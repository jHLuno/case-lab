begin;

select plan(68);

create temp table cl3_refund_test_baseline on commit drop as
select
  (select count(*)::bigint from public.case_lab_3_refunds) as refund_count,
  (select count(*)::bigint from public.case_lab_3_incidents where incident_type = 'reconciliation_mismatch') as reconciliation_mismatch_count,
  (select count(*)::bigint from public.case_lab_3_incidents where incident_type = 'overdue_receipt') as overdue_receipt_count,
  (select count(*)::bigint from public.case_lab_3_provider_events where event_type = 'Refund') as refund_provider_event_count;

create temp table cl3_refund_worker_fixture on commit drop as
select
  (100000000 + (txid_current() % 1000000)::integer) as processing_number,
  (100001000 + (txid_current() % 1000000)::integer) as unknown_number;

insert into public.case_lab_3_legal_document_versions (
  id, environment, document_kind, version_id, url, publication_label,
  content_snapshot, content_hash, is_active, activated_at
)
values
  (
    '00000000-0000-4000-8000-000000000601'::uuid, 'test', 'offer',
    'offer-refunds-1', 'https://caselab.kz/offer/', 'Refund offer 1',
    'Case Lab III refund offer snapshot',
    encode(digest('Case Lab III refund offer snapshot', 'sha256'), 'hex'), true, clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000602'::uuid, 'test', 'privacy',
    'privacy-refunds-1', 'https://caselab.kz/privacy/', 'Refund privacy 1',
    'Case Lab III refund privacy snapshot',
    encode(digest('Case Lab III refund privacy snapshot', 'sha256'), 'hex'), true, clock_timestamp()
  );

update public.case_lab_3_event_settings
set active_offer_version_id = '00000000-0000-4000-8000-000000000601'::uuid,
    active_privacy_version_id = '00000000-0000-4000-8000-000000000602'::uuid,
    sales_enabled = true
where environment = 'test';

create or replace function pg_temp.cl3_seed_paid_refund_order(p_number integer)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
  v_reservation_id uuid;
begin
  insert into public.case_lab_3_orders (
    id, order_number, idempotency_key, environment, first_name, last_name,
    participant_email, purchaser_email, fiscal_email, original_contact_snapshot,
    tier, amount_minor, receipt_label, configuration_version,
    offer_version_id, privacy_version_id, accepted_at
  )
  values (
    gen_random_uuid(), format('CL3-REFUND-%s', p_number), format('refund-%s', p_number),
    'test', 'Refund', format('Participant %s', p_number),
    format('refund-%s@example.test', p_number), format('buyer-%s@example.test', p_number),
    format('buyer-%s@example.test', p_number),
    jsonb_build_object('firstName', 'Refund', 'lastName', format('Participant %s', p_number)),
    'standard', 1500000, 'Case Lab III Standard', 1,
    '00000000-0000-4000-8000-000000000601'::uuid,
    '00000000-0000-4000-8000-000000000602'::uuid,
    clock_timestamp()
  )
  returning id into v_order_id;

  insert into public.case_lab_3_reservations (order_id, environment, tier, expires_at, status)
  values (v_order_id, 'test', 'standard', clock_timestamp() + interval '15 minutes', 'active')
  returning id into v_reservation_id;

  insert into public.case_lab_3_payment_attempts (
    external_id, order_id, reservation_id, environment, amount_minor
  )
  values (format('refund-attempt-%s', p_number), v_order_id, v_reservation_id, 'test', 1500000);

  perform public.case_lab_3_apply_pay(
    'test', 'tiptoppay', format('refund-pay-event-%s', p_number), repeat('a', 64 - length(p_number::text)) || p_number,
    format('refund-attempt-%s', p_number), format('refund-payment-%s', p_number), 1500000, 'KZT', '{}'::jsonb
  );

  return v_order_id;
end;
$$;

