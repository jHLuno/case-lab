create extension if not exists pgcrypto;
set search_path = public, extensions, pg_catalog;

create or replace function public.case_lab_3_set_updated_at()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  new.updated_at = clock_timestamp();
  return new;
end;
$$;

create or replace function public.case_lab_3_reject_immutable_change()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  raise exception 'Case Lab III versioned rows are immutable'
    using errcode = '55000';
end;
$$;

create or replace function public.case_lab_3_guard_sales_enabled()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if tg_op = 'UPDATE' and new.configuration_version < old.configuration_version then
    raise exception 'Case Lab III configuration_version cannot decrease'
      using errcode = '23514';
  end if;

  if new.sales_enabled then
    if new.active_fiscal_policy_version_id is null
       or not exists (
         select 1
         from public.case_lab_3_fiscal_policy_versions policy
         where policy.id = new.active_fiscal_policy_version_id
           and policy.environment = new.environment
           and policy.policy_status = 'approved'
           and policy.is_accountant_approved
           and policy.approved_at is not null
           and policy.approved_by is not null
           and policy.required_purposes @> array['payment_income', 'refund_income_return']::text[]
           and public.case_lab_3_is_supported_fiscal_policy(policy.id, policy.environment)
       ) then
      raise exception 'Case Lab III sales require an approved complete fiscal policy'
        using errcode = '23514';
    end if;

    if new.environment = 'live'
       and exists (
         select 1
         from public.case_lab_3_fiscal_policy_versions policy
         where policy.id = new.active_fiscal_policy_version_id
           and (policy.is_test_policy or policy.approved_by = 'automated-test')
       ) then
      raise exception 'Live sales cannot use the automated test fiscal policy'
        using errcode = '23514';
    end if;

    if new.active_offer_version_id is null
       or not exists (
         select 1
         from public.case_lab_3_legal_document_versions document
         where document.id = new.active_offer_version_id
           and document.environment = new.environment
           and document.document_kind = 'offer'
           and document.is_active
           and document.activated_at is not null
       )
       or new.active_privacy_version_id is null
       or not exists (
         select 1
         from public.case_lab_3_legal_document_versions document
         where document.id = new.active_privacy_version_id
           and document.environment = new.environment
           and document.document_kind = 'privacy'
           and document.is_active
           and document.activated_at is not null
       ) then
      raise exception 'Case Lab III sales require active offer and privacy versions'
        using errcode = '23514';
    end if;
  end if;

  return new;
end;
$$;

create table public.case_lab_3_fiscal_policy_versions (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  version_number integer not null check (version_number > 0),
  policy_key text not null,
  policy_status text not null default 'draft',
  is_test_policy boolean not null default false,
  is_accountant_approved boolean not null default false,
  required_purposes text[] not null,
  policy_definition jsonb not null,
  policy_hash text not null check (policy_hash ~ '^[0-9a-f]{64}$'),
  approved_at timestamptz,
  approved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (policy_hash = encode(digest(policy_definition::text, 'sha256'), 'hex')),
  constraint case_lab_3_fiscal_policy_versions_id_environment_key unique (id, environment),
  unique (environment, version_number),
  unique (environment, policy_key),
  constraint case_lab_3_fiscal_policy_versions_policy_status_check
    check (policy_status in ('draft', 'approved', 'retired')),
  check ('payment_income' = any(required_purposes)),
  check ('refund_income_return' = any(required_purposes)),
  check (
    (is_accountant_approved and approved_at is not null and approved_by is not null)
    or not is_accountant_approved
  ),
  check (not is_test_policy or environment = 'test'),
  check (is_test_policy or approved_by is distinct from 'automated-test'),
  check (policy_status <> 'approved' or is_accountant_approved)
);

create table public.case_lab_3_legal_document_versions (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  document_kind text not null check (document_kind in ('offer', 'privacy')),
  version_id text not null,
  url text not null,
  publication_label text not null,
  content_snapshot text not null check (char_length(content_snapshot) > 0),
  content_hash text not null
    constraint case_lab_3_legal_document_versions_content_hash_format_check
    check (content_hash ~ '^[0-9a-f]{64}$'),
  is_active boolean not null default false,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_legal_document_versions_id_environment_key unique (id, environment),
  unique (environment, document_kind, version_id),
  unique (environment, document_kind, content_hash),
  constraint case_lab_3_legal_document_versions_content_hash_check
    check (content_hash = encode(digest(content_snapshot, 'sha256'), 'hex')),
  check ((is_active and activated_at is not null) or not is_active)
);

