begin;

select plan(76);

insert into public.case_lab_3_legal_document_versions (
  id, environment, document_kind, version_id, url, publication_label,
  content_snapshot, content_hash, is_active, activated_at
)
values
  (
    '00000000-0000-4000-8000-000000000501'::uuid, 'test', 'offer',
    'offer-webhooks-1', 'https://caselab.kz/offer/', 'Webhook offer 1',
    'Case Lab III webhook offer snapshot',
    encode(digest('Case Lab III webhook offer snapshot', 'sha256'), 'hex'),
    true, clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000502'::uuid, 'test', 'privacy',
    'privacy-webhooks-1', 'https://caselab.kz/privacy/', 'Webhook privacy 1',
    'Case Lab III webhook privacy snapshot',
    encode(digest('Case Lab III webhook privacy snapshot', 'sha256'), 'hex'),
    true, clock_timestamp()
  );

update public.case_lab_3_event_settings
set active_offer_version_id = '00000000-0000-4000-8000-000000000501'::uuid,
    active_privacy_version_id = '00000000-0000-4000-8000-000000000502'::uuid,
    sales_enabled = true
where environment = 'test';

create temp table cl3_webhook_settings_snapshot on commit drop as
select sales_enabled, sales_cutoff
from public.case_lab_3_event_settings
where environment = 'test';

create or replace function pg_temp.cl3_seed_order(
  p_number integer,
  p_status text default 'pending',
  p_with_attempt boolean default true
)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
  v_reservation_id uuid;
  v_attempt_id uuid;
begin
  insert into public.case_lab_3_orders (
    id, order_number, idempotency_key, environment, first_name, last_name,
    participant_email, purchaser_email, fiscal_email, original_contact_snapshot,
    tier, amount_minor, receipt_label, configuration_version,
    offer_version_id, privacy_version_id, accepted_at, payment_status
  )
  values (
    gen_random_uuid(), format('CL3-WEBHOOK-%s', p_number), format('webhook-%s', p_number),
    'test', 'Webhook', format('Participant %s', p_number),
    format('webhook-%s@example.test', p_number), format('buyer-%s@example.test', p_number),
    format('buyer-%s@example.test', p_number),
    jsonb_build_object('firstName', 'Webhook', 'lastName', format('Participant %s', p_number)),
    'standard', 1500000, 'Case Lab III Standard', 1,
    '00000000-0000-4000-8000-000000000501'::uuid,
    '00000000-0000-4000-8000-000000000502'::uuid,
    clock_timestamp(), p_status
  )
  returning id into v_order_id;

  insert into public.case_lab_3_reservations (
    order_id, environment, tier, expires_at, status
  )
  values (v_order_id, 'test', 'standard', clock_timestamp() + interval '15 minutes', 'active')
  returning id into v_reservation_id;

  if p_with_attempt then
    insert into public.case_lab_3_payment_attempts (
      external_id, order_id, reservation_id, environment, amount_minor
    )
    values (format('webhook-attempt-%s', p_number), v_order_id, v_reservation_id, 'test', 1500000)
    returning id into v_attempt_id;
  end if;

  return v_order_id;
end;
$$;

select ok(
  (select prosecdef and proconfig @> array['search_path=pg_catalog, public, extensions']
   from pg_proc where oid = 'public.case_lab_3_apply_pay(text,text,text,text,text,text,bigint,text,jsonb)'::regprocedure),
  'payment transition is SECURITY DEFINER with a fixed search path'
);

select ok(
  has_function_privilege(
    'service_role',
    'public.case_lab_3_apply_pay(text,text,text,text,text,text,bigint,text,jsonb)',
    'EXECUTE'
  )
  and not has_function_privilege(
    'anon',
    'public.case_lab_3_apply_pay(text,text,text,text,text,text,bigint,text,jsonb)',
    'EXECUTE'
  ),
  'provider transitions are executable only by service_role'
);

select is(
  (select count(*)::bigint from pg_proc where proname in (
    'case_lab_3_apply_check', 'case_lab_3_apply_pay', 'case_lab_3_apply_fail',
    'case_lab_3_apply_refund', 'case_lab_3_apply_receipt'
  )),
  5::bigint,
  'all five provider transition RPCs exist'
);

