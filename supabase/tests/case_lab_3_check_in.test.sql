begin;

select plan(45);

insert into public.case_lab_3_legal_document_versions (
  id,
  environment,
  document_kind,
  version_id,
  url,
  publication_label,
  content_snapshot,
  content_hash,
  is_active,
  activated_at
)
values
  (
    '00000000-0000-4000-8000-000000000411'::uuid,
    'test',
    'offer',
    'offer-check-in-1',
    'https://caselab.kz/offer/',
    'Offer check-in 1',
    'Case Lab III offer check-in snapshot',
    encode(digest('Case Lab III offer check-in snapshot', 'sha256'), 'hex'),
    true,
    clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000412'::uuid,
    'test',
    'privacy',
    'privacy-check-in-1',
    'https://caselab.kz/privacy/',
    'Privacy check-in 1',
    'Case Lab III privacy check-in snapshot',
    encode(digest('Case Lab III privacy check-in snapshot', 'sha256'), 'hex'),
    true,
    clock_timestamp()
  );

update public.case_lab_3_event_settings
set active_offer_version_id = '00000000-0000-4000-8000-000000000411'::uuid,
    active_privacy_version_id = '00000000-0000-4000-8000-000000000412'::uuid,
    sales_enabled = true
where environment = 'test';

create temp table cl3_task4_rpc_signatures (signature text primary key) on commit drop;

insert into cl3_task4_rpc_signatures (signature)
values
  ('public.case_lab_3_inventory_availability(text)'),
  ('public.case_lab_3_get_availability(text)'),
  ('public.case_lab_3_create_order(text,jsonb,text,text)'),
  ('public.case_lab_3_create_payment_attempt(uuid)'),
  ('public.case_lab_3_transfer_participant(uuid,jsonb,text,text)'),
  ('public.case_lab_3_transfer_participant(uuid,jsonb,text)'),
  ('public.case_lab_3_cancel_ticket(uuid,text,text)'),
  ('public.case_lab_3_check_in(uuid,uuid,integer)'),
  ('public.case_lab_3_consume_rate_limit(text,text,integer,integer)'),
  ('public.case_lab_3_update_settings(text,integer,boolean,text)'),
  ('public.case_lab_3_create_allocation(text,text,integer,text,boolean,boolean,text,text)'),
  ('public.case_lab_3_release_allocation(text,uuid,text,text)');

create temp table cl3_concurrent_check_results (
  call_number integer primary key,
  response jsonb not null,
  check_in_count integer not null
) on commit drop;

insert into public.case_lab_3_orders (
  id,
  order_number,
  idempotency_key,
  environment,
  first_name,
  last_name,
  participant_email,
  purchaser_email,
  fiscal_email,
  original_contact_snapshot,
  tier,
  amount_minor,
  receipt_label,
  configuration_version,
  offer_version_id,
  privacy_version_id,
  accepted_at,
  payment_status,
  paid_amount_minor,
  refundable_amount_minor
)
values (
  '00000000-0000-4000-8000-000000000421'::uuid,
  'CL3-CHECK-0001',
  'check-in-test-order',
  'test',
  'Check',
  'In',
  'check-in@example.test',
  'buyer@example.test',
  'buyer@example.test',
  '{"firstName":"Check","lastName":"In"}'::jsonb,
  'standard',
  1500000,
  'Участие в Case Lab III, 24.09.2026, Стандарт',
  1,
  '00000000-0000-4000-8000-000000000411'::uuid,
  '00000000-0000-4000-8000-000000000412'::uuid,
  clock_timestamp(),
  'paid',
  1500000,
  1500000
);

insert into public.case_lab_3_tickets (
  id,
  order_id,
  environment,
  public_ticket_number,
  status
)
values (
  '00000000-0000-4000-8000-000000000422'::uuid,
  '00000000-0000-4000-8000-000000000421'::uuid,
  'test',
  'CL3-TICKET-0001',
  'valid'
);