create table public.case_lab_3_event_settings (
  id uuid primary key default gen_random_uuid(),
  environment text not null unique check (environment in ('test', 'live')),
  early_bird_amount_minor bigint not null check (early_bird_amount_minor >= 0),
  standard_amount_minor bigint not null check (standard_amount_minor >= 0),
  early_bird_quota integer not null check (early_bird_quota >= 0),
  online_sales_limit integer not null check (online_sales_limit > 0),
  venue_capacity integer not null check (venue_capacity > 0),
  sales_cutoff timestamptz not null,
  sales_enabled boolean not null default false,
  seller_label text not null default 'IP Case Lab',
  taxation_system smallint not null default 0 check (taxation_system >= 0),
  vat_rate numeric(5, 2) check (vat_rate is null or vat_rate > 0),
  early_bird_receipt_label text not null default 'Участие в Case Lab III, 24.09.2026, Early Bird',
  standard_receipt_label text not null default 'Участие в Case Lab III, 24.09.2026, Стандарт',
  calculation_place text not null default 'caselab.kz',
  active_fiscal_policy_version_id uuid,
  active_offer_version_id uuid,
  active_privacy_version_id uuid,
  configuration_version bigint not null default 1 check (configuration_version > 0),
  latest_worker_heartbeat_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_settings_fiscal_policy_environment_fk
    foreign key (active_fiscal_policy_version_id, environment)
    references public.case_lab_3_fiscal_policy_versions(id, environment),
  constraint case_lab_3_settings_offer_environment_fk
    foreign key (active_offer_version_id, environment)
    references public.case_lab_3_legal_document_versions(id, environment),
  constraint case_lab_3_settings_privacy_environment_fk
    foreign key (active_privacy_version_id, environment)
    references public.case_lab_3_legal_document_versions(id, environment),
  check (online_sales_limit <= venue_capacity),
  check (standard_amount_minor >= early_bird_amount_minor)
);

create table public.case_lab_3_inventory_allocations (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  allocation_category text not null
    check (allocation_category in ('paid', 'invited', 'organizer_reserved')),
  quantity integer not null check (quantity > 0),
  tier text check (tier is null or tier in ('early_bird', 'standard')),
  counts_toward_online_limit boolean not null default false,
  holds_early_bird_quota boolean not null default false,
  ticket_id uuid,
  reason text not null,
  actor_label text not null,
  released_at timestamptz,
  released_by text,
  release_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (not holds_early_bird_quota or tier = 'early_bird'),
  check ((released_at is null and released_by is null and release_reason is null)
    or (released_at is not null and released_by is not null and release_reason is not null))
);

create table public.case_lab_3_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  idempotency_key text not null,
  environment text not null check (environment in ('test', 'live')),
  order_type text not null default 'single_ticket' check (order_type = 'single_ticket'),
  first_name text not null,
  last_name text not null,
  participant_email text not null,
  phone text,
  company text,
  position text,
  purchaser_email text not null,
  fiscal_email text not null,
  original_contact_snapshot jsonb not null,
  tier text not null check (tier in ('early_bird', 'standard')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'KZT' check (currency = 'KZT'),
  receipt_label text not null,
  taxation_system smallint not null default 0 check (taxation_system >= 0),
  vat_rate numeric(5, 2) check (vat_rate is null or vat_rate > 0),
  configuration_version bigint not null check (configuration_version > 0),
  offer_version_id uuid not null,
  privacy_version_id uuid not null,
  accepted_at timestamptz not null,
  marketing_consent boolean not null default false,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  referrer text,
  ga_client_id text,
  payment_status text not null default 'pending',
  ticket_status text not null default 'pending',
  receipt_status text not null default 'not_requested',
  email_status text not null default 'pending',
  paid_amount_minor bigint not null default 0 check (paid_amount_minor >= 0),
  refunded_amount_minor bigint not null default 0 check (refunded_amount_minor >= 0),
  refundable_amount_minor bigint not null default 0 check (refundable_amount_minor >= 0),
  order_access_token_version integer not null default 1 check (order_access_token_version > 0),
  order_access_revoked_at timestamptz,
  reservation_expires_at timestamptz,
  paid_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_orders_id_environment_key unique (id, environment),
  constraint case_lab_3_orders_offer_environment_fk
    foreign key (offer_version_id, environment)
    references public.case_lab_3_legal_document_versions(id, environment),
  constraint case_lab_3_orders_privacy_environment_fk
    foreign key (privacy_version_id, environment)
    references public.case_lab_3_legal_document_versions(id, environment),
  constraint case_lab_3_orders_ticket_status_check
    check (ticket_status in ('pending', 'valid', 'used', 'cancelled')),
  constraint case_lab_3_orders_payment_status_check
    check (payment_status in ('pending', 'processing', 'paid', 'failed', 'refund_pending', 'partially_refunded', 'refunded', 'review_required')),
  constraint case_lab_3_orders_receipt_status_check
    check (receipt_status in ('not_requested', 'queued', 'issued', 'error', 'unknown')),
  constraint case_lab_3_orders_email_status_check
    check (email_status in ('pending', 'sent', 'failed', 'unknown')),
  unique (environment, idempotency_key),
  check (paid_amount_minor <= amount_minor),
  check (refunded_amount_minor <= paid_amount_minor),
  check (refundable_amount_minor <= amount_minor),
  check (vat_rate is null or vat_rate > 0)
);

