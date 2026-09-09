set search_path = public, extensions, pg_catalog;

-- Production-only hardening. This migration never copies or mutates operational
-- records from the test project and is safe to run more than once.
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create table if not exists public.case_lab_3_idempotency_records (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  scope text not null check (scope in ('order', 'payment', 'ticket', 'email', 'fiscal', 'worker')),
  idempotency_key text not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null default '{}'::jsonb check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  unique (environment, scope, idempotency_key)
);

create index if not exists case_lab_3_idempotency_records_expiry_idx
  on public.case_lab_3_idempotency_records (environment, expires_at)
  where expires_at is not null;

alter table public.case_lab_3_idempotency_records enable row level security;
revoke all on public.case_lab_3_idempotency_records from anon, authenticated;
grant select, insert, update, delete on public.case_lab_3_idempotency_records to service_role;

-- Preserve only bounded fiscal metadata required by CRM reconciliation.
create or replace function public.case_lab_3_sanitize_provider_fields(
  p_fields jsonb,
  p_context text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_allowed text[];
begin
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    return '{}'::jsonb;
  end if;

  v_allowed := case p_context
    when 'provider' then array[
      'invoiceId', 'accountId', 'transactionId', 'paymentTransactionId', 'refundTransactionId',
      'operationType', 'status', 'failureCode', 'amountMinor', 'currency', 'testMode'
    ]::text[]
    when 'receipt' then array[
      'receiptId', 'kassirReceiptId', 'receiptStatus', 'status', 'type', 'amountMinor',
      'operationKey', 'receiptUrl', 'fiscalDocumentNumber', 'fiscalSign', 'fiscalNumber',
      'ofd', 'ofdUrl', 'qrUrl'
    ]::text[]
    when 'conflict' then array[
      'reason', 'providerEventId', 'bodyHash', 'externalId', 'providerTransactionId',
      'paymentProviderTransactionId', 'operationKey', 'amountMinor', 'expectedAmountMinor',
      'actualAmountMinor', 'currency', 'receiptType', 'failureCode',
      'expectedProviderTransactionId', 'actualProviderTransactionId'
    ]::text[]
    else array[]::text[]
  end;

  return coalesce(
    (
      select jsonb_object_agg(
        entry.key,
        case
          when jsonb_typeof(entry.value) = 'string'
            then to_jsonb(public.case_lab_3_sanitize_bounded_text(entry.value #>> '{}', 256))
          else entry.value
        end
      )
      from jsonb_each(p_fields) as entry(key, value)
      where entry.key = any(v_allowed)
        and jsonb_typeof(entry.value) in ('string', 'number', 'boolean', 'null')
        and (
          jsonb_typeof(entry.value) <> 'string'
          or length(entry.value #>> '{}') <= 256
        )
    ),
    '{}'::jsonb
  );
end;
$$;

revoke all on function public.case_lab_3_sanitize_provider_fields(jsonb, text) from public, anon, authenticated;
grant execute on function public.case_lab_3_sanitize_provider_fields(jsonb, text) to service_role;

-- Live fiscal policy mirrors the production payload contract but remains
-- isolated from the automated test policy and all test records.
with policy_definition(definition) as (
  values (
    $$[
      {"purpose":"payment_income","trigger":"payment_confirmed","depends_on_purpose":null,"provider_receipt_type":"Income","payload_fields":{"vat":"omitted_or_null","taxation_system":0,"calculation_place":"caselab.kz","calculation_method":"full_payment"},"schedule":"immediate"},
      {"purpose":"refund_income_return","trigger":"refund_confirmed","depends_on_purpose":"payment_income","provider_receipt_type":"IncomeReturn","payload_fields":{"vat":"omitted_or_null","taxation_system":0,"calculation_place":"caselab.kz","calculation_method":"full_payment"},"schedule":"after_dependency"}
    ]$$::jsonb
  )
)
insert into public.case_lab_3_fiscal_policy_versions (
  id, environment, version_number, policy_key, policy_status, is_test_policy,
  is_accountant_approved, required_purposes, policy_definition, policy_hash,
  approved_at, approved_by
)
select
  '00000000-0000-4000-8000-000000000302'::uuid,
  'live', 1, 'case-lab-3-production', 'approved', false, true,
  array['payment_income', 'refund_income_return']::text[], definition,
  encode(digest(definition::text, 'sha256'), 'hex'),
  '2026-09-09 00:00:00 Asia/Almaty'::timestamptz,
  'case-lab-production'
from policy_definition
on conflict (environment, policy_key) do nothing;

update public.case_lab_3_event_settings
set active_fiscal_policy_version_id = '00000000-0000-4000-8000-000000000302'::uuid,
    sales_enabled = false,
    calculation_place = 'caselab.kz'
where environment = 'live';

update public.case_lab_3_event_settings
set sales_enabled = false
where environment = 'test';

create or replace function public.case_lab_3_install_live_worker_schedule()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_worker_url text;
  v_cron_secret text;
  v_worker_job_id bigint;
begin
  select nullif(btrim(decrypted_secret), '') into v_worker_url
  from vault.decrypted_secrets where name = 'case_lab_3_worker_url';
  select nullif(btrim(decrypted_secret), '') into v_cron_secret
  from vault.decrypted_secrets where name = 'case_lab_3_cron_secret';

  if v_worker_url is null
     or v_worker_url not in (
       'https://caselab.kz/api/internal/case-lab-3/jobs',
       'https://caselab.kz/api/internal/case-lab-3/jobs/',
       'https://www.caselab.kz/api/internal/case-lab-3/jobs',
       'https://www.caselab.kz/api/internal/case-lab-3/jobs/'
     )
     or v_cron_secret is null
     or length(v_cron_secret) < 32
     or v_cron_secret ~ '[[:cntrl:]]' then
    raise exception 'case lab 3 production worker Vault configuration is incomplete'
      using errcode = '22023';
  end if;

  select jobid into v_worker_job_id from cron.job where jobname = 'case-lab-3-worker-live';
  if v_worker_job_id is not null then perform cron.unschedule(v_worker_job_id); end if;

  v_worker_job_id := cron.schedule(
    'case-lab-3-worker-live', '* * * * *',
    $worker$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'case_lab_3_worker_url'),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', concat('Bearer ', (select decrypted_secret from vault.decrypted_secrets where name = 'case_lab_3_cron_secret'))
        ),
        body := '{"environment":"live"}'::jsonb
      ) as request_id;
    $worker$
  );

  return jsonb_build_object('kind', 'installed', 'environment', 'live', 'workerJobId', v_worker_job_id);
end;
$$;

revoke all on function public.case_lab_3_install_live_worker_schedule() from public, anon, authenticated;
grant execute on function public.case_lab_3_install_live_worker_schedule() to service_role;