insert into public.case_lab_3_ticket_revisions (
  id,
  ticket_id,
  environment,
  revision_number,
  first_name,
  last_name,
  participant_email,
  token_version,
  creation_reason
)
values (
  '00000000-0000-4000-8000-000000000423'::uuid,
  '00000000-0000-4000-8000-000000000422'::uuid,
  'test',
  1,
  'Check',
  'In',
  'check-in@example.test',
  1,
  'payment_confirmed'
);

update public.case_lab_3_tickets
set current_revision_id = '00000000-0000-4000-8000-000000000423'::uuid
where id = '00000000-0000-4000-8000-000000000422'::uuid;

select is(
  (public.case_lab_3_check_in(
    '00000000-0000-4000-8000-000000000422'::uuid,
    '00000000-0000-4000-8000-000000000423'::uuid,
    1
  )->>'result'),
  'admitted',
  'the first verified current check-in is admitted'
);

select is(
  (select status from public.case_lab_3_tickets where id = '00000000-0000-4000-8000-000000000422'::uuid),
  'used',
  'admission changes the ticket to used'
);

select is(
  (select count(*)::bigint from public.case_lab_3_check_ins where ticket_id = '00000000-0000-4000-8000-000000000422'::uuid),
  1::bigint,
  'the first admission creates exactly one check-in row'
);

select is(
  (public.case_lab_3_check_in(
    '00000000-0000-4000-8000-000000000422'::uuid,
    '00000000-0000-4000-8000-000000000423'::uuid,
    1
  )->>'result'),
  'already_used',
  'a repeated verified scan returns already_used'
);

select is(
  (public.case_lab_3_check_in(
    '00000000-0000-4000-8000-000000000422'::uuid,
    '00000000-0000-4000-8000-000000000423'::uuid,
    99
  )->>'result'),
  'invalid',
  'an old or incorrect token version is invalid'
);

select is(
  (public.case_lab_3_check_in(
    '00000000-0000-4000-8000-000000000422'::uuid,
    '00000000-0000-4000-8000-000000000421'::uuid,
    1
  )->>'result'),
  'invalid',
  'a non-current revision is invalid'
);

select is(
  (public.case_lab_3_check_in(
    '00000000-0000-4000-8000-000000000499'::uuid,
    '00000000-0000-4000-8000-000000000423'::uuid,
    1
  )->>'result'),
  'invalid',
  'an unknown ticket does not leak unrelated data'
);

update public.case_lab_3_tickets
set status = 'cancelled'
where id = '00000000-0000-4000-8000-000000000422'::uuid;

select is(
  (public.case_lab_3_check_in(
    '00000000-0000-4000-8000-000000000422'::uuid,
    '00000000-0000-4000-8000-000000000423'::uuid,
    1
  )->>'result'),
  'cancelled',
  'a cancelled ticket is rejected'
);

select is(
  (select count(*)::bigint from public.case_lab_3_check_ins where ticket_id = '00000000-0000-4000-8000-000000000422'::uuid),
  1::bigint,
  'invalid, repeated, and cancelled scans never create another check-in'
);

update public.case_lab_3_tickets
set status = 'valid'
where id = '00000000-0000-4000-8000-000000000422'::uuid;

select throws_ok(
  $$
    select public.case_lab_3_transfer_participant(
      '00000000-0000-4000-8000-000000000422'::uuid,
      jsonb_build_object(
        'firstName', 'Transferred',
        'lastName', 'Participant',
        'email', 'transferred@example.test',
        'phone', null,
        'company', 'New Company',
        'position', 'Attendee'
      ),
      'pgTAP'
    )
  $$,
  '55000',
  'ticket is not transferable',
  'a ticket with a recorded check-in cannot be transferred'
);

select is(
  (select max(revision_number) from public.case_lab_3_ticket_revisions where ticket_id = '00000000-0000-4000-8000-000000000422'::uuid),
  1,
  'a transfer attempt after check-in creates no new revision'
);