create table public.case_lab_3_reservations (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique,
  environment text not null check (environment in ('test', 'live')),
  tier text not null check (tier in ('early_bird', 'standard')),
  expires_at timestamptz not null,
  status text not null default 'active',
  admitted_payment_attempt_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_reservations_id_environment_key unique (id, environment),
  constraint case_lab_3_reservations_id_order_environment_key unique (id, order_id, environment),
  constraint case_lab_3_reservations_order_environment_fk
    foreign key (order_id, environment)
    references public.case_lab_3_orders(id, environment),
  constraint case_lab_3_reservations_status_check
    check (status in ('active', 'processing', 'consumed', 'expired', 'released'))
);

create table public.case_lab_3_payment_attempts (
  id uuid primary key default gen_random_uuid(),
  external_id text not null,
  order_id uuid not null,
  reservation_id uuid not null,
  environment text not null check (environment in ('test', 'live')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'KZT' check (currency = 'KZT'),
  provider_transaction_id text,
  status text not null default 'created',
  failure_code text,
  failure_reason text,
  check_approved_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_payment_attempts_id_environment_key unique (id, environment),
  constraint case_lab_3_payment_attempts_id_order_environment_key unique (id, order_id, environment),
  constraint case_lab_3_payment_attempts_order_environment_fk
    foreign key (order_id, environment)
    references public.case_lab_3_orders(id, environment),
  constraint case_lab_3_payment_attempts_reservation_environment_fk
    foreign key (reservation_id, order_id, environment)
    references public.case_lab_3_reservations(id, order_id, environment),
  constraint case_lab_3_payment_attempts_status_check
    check (status in ('created', 'check_approved', 'completed', 'failed', 'review_required')),
  unique (environment, external_id)
);

create table public.case_lab_3_provider_events (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  provider text not null check (provider in ('tiptoppay', 'kassir')),
  event_type text not null,
  provider_event_id text,
  external_id text,
  provider_transaction_id text,
  order_id uuid,
  payment_attempt_id uuid,
  refund_id uuid,
  body_hash text not null check (body_hash ~ '^[0-9a-f]{64}$'),
  verified_at timestamptz not null,
  sanitized_fields jsonb not null default '{}'::jsonb,
  processing_result text not null,
  incident_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_provider_events_id_environment_key unique (id, environment),
  constraint case_lab_3_provider_events_order_environment_fk
    foreign key (order_id, environment)
    references public.case_lab_3_orders(id, environment),
  check (payment_attempt_id is null or order_id is not null),
  check (refund_id is null or order_id is not null),
  unique (environment, provider, body_hash),
  unique (environment, provider, provider_event_id)
);

create table public.case_lab_3_fiscal_operations (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  order_id uuid not null,
  payment_attempt_id uuid,
  refund_id uuid,
  fiscal_policy_version_id uuid not null,
  policy_purpose text not null check (policy_purpose in ('payment_income', 'service_settlement_income', 'refund_income_return')),
  provider_receipt_type text not null check (provider_receipt_type in ('Income', 'IncomeReturn')),
  amount_minor bigint not null check (amount_minor >= 0),
  currency text not null default 'KZT' check (currency = 'KZT'),
  payload_snapshot jsonb not null,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  operation_key text not null,
  kassir_receipt_id text,
  receipt_url text,
  fiscal_fields jsonb not null default '{}'::jsonb,
  status text not null default 'not_requested',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  last_error text,
  issued_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_fiscal_operations_id_environment_key unique (id, environment),
  constraint case_lab_3_fiscal_operations_order_environment_fk
    foreign key (order_id, environment)
    references public.case_lab_3_orders(id, environment),
  constraint case_lab_3_fiscal_operations_attempt_environment_fk
    foreign key (payment_attempt_id, order_id, environment)
    references public.case_lab_3_payment_attempts(id, order_id, environment),
  constraint case_lab_3_fiscal_operations_policy_environment_fk
    foreign key (fiscal_policy_version_id, environment)
    references public.case_lab_3_fiscal_policy_versions(id, environment),
  constraint case_lab_3_fiscal_operations_status_check
    check (status in ('not_requested', 'queued', 'issued', 'error', 'unknown')),
  unique (environment, operation_key)
);

create table public.case_lab_3_tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique,
  environment text not null check (environment in ('test', 'live')),
  public_ticket_number text not null unique,
  current_revision_id uuid,
  status text not null default 'valid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_tickets_id_environment_key unique (id, environment),
  constraint case_lab_3_tickets_id_order_environment_key unique (id, order_id, environment),
  constraint case_lab_3_tickets_order_environment_fk
    foreign key (order_id, environment)
    references public.case_lab_3_orders(id, environment),
  constraint case_lab_3_tickets_status_check
    check (status in ('valid', 'used', 'cancelled'))
);