select is(
  (
    select count(*)::bigint
    from pg_proc
    where oid in (
      'public.case_lab_3_apply_pay(text,text,text,text,text,text,bigint,text,jsonb)'::regprocedure,
      'public.case_lab_3_apply_refund(text,text,text,text,text,text,text,bigint,text,text,jsonb)'::regprocedure,
      'public.case_lab_3_apply_receipt(text,text,text,text,text,text,uuid,uuid,text,text,bigint,text,jsonb,jsonb)'::regprocedure
    )
    and pg_get_functiondef(oid) like '%hashtextextended(''case_lab_3:provider:'' || p_environment, 0)%'
  ),
  3::bigint,
  'Pay, Refund, and Receipt share one provider ordering lock domain'
);

select is(
  (
    select count(*)::bigint
    from pg_proc
    where oid in (
      'public.case_lab_3_apply_check(text,text,text,text,text,bigint,text,jsonb)'::regprocedure,
      'public.case_lab_3_apply_pay(text,text,text,text,text,text,bigint,text,jsonb)'::regprocedure,
      'public.case_lab_3_apply_fail(text,text,text,text,text,text,text,jsonb)'::regprocedure
    )
    and strpos(pg_get_functiondef(oid), 'case_lab_3_event_settings') > 0
    and strpos(pg_get_functiondef(oid), 'case_lab_3_event_settings') < strpos(pg_get_functiondef(oid), 'case_lab_3_payment_attempts')
    and pg_get_functiondef(oid) like '%for update%'
  ),
  3::bigint,
  'Check, Pay, and Fail lock settings before locking payment attempts'
);

select throws_ok(
  $$ select public.case_lab_3_apply_check(
    'test', 'tiptoppay', repeat('e', 257), repeat('1', 64), 'bounded-check-attempt',
    1500000, 'KZT', '{}'::jsonb
  ) $$,
  '22023',
  'invalid provider Check input',
  'Check rejects an oversized provider event id'
);

select throws_ok(
  $$ select public.case_lab_3_apply_check(
    'test', 'tiptoppay', 'check-invalid-external', repeat('1', 64), E'bounded-check\n',
    1500000, 'KZT', '{}'::jsonb
  ) $$,
  '22023',
  'invalid provider Check input',
  'Check rejects control characters in an external id'
);

select throws_ok(
  $$ select public.case_lab_3_apply_pay(
    'test', 'tiptoppay', 'pay-invalid-transaction-length', repeat('1', 64), 'bounded-pay-attempt',
    repeat('p', 257), 1500000, 'KZT', '{}'::jsonb
  ) $$,
  '22023',
  'invalid provider Pay input',
  'Pay rejects an oversized provider transaction id'
);

select throws_ok(
  $$ select public.case_lab_3_apply_pay(
    'test', 'tiptoppay', 'pay-invalid-transaction-control', repeat('1', 64), 'bounded-pay-attempt',
    E'provider-transaction\n', 1500000, 'KZT', '{}'::jsonb
  ) $$,
  '22023',
  'invalid provider Pay input',
  'Pay rejects control characters in a provider transaction id'
);

select throws_ok(
  $$ select public.case_lab_3_apply_fail(
    'test', 'tiptoppay', 'fail-invalid-external', repeat('1', 64), repeat('f', 257),
    'declined', 'declined', '{}'::jsonb
  ) $$,
  '22023',
  'invalid provider Fail input',
  'Fail rejects an oversized external id'
);

select throws_ok(
  $$ select public.case_lab_3_apply_refund(
    'test', 'tiptoppay', repeat('r', 257), repeat('1', 64), 'bounded-refund-operation',
    'payment-1', 'refund-1', 1, 'KZT', 'confirmed', '{}'::jsonb
  ) $$,
  '22023',
  'invalid provider Refund input',
  'Refund rejects an oversized provider event id'
);

select throws_ok(
  $$ select public.case_lab_3_apply_receipt(
    'test', 'kassir', E'receipt-invalid-event\n', repeat('1', 64), 'kassir-invalid', null,
    gen_random_uuid(), null, 'Income', 'Processed', 1, null, '{}'::jsonb, '{}'::jsonb
  ) $$,
  '22023',
  'invalid Kassir Receipt input',
  'Receipt rejects control characters in a provider event id'
);