insert into public.case_lab_3_orders (
  id,
  order_number,
  idempotency_key,
  environment,
  first_name,
  last_name,
  participant_email,
  purchaser_email,
  fiscal_email,
  original_contact_snapshot,
  tier,
  amount_minor,
  receipt_label,
  configuration_version,
  offer_version_id,
  privacy_version_id,
  accepted_at,
  payment_status,
  paid_amount_minor,
  refundable_amount_minor
)
values (
  '00000000-0000-4000-8000-000000000424'::uuid,
  'CL3-CHECK-0002',
  'check-in-test-order-2',
  'test',
  'Original',
  'Participant',
  'original@example.test',
  'buyer@example.test',
  'buyer@example.test',
  '{"firstName":"Original","lastName":"Participant"}'::jsonb,
  'standard',
  1500000,
  'Участие в Case Lab III, 24.09.2026, Стандарт',
  1,
  '00000000-0000-4000-8000-000000000411'::uuid,
  '00000000-0000-4000-8000-000000000412'::uuid,
  clock_timestamp(),
  'paid',
  1500000,
  1500000
);

insert into public.case_lab_3_tickets (
  id,
  order_id,
  environment,
  public_ticket_number,
  status
)
values (
  '00000000-0000-4000-8000-000000000425'::uuid,
  '00000000-0000-4000-8000-000000000424'::uuid,
  'test',
  'CL3-TICKET-0002',
  'valid'
);

insert into public.case_lab_3_ticket_revisions (
  id,
  ticket_id,
  environment,
  revision_number,
  first_name,
  last_name,
  participant_email,
  token_version,
  creation_reason
)
values (
  '00000000-0000-4000-8000-000000000426'::uuid,
  '00000000-0000-4000-8000-000000000425'::uuid,
  'test',
  1,
  'Original',
  'Participant',
  'original@example.test',
  1,
  'payment_confirmed'
);

update public.case_lab_3_tickets
set current_revision_id = '00000000-0000-4000-8000-000000000426'::uuid
where id = '00000000-0000-4000-8000-000000000425'::uuid;

select lives_ok(
  $$
    select public.case_lab_3_transfer_participant(
      '00000000-0000-4000-8000-000000000425'::uuid,
      jsonb_build_object(
        'firstName', 'Transferred',
        'lastName', 'Participant',
        'email', 'transferred@example.test',
        'phone', null,
        'company', 'New Company',
        'position', 'Attendee'
      ),
      'pgTAP'
    )
  $$,
  'participant transfer creates a new revision'
);

select is(
  (select max(revision_number) from public.case_lab_3_ticket_revisions where ticket_id = '00000000-0000-4000-8000-000000000425'::uuid),
  2,
  'transfer increments the immutable revision number'
);

select is(
  (select token_version from public.case_lab_3_ticket_revisions where ticket_id = '00000000-0000-4000-8000-000000000425'::uuid and revision_number = 2),
  2,
  'transfer rotates the token version'
);

select is(
  (select participant_email from public.case_lab_3_ticket_revisions where ticket_id = '00000000-0000-4000-8000-000000000425'::uuid and revision_number = 2),
  'transferred@example.test',
  'the current revision contains the new participant'
);

select ok(
  (select current_revision_id = (
    select id from public.case_lab_3_ticket_revisions
    where ticket_id = '00000000-0000-4000-8000-000000000425'::uuid
      and revision_number = 2
  ) from public.case_lab_3_tickets where id = '00000000-0000-4000-8000-000000000425'::uuid),
  'transfer updates the current revision pointer'
);

select is(
  (public.case_lab_3_check_in(
    '00000000-0000-4000-8000-000000000425'::uuid,
    '00000000-0000-4000-8000-000000000426'::uuid,
    1
  )->>'result'),
  'invalid',
  'the previous revision cannot be checked in after transfer'
);