create table public.case_lab_3_ticket_revisions (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  environment text not null check (environment in ('test', 'live')),
  revision_number integer not null check (revision_number > 0),
  first_name text not null,
  last_name text not null,
  participant_email text not null,
  phone text,
  company text,
  position text,
  token_version integer not null default 1 check (token_version > 0),
  creation_reason text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_ticket_revisions_id_environment_key unique (id, environment),
  constraint case_lab_3_ticket_revisions_id_ticket_environment_key unique (id, ticket_id, environment),
  constraint case_lab_3_ticket_revisions_ticket_id_environment_key unique (ticket_id, id, environment),
  constraint case_lab_3_ticket_revisions_ticket_environment_fk
    foreign key (ticket_id, environment)
    references public.case_lab_3_tickets(id, environment),
  unique (ticket_id, revision_number),
  unique (ticket_id, token_version)
);

create table public.case_lab_3_check_ins (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null,
  ticket_revision_id uuid not null,
  environment text not null check (environment in ('test', 'live')),
  checked_in_by text not null,
  checked_in_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_check_ins_id_environment_key unique (id, environment),
  constraint case_lab_3_check_ins_ticket_environment_fk
    foreign key (ticket_id, environment)
    references public.case_lab_3_tickets(id, environment),
  constraint case_lab_3_check_ins_revision_environment_fk
    foreign key (ticket_id, ticket_revision_id, environment)
    references public.case_lab_3_ticket_revisions(ticket_id, id, environment),
  unique (ticket_id)
);

create table public.case_lab_3_refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  payment_attempt_id uuid,
  environment text not null check (environment in ('test', 'live')),
  operation_key text not null,
  provider_transaction_id text,
  payment_provider_transaction_id text,
  refund_type text not null check (refund_type in ('full', 'partial')),
  amount_minor bigint not null check (amount_minor >= 0),
  remaining_refundable_amount_minor bigint not null default 0
    check (remaining_refundable_amount_minor >= 0),
  currency text not null default 'KZT' check (currency = 'KZT'),
  status text not null default 'requested',
  reason text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  last_error text,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_refunds_id_environment_key unique (id, environment),
  constraint case_lab_3_refunds_id_order_environment_key unique (id, order_id, environment),
  constraint case_lab_3_refunds_order_environment_fk
    foreign key (order_id, environment)
    references public.case_lab_3_orders(id, environment),
  constraint case_lab_3_refunds_attempt_environment_fk
    foreign key (payment_attempt_id, order_id, environment)
    references public.case_lab_3_payment_attempts(id, order_id, environment),
  constraint case_lab_3_refunds_status_check
    check (status in ('requested', 'processing', 'confirmed', 'failed', 'unknown', 'review_required')),
  unique (environment, operation_key),
  check (remaining_refundable_amount_minor <= amount_minor)
);

create table public.case_lab_3_jobs (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  job_type text not null check (job_type in (
    'issue_fiscal_operation',
    'poll_receipt',
    'send_ticket_email',
    'send_refund_notification',
    'initiate_refund',
    'reconcile_payment',
    'send_analytics_event',
    'send_organizer_alert',
    'daily_provider_reconciliation'
  )),
  logical_key text not null,
  payload_reference jsonb not null default '{}'::jsonb,
  order_id uuid,
  ticket_id uuid,
  refund_id uuid,
  status text not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default now(),
  leased_until timestamptz,
  lease_token uuid,
  result jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_jobs_id_environment_key unique (id, environment),
  constraint case_lab_3_jobs_order_environment_fk
    foreign key (order_id, environment)
    references public.case_lab_3_orders(id, environment),
  constraint case_lab_3_jobs_ticket_environment_fk
    foreign key (ticket_id, order_id, environment)
    references public.case_lab_3_tickets(id, order_id, environment),
  constraint case_lab_3_jobs_refund_environment_fk
    foreign key (refund_id, order_id, environment)
    references public.case_lab_3_refunds(id, order_id, environment),
  constraint case_lab_3_jobs_status_check
    check (status in ('pending', 'leased', 'completed', 'failed', 'unknown')),
  check (ticket_id is null or order_id is not null),
  check (refund_id is null or order_id is not null),
  unique (environment, logical_key)
);