select ok(
  (select prosecdef and proconfig @> array['search_path=pg_catalog, public, extensions']
   from pg_proc where oid = 'public.case_lab_3_create_refund(text,uuid,text,bigint,text)'::regprocedure),
  'refund creation is SECURITY DEFINER with a fixed search path'
);

select is(
  (select count(*)::bigint from pg_proc where proname in ('case_lab_3_create_refund', 'case_lab_3_apply_refund', 'case_lab_3_resolve_incident')),
  3::bigint,
  'refund and incident RPCs exist'
);

select is(
  (select count(*)::bigint from public.case_lab_3_refunds),
  (select refund_count from cl3_refund_test_baseline),
  'refund fixtures preserve pre-existing rows'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order(1), 'refund-op-1', 400000, 'partial refund'
);

select is(
  (select status from public.case_lab_3_refunds where operation_key = 'refund-op-1'),
  'requested',
  'a refund starts requested'
);

select is(
  (select refundable_amount_minor from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-1'
  )),
  1100000::bigint,
  'pending refund amount is deducted from the available balance'
);

select throws_ok(
  $$ select public.case_lab_3_create_refund(
    'test', (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-1'),
    'refund-op-too-large', 1100001, 'exceeds remaining balance'
  ) $$,
  '23514',
  'refund amount exceeds the remaining refundable balance',
  'refund creation enforces paid minus confirmed minus pending arithmetic'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-1-conflict', repeat('1', 64), 'refund-op-1',
  'wrong-original-payment-1', 'refund-provider-1', 400000, 'KZT', 'confirmed', '{}'
);

select is(
  (select status from public.case_lab_3_refunds where operation_key = 'refund-op-1'),
  'requested',
  'a refund with the wrong original payment identity is not attached'
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where incident_type = 'reconciliation_mismatch'),
  (select reconciliation_mismatch_count + 1::bigint from cl3_refund_test_baseline),
  'a refund identity conflict becomes a reconciliation incident'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-1-wrong-amount', repeat('a', 64), 'refund-op-1',
  'refund-payment-1', 'refund-provider-1-wrong', 400001, 'KZT', 'failed', '{}'
);

select is(
  (select status from public.case_lab_3_refunds where operation_key = 'refund-op-1'),
  'requested',
  'a mismatched provider refund amount cannot update a requested refund'
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where incident_type = 'reconciliation_mismatch'),
  (select reconciliation_mismatch_count + 2::bigint from cl3_refund_test_baseline),
  'a mismatched provider refund amount becomes a reconciliation incident'
);

select throws_ok(
  $$ select public.case_lab_3_apply_refund(
    'test', 'tiptoppay', 'refund-event-1-wrong-currency', repeat('c', 64), 'refund-op-1',
    'refund-payment-1', 'refund-provider-1-currency', 400000, 'USD', 'failed', '{}'
  ) $$,
  '22023',
  'invalid provider Refund input',
  'provider refund currency is validated before terminal status handling'
);

select throws_ok(
  $$ select public.case_lab_3_apply_refund(
    'test', 'tiptoppay', 'refund-event-1-null-status', repeat('2', 64), 'refund-op-1',
    'refund-payment-1', 'refund-provider-1', 400000, 'KZT', null, '{}'
  ) $$,
  '22023',
  'invalid provider Refund input',
  'provider refunds validate status before accepting any result'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-1', repeat('b', 64), 'refund-op-1',
  'refund-payment-1', 'refund-provider-1', 400000, 'KZT', 'confirmed',
  jsonb_build_object('transactionId', 'refund-provider-1')
);

select is(
  (select payment_status from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-1'
  )),
  'partially_refunded',
  'partial refund changes the order to partially_refunded'
);

select is(
  (select refunded_amount_minor from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-1'
  )),
  400000::bigint,
  'partial refund arithmetic records the confirmed amount'
);

select is(
  (select status from public.case_lab_3_tickets where order_id = (
    select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-1'
  )),
  'valid',
  'partial refund retains the ticket'
);