select is(
  (select count(*)::bigint from public.case_lab_3_check_ins where ticket_id = '00000000-0000-4000-8000-000000000422'::uuid),
  1::bigint,
  'transfer attempts preserve the unique first check-in relation'
);

select is(
  (select count(*)::bigint from pg_constraint where conrelid = 'public.case_lab_3_check_ins'::regclass and conname = 'case_lab_3_check_ins_ticket_environment_fk'),
  1::bigint,
  'check-ins retain the composite environment foreign key'
);

select is(
  (select count(*)::bigint from pg_constraint where conrelid = 'public.case_lab_3_check_ins'::regclass and conname = 'case_lab_3_check_ins_revision_environment_fk'),
  1::bigint,
  'check-in revisions retain the composite environment foreign key'
);

select is(
  (select count(*)::bigint from pg_constraint where conrelid = 'public.case_lab_3_check_ins'::regclass and contype = 'u' and pg_get_constraintdef(oid) like '%ticket_id%'),
  1::bigint,
  'the ticket check-in relation is unique for concurrent scans'
);

insert into public.case_lab_3_orders (
  id,
  order_number,
  idempotency_key,
  environment,
  first_name,
  last_name,
  participant_email,
  purchaser_email,
  fiscal_email,
  original_contact_snapshot,
  tier,
  amount_minor,
  receipt_label,
  configuration_version,
  offer_version_id,
  privacy_version_id,
  accepted_at,
  payment_status,
  ticket_status,
  paid_amount_minor,
  refundable_amount_minor
)
values (
  '00000000-0000-4000-8000-000000000427'::uuid,
  'CL3-CHECK-0003',
  'check-in-test-order-3',
  'test',
  'Cancel',
  'Participant',
  'cancel@example.test',
  'buyer@example.test',
  'buyer@example.test',
  '{"firstName":"Cancel","lastName":"Participant"}'::jsonb,
  'standard',
  1500000,
  'Участие в Case Lab III, 24.09.2026, Стандарт',
  1,
  '00000000-0000-4000-8000-000000000411'::uuid,
  '00000000-0000-4000-8000-000000000412'::uuid,
  clock_timestamp(),
  'paid',
  'valid',
  1500000,
  1500000
);

insert into public.case_lab_3_tickets (
  id,
  order_id,
  environment,
  public_ticket_number,
  status
)
values (
  '00000000-0000-4000-8000-000000000428'::uuid,
  '00000000-0000-4000-8000-000000000427'::uuid,
  'test',
  'CL3-TICKET-0003',
  'valid'
);

insert into public.case_lab_3_ticket_revisions (
  id,
  ticket_id,
  environment,
  revision_number,
  first_name,
  last_name,
  participant_email,
  token_version,
  creation_reason
)
values (
  '00000000-0000-4000-8000-000000000429'::uuid,
  '00000000-0000-4000-8000-000000000428'::uuid,
  'test',
  1,
  'Cancel',
  'Participant',
  'cancel@example.test',
  1,
  'payment_confirmed'
);

update public.case_lab_3_tickets
set current_revision_id = '00000000-0000-4000-8000-000000000429'::uuid
where id = '00000000-0000-4000-8000-000000000428'::uuid;

select is(
  (public.case_lab_3_cancel_ticket(
    '00000000-0000-4000-8000-000000000428'::uuid,
    'pgTAP',
    'behavioral cancellation test'
  )->>'kind'),
  'cancelled',
  'ticket cancellation returns the cancelled result'
);

select results_eq(
  $$
    select order_row.ticket_status, ticket.status, order_row.payment_status
    from public.case_lab_3_orders order_row
    join public.case_lab_3_tickets ticket on ticket.order_id = order_row.id
    where ticket.id = '00000000-0000-4000-8000-000000000428'::uuid
  $$,
  $$ values ('cancelled', 'cancelled', 'paid') $$,
  'cancellation updates the order summary and ticket without changing payment status'
);