create table public.case_lab_3_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  operation_key text not null,
  delivery_kind text not null check (delivery_kind in ('ticket', 'refund_notification', 'organizer_alert')),
  order_id uuid,
  ticket_id uuid,
  ticket_revision_id uuid,
  recipient_email text not null,
  status text not null default 'pending',
  transport_message_id text,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_email_deliveries_id_environment_key unique (id, environment),
  constraint case_lab_3_email_deliveries_order_environment_fk
    foreign key (order_id, environment)
    references public.case_lab_3_orders(id, environment),
  constraint case_lab_3_email_deliveries_ticket_environment_fk
    foreign key (ticket_id, order_id, environment)
    references public.case_lab_3_tickets(id, order_id, environment),
  constraint case_lab_3_email_deliveries_revision_environment_fk
    foreign key (ticket_revision_id, ticket_id, environment)
    references public.case_lab_3_ticket_revisions(id, ticket_id, environment),
  constraint case_lab_3_email_deliveries_status_check
    check (status in ('pending', 'sent', 'failed', 'unknown')),
  check (ticket_id is null or order_id is not null),
  check (ticket_revision_id is null or ticket_id is not null),
  unique (environment, operation_key)
);

create table public.case_lab_3_analytics_events (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  event_key text not null,
  event_name text not null check (event_name in ('purchase', 'refund')),
  order_id uuid,
  refund_id uuid,
  ga_client_id text,
  payload_snapshot jsonb not null default '{}'::jsonb,
  delivery_status text not null default 'pending',
  attempt_count integer not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz,
  last_error text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_analytics_events_id_environment_key unique (id, environment),
  constraint case_lab_3_analytics_events_order_environment_fk
    foreign key (order_id, environment)
    references public.case_lab_3_orders(id, environment),
  constraint case_lab_3_analytics_events_refund_environment_fk
    foreign key (refund_id, order_id, environment)
    references public.case_lab_3_refunds(id, order_id, environment),
  constraint case_lab_3_analytics_events_delivery_status_check
    check (delivery_status in ('pending', 'sent', 'failed', 'unknown')),
  check (refund_id is null or order_id is not null),
  unique (environment, event_key)
);

create table public.case_lab_3_incidents (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  incident_type text not null check (incident_type in (
    'unexpected_payment',
    'unknown_provider_result',
    'overdue_receipt',
    'overdue_email',
    'reconciliation_mismatch'
  )),
  status text not null default 'open'
    check (status in ('open', 'investigating', 'resolved', 'ignored')),
  order_id uuid,
  payment_attempt_id uuid,
  refund_id uuid,
  provider_event_id uuid,
  summary jsonb not null default '{}'::jsonb,
  resolution text,
  resolved_at timestamptz,
  resolved_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_incidents_id_environment_key unique (id, environment),
  constraint case_lab_3_incidents_order_environment_fk
    foreign key (order_id, environment)
    references public.case_lab_3_orders(id, environment),
  constraint case_lab_3_incidents_attempt_environment_fk
    foreign key (payment_attempt_id, order_id, environment)
    references public.case_lab_3_payment_attempts(id, order_id, environment),
  constraint case_lab_3_incidents_refund_environment_fk
    foreign key (refund_id, order_id, environment)
    references public.case_lab_3_refunds(id, order_id, environment),
  check (payment_attempt_id is null or order_id is not null),
  check (refund_id is null or order_id is not null)
);

create table public.case_lab_3_audit_log (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  action text not null,
  target_table text not null,
  target_id uuid,
  before_summary jsonb,
  after_summary jsonb,
  actor_id text not null,
  actor_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_audit_log_id_environment_key unique (id, environment)
);

create table public.case_lab_3_rate_limits (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  purpose_ip_hash text not null check (purpose_ip_hash ~ '^[0-9a-f]{64}$'),
  bucket_start timestamptz not null,
  limit_count integer not null check (limit_count > 0),
  used_count integer not null default 0 check (used_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scope, purpose_ip_hash, bucket_start),
  check (used_count <= limit_count)
);

create table public.case_lab_3_reconciliation_state (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  provider text not null check (provider in ('tiptoppay', 'kassir')),
  high_water_mark timestamptz,
  pagination_cursor text,
  last_run_at timestamptz,
  last_success_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_reconciliation_state_id_environment_key unique (id, environment),
  unique (environment, provider)
);