select is(
  (select count(*)::bigint from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-1'
  )),
  1::bigint,
  'confirmed refund creates one dependent fiscal return operation'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-1', repeat('b', 64), 'refund-op-1',
  'refund-payment-1', 'refund-provider-1', 400000, 'KZT', 'confirmed',
  jsonb_build_object('transactionId', 'refund-provider-1')
);

select is(
  (select count(*)::bigint from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-1'
  )),
  1::bigint,
  'duplicate Refund creates no second fiscal operation'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order(2), 'refund-op-2', 1500000, 'full refund'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-2', repeat('c', 64), 'refund-op-2',
  'refund-payment-2', 'refund-provider-2', 1500000, 'KZT', 'confirmed', '{}'
);

select is(
  (select payment_status from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-2'
  )),
  'refunded',
  'full refund changes the order to refunded'
);

select is(
  (select status from public.case_lab_3_tickets where order_id = (
    select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-2'
  )),
  'cancelled',
  'full refund cancels the ticket'
);

select is(
  (select status from public.case_lab_3_reservations where order_id = (
    select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-2'
  )),
  'released',
  'full refund returns the consumed Standard reservation'
);

select is(
  (select count(*)::bigint from public.case_lab_3_jobs where job_type = 'send_refund_notification' and refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-2'
  )),
  1::bigint,
  'full refund queues exactly one buyer notification'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-2-provider-change', repeat('6', 64), 'refund-op-2',
  'refund-payment-2', 'refund-provider-2-new', 1500000, 'KZT', 'confirmed', '{}'
);

select is(
  (select provider_transaction_id from public.case_lab_3_refunds where operation_key = 'refund-op-2'),
  'refund-provider-2',
  'a confirmed Refund keeps its first provider transaction id'
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-2'
  )),
  1::bigint,
  'a changed confirmed Refund provider transaction becomes one reconciliation incident'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order(9), 'refund-op-9', 500000, 'failed result identity'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-9-failed', repeat('0', 64), 'refund-op-9',
  'refund-payment-9', 'refund-provider-9-a', 500000, 'KZT', 'failed', '{}'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order(10), 'refund-op-10', 500000, 'unknown result identity'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-10-unknown', repeat('0', 63) || '1', 'refund-op-10',
  'refund-payment-10', 'refund-provider-10-a', 500000, 'KZT', 'unknown', '{}'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order(11), 'refund-op-11', 500000, 'indeterminate result identity'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-11-indeterminate', repeat('0', 63) || '2', 'refund-op-11',
  'refund-payment-11', 'refund-provider-11-a', 500000, 'KZT', 'indeterminate', '{}'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-9-changed', repeat('0', 63) || '3', 'refund-op-9',
  'refund-payment-9', 'refund-provider-9-b', 500000, 'KZT', 'confirmed', '{}'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-10-changed', repeat('0', 63) || '4', 'refund-op-10',
  'refund-payment-10', 'refund-provider-10-b', 500000, 'KZT', 'failed', '{}'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-11-changed', repeat('0', 63) || '5', 'refund-op-11',
  'refund-payment-11', 'refund-provider-11-b', 500000, 'KZT', 'confirmed', '{}'
);