select is(
  (public.case_lab_3_check_in(
    '00000000-0000-4000-8000-000000000428'::uuid,
    '00000000-0000-4000-8000-000000000429'::uuid,
    1
  )->>'result'),
  'cancelled',
  'a behaviourally cancelled ticket is rejected at check-in'
);

select is(
  (select count(*)::bigint
   from public.case_lab_3_audit_log
   where action = 'ticket_cancelled'
     and target_id = '00000000-0000-4000-8000-000000000428'::uuid),
  1::bigint,
  'ticket cancellation writes one audit record'
);

create temp table cl3_rate_limit_calls (
  request_number integer primary key,
  response jsonb not null
) on commit drop;

insert into cl3_rate_limit_calls (request_number, response)
values (1, public.case_lab_3_consume_rate_limit('inventory-test', repeat('d', 64), 3, 60));

insert into cl3_rate_limit_calls (request_number, response)
values (2, public.case_lab_3_consume_rate_limit('inventory-test', repeat('d', 64), 3, 60));

insert into cl3_rate_limit_calls (request_number, response)
values (3, public.case_lab_3_consume_rate_limit('inventory-test', repeat('d', 64), 3, 60));

insert into cl3_rate_limit_calls (request_number, response)
values (4, public.case_lab_3_consume_rate_limit('inventory-test', repeat('d', 64), 3, 60));

select is(
  ((select response from cl3_rate_limit_calls where request_number = 1)->>'allowed')::boolean,
  true,
  'the first fixed-window request is allowed'
);

select is(
  ((select response from cl3_rate_limit_calls where request_number = 1)->>'remaining')::integer,
  2,
  'the first fixed-window request returns two remaining attempts'
);

select is(
  ((select response from cl3_rate_limit_calls where request_number = 2)->>'allowed')::boolean,
  true,
  'the second fixed-window request is allowed'
);

select is(
  ((select response from cl3_rate_limit_calls where request_number = 2)->>'remaining')::integer,
  1,
  'the second fixed-window request returns one remaining attempt'
);

select is(
  ((select response from cl3_rate_limit_calls where request_number = 3)->>'allowed')::boolean,
  true,
  'the third fixed-window request is the final allowed request'
);

select is(
  ((select response from cl3_rate_limit_calls where request_number = 3)->>'remaining')::integer,
  0,
  'the final allowed request returns zero remaining attempts'
);

select is(
  ((select response from cl3_rate_limit_calls where request_number = 4)->>'allowed')::boolean,
  false,
  'the fourth fixed-window request is denied'
);

select is(
  ((select response from cl3_rate_limit_calls where request_number = 4)->>'remaining')::integer,
  0,
  'a denied exhausted request returns zero remaining attempts'
);

select is(
  (select count(*)::bigint from public.case_lab_3_rate_limits where scope = 'inventory-test' and purpose_ip_hash = repeat('d', 64)),
  1::bigint,
   'repeated limiter calls use one unique bucket row; concurrency relies on the atomic upsert'
);

select is(
  (select used_count from public.case_lab_3_rate_limits where scope = 'inventory-test' and purpose_ip_hash = repeat('d', 64)),
  3,
  'an exhausted limiter bucket never increments beyond its configured limit'
);

select ok(
  (select prosrc like '%on conflict (scope, purpose_ip_hash, bucket_start)%'
     and prosrc like '%used_count <%'
     and prosrc not like '%used_count <=%'
     and prosrc like '%returning * into v_bucket%'
     and prosrc like '%if found then%'
    from pg_proc
    where oid = 'public.case_lab_3_consume_rate_limit(text,text,integer,integer)'::regprocedure),
  'rate-limit consumption uses an atomic unique-bucket upsert with a hard cap and admitted-call marker'
);