create or replace function public.case_lab_3_is_supported_fiscal_policy(
  p_policy_id uuid,
  p_environment text
)
returns boolean
language sql
stable
set search_path = public, extensions, pg_catalog
as $$
  select exists (
    select 1
    from public.case_lab_3_fiscal_policy_versions policy
    where policy.id = p_policy_id
      and policy.environment = p_environment
      and policy.required_purposes = array['payment_income', 'refund_income_return']::text[]
      and case
        when jsonb_typeof(policy.policy_definition) = 'array'
          then jsonb_array_length(policy.policy_definition)
        else 0
      end = 2
      and (
        select count(*)
        from jsonb_array_elements(
           case
             when jsonb_typeof(policy.policy_definition) = 'array'
               then policy.policy_definition
             else '[]'::jsonb
           end
         ) stage
         where jsonb_typeof(stage) = 'object'
           and (
             select count(*)
             from jsonb_object_keys(
               case
                 when jsonb_typeof(stage) = 'object' then stage
                 else '{}'::jsonb
               end
             )
           ) = 6
          and stage ?& array[
           'purpose', 'trigger', 'depends_on_purpose',
            'provider_receipt_type', 'payload_fields', 'schedule'
          ]
           and jsonb_typeof(stage->'payload_fields') = 'object'
           and (
             select count(*)
             from jsonb_object_keys(
               case
                 when jsonb_typeof(stage->'payload_fields') = 'object'
                   then stage->'payload_fields'
                 else '{}'::jsonb
               end
             )
           ) = 4
          and stage->'payload_fields' ?& array[
            'vat', 'taxation_system', 'calculation_place', 'calculation_method'
          ]
          and stage->'payload_fields'->>'vat' = 'omitted_or_null'
          and stage->'payload_fields'->>'taxation_system' = '0'
          and stage->'payload_fields'->>'calculation_place' = 'caselab.kz'
          and stage->'payload_fields'->>'calculation_method' = 'full_payment'
          and (
            (
              stage->>'purpose' = 'payment_income'
              and stage->>'trigger' = 'payment_confirmed'
              and stage->'depends_on_purpose' = 'null'::jsonb
              and stage->>'provider_receipt_type' = 'Income'
              and stage->>'schedule' = 'immediate'
            )
            or (
              stage->>'purpose' = 'refund_income_return'
              and stage->>'trigger' = 'refund_confirmed'
              and stage->>'depends_on_purpose' = 'payment_income'
              and stage->>'provider_receipt_type' = 'IncomeReturn'
              and stage->>'schedule' = 'after_dependency'
            )
          )
      ) = 2
      and exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(policy.policy_definition) = 'array'
              then policy.policy_definition
            else '[]'::jsonb
          end
        ) stage
        where stage->>'purpose' = 'payment_income'
      )
      and exists (
        select 1
        from jsonb_array_elements(
          case
            when jsonb_typeof(policy.policy_definition) = 'array'
              then policy.policy_definition
            else '[]'::jsonb
          end
        ) stage
        where stage->>'purpose' = 'refund_income_return'
      )
  );
$$;

alter table public.case_lab_3_inventory_allocations
  add constraint case_lab_3_inventory_allocations_ticket_environment_fk
  foreign key (ticket_id, environment)
  references public.case_lab_3_tickets(id, environment);

alter table public.case_lab_3_reservations
  add constraint case_lab_3_reservations_admitted_attempt_environment_fk
  foreign key (admitted_payment_attempt_id, order_id, environment)
  references public.case_lab_3_payment_attempts(id, order_id, environment);

alter table public.case_lab_3_provider_events
  add constraint case_lab_3_provider_events_attempt_environment_fk
  foreign key (payment_attempt_id, order_id, environment)
  references public.case_lab_3_payment_attempts(id, order_id, environment);

alter table public.case_lab_3_provider_events
  add constraint case_lab_3_provider_events_refund_environment_fk
  foreign key (refund_id, order_id, environment)
  references public.case_lab_3_refunds(id, order_id, environment);

alter table public.case_lab_3_provider_events
  add constraint case_lab_3_provider_events_incident_environment_fk
  foreign key (incident_id, environment)
  references public.case_lab_3_incidents(id, environment);

alter table public.case_lab_3_fiscal_operations
  add constraint case_lab_3_fiscal_operations_refund_environment_fk
  foreign key (refund_id, order_id, environment)
  references public.case_lab_3_refunds(id, order_id, environment);

alter table public.case_lab_3_tickets
  add constraint case_lab_3_tickets_current_revision_environment_fk
  foreign key (id, current_revision_id, environment)
  references public.case_lab_3_ticket_revisions(ticket_id, id, environment);

alter table public.case_lab_3_incidents
  add constraint case_lab_3_incidents_provider_event_environment_fk
  foreign key (provider_event_id, environment)
  references public.case_lab_3_provider_events(id, environment);

create unique index case_lab_3_payment_attempts_provider_transaction_uidx
  on public.case_lab_3_payment_attempts (environment, provider_transaction_id)
  where provider_transaction_id is not null;