select is(
  jsonb_build_object(
    'failed', (select provider_transaction_id from public.case_lab_3_refunds where operation_key = 'refund-op-9'),
    'unknown', (select provider_transaction_id from public.case_lab_3_refunds where operation_key = 'refund-op-10'),
    'indeterminate', (select provider_transaction_id from public.case_lab_3_refunds where operation_key = 'refund-op-11')
  ),
  jsonb_build_object('failed', 'refund-provider-9-a', 'unknown', 'refund-provider-10-a', 'indeterminate', 'refund-provider-11-a'),
  'the first Refund provider transaction remains bound across failed, unknown, and indeterminate results'
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where refund_id in (
    select id from public.case_lab_3_refunds where operation_key in ('refund-op-9', 'refund-op-10', 'refund-op-11')
  )),
  3::bigint,
  'different later Refund transactions create one identity incident per operation'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order(8), 'refund-op-8', 500000, 'provider transaction conflict'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-8-conflict', repeat('8', 64), 'refund-op-8',
  'refund-payment-8', 'refund-provider-2', 500000, 'KZT', 'confirmed', '{}'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-8-conflict', repeat('8', 64), 'refund-op-8',
  'refund-payment-8', 'refund-provider-2', 500000, 'KZT', 'confirmed', '{}'
);

select is(
  (select status from public.case_lab_3_refunds where operation_key = 'refund-op-8'),
  'requested',
  'a reused provider refund transaction does not confirm the conflicting refund'
);

select is(
  (select count(*)::bigint from public.case_lab_3_provider_events where provider_event_id = 'refund-event-8-conflict'),
  1::bigint,
  'a provider refund transaction conflict persists one deduplicated event'
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-8'
  )),
  1::bigint,
  'replaying a provider refund transaction conflict does not duplicate its incident'
);

select is(
  (select count(*)::bigint from public.case_lab_3_jobs where job_type = 'send_refund_notification' and refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-1'
  )),
  0::bigint,
  'partial refund does not cancel or notify as a full refund'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order(3), 'refund-op-3', 1500000, 'receipt dependency refund'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-3', repeat('d', 64), 'refund-op-3',
  'refund-payment-3', 'refund-provider-3', 1500000, 'KZT', 'confirmed', '{}'
);

select is(
  (select status from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-3'
  )),
  'not_requested',
  'return receipt waits while the payment receipt dependency is pending'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-event-3', repeat('e', 64), 'kassir-payment-3',
  'fiscal:payment_income:refund-payment-3',
  (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-3'),
  null, 'Income', 'Processed', 1500000, null, '{}', '{}'
);

select is(
  (select status from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-3'
  )),
  'queued',
  'payment Receipt releases the dependent return receipt job'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-event-3-late', repeat('1', 64), 'kassir-payment-3',
  'fiscal:payment_income:refund-payment-3',
  (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-3'),
  null, 'Income', 'Queued', 1500000, null,
  jsonb_build_object('rawBody', 'secret', 'cardNumber', '4111', 'cvv', '123', 'token', 'opaque-token'),
  jsonb_build_object('receiptId', 'kassir-payment-3')
);

select is(
  (select status from public.case_lab_3_fiscal_operations
   where operation_key = 'fiscal:payment_income:refund-payment-3'),
  'issued',
  'a late queued Receipt cannot regress an issued fiscal operation'
);

select ok(
  (select not fiscal_fields ? 'rawBody'
      and not fiscal_fields ? 'cardNumber'
      and not fiscal_fields ? 'cvv'
      and not fiscal_fields ? 'token'
   from public.case_lab_3_fiscal_operations
   where operation_key = 'fiscal:payment_income:refund-payment-3'),
  'fiscal response fields are sanitized before persistence'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-event-3-wrong-amount', repeat('2', 64), 'kassir-payment-3',
  'fiscal:payment_income:refund-payment-3',
  (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-3'),
  null, 'Income', 'Processed', 1500001, null, '{}', '{}'
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where incident_type = 'overdue_receipt'),
  (select overdue_receipt_count + 1::bigint from cl3_refund_test_baseline),
  'a Receipt with the wrong operation amount becomes an incident'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-2-late', repeat('3', 64), 'refund-op-2',
  'refund-payment-2', 'refund-provider-2', 1500000, 'KZT', 'unknown', '{}'
);