insert into cl3_rate_limit_calls (request_number, response)
values (5, public.case_lab_3_consume_rate_limit('expiry-test', repeat('e', 64), 2, 1));

do $$ begin perform pg_sleep(1.1); end $$;

insert into cl3_rate_limit_calls (request_number, response)
values (6, public.case_lab_3_consume_rate_limit('expiry-test', repeat('e', 64), 2, 1));

select is(
  ((select response from cl3_rate_limit_calls where request_number = 5)->>'remaining')::integer,
  1,
  'a new limiter bucket starts with its full quota'
);

select is(
  ((select response from cl3_rate_limit_calls where request_number = 6)->>'remaining')::integer,
  1,
  'an expired fixed window starts a fresh quota'
);

select throws_ok(
  $$ select public.case_lab_3_consume_rate_limit('null-limit', repeat('n', 64), null::integer, 1) $$,
  '22023',
  'invalid rate limit parameters',
  'a null limiter count is rejected'
);

select throws_ok(
  $$ select public.case_lab_3_consume_rate_limit('null-bucket', repeat('o', 64), 2, null::integer) $$,
  '22023',
  'invalid rate limit parameters',
  'a null limiter bucket duration is rejected'
);

select is(
  (select count(*)::bigint
   from cl3_task4_rpc_signatures rpc
   where has_function_privilege('service_role', rpc.signature, 'EXECUTE')
     and not has_function_privilege('anon', rpc.signature, 'EXECUTE')
     and not has_function_privilege('authenticated', rpc.signature, 'EXECUTE')),
  12::bigint,
  'every Task 4 RPC is executable only by service_role'
);

select is(
  (select count(*)::bigint
   from cl3_task4_rpc_signatures rpc
   where exists (
     select 1
     from pg_proc function_row
     where function_row.oid = rpc.signature::regprocedure
       and function_row.prokind = 'f'
       and function_row.prosecdef
       and function_row.proconfig @> array['search_path=pg_catalog, public, extensions']
   )),
  12::bigint,
  'every Task 4 RPC is SECURITY DEFINER with the fixed search path'
);

select ok(
  (select prosrc like '%from public.case_lab_3_event_settings%' and prosrc like '%for update%'
    from pg_proc where oid = 'public.case_lab_3_inventory_availability(text)'::regprocedure)
  and (select prosrc like '%from public.case_lab_3_event_settings%' and prosrc like '%for update%'
    from pg_proc where oid = 'public.case_lab_3_create_order(text,jsonb,text,text)'::regprocedure)
  and (select prosrc like '%from public.case_lab_3_event_settings%' and prosrc like '%for update%'
    from pg_proc where oid = 'public.case_lab_3_create_payment_attempt(uuid)'::regprocedure)
  and (select prosrc like '%from public.case_lab_3_event_settings%' and prosrc like '%for update%'
    from pg_proc where oid = 'public.case_lab_3_create_allocation(text,text,integer,text,boolean,boolean,text,text)'::regprocedure)
  and (select prosrc like '%from public.case_lab_3_event_settings%' and prosrc like '%for update%'
    from pg_proc where oid = 'public.case_lab_3_release_allocation(text,uuid,text,text)'::regprocedure)
  and (select prosrc like '%from public.case_lab_3_tickets%' and prosrc like '%for update%'
    from pg_proc where oid = 'public.case_lab_3_check_in(uuid,uuid,integer)'::regprocedure),
  'Task 4 state-changing RPCs retain row-locking assertions without claiming concurrent execution'
);