create unique index case_lab_3_refunds_provider_transaction_uidx
  on public.case_lab_3_refunds (environment, provider_transaction_id)
  where provider_transaction_id is not null;

create index case_lab_3_tickets_uuid_revision_idx
  on public.case_lab_3_tickets (id, current_revision_id);

create index case_lab_3_ticket_revisions_ticket_revision_idx
  on public.case_lab_3_ticket_revisions (ticket_id, revision_number);

create index case_lab_3_orders_environment_status_idx
  on public.case_lab_3_orders (environment, payment_status, created_at);

create index case_lab_3_reservations_environment_status_idx
  on public.case_lab_3_reservations (environment, status, expires_at);

create index case_lab_3_jobs_due_idx
  on public.case_lab_3_jobs (environment, status, available_at, leased_until);

create index case_lab_3_provider_events_transaction_idx
  on public.case_lab_3_provider_events (environment, provider_transaction_id);

create index case_lab_3_audit_log_target_idx
  on public.case_lab_3_audit_log (environment, target_table, target_id, created_at);

create index case_lab_3_incidents_status_idx
  on public.case_lab_3_incidents (environment, status, created_at);

create trigger case_lab_3_fiscal_policy_versions_updated_at
before update on public.case_lab_3_fiscal_policy_versions
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_legal_document_versions_updated_at
before update on public.case_lab_3_legal_document_versions
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_event_settings_updated_at
before update on public.case_lab_3_event_settings
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_inventory_allocations_updated_at
before update on public.case_lab_3_inventory_allocations
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_orders_updated_at
before update on public.case_lab_3_orders
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_reservations_updated_at
before update on public.case_lab_3_reservations
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_payment_attempts_updated_at
before update on public.case_lab_3_payment_attempts
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_provider_events_updated_at
before update on public.case_lab_3_provider_events
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_fiscal_operations_updated_at
before update on public.case_lab_3_fiscal_operations
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_tickets_updated_at
before update on public.case_lab_3_tickets
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_ticket_revisions_updated_at
before update on public.case_lab_3_ticket_revisions
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_check_ins_updated_at
before update on public.case_lab_3_check_ins
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_refunds_updated_at
before update on public.case_lab_3_refunds
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_jobs_updated_at
before update on public.case_lab_3_jobs
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_email_deliveries_updated_at
before update on public.case_lab_3_email_deliveries
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_analytics_events_updated_at
before update on public.case_lab_3_analytics_events
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_incidents_updated_at
before update on public.case_lab_3_incidents
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_audit_log_updated_at
before update on public.case_lab_3_audit_log
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_rate_limits_updated_at
before update on public.case_lab_3_rate_limits
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_reconciliation_state_updated_at
before update on public.case_lab_3_reconciliation_state
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_guard_event_settings_sales
before insert or update on public.case_lab_3_event_settings
for each row execute function public.case_lab_3_guard_sales_enabled();

create trigger case_lab_3_immutable_fiscal_policy_versions
before update or delete on public.case_lab_3_fiscal_policy_versions
for each row execute function public.case_lab_3_reject_immutable_change();

create trigger case_lab_3_immutable_legal_document_versions
before update or delete on public.case_lab_3_legal_document_versions
for each row execute function public.case_lab_3_reject_immutable_change();

create trigger case_lab_3_immutable_ticket_revisions
before update or delete on public.case_lab_3_ticket_revisions
for each row execute function public.case_lab_3_reject_immutable_change();

create trigger case_lab_3_immutable_audit_log
before update or delete on public.case_lab_3_audit_log
for each row execute function public.case_lab_3_reject_immutable_change();

with policy_definition(definition) as (
  values (
    $$[
      {"purpose":"payment_income","trigger":"payment_confirmed","depends_on_purpose":null,"provider_receipt_type":"Income","payload_fields":{"vat":"omitted_or_null","taxation_system":0,"calculation_place":"caselab.kz","calculation_method":"full_payment"},"schedule":"immediate"},
      {"purpose":"refund_income_return","trigger":"refund_confirmed","depends_on_purpose":"payment_income","provider_receipt_type":"IncomeReturn","payload_fields":{"vat":"omitted_or_null","taxation_system":0,"calculation_place":"caselab.kz","calculation_method":"full_payment"},"schedule":"after_dependency"}
    ]$$::jsonb
  )
)
insert into public.case_lab_3_fiscal_policy_versions (
  id,
  environment,
  version_number,
  policy_key,
  policy_status,
  is_test_policy,
  is_accountant_approved,
  required_purposes,
  policy_definition,
  policy_hash,
  approved_at,
  approved_by
)
select
  '00000000-0000-4000-8000-000000000301'::uuid,
  'test',
  1,
  'case-lab-3-test-automated',
  'approved',
  true,
  true,
  array['payment_income', 'refund_income_return']::text[],
  definition,
  encode(digest(definition::text, 'sha256'), 'hex'),
  '2026-09-07 00:00:00 Asia/Almaty'::timestamptz,
  'automated-test'