select is(
  (select status from public.case_lab_3_refunds where operation_key = 'refund-op-2'),
  'confirmed',
  'an indeterminate late refund cannot regress a confirmed refund'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-2-late', repeat('3', 64), 'refund-op-2',
  'refund-payment-2', 'refund-provider-2', 1500000, 'KZT', 'unknown', '{}'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-2-late-failed', repeat('4', 64), 'refund-op-2',
  'refund-payment-2', 'refund-provider-2', 1500000, 'KZT', 'failed', '{}'
);

select is(
  (select count(*)::bigint from public.case_lab_3_provider_events
   where refund_id = (select id from public.case_lab_3_refunds where operation_key = 'refund-op-2')
     and processing_result = 'late_terminal_ignored'),
  2::bigint,
  'late unknown and failed Refund callbacks persist durable terminal no-op events'
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents
   where refund_id = (select id from public.case_lab_3_refunds where operation_key = 'refund-op-2')),
  1::bigint,
  'replayed and contradictory terminal Refund callbacks share one semantic incident'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order(4), 'refund-op-4', 1500000, 'early return receipt'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-return-4', repeat('4', 64), 'kassir-return-4',
  null,
  (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-4'),
  (select id from public.case_lab_3_refunds where operation_key = 'refund-op-4'),
  'IncomeReturn', 'Processed', 1500000, 'https://receipt.test/return-4',
  jsonb_build_object('fiscalDocumentNumber', 'early-return-4'), '{}'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-4', repeat('5', 64), 'refund-op-4',
  'refund-payment-4', 'refund-provider-4', 1500000, 'KZT', 'confirmed', '{}'
);

select is(
  (select status from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-4'
  )),
  'not_requested',
  'an early IncomeReturn remains blocked until the Income dependency is issued'
);

select is(
  (select kassir_receipt_id from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-4'
  )),
  'kassir-return-4',
  'early IncomeReturn preserves its Kassir receipt identity'
);

select is(
  (select receipt_url from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-4'
  )),
  'https://receipt.test/return-4',
  'early IncomeReturn preserves its receipt URL while blocked'
);

select is(
  (select sanitized_fields->>'operationKey' from public.case_lab_3_provider_events where provider_event_id = 'receipt-return-4'),
  'fiscal:refund_income_return:' || (select id::text from public.case_lab_3_refunds where operation_key = 'refund-op-4'),
  'rematching an early IncomeReturn hydrates its fiscal operation key'
);

select is(
  (select fiscal_fields->>'fiscalDocumentNumber' from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-4'
  )),
  'early-return-4',
  'rematching an early IncomeReturn preserves its sanitized fiscal fields'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-return-4-key-mismatch', repeat('7', 64), 'kassir-return-4',
  'fiscal:refund_income_return:wrong-refund-id',
  (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-4'),
  (select id from public.case_lab_3_refunds where operation_key = 'refund-op-4'),
  'IncomeReturn', 'Processed', 1500000, 'https://receipt.test/return-4', '{}', '{}'
);

select is(
  (select count(*)::bigint from public.case_lab_3_incidents where incident_type = 'overdue_receipt'),
  (select overdue_receipt_count + 2::bigint from cl3_refund_test_baseline),
  'a Kassir ID match with a conflicting operation key becomes an overdue receipt incident'
);

select is(
  (select status from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-4'
  )),
  'not_requested',
  'an operation-key conflict cannot issue or regress the early IncomeReturn'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-income-4', repeat('6', 64), 'kassir-income-4',
  'fiscal:payment_income:refund-payment-4',
  (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-4'),
  null, 'Income', 'Processed', 1500000, null, '{}', '{}'
);

select is(
  (select status from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-4'
  )),
  'issued',
  'the dependent Income receipt releases the preserved early IncomeReturn'
);

select is(
  (select fiscal_fields->>'fiscalDocumentNumber' from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-4'
  )),
  'early-return-4',
  'the dependent Income receipt preserves the rematched IncomeReturn fiscal fields'
);