select is(
  (select count(*)::bigint from pg_constraint
   where conrelid = 'public.case_lab_3_payment_attempts'::regclass
     and pg_get_constraintdef(oid) like '%unknown%'),
  0::bigint,
  'payment attempts do not gain an unknown state'
);

select is(
  (select count(*)::bigint from public.case_lab_3_provider_events),
  0::bigint,
  'provider event fixtures start empty'
);

select public.case_lab_3_apply_check(
  'test', 'tiptoppay', 'check-1001', repeat('1', 64), 'webhook-attempt-1',
  1500000, 'KZT', jsonb_build_object(
    'invoiceId', 'webhook-attempt-1',
     'accountId', seeded.order_id::text,
    'testMode', true
  )
)
from pg_temp.cl3_seed_order(1) as seeded(order_id);

select is(
  (select status from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'),
  'check_approved',
  'Check approves the matching attempt'
);

select is(
  (select status from public.case_lab_3_reservations where order_id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'
  )),
  'processing',
  'Check moves the reservation to processing'
);

select is(
  (select count(*)::bigint from public.case_lab_3_provider_events where provider_event_id = 'check-1001'),
  1::bigint,
  'the first Check is stored once'
);

select public.case_lab_3_apply_check(
  'test', 'tiptoppay', 'check-1001', repeat('1', 64), 'webhook-attempt-1',
  1500000, 'KZT', jsonb_build_object(
    'invoiceId', 'webhook-attempt-1',
    'accountId', (select order_id::text from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'),
    'testMode', true
  )
);

select is(
  (select count(*)::bigint from public.case_lab_3_provider_events where provider_event_id = 'check-1001'),
  1::bigint,
  'duplicate Check has no new durable effect'
);

select public.case_lab_3_apply_check(
  'test', 'tiptoppay', 'check-1001', repeat('f', 64), 'webhook-attempt-1',
  1500000, 'KZT', jsonb_build_object(
    'invoiceId', 'webhook-attempt-1',
    'accountId', (select order_id::text from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'),
    'testMode', true
  )
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where incident_type = 'unknown_provider_result'),
  1::bigint,
  'a reused Check event id with a different body becomes an incident'
);

select is(
  (select count(*)::bigint from public.case_lab_3_provider_events where provider_event_id = 'check-1001'),
  1::bigint,
  'a conflicting provider event does not raise a unique-constraint error or replace the original'
);

update public.case_lab_3_event_settings
set sales_enabled = false
where environment = 'test';

select is(
  (public.case_lab_3_apply_check(
    'test', 'tiptoppay', 'check-sales-disabled', repeat('a', 64), 'webhook-attempt-1',
    1500000, 'KZT', jsonb_build_object(
      'invoiceId', 'webhook-attempt-1',
      'accountId', (select order_id::text from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'),
      'testMode', true
    )
  )->>'code')::integer,
  20,
  'Check rejects new admissions when sales are disabled'
);

update public.case_lab_3_event_settings
set sales_enabled = true,
    sales_cutoff = clock_timestamp() - interval '1 second'
where environment = 'test';

select is(
  (public.case_lab_3_apply_check(
    'test', 'tiptoppay', 'check-sales-cutoff', repeat('a', 63) || '1', 'webhook-attempt-1',
    1500000, 'KZT', jsonb_build_object(
      'invoiceId', 'webhook-attempt-1',
      'accountId', (select order_id::text from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'),
      'testMode', true
    )
  )->>'code')::integer,
  20,
  'Check rejects new admissions after the exclusive sales cutoff'
);

update public.case_lab_3_event_settings
set sales_enabled = (select sales_enabled from cl3_webhook_settings_snapshot),
    sales_cutoff = (select sales_cutoff from cl3_webhook_settings_snapshot)
where environment = 'test';

select is(
  (public.case_lab_3_apply_check(
    'test', 'tiptoppay', 'check-test-mode-mismatch', repeat('a', 63) || '2', 'webhook-attempt-1',
    1500000, 'KZT', jsonb_build_object(
      'invoiceId', 'webhook-attempt-1',
      'accountId', (select order_id::text from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'),
      'testMode', false
    )
  )->>'result'),
  'rejected_provider_metadata',
  'Check rejects TestMode values that disagree with the callback environment'
);

select is(
  (public.case_lab_3_apply_check(
    'test', 'tiptoppay', 'check-invoice-mismatch', repeat('a', 63) || '3', 'webhook-attempt-1',
    1500000, 'KZT', jsonb_build_object(
      'invoiceId', 'different-invoice',
      'accountId', (select order_id::text from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'),
      'testMode', true
    )
  )->>'result'),
  'rejected_provider_metadata',
  'Check rejects an InvoiceId that does not match the payment attempt'
);

select is(
  (public.case_lab_3_apply_check(
    'test', 'tiptoppay', 'check-account-mismatch', repeat('a', 63) || '4', 'webhook-attempt-1',
    1500000, 'KZT', jsonb_build_object(
      'invoiceId', 'webhook-attempt-1',
      'accountId', '00000000-0000-4000-8000-000000000000',
      'testMode', true
    )
  )->>'result'),
  'rejected_provider_metadata',
  'Check rejects an AccountId that does not identify the attempt order'
);

select public.case_lab_3_apply_pay(
  'test', 'tiptoppay', 'pay-1001', repeat('2', 64), 'webhook-attempt-1',
  'payment-1001', 1500000, 'KZT',
  jsonb_build_object('invoiceId', 'webhook-attempt-1', 'transactionId', 'payment-1001')
);

select is(
  (select payment_status from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'
  )),
  'paid',
  'Pay records the payment'
);

select is(
  (select status from public.case_lab_3_reservations where order_id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'
  )),
  'consumed',
  'Pay consumes the reservation'
);

select is(
  (select count(*)::bigint from public.case_lab_3_tickets where order_id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'
  )),
  1::bigint,
  'Pay creates exactly one ticket'
);

select is(
  (select count(*)::bigint from public.case_lab_3_ticket_revisions where ticket_id = (
    select id from public.case_lab_3_tickets where order_id = (
      select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'
    )
  )),
  1::bigint,
  'Pay creates exactly one immutable ticket revision'
);

select is(
  (select count(*)::bigint from public.case_lab_3_fiscal_operations
   where operation_key = 'fiscal:payment_income:payment-1001'),
  1::bigint,
  'Pay creates the exact payment fiscal logical key'
);

select is(
  (select count(*)::bigint from public.case_lab_3_email_deliveries
   where operation_key like 'email:ticket:%'),
  1::bigint,
  'Pay creates one ticket email delivery'
);

select is(
  (select count(*)::bigint from public.case_lab_3_analytics_events
   where event_key = 'ga4:purchase:' || (
     select id::text from public.case_lab_3_orders where id = (
       select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'
     )
   )),
  1::bigint,
  'Pay creates one server purchase event'
);

select public.case_lab_3_apply_pay(
  'test', 'tiptoppay', 'pay-1001', repeat('2', 64), 'webhook-attempt-1',
  'payment-1001', 1500000, 'KZT',
  jsonb_build_object('invoiceId', 'webhook-attempt-1', 'transactionId', 'payment-1001')
);

select is(
  (select count(*)::bigint from public.case_lab_3_tickets),
  1::bigint,
  'duplicate Pay does not create another ticket'
);

select public.case_lab_3_apply_fail(
  'test', 'tiptoppay', 'fail-1001', repeat('3', 64), 'webhook-attempt-1',
  'late_failure', 'provider failure arrived after payment', '{}'::jsonb
);

select is(
  (select payment_status from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-1'
  )),
  'paid',
  'late Fail never changes a paid order'
);

select public.case_lab_3_apply_fail(
  'test', 'tiptoppay', 'fail-1002', repeat('4', 64), 'webhook-attempt-2',
  'declined', 'declined by provider', '{}'::jsonb
)
from pg_temp.cl3_seed_order(2);

select is(
  (select status from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-2'),
  'failed',
  'Fail marks an unresolved attempt failed'
);

select public.case_lab_3_apply_fail(
  'test', 'tiptoppay', 'fail-1002-late-unknown', repeat('0', 64), 'webhook-attempt-2',
  'unknown', 'late provider uncertainty after terminal failure', '{}'::jsonb
);

select is(
  (select status from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-2'),
  'failed',
  'indeterminate Fail does not regress a terminal failed attempt'
);

select is(
  (select payment_status from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-2'
  )),
  'failed',
  'indeterminate Fail does not regress a terminal failed order'
);

select is(
  (select processing_result from public.case_lab_3_provider_events
   where provider_event_id = 'fail-1002-late-unknown'),
  'late_failure_conflict',
  'terminal contradictory Fail is stored as a durable no-op outcome'
);

select public.case_lab_3_apply_fail(
  'test', 'tiptoppay', 'fail-1002-late-replay', repeat('8', 64), 'webhook-attempt-2',
  'unknown', 'late provider uncertainty after terminal failure', '{}'::jsonb
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where incident_type = 'unknown_provider_result'),
  2::bigint,
  'terminal contradictory Fail creates one durable conflict incident'
);

select is(
  (select count(*)::bigint from public.case_lab_3_provider_events
   where external_id = 'webhook-attempt-2'
     and processing_result = 'late_failure_conflict'),
  2::bigint,
  'semantically repeated terminal Fail callbacks remain durable provider events'
);

select public.case_lab_3_apply_pay(
  'test', 'tiptoppay', 'pay-1002', repeat('5', 64), 'webhook-attempt-2',
  'payment-1002', 1500000, 'KZT', '{}'::jsonb
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where incident_type = 'unexpected_payment'),
  1::bigint,
  'Pay after Fail creates an unexpected payment incident'
);