from policy_definition;

insert into public.case_lab_3_event_settings (
  environment,
  early_bird_amount_minor,
  standard_amount_minor,
  early_bird_quota,
  online_sales_limit,
  venue_capacity,
  sales_cutoff,
  sales_enabled,
  active_fiscal_policy_version_id
)
values
  (
    'test',
    789000,
    1500000,
    20,
    70,
    100,
    '2026-09-24 00:00:00 Asia/Almaty'::timestamptz,
    false,
    '00000000-0000-4000-8000-000000000301'::uuid
  ),
  (
    'live',
    789000,
    1500000,
    20,
    70,
    100,
    '2026-09-24 00:00:00 Asia/Almaty'::timestamptz,
    false,
    null
  );

revoke all on table
  public.case_lab_3_event_settings,
  public.case_lab_3_fiscal_policy_versions,
  public.case_lab_3_inventory_allocations,
  public.case_lab_3_legal_document_versions,
  public.case_lab_3_orders,
  public.case_lab_3_reservations,
  public.case_lab_3_payment_attempts,
  public.case_lab_3_provider_events,
  public.case_lab_3_fiscal_operations,
  public.case_lab_3_tickets,
  public.case_lab_3_ticket_revisions,
  public.case_lab_3_check_ins,
  public.case_lab_3_refunds,
  public.case_lab_3_jobs,
  public.case_lab_3_email_deliveries,
  public.case_lab_3_analytics_events,
  public.case_lab_3_audit_log,
  public.case_lab_3_incidents,
  public.case_lab_3_rate_limits,
  public.case_lab_3_reconciliation_state
from public, anon, authenticated;

grant all on table
  public.case_lab_3_event_settings,
  public.case_lab_3_fiscal_policy_versions,
  public.case_lab_3_inventory_allocations,
  public.case_lab_3_legal_document_versions,
  public.case_lab_3_orders,
  public.case_lab_3_reservations,
  public.case_lab_3_payment_attempts,
  public.case_lab_3_provider_events,
  public.case_lab_3_fiscal_operations,
  public.case_lab_3_tickets,
  public.case_lab_3_ticket_revisions,
  public.case_lab_3_check_ins,
  public.case_lab_3_refunds,
  public.case_lab_3_jobs,
  public.case_lab_3_email_deliveries,
  public.case_lab_3_analytics_events,
  public.case_lab_3_audit_log,
  public.case_lab_3_incidents,
  public.case_lab_3_rate_limits,
  public.case_lab_3_reconciliation_state
to service_role;

revoke all on function public.case_lab_3_set_updated_at() from public, anon, authenticated;
revoke all on function public.case_lab_3_reject_immutable_change() from public, anon, authenticated;
revoke all on function public.case_lab_3_guard_sales_enabled() from public, anon, authenticated;
revoke all on function public.case_lab_3_is_supported_fiscal_policy(uuid, text) from public, anon, authenticated;

grant execute on function public.case_lab_3_set_updated_at() to service_role;
grant execute on function public.case_lab_3_reject_immutable_change() to service_role;
grant execute on function public.case_lab_3_guard_sales_enabled() to service_role;
grant execute on function public.case_lab_3_is_supported_fiscal_policy(uuid, text) to service_role;

alter table public.case_lab_3_event_settings enable row level security;
alter table public.case_lab_3_fiscal_policy_versions enable row level security;
alter table public.case_lab_3_inventory_allocations enable row level security;
alter table public.case_lab_3_legal_document_versions enable row level security;
alter table public.case_lab_3_orders enable row level security;
alter table public.case_lab_3_reservations enable row level security;
alter table public.case_lab_3_payment_attempts enable row level security;
alter table public.case_lab_3_provider_events enable row level security;
alter table public.case_lab_3_fiscal_operations enable row level security;
alter table public.case_lab_3_tickets enable row level security;
alter table public.case_lab_3_ticket_revisions enable row level security;
alter table public.case_lab_3_check_ins enable row level security;
alter table public.case_lab_3_refunds enable row level security;
alter table public.case_lab_3_jobs enable row level security;
alter table public.case_lab_3_email_deliveries enable row level security;
alter table public.case_lab_3_analytics_events enable row level security;
alter table public.case_lab_3_audit_log enable row level security;
alter table public.case_lab_3_incidents enable row level security;
alter table public.case_lab_3_rate_limits enable row level security;
alter table public.case_lab_3_reconciliation_state enable row level security;