select is(
  (select processing_result from public.case_lab_3_provider_events where provider_event_id = 'receipt-return-4'),
  'matched_early',
  'the dependent Income receipt completes the rematched early IncomeReturn event'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order(6), 'refund-op-6', 1500000, 'wrong early return amount'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-return-6-wrong-amount', repeat('8', 64), 'kassir-return-6',
  (select 'fiscal:refund_income_return:' || id::text from public.case_lab_3_refunds where operation_key = 'refund-op-6'),
  (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-6'),
  (select id from public.case_lab_3_refunds where operation_key = 'refund-op-6'),
  'IncomeReturn', 'Processed', 1500001, 'https://receipt.test/return-6', '{}', '{}'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-6', repeat('9', 64), 'refund-op-6',
  'refund-payment-6', 'refund-provider-6', 1500000, 'KZT', 'confirmed', '{}'
);

select is(
  (select status from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-6'
  )),
  'not_requested',
  'an early IncomeReturn with the wrong amount is not matched to the refund operation'
);

select is(
  (select processing_result from public.case_lab_3_provider_events where provider_event_id = 'receipt-return-6-wrong-amount'),
  'pending_match',
  'an unmatched early IncomeReturn remains durable for later reconciliation'
);

create temp table pg_temp.cl3_early_return_queued on commit drop as
select pg_temp.cl3_seed_paid_refund_order(12) as order_id;

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'income-receipt-12', repeat('a', 64), 'kassir-income-12',
  'fiscal:payment_income:refund-payment-12',
  (select order_id from pg_temp.cl3_early_return_queued), null,
  'Income', 'Processed', 1500000, null, '{}'::jsonb, '{}'::jsonb
);

select public.case_lab_3_create_refund(
  'test', (select order_id from pg_temp.cl3_early_return_queued), 'refund-op-12', 1500000,
  'queued early return receipt'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-return-12', repeat('b', 64), 'kassir-return-12', null,
  (select order_id from pg_temp.cl3_early_return_queued),
  (select id from public.case_lab_3_refunds where operation_key = 'refund-op-12'),
  'IncomeReturn', 'Queued', 1500000, null, '{}'::jsonb, '{}'::jsonb
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-12', repeat('7', 63) || '1', 'refund-op-12',
  'refund-payment-12', 'refund-provider-12', 1500000, 'KZT', 'confirmed', '{}'::jsonb
);

select is(
  (select status from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-12'
  )),
  'queued',
  'an early queued IncomeReturn never rematches as issued'
);

create temp table pg_temp.cl3_early_return_error on commit drop as
select pg_temp.cl3_seed_paid_refund_order(13) as order_id;

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'income-receipt-13', repeat('d', 64), 'kassir-income-13',
  'fiscal:payment_income:refund-payment-13',
  (select order_id from pg_temp.cl3_early_return_error), null,
  'Income', 'Processed', 1500000, null, '{}'::jsonb, '{}'::jsonb
);

select public.case_lab_3_create_refund(
  'test', (select order_id from pg_temp.cl3_early_return_error), 'refund-op-13', 1500000,
  'error early return receipt'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-return-13', repeat('c', 64), 'kassir-return-13', null,
  (select order_id from pg_temp.cl3_early_return_error),
  (select id from public.case_lab_3_refunds where operation_key = 'refund-op-13'),
  'IncomeReturn', 'Error', 1500000, null, '{}'::jsonb, '{}'::jsonb
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-13', repeat('7', 63) || '2', 'refund-op-13',
  'refund-payment-13', 'refund-provider-13', 1500000, 'KZT', 'confirmed', '{}'::jsonb
);

select is(
  (select status from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-13'
  )),
  'queued',
  'an early error IncomeReturn never rematches as issued'
);

create temp table pg_temp.cl3_early_return_unknown on commit drop as
select pg_temp.cl3_seed_paid_refund_order(14) as order_id;

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'income-receipt-14', repeat('f', 64), 'kassir-income-14',
  'fiscal:payment_income:refund-payment-14',
  (select order_id from pg_temp.cl3_early_return_unknown), null,
  'Income', 'Processed', 1500000, null, '{}'::jsonb, '{}'::jsonb
);