select is(
  (select count(*)::bigint from public.case_lab_3_jobs where job_type = 'send_organizer_alert'),
  1::bigint,
  'unexpected payment creates an organizer alert job'
);

select public.case_lab_3_apply_fail(
  'test', 'tiptoppay', 'fail-1003', repeat('6', 64), 'webhook-attempt-3',
  'indeterminate rawBody=provider-secret', 'provider timeout after authorization rawBody=provider-secret', jsonb_build_object('testMode', true)
)
from pg_temp.cl3_seed_order(3);

select is(
  (select status from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-3'),
  'review_required',
  'indeterminate provider result moves the attempt to review_required'
);

select is(
  (select payment_status from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-3'
  )),
  'review_required',
  'indeterminate provider result moves the order to review_required'
);

select is(
  (select failure_reason from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-3'),
  'provider timeout after authorization [redacted]',
  'provider failure reasons are sanitized before persistence'
);

select is(
  (select failure_code from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-3'),
  'indeterminate',
  'provider failure codes are normalized to an allowlisted value'
);

select is(
  (select status from public.case_lab_3_reservations where order_id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-3'
  )),
  'processing',
  'review_required retains the processing reservation'
);

update public.case_lab_3_reservations
set expires_at = clock_timestamp() - interval '1 minute'
where order_id = (
  select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-3'
);

select public.case_lab_3_apply_pay(
  'test', 'tiptoppay', 'pay-1003', repeat('7', 64), 'webhook-attempt-3',
  'payment-1003', 1500000, 'KZT', '{}'::jsonb
);

select is(
  (select status from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-3'),
  'completed',
  'reconciliation Pay resolves review_required to completed'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-1003', repeat('8', 64), 'kassir-1003',
  'fiscal:payment_income:payment-1003',
  (select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-3'),
  null, 'Income', 'Processed', 1500000, 'https://receipt.test/1004',
  jsonb_build_object('status', 'Processed'), jsonb_build_object('receiptId', 'kassir-1004')
);

select is(
  (select status from public.case_lab_3_fiscal_operations
   where operation_key = 'fiscal:payment_income:payment-1003'),
  'issued',
  'Receipt marks the payment fiscal operation issued'
);

select is(
  (select sanitized_fields ? 'rawBody' from public.case_lab_3_provider_events
   where provider_event_id = 'receipt-1003'),
  false,
  'provider events retain sanitized fields instead of raw bodies'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-1003-omitted-key', repeat('0', 64), 'kassir-1003', null,
  (select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-3'),
  null, 'Income', 'Processed', 1500000, 'https://receipt.test/1004', '{}', '{}'
);

select is(
  (select processing_result from public.case_lab_3_provider_events where provider_event_id = 'receipt-1003-omitted-key'),
  'matched',
  'an omitted operation key may match only the exact Kassir/order/type/amount identity'
);

select pg_temp.cl3_seed_order(4);

select throws_ok(
  $$
    select public.case_lab_3_apply_receipt(
      'test', 'kassir', 'receipt-invalid-kassir-id', repeat('9', 64), E'kassir-1004\nsecret',
      null,
      (select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-4'),
      null, 'Income', 'Processed', 1500000, 'https://receipt.test/early-1004?token=provider-secret',
      jsonb_build_object('fiscalDocumentNumber', 'early-1004'), '{}'
    )
  $$,
  '22023',
  'invalid Kassir Receipt input',
  'Receipt rejects control characters in a Kassir receipt id instead of aliasing them'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-1004', repeat('9', 64), 'kassir-1004',
  null,
  (select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-4'),
   null, 'Income', 'Processed', 1500000,
   'https://receipt.test/early-1004?token=provider-secret',
  jsonb_build_object('fiscalDocumentNumber', 'early-1004'), '{}'
);

select is(
  (select processing_result from public.case_lab_3_provider_events where provider_event_id = 'receipt-1004'),
  'pending_match',
  'an early Receipt is retained before the fiscal create response is stored'
);

select public.case_lab_3_apply_pay(
   'test', 'tiptoppay', 'pay-1004', repeat('a', 63) || '5', 'webhook-attempt-4',
  'payment-1004', 1500000, 'KZT', '{}'
);

select is(
  (select status from public.case_lab_3_fiscal_operations where operation_key = 'fiscal:payment_income:payment-1004'),
  'issued',
  'Pay matches an early Receipt using environment, order, type, and amount'
);

select is(
  (select processing_result from public.case_lab_3_provider_events where provider_event_id = 'receipt-1004'),
  'matched_early',
  'the early Receipt is linked after the Kassir operation is created'
);

select is(
  (select sanitized_fields->>'operationKey' from public.case_lab_3_provider_events where provider_event_id = 'receipt-1004'),
  'fiscal:payment_income:payment-1004',
  'rematching an early Receipt hydrates its verified fiscal operation key'
);

select ok(
  (select external_id = 'kassir-1004'
      and sanitized_fields->>'kassirReceiptId' = 'kassir-1004'
      and sanitized_fields->>'receiptStatus' = 'issued'
      and sanitized_fields->>'receiptUrl' = 'https://receipt.test/early-1004?[redacted]'
   from public.case_lab_3_provider_events
   where provider_event_id = 'receipt-1004'),
  'Receipt Kassir identifiers, URLs, and status strings are bounded and sanitized before persistence'
);

select ok(
  (select order_id = (select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-4')
       and external_id = 'kassir-1004'
      and sanitized_fields->>'receiptType' = 'Income'
      and (sanitized_fields->>'amountMinor')::bigint = 1500000
   from public.case_lab_3_provider_events
   where provider_event_id = 'receipt-1004'),
  'an early Receipt retains environment, Kassir, order, type, and exact amount identity'
);

select is(
  (select fiscal_fields->>'fiscalDocumentNumber' from public.case_lab_3_fiscal_operations
   where operation_key = 'fiscal:payment_income:payment-1004'),
  'early-1004',
  'rematching an early Receipt preserves its sanitized fiscal fields'
);

select public.case_lab_3_apply_fail(
  'test', 'tiptoppay', 'fail-1005', repeat('b', 64), 'webhook-attempt-5',
  'indeterminate', 'provider timeout', '{}'
)
from pg_temp.cl3_seed_order(5);

select public.case_lab_3_apply_fail(
  'test', 'tiptoppay', 'fail-1006', repeat('c', 64), 'webhook-attempt-5',
  'reconciled_failure', 'reconciliation confirmed failure', '{}'
);

select is(
  (select status from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-5'),
  'failed',
  'reconciliation can resolve an indeterminate attempt to failed'
);

select is(
  (select status from public.case_lab_3_reservations where order_id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-5'
  )),
  'active',
  'a reconciled failure releases the still-valid reservation'
);

select public.case_lab_3_apply_pay(
  'test', 'tiptoppay', 'pay-1006', repeat('d', 64), 'webhook-attempt-6',
  'shared-payment-1006', 1500000, 'KZT',
  jsonb_build_object(
    'invoiceId', 'webhook-attempt-6',
    'rawBody', 'provider-secret',
    'cardNumber', '4111111111111111',
    'cvv', '123',
    'token', 'opaque-token',
    'email', 'buyer@example.test'
  )
)
from pg_temp.cl3_seed_order(6);

select ok(
  (select sanitized_fields ? 'invoiceId'
      and not sanitized_fields ? 'rawBody'
      and not sanitized_fields ? 'cardNumber'
      and not sanitized_fields ? 'cvv'
      and not sanitized_fields ? 'token'
      and not sanitized_fields ? 'email'
   from public.case_lab_3_provider_events
   where provider_event_id = 'pay-1006'),
  'provider snapshots keep only the allowlisted non-sensitive fields'
);

select public.case_lab_3_apply_pay(
  'test', 'tiptoppay', 'pay-1007', repeat('e', 64), 'webhook-attempt-7',
  'shared-payment-1006', 1500000, 'KZT', '{}'
)
from pg_temp.cl3_seed_order(7);

select is(
  (select status from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-7'),
  'review_required',
  'a known Pay conflict retains the conflicting attempt for review'
);

select is(
  (select payment_status from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-7'
  )),
  'review_required',
  'a known Pay conflict moves the current order to review_required'
);

select is(
  (select status from public.case_lab_3_reservations where order_id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-7'
  )),
  'processing',
  'a known Pay conflict retains the processing reservation'
);

select is(
  (select admitted_payment_attempt_id from public.case_lab_3_reservations where order_id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-7'
  )),
  (select id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-7'),
  'a known Pay conflict keeps the current attempt admitted to the reservation'
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where incident_type = 'unexpected_payment'),
  2::bigint,
  'a provider transaction already attached to another attempt becomes an unexpected-payment incident'
);

select is(
  (select count(*)::bigint from public.case_lab_3_tickets where order_id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-7'
  )),
  0::bigint,
  'a conflicting provider transaction cannot create a second ticket'
);

select public.case_lab_3_apply_pay(
  'test', 'tiptoppay', 'pay-1007', repeat('e', 64), 'webhook-attempt-7',
  'shared-payment-1006', 1500000, 'KZT', '{}'
);

select is(
  (select count(*)::bigint from public.case_lab_3_provider_events where provider_event_id = 'pay-1007'),
  1::bigint,
  'a provider-transaction conflict persists one deduplicated provider event'
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where incident_type = 'unexpected_payment'),
  2::bigint,
  'replaying a provider-transaction conflict does not duplicate incidents'
);

select is(
  (select count(*)::bigint from public.case_lab_3_jobs where job_type = 'send_organizer_alert'),
  2::bigint,
  'replaying a provider-transaction conflict does not duplicate organizer alerts'
);

select ok(
  coalesce((select bool_and(
    not summary ? 'rawBody'
    and not summary ? 'cardNumber'
    and not summary ? 'cvv'
    and not summary ? 'token'
    and not summary ? 'email'
  ) from public.case_lab_3_incidents), false),
  'incident summaries use the allowlist and exclude raw provider data'
);

select public.case_lab_3_apply_check(
  'test', 'tiptoppay', 'check-1008', repeat('f', 64), 'webhook-attempt-8',
  1500000, 'KZT', jsonb_build_object(
    'invoiceId', 'webhook-attempt-8',
     'accountId', seeded.order_id::text,
    'testMode', true
  )
)
from pg_temp.cl3_seed_order(8) as seeded(order_id);

update public.case_lab_3_reservations
set expires_at = clock_timestamp() - interval '1 minute'
where order_id = (
  select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-8'
);

update public.case_lab_3_event_settings
set sales_enabled = false,
    sales_cutoff = clock_timestamp() - interval '1 second'
where environment = 'test';

select public.case_lab_3_apply_pay(
  'test', 'tiptoppay', 'pay-1008', repeat('9', 64), 'webhook-attempt-8',
  'payment-1008', 1500000, 'KZT', '{}'
);

select is(
  (select status from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-8'),
  'completed',
  'authoritative Pay is accepted for an expired processing reservation'
);

select is(
  (select payment_status from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-8'
  )),
  'paid',
  'Pay settles the order despite the retained processing reservation deadline'
);

select is(
  (select status from public.case_lab_3_reservations where order_id = (
    select order_id from public.case_lab_3_payment_attempts where external_id = 'webhook-attempt-8'
  )),
  'consumed',
  'Pay consumes the retained processing reservation after authoritative settlement'
);

select is(
  (select count(*)::bigint from public.case_lab_3_provider_events),
   24::bigint,
   'replayed and ordered events preserve one row per provider event'
);

select * from finish();
rollback;