-- dblink is optional, but when available this submits two real sessions behind one ticket lock.
do $cl3_concurrent_check$
begin
  if not exists (
       select 1
       from pg_available_extensions
       where name = 'dblink'
     )
     or not exists (
       select 1
       from pg_roles
       where rolname = current_user
         and rolsuper
     ) then
    return;
  end if;

  if not exists (
       select 1
       from pg_extension
       where extname = 'dblink'
     ) then
    begin
      execute 'create extension dblink';
    exception when others then
      return;
    end;
  end if;

  execute $cl3_runner$
  declare
    v_conninfo text := 'dbname=' || current_database();
    v_cleanup text := $cl3_cleanup_sql$begin
      delete from public.case_lab_3_check_ins
      where ticket_id = '00000000-0000-4000-8000-000000000432'::uuid;
      update public.case_lab_3_tickets
      set current_revision_id = null
      where id = '00000000-0000-4000-8000-000000000432'::uuid;
      alter table public.case_lab_3_ticket_revisions
        disable trigger case_lab_3_immutable_ticket_revisions;
      delete from public.case_lab_3_ticket_revisions
      where id = '00000000-0000-4000-8000-000000000433'::uuid;
      alter table public.case_lab_3_ticket_revisions
        enable trigger case_lab_3_immutable_ticket_revisions;
      delete from public.case_lab_3_tickets
      where id = '00000000-0000-4000-8000-000000000432'::uuid;
      delete from public.case_lab_3_orders
      where id = '00000000-0000-4000-8000-000000000431'::uuid;
    commit;$cl3_cleanup_sql$;
    v_response jsonb;
    v_check_in_count integer;
  begin
    perform dblink_connect('cl3-check-coordinator', v_conninfo);
    perform dblink_connect('cl3-check-a', v_conninfo);
    perform dblink_connect('cl3-check-b', v_conninfo);

    perform dblink_exec('cl3-check-coordinator', v_cleanup);
    perform dblink_exec('cl3-check-coordinator', 'insert into public.case_lab_3_orders (
      id, order_number, idempotency_key, environment, first_name, last_name,
      participant_email, purchaser_email, fiscal_email, original_contact_snapshot,
      tier, amount_minor, receipt_label, configuration_version,
      offer_version_id, privacy_version_id, accepted_at, payment_status,
      paid_amount_minor, refundable_amount_minor
    ) values (
      ''00000000-0000-4000-8000-000000000431''::uuid,
      ''CL3-CONCURRENT-CHECK-1'', ''cl3-concurrent-check-1'', ''test'',
      ''Concurrent'', ''Check'', ''concurrent-check@example.test'',
      ''concurrent-check@example.test'', ''concurrent-check@example.test'',
      ''{"firstName":"Concurrent","lastName":"Check"}''::jsonb,
      ''standard'', 1500000, ''Case Lab III Standard'', 1,
      ''00000000-0000-4000-8000-000000000801''::uuid,
      ''00000000-0000-4000-8000-000000000802''::uuid,
      clock_timestamp(), ''paid'', 1500000, 1500000
    )');
    perform dblink_exec('cl3-check-coordinator', 'insert into public.case_lab_3_tickets (
      id, order_id, environment, public_ticket_number, status
    ) values (
      ''00000000-0000-4000-8000-000000000432''::uuid,
      ''00000000-0000-4000-8000-000000000431''::uuid,
      ''test'', ''CL3-CONCURRENT-TICKET-1'', ''valid''
    )');
    perform dblink_exec('cl3-check-coordinator', 'insert into public.case_lab_3_ticket_revisions (
      id, ticket_id, environment, revision_number, first_name, last_name,
      participant_email, token_version, creation_reason
    ) values (
      ''00000000-0000-4000-8000-000000000433''::uuid,
      ''00000000-0000-4000-8000-000000000432''::uuid,
      ''test'', 1, ''Concurrent'', ''Check'',
      ''concurrent-check@example.test'', 1, ''payment_confirmed''
    )');
    perform dblink_exec('cl3-check-coordinator', 'update public.case_lab_3_tickets
      set current_revision_id = ''00000000-0000-4000-8000-000000000433''::uuid
      where id = ''00000000-0000-4000-8000-000000000432''::uuid');
    perform dblink_exec('cl3-check-coordinator', 'commit');

    perform dblink_exec('cl3-check-coordinator', 'begin');
    perform dblink_exec('cl3-check-coordinator', 'update public.case_lab_3_tickets
      set updated_at = updated_at
      where id = ''00000000-0000-4000-8000-000000000432''::uuid');

    perform dblink_send_query('cl3-check-a', 'select public.case_lab_3_check_in(
      ''00000000-0000-4000-8000-000000000432''::uuid,
      ''00000000-0000-4000-8000-000000000433''::uuid, 1)');
    perform dblink_send_query('cl3-check-b', 'select public.case_lab_3_check_in(
      ''00000000-0000-4000-8000-000000000432''::uuid,
      ''00000000-0000-4000-8000-000000000433''::uuid, 1)');
    if dblink_is_busy('cl3-check-a') <> 1 or dblink_is_busy('cl3-check-b') <> 1 then
      raise exception 'concurrent check-in calls did not remain in flight';
    end if;
    perform dblink_exec('cl3-check-coordinator', 'commit');

    select response
    into v_response
    from dblink_get_result('cl3-check-a') as result(response jsonb);
    select check_in_count
    into v_check_in_count
    from dblink(
      'cl3-check-coordinator',
      'select count(*)::integer from public.case_lab_3_check_ins
       where ticket_id = ''00000000-0000-4000-8000-000000000432''::uuid'
    ) as result(check_in_count integer);
    insert into pg_temp.cl3_concurrent_check_results
      (call_number, response, check_in_count)
    values (1, v_response, v_check_in_count);

    select response
    into v_response
    from dblink_get_result('cl3-check-b') as result(response jsonb);
    insert into pg_temp.cl3_concurrent_check_results
      (call_number, response, check_in_count)
    values (2, v_response, v_check_in_count);

    perform dblink_exec('cl3-check-coordinator', v_cleanup);

    perform dblink_disconnect('cl3-check-a');
    perform dblink_disconnect('cl3-check-b');
    perform dblink_disconnect('cl3-check-coordinator');
  exception when others then
    begin
      perform dblink_exec('cl3-check-coordinator', 'rollback');
      perform dblink_exec('cl3-check-coordinator', v_cleanup);
    exception when others then
      null;
    end;
    begin
      perform dblink_disconnect('cl3-check-a');
    exception when others then
      null;
    end;
    begin
      perform dblink_disconnect('cl3-check-b');
    exception when others then
      null;
    end;
    begin
      perform dblink_disconnect('cl3-check-coordinator');
    exception when others then
      null;
    end;
    raise;
  end;
  $cl3_runner$;
end;
$cl3_concurrent_check$;

select skip(
  1,
  'dblink is unavailable or cannot be enabled safely in this database'
)
where not exists (
  select 1
  from pg_extension
  where extname = 'dblink'
)
or not exists (
  select 1
  from pg_roles
  where rolname = current_user
    and rolsuper
);

select ok(
  (select count(*)::integer from cl3_concurrent_check_results) = 2
  and (select count(*)::integer from cl3_concurrent_check_results where response->>'result' = 'admitted') = 1
  and (select count(*)::integer from cl3_concurrent_check_results where response->>'result' = 'already_used') = 1
  and (select min(check_in_count) from cl3_concurrent_check_results) = 1
  and (select max(check_in_count) from cl3_concurrent_check_results) = 1,
  'two concurrent check-ins serialize to one admission and one already_used result'
)
where exists (
  select 1
  from pg_extension
  where extname = 'dblink'
)
and exists (
  select 1
  from pg_roles
  where rolname = current_user
    and rolsuper
);

select ok(
  has_function_privilege('service_role', 'public.case_lab_3_check_in(uuid,uuid,integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.case_lab_3_check_in(uuid,uuid,integer)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.case_lab_3_check_in(uuid,uuid,integer)', 'EXECUTE'),
  'check-in execution is granted only to service_role'
);

select * from finish();
rollback;