select public.case_lab_3_create_refund(
  'test', (select order_id from pg_temp.cl3_early_return_unknown), 'refund-op-14', 1500000,
  'unknown early return receipt'
);

select public.case_lab_3_apply_receipt(
  'test', 'kassir', 'receipt-return-14', repeat('9', 64), 'kassir-return-14', null,
  (select order_id from pg_temp.cl3_early_return_unknown),
  (select id from public.case_lab_3_refunds where operation_key = 'refund-op-14'),
  'IncomeReturn', 'Unknown', 1500000, null, '{}'::jsonb, '{}'::jsonb
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-14', repeat('7', 63) || '3', 'refund-op-14',
  'refund-payment-14', 'refund-provider-14', 1500000, 'KZT', 'confirmed', '{}'::jsonb
);

select is(
  (select status from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-14'
  )),
  'queued',
  'an early unknown IncomeReturn never rematches as issued'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order(5), 'refund-op-5a', 400000, 'first pending refund'
);

select public.case_lab_3_create_refund(
  'test', (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-5a'),
  'refund-op-5a', 400000, 'replayed identical refund request'
);

select is(
  (select count(*)::bigint from public.case_lab_3_refunds where operation_key = 'refund-op-5a'),
  1::bigint,
  'replayed create_refund returns the existing operation idempotently'
);

select public.case_lab_3_create_refund(
  'test', (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-5a'),
  'refund-op-5b', 500000, 'second pending refund'
);

select throws_ok(
  $$ select public.case_lab_3_create_refund(
    'test', (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-5a'),
    'refund-op-5c', 600001, 'exceeds multiple pending balance'
  ) $$,
  '23514',
  'refund amount exceeds the remaining refundable balance',
  'multiple pending refunds are included in the available balance'
);

select is(
  (select refundable_amount_minor from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-5a'
  )),
  600000::bigint,
  'multiple pending refunds leave the exact remaining balance'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order(7), 'refund-op-7a', 1000000, 'confirmed refund with pending remainder'
);

select public.case_lab_3_create_refund(
  'test', (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-7a'),
  'refund-op-7b', 500000, 'outstanding refund remains pending'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-7a', repeat('2', 64), 'refund-op-7a',
  'refund-payment-7', 'refund-provider-7', 1000000, 'KZT', 'confirmed', '{}'
);

select is(
  (select payment_status from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-7a'
  )),
  'refund_pending',
  'a confirmed partial refund preserves refund_pending while another refund is outstanding'
);

update public.case_lab_3_refunds
set status = 'unknown'
where operation_key = 'refund-op-7b';

select throws_ok(
  $$ select public.case_lab_3_create_refund(
    'test', (select order_id from public.case_lab_3_refunds where operation_key = 'refund-op-7a'),
    'refund-op-7c', 500000, 'unknown refund remains outstanding'
  ) $$,
  '23514',
  'refund amount exceeds the remaining refundable balance',
  'unknown refunds remain part of the outstanding balance'
);

select public.case_lab_3_apply_refund(
  'test', 'tiptoppay', 'refund-event-3-repeat', repeat('f', 64), 'refund-op-3',
  'refund-payment-3', 'refund-provider-3', 1500000, 'KZT', 'confirmed', '{}'
);

select is(
  (select count(*)::bigint from public.case_lab_3_fiscal_operations where refund_id = (
    select id from public.case_lab_3_refunds where operation_key = 'refund-op-3'
  )),
  1::bigint,
  'replayed provider Refund remains one operation'
);

select is(
  (select count(*)::bigint from public.case_lab_3_provider_events where event_type = 'Refund'),
  (select refund_provider_event_count + 22::bigint from cl3_refund_test_baseline),
  'refund provider events remain durable and replay-safe alongside pre-existing events'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order((select processing_number from cl3_refund_worker_fixture)),
  format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture)),
  500000, 'worker failure transition'
);

select is(
  public.case_lab_3_begin_refund(
    'test',
    (select order_id from public.case_lab_3_refunds where operation_key = format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture))),
    (select id from public.case_lab_3_refunds where operation_key = format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture))),
    format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture)),
    500000
  )->>'kind',
  'claimed',
  'refund worker claims a requested refund atomically'
);

select is(
  (select status from public.case_lab_3_refunds where operation_key = format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture))),
  'processing',
  'claimed refund is durable in processing state'
);

select is(
  public.case_lab_3_begin_refund(
    'test',
    (select order_id from public.case_lab_3_refunds where operation_key = format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture))),
    (select id from public.case_lab_3_refunds where operation_key = format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture))),
    format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture)),
    500000
  )->>'kind',
  'already_processing',
  'duplicate refund worker claims do not start a second provider request'
);

select is(
  public.case_lab_3_fail_refund(
    'test',
    (select order_id from public.case_lab_3_refunds where operation_key = format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture))),
    (select id from public.case_lab_3_refunds where operation_key = format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture))),
    format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture)),
    500000,
    'provider_refused_refund'
  )->>'kind',
  'failed',
  'provider refusal restores a processing refund through one failure transition'
);

select is(
  (select status from public.case_lab_3_refunds where operation_key = format('refund-op-worker-%s', (select processing_number from cl3_refund_worker_fixture))),
  'failed',
  'failed refund is durable and no longer outstanding'
);

select public.case_lab_3_create_refund(
  'test', pg_temp.cl3_seed_paid_refund_order((select unknown_number from cl3_refund_worker_fixture)),
  format('refund-op-unknown-%s', (select unknown_number from cl3_refund_worker_fixture)),
  500000, 'worker unknown transition'
);

select public.case_lab_3_begin_refund(
  'test',
  (select order_id from public.case_lab_3_refunds where operation_key = format('refund-op-unknown-%s', (select unknown_number from cl3_refund_worker_fixture))),
  (select id from public.case_lab_3_refunds where operation_key = format('refund-op-unknown-%s', (select unknown_number from cl3_refund_worker_fixture))),
  format('refund-op-unknown-%s', (select unknown_number from cl3_refund_worker_fixture)),
  500000
);

select is(
  public.case_lab_3_mark_refund_unknown(
    'test',
    (select order_id from public.case_lab_3_refunds where operation_key = format('refund-op-unknown-%s', (select unknown_number from cl3_refund_worker_fixture))),
    (select id from public.case_lab_3_refunds where operation_key = format('refund-op-unknown-%s', (select unknown_number from cl3_refund_worker_fixture))),
    format('refund-op-unknown-%s', (select unknown_number from cl3_refund_worker_fixture)),
    'provider_result_unknown'
  )->>'kind',
  'unknown',
  'unknown provider result moves the refund into reconciliation state'
);

select is(
  (select status from public.case_lab_3_refunds where operation_key = format('refund-op-unknown-%s', (select unknown_number from cl3_refund_worker_fixture))),
  'unknown',
  'unknown refund is durable and not eligible for blind retry'
);

select ok(
  (select uncertain_since_at is not null from public.case_lab_3_refunds where operation_key = format('refund-op-unknown-%s', (select unknown_number from cl3_refund_worker_fixture))),
  'unknown refund persists an uncertainty timestamp'
);

select is(
  (select payment_status from public.case_lab_3_orders where id = (
    select order_id from public.case_lab_3_refunds where operation_key = format('refund-op-unknown-%s', (select unknown_number from cl3_refund_worker_fixture))
  )),
  'refund_pending',
  'unknown refund keeps the order pending reconciliation'
);

select * from finish();
rollback;
