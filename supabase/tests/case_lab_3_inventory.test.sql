begin;

select plan(83);

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
    '00000000-0000-4000-8000-000000000401'::uuid,
    'test',
    'offer',
    'offer-2026-09-07',
    'https://caselab.kz/offer/',
    'Offer test 1',
    'Case Lab III offer test snapshot',
    encode(digest('Case Lab III offer test snapshot', 'sha256'), 'hex'),
    true,
    clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000402'::uuid,
    'test',
    'privacy',
    'privacy-2026-09-07',
    'https://caselab.kz/privacy/',
    'Privacy test 1',
    'Case Lab III privacy test snapshot',
    encode(digest('Case Lab III privacy test snapshot', 'sha256'), 'hex'),
    true,
    clock_timestamp()
)
on conflict (environment, document_kind, version_id) do nothing;

update public.case_lab_3_event_settings
set active_offer_version_id = (
      select id
      from public.case_lab_3_legal_document_versions
      where environment = 'test'
        and document_kind = 'offer'
        and version_id = 'offer-2026-09-07'
    ),
    active_privacy_version_id = (
      select id
      from public.case_lab_3_legal_document_versions
      where environment = 'test'
        and document_kind = 'privacy'
        and version_id = 'privacy-2026-09-07'
    ),
    sales_enabled = true
where environment = 'test';

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
values (
  '00000000-0000-4000-8000-000000000403'::uuid,
  'test',
  'offer',
  'offer-inactive-test',
  'https://caselab.kz/offer/',
  'Inactive offer test',
  'Case Lab III inactive offer test snapshot',
  encode(digest('Case Lab III inactive offer test snapshot', 'sha256'), 'hex'),
  false,
  null
),
(
  '00000000-0000-4000-8000-000000000404'::uuid,
  'test',
  'offer',
  'offer-active-alternative-test',
  'https://caselab.kz/offer/',
  'Alternative active offer test',
  'Case Lab III alternative active offer test snapshot',
  encode(digest('Case Lab III alternative active offer test snapshot', 'sha256'), 'hex'),
  true,
  clock_timestamp()
);

create or replace function pg_temp.cl3_seed_reservation(
  p_number integer,
  p_tier text default 'standard',
  p_paid boolean default false,
  p_reservation_status text default 'active'
)
returns uuid
language plpgsql
as $$
declare
  v_order_id uuid;
  v_amount bigint;
  v_payment_status text;
  v_offer_version_id uuid;
  v_privacy_version_id uuid;
  v_reservation_id uuid;
begin
  v_amount := case when p_tier = 'early_bird' then 789000 else 1500000 end;
  v_payment_status := case when p_paid then 'paid' else 'pending' end;

  select active_offer_version_id, active_privacy_version_id
  into v_offer_version_id, v_privacy_version_id
  from public.case_lab_3_event_settings
  where environment = 'test';

  insert into public.case_lab_3_orders (
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
    refundable_amount_minor,
    paid_at
  )
  values (
    format('CL3-TEST-%s', to_char(p_number, 'FM00000')),
    format('inventory-test-%s', p_number),
    'test',
    'Test',
    format('Participant %s', p_number),
    format('participant-%s@example.test', p_number),
    format('participant-%s@example.test', p_number),
    format('participant-%s@example.test', p_number),
    jsonb_build_object('firstName', 'Test', 'lastName', format('Participant %s', p_number)),
    p_tier,
    v_amount,
    case when p_tier = 'early_bird'
      then 'Участие в Case Lab III, 24.09.2026, Early Bird'
      else 'Участие в Case Lab III, 24.09.2026, Стандарт'
    end,
    1,
    v_offer_version_id,
    v_privacy_version_id,
    clock_timestamp(),
    v_payment_status,
    case when p_paid then v_amount else 0 end,
    case when p_paid then v_amount else 0 end,
    case when p_paid then clock_timestamp() else null end
  )
  returning id into v_order_id;

  insert into public.case_lab_3_reservations (
    order_id,
    environment,
    tier,
    expires_at,
    status
  )
  values (v_order_id, 'test', p_tier, clock_timestamp() + interval '15 minutes', p_reservation_status)
  returning id into v_reservation_id;

  if p_paid then
    insert into public.case_lab_3_payment_attempts (
      external_id,
      order_id,
      reservation_id,
      environment,
      amount_minor,
      provider_transaction_id,
      status,
      completed_at
    )
    values (
      format('inventory-attempt-%s', p_number),
      v_order_id,
      v_reservation_id,
      'test',
      v_amount,
      format('inventory-payment-%s', p_number),
      'completed',
      clock_timestamp()
    );
  end if;

  return v_order_id;
end;
$$;

create or replace function pg_temp.cl3_reset_inventory()
returns void
language plpgsql
as $$
begin
  update public.case_lab_3_reservations
  set admitted_payment_attempt_id = null
  where environment = 'test'
    and order_id in (
      select id
      from public.case_lab_3_orders
      where environment = 'test'
        and idempotency_key like 'inventory-test-%'
    );
  delete from public.case_lab_3_check_ins
  where environment = 'test'
    and ticket_id in (
      select id
      from public.case_lab_3_tickets
      where environment = 'test'
        and order_id in (
          select id
          from public.case_lab_3_orders
          where environment = 'test'
            and idempotency_key like 'inventory-test-%'
        )
    );
  delete from public.case_lab_3_ticket_revisions
  where environment = 'test'
    and ticket_id in (
      select id
      from public.case_lab_3_tickets
      where environment = 'test'
        and order_id in (
          select id
          from public.case_lab_3_orders
          where environment = 'test'
            and idempotency_key like 'inventory-test-%'
        )
    );
  delete from public.case_lab_3_tickets
  where environment = 'test'
    and order_id in (
      select id
      from public.case_lab_3_orders
      where environment = 'test'
        and idempotency_key like 'inventory-test-%'
    );
  delete from public.case_lab_3_provider_events
  where environment = 'test'
    and order_id in (
      select id
      from public.case_lab_3_orders
      where environment = 'test'
        and idempotency_key like 'inventory-test-%'
    );
  delete from public.case_lab_3_fiscal_operations
  where environment = 'test'
    and order_id in (
      select id
      from public.case_lab_3_orders
      where environment = 'test'
        and idempotency_key like 'inventory-test-%'
    );
  delete from public.case_lab_3_email_deliveries
  where environment = 'test'
    and order_id in (
      select id
      from public.case_lab_3_orders
      where environment = 'test'
        and idempotency_key like 'inventory-test-%'
    );
  delete from public.case_lab_3_analytics_events
  where environment = 'test'
    and order_id in (
      select id
      from public.case_lab_3_orders
      where environment = 'test'
        and idempotency_key like 'inventory-test-%'
    );
  delete from public.case_lab_3_jobs
  where environment = 'test'
    and order_id in (
      select id
      from public.case_lab_3_orders
      where environment = 'test'
        and idempotency_key like 'inventory-test-%'
    );
  delete from public.case_lab_3_incidents
  where environment = 'test'
    and order_id in (
      select id
      from public.case_lab_3_orders
      where environment = 'test'
        and idempotency_key like 'inventory-test-%'
    );
  delete from public.case_lab_3_refunds
  where environment = 'test'
    and order_id in (
      select id
      from public.case_lab_3_orders
      where environment = 'test'
        and idempotency_key like 'inventory-test-%'
    );
  delete from public.case_lab_3_payment_attempts
  where environment = 'test'
    and order_id in (
      select id
      from public.case_lab_3_orders
      where environment = 'test'
        and idempotency_key like 'inventory-test-%'
    );
  delete from public.case_lab_3_inventory_allocations
  where environment = 'test'
    and actor_label = 'pgTAP';
  delete from public.case_lab_3_reservations
  where environment = 'test'
    and order_id in (
      select id
      from public.case_lab_3_orders
      where environment = 'test'
        and idempotency_key like 'inventory-test-%'
    );
  delete from public.case_lab_3_orders
  where environment = 'test'
    and idempotency_key like 'inventory-test-%';
end;
$$;

create or replace function pg_temp.cl3_create_order(
  p_idempotency_key text,
  p_tier text,
  p_amount_minor bigint
)
returns jsonb
language sql
as $$
  select public.case_lab_3_create_order(
    'test',
    jsonb_build_object(
      'firstName', 'RPC',
      'lastName', 'Coverage',
      'email', p_idempotency_key || '@example.test',
      'phone', null,
      'company', null,
      'position', null,
      'expectedTier', p_tier,
      'expectedAmountMinor', p_amount_minor,
      'offerVersionId', 'offer-2026-09-07',
      'privacyVersionId', 'privacy-2026-09-07',
      'marketingConsent', false,
      'attribution', '{}'::jsonb
    ),
    p_idempotency_key,
    repeat('f', 64)
  );
$$;

create or replace function pg_temp.cl3_remaining_early_bird_places()
returns integer
language sql
as $$
  select greatest(
    0,
    settings.early_bird_quota - (
      select count(*)::integer
      from public.case_lab_3_orders
      where environment = 'test'
        and tier = 'early_bird'
        and paid_amount_minor > 0
        and payment_status in ('paid', 'refund_pending', 'partially_refunded', 'refunded')
    ) - (
      select coalesce(sum(quantity), 0)::integer
      from public.case_lab_3_inventory_allocations
      where environment = 'test'
        and allocation_category = 'paid'
        and tier = 'early_bird'
    )
  )
  from public.case_lab_3_event_settings settings
  where settings.environment = 'test';
$$;

create or replace function pg_temp.cl3_existing_online_commitment()
returns integer
language sql
as $$
  select (
    select count(*)::integer
    from public.case_lab_3_reservations
    where environment = 'test'
      and status in ('active', 'processing', 'consumed')
  ) + (
    select coalesce(sum(quantity), 0)::integer
    from public.case_lab_3_inventory_allocations
    where environment = 'test'
      and counts_toward_online_limit
      and released_at is null
  );
$$;

create temp table cl3_settings_snapshot on commit drop as
select active_fiscal_policy_version_id,
       active_offer_version_id,
       active_privacy_version_id,
       sales_cutoff
from public.case_lab_3_event_settings
where environment = 'test';

update public.case_lab_3_event_settings
set sales_enabled = false
where environment = 'test';

select is(
  (public.case_lab_3_get_availability('test')->>'reason'),
  'sales_closed',
  'disabled sales close availability'
);

select is(
  (pg_temp.cl3_create_order('inventory-test-sales-closed', 'early_bird', 789000)->>'kind'),
  'unavailable',
  'disabled sales prevent order creation'
);

update public.case_lab_3_event_settings
set sales_enabled = true
where environment = 'test';

update public.case_lab_3_event_settings
set sales_cutoff = clock_timestamp() - interval '1 second'
where environment = 'test';

select is(
  (public.case_lab_3_get_availability('test')->>'reason'),
  'sales_closed',
  'a passed sales cutoff closes availability'
);

update public.case_lab_3_event_settings
set sales_cutoff = (select sales_cutoff from cl3_settings_snapshot)
where environment = 'test';

update public.case_lab_3_event_settings
set sales_enabled = false,
    active_offer_version_id = null
where environment = 'test';

select is(
  (public.case_lab_3_get_availability('test')->>'reason'),
  'configuration_incomplete',
  'an inactive offer version closes availability'
);

update public.case_lab_3_event_settings
set sales_enabled = true,
    active_offer_version_id = (select active_offer_version_id from cl3_settings_snapshot)
where environment = 'test';

update public.case_lab_3_event_settings
set sales_enabled = false,
    active_privacy_version_id = null
where environment = 'test';

select is(
  (public.case_lab_3_get_availability('test')->>'reason'),
  'configuration_incomplete',
  'an inactive privacy version closes availability'
);

update public.case_lab_3_event_settings
set sales_enabled = true,
    active_privacy_version_id = (select active_privacy_version_id from cl3_settings_snapshot)
where environment = 'test';

update public.case_lab_3_event_settings
set sales_enabled = false,
    active_fiscal_policy_version_id = null
where environment = 'test';

select is(
  (public.case_lab_3_get_availability('test')->>'reason'),
  'configuration_incomplete',
  'an incomplete fiscal policy closes availability'
);

update public.case_lab_3_event_settings
set sales_enabled = true,
    active_fiscal_policy_version_id = (select active_fiscal_policy_version_id from cl3_settings_snapshot)
where environment = 'test';

select ok(
  (select prokind = 'f' and prosecdef from pg_proc where oid = 'public.case_lab_3_get_availability(text)'::regprocedure),
  'availability is a SECURITY DEFINER function'
);

select ok(
  (select prokind = 'f' and prosecdef from pg_proc where oid = 'public.case_lab_3_create_order(text,jsonb,text,text)'::regprocedure),
  'order creation is a SECURITY DEFINER function'
);

select is(
  (public.case_lab_3_get_availability('test')->>'tier'),
  'early_bird',
  'the first sellable offer is Early Bird'
);

select is(
  (pg_temp.cl3_create_order('inventory-test-idempotent', 'early_bird', 789000)->>'kind'),
  'created',
  'the first order request creates one reservation'
);

select is(
  (pg_temp.cl3_create_order('inventory-test-idempotent', 'early_bird', 789000)->>'orderId'),
  (select id::text from public.case_lab_3_orders where idempotency_key = 'inventory-test-idempotent'),
  'an exact idempotency repeat returns the original order'
);

select throws_ok(
  $$
    select public.case_lab_3_create_order(
      'test',
      jsonb_build_object(
        'firstName', 'Changed',
        'lastName', 'Coverage',
        'email', 'inventory-test-idempotent@example.test',
        'expectedTier', 'early_bird',
        'expectedAmountMinor', 789000,
        'offerVersionId', 'offer-2026-09-07',
        'privacyVersionId', 'privacy-2026-09-07',
        'marketingConsent', false,
        'attribution', '{}'::jsonb
      ),
      'inventory-test-idempotent',
      repeat('f', 64)
    )
  $$,
  '23505',
  'idempotency key conflicts with an existing order',
  'a changed participant cannot reuse the original idempotency key'
);

select throws_ok(
  $$ select pg_temp.cl3_create_order('inventory-test-idempotent', 'standard', 1500000) $$,
  '23505',
  'idempotency key conflicts with an existing order',
  'a changed tariff cannot reuse the original idempotency key'
);

select throws_ok(
  $$
    select public.case_lab_3_create_order(
      'test',
      jsonb_build_object(
        'firstName', 'RPC',
        'lastName', 'Coverage',
        'email', 'inventory-test-idempotent@example.test',
        'expectedTier', 'early_bird',
        'expectedAmountMinor', 789000,
        'offerVersionId', 'offer-active-alternative-test',
        'privacyVersionId', 'privacy-2026-09-07',
        'marketingConsent', false,
        'attribution', '{}'::jsonb
      ),
      'inventory-test-idempotent',
      repeat('f', 64)
    )
  $$,
  '23505',
  'idempotency key conflicts with an existing order',
  'a changed legal version cannot reuse the original idempotency key'
);

select throws_ok(
  $$
    select public.case_lab_3_create_order(
      'test',
      jsonb_build_object(
        'firstName', 'RPC',
        'lastName', 'Coverage',
        'email', 'inventory-test-idempotent@example.test',
        'expectedTier', 'early_bird',
        'expectedAmountMinor', 789000,
        'offerVersionId', 'offer-2026-09-07',
        'privacyVersionId', 'privacy-2026-09-07',
        'marketingConsent', false,
        'attribution', jsonb_build_object('utm_source', 'changed-source')
      ),
      'inventory-test-idempotent',
      repeat('f', 64)
    )
  $$,
  '23505',
  'idempotency key conflicts with an existing order',
  'changed attribution cannot reuse the original idempotency key'
);

select results_eq(
  $$
    select offer_version_id::text, privacy_version_id::text
    from public.case_lab_3_orders
    where idempotency_key = 'inventory-test-idempotent'
  $$,
  $$
    values
      (
        (select active_offer_version_id::text from public.case_lab_3_event_settings where environment = 'test'),
        (select active_privacy_version_id::text from public.case_lab_3_event_settings where environment = 'test')
      )
  $$,
  'stable legal version strings resolve to the active legal row UUIDs'
);

select results_eq(
  $$
    select order_row.ticket_status, count(ticket.id)::bigint
    from public.case_lab_3_orders order_row
    left join public.case_lab_3_tickets ticket on ticket.order_id = order_row.id
    where order_row.idempotency_key = 'inventory-test-idempotent'
    group by order_row.ticket_status
  $$,
  $$ values ('pending', 0::bigint) $$,
  'a newly created order keeps a pending summary until a ticket row exists'
);

select throws_ok(
  $$
    select public.case_lab_3_create_order(
      'test',
      jsonb_build_object(
        'firstName', 'Wrong',
        'lastName', 'Kind',
        'email', 'wrong-kind@example.test',
        'expectedTier', 'early_bird',
        'expectedAmountMinor', 789000,
        'offerVersionId', 'privacy-2026-09-07',
        'privacyVersionId', 'privacy-2026-09-07',
        'marketingConsent', false,
        'attribution', '{}'::jsonb
      ),
      'inventory-test-wrong-legal-kind',
       repeat('a', 64)
    )
  $$,
  '23514',
  'active legal versions are required',
  'a privacy version cannot satisfy the offer legal input'
);

select throws_ok(
  $$
    select public.case_lab_3_create_order(
      'test',
      jsonb_build_object(
        'firstName', 'Inactive',
        'lastName', 'Offer',
        'email', 'inactive-offer@example.test',
        'expectedTier', 'early_bird',
        'expectedAmountMinor', 789000,
        'offerVersionId', 'offer-inactive-test',
        'privacyVersionId', 'privacy-2026-09-07',
        'marketingConsent', false,
        'attribution', '{}'::jsonb
      ),
      'inventory-test-inactive-legal',
       repeat('b', 64)
    )
  $$,
  '23514',
  'active legal versions are required',
  'an inactive legal version cannot be accepted'
);

select is(
  (select count(*)::bigint from public.case_lab_3_orders where idempotency_key = 'inventory-test-idempotent'),
  1::bigint,
  'an idempotency repeat creates no second order'
);

select is(
  (pg_temp.cl3_create_order('inventory-test-changed-offer', 'standard', 1500000)->>'kind'),
  'offer_changed',
  'a stale expected tier returns the current offer instead of inserting'
);

select is(
  (select count(*)::bigint from public.case_lab_3_orders where idempotency_key = 'inventory-test-changed-offer'),
  0::bigint,
  'a changed-offer response creates no order'
);

select ok(
  (select prosrc like '%for update%' and prosrc like '%case_lab_3_event_settings%'
   from pg_proc
   where oid = 'public.case_lab_3_create_order(text,jsonb,text,text)'::regprocedure),
  'order creation serializes competing buyers on the event settings row'
);

select is(
  (pg_temp.cl3_create_order('inventory-test-attempt', 'early_bird', 789000)->>'kind'),
  'created',
  'payment-attempt coverage has an active reservation'
);

select ok(
  (select (public.case_lab_3_create_payment_attempt(
    (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-attempt')
  )->>'external_id') like 'cl3-%'),
  'the first payment attempt has a server-generated external ID'
);

select is(
  (public.case_lab_3_create_payment_attempt(
    (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-attempt')
  )->>'attempt_id'),
  (select id::text from public.case_lab_3_payment_attempts where order_id = (
    select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-attempt'
  ) and status = 'created'),
  'a created attempt is safely reusable while its reservation is active'
);

select is(
  (select count(*)::bigint from public.case_lab_3_payment_attempts where order_id = (
    select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-attempt'
  )),
  1::bigint,
  'payment-attempt reuse creates no duplicate attempt'
);

select ok(
  (select prosrc like '%case_lab_3_legal_document_versions%'
      and prosrc like '%document.version_id%'
      and prosrc like '%document.document_kind%'
      and prosrc like '%document.is_active%'
    from pg_proc
    where oid = 'public.case_lab_3_create_order(text,jsonb,text,text)'::regprocedure),
  'order creation resolves legal inputs by environment, kind, stable version, and active status'
);

update public.case_lab_3_payment_attempts
set status = 'check_approved'
where order_id = (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-attempt');

select throws_ok(
  $$
    select public.case_lab_3_create_payment_attempt(
      (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-attempt')
    )
  $$,
  '55000',
  'payment attempt is not retryable',
  'a check-approved attempt blocks a new attempt'
);

update public.case_lab_3_payment_attempts
set status = 'review_required'
where order_id = (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-attempt');

select throws_ok(
  $$
    select public.case_lab_3_create_payment_attempt(
      (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-attempt')
    )
  $$,
  '55000',
  'payment attempt is not retryable',
  'a review-required attempt blocks a new attempt'
);

do $$ begin perform pg_temp.cl3_reset_inventory(); end $$;

select is(
  (pg_temp.cl3_create_order('inventory-test-retry', 'early_bird', 789000)->>'kind'),
  'created',
  'retry coverage has a fresh reservation'
);

select ok(
  (select (public.case_lab_3_create_payment_attempt(
    (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-retry')
  )->>'attempt_id') is not null),
  'a failed payment flow starts with one attempt'
);

update public.case_lab_3_payment_attempts
set status = 'failed'
where order_id = (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-retry');

update public.case_lab_3_orders
set payment_status = 'failed'
where idempotency_key = 'inventory-test-retry';

update public.case_lab_3_reservations
set status = 'released'
where order_id = (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-retry');

select ok(
  (select (public.case_lab_3_create_payment_attempt(
    (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-retry')
  )->>'attempt_id') is not null),
  'a confirmed failure reacquires the same tier with a new attempt'
);

select is(
  (select payment_status from public.case_lab_3_orders where idempotency_key = 'inventory-test-retry'),
  'pending',
  'failed payment reacquisition resets the order to pending before the new attempt'
);

select ok(
  (select strpos(prosrc, 'set payment_status = ''pending''') > 0
      and strpos(prosrc, 'set payment_status = ''pending''') < strpos(prosrc, 'insert into public.case_lab_3_payment_attempts')
      and prosrc like '%and payment_status = ''failed''%'
     from pg_proc
     where oid = 'public.case_lab_3_create_payment_attempt_legacy(uuid)'::regprocedure),
  'failed payment reset is guarded and occurs before payment-attempt insertion'
);

select ok(
  (select strpos(prosrc, 'case_lab_3_event_settings') > 0
      and strpos(prosrc, 'case_lab_3_event_settings') < strpos(prosrc, 'case_lab_3_reservations')
      and strpos(prosrc, 'case_lab_3_reservations') < strpos(prosrc, 'case_lab_3_payment_attempts')
      and prosrc like '%for update%'
     from pg_proc
     where oid = 'public.case_lab_3_create_payment_attempt(uuid)'::regprocedure),
  'payment-attempt retry locks settings before reservation and attempt state'
);

select is(
  (select reservation_expires_at from public.case_lab_3_orders where idempotency_key = 'inventory-test-retry'),
  (select expires_at from public.case_lab_3_reservations where order_id = (
    select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-retry'
  )),
  'reacquisition stores the exact reservation expiry on the parent order'
);

select is(
  (public.case_lab_3_create_payment_attempt(
    (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-retry')
  )->>'reservation_expires_at')::timestamptz,
  (select expires_at from public.case_lab_3_reservations where order_id = (
    select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-retry'
  )),
  'payment-attempt reuse returns the exact stored reservation expiry'
);

select is(
  (public.case_lab_3_get_availability('test')->>'tier'),
  'early_bird',
  'reacquisition keeps the original Early Bird offer'
);

select is(
  (pg_temp.cl3_create_order('inventory-test-expired-retry', 'early_bird', 789000)->>'kind'),
  'created',
  'expired retry coverage has a fresh reservation'
);

select ok(
  (select (public.case_lab_3_create_payment_attempt(
    (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-expired-retry')
  )->>'attempt_id') is not null),
  'expired retry coverage has an initial attempt'
);

update public.case_lab_3_payment_attempts
set status = 'failed'
where order_id = (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-expired-retry');

update public.case_lab_3_orders
set payment_status = 'failed'
where idempotency_key = 'inventory-test-expired-retry';

update public.case_lab_3_reservations
set status = 'active',
    expires_at = clock_timestamp() - interval '1 second'
where order_id = (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-expired-retry');

select ok(
  (select (public.case_lab_3_create_payment_attempt(
    (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-expired-retry')
  )->>'attempt_id') is not null),
  'an expired failed reservation is reacquired with a new attempt'
);

select is(
  (select status from public.case_lab_3_reservations where order_id = (
    select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-expired-retry'
  )),
  'active',
  'expired retry reacquisition restores an active reservation'
);

select is(
  (select payment_status from public.case_lab_3_orders where idempotency_key = 'inventory-test-expired-retry'),
  'pending',
  'expired retry reacquisition resets the order to pending'
);

select is(
  (select public.case_lab_3_apply_check(
    'test',
    'tiptoppay',
    'inventory-retry-check-1',
     repeat('c', 64),
     attempt.external_id,
     789000,
     'KZT',
      jsonb_build_object(
        'invoiceId', attempt.external_id,
        'accountId', attempt.order_id::text,
        'testMode', true
      )
   )->>'result'
   from (
     select payment_attempt.external_id, payment_attempt.order_id
     from public.case_lab_3_payment_attempts payment_attempt
      where payment_attempt.order_id = (
        select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-retry'
      )
      and payment_attempt.status = 'created'
      order by payment_attempt.created_at desc
     limit 1
   ) attempt),
  'accepted',
  'Task 5 Check admits a reacquired failed payment'
);

select is(
  (select payment_status from public.case_lab_3_orders where idempotency_key = 'inventory-test-retry'),
  'processing',
  'Task 5 Check owns the processing transition after Task 4 reset to pending'
);

select is(
  (pg_temp.cl3_create_order('inventory-test-order-state', 'early_bird', 789000)->>'kind'),
  'created',
  'payment status block coverage has a fresh order'
);

select ok(
  (select (public.case_lab_3_create_payment_attempt(
    (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-order-state')
  )->>'attempt_id') is not null),
  'payment status block coverage has an attempt'
);

update public.case_lab_3_payment_attempts
set status = 'failed'
where order_id = (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-order-state');

update public.case_lab_3_reservations
set status = 'released'
where order_id = (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-order-state');

update public.case_lab_3_orders
set payment_status = 'paid'
where idempotency_key = 'inventory-test-order-state';

select throws_ok(
  $$
    select public.case_lab_3_create_payment_attempt(
      (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-order-state')
    )
  $$,
  '55000',
  'payment attempt is not retryable',
  'a paid order still blocks reacquisition'
);

update public.case_lab_3_orders
set payment_status = 'refunded'
where idempotency_key = 'inventory-test-order-state';

select throws_ok(
  $$
    select public.case_lab_3_create_payment_attempt(
      (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-order-state')
    )
  $$,
  '55000',
  'payment attempt is not retryable',
  'a refunded order still blocks reacquisition'
);

update public.case_lab_3_orders
set payment_status = 'review_required'
where idempotency_key = 'inventory-test-order-state';

select throws_ok(
  $$
    select public.case_lab_3_create_payment_attempt(
      (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-order-state')
    )
  $$,
  '55000',
  'payment attempt is not retryable',
  'a review-required order still blocks reacquisition'
);

do $$ begin perform pg_temp.cl3_reset_inventory(); end $$;

do $$
declare
  v_order_id uuid;
begin
  for i in 1..greatest(0, pg_temp.cl3_remaining_early_bird_places() - 1) loop
    v_order_id := pg_temp.cl3_seed_reservation(i, 'early_bird', true, 'consumed');
  end loop;
end;
$$;

select lives_ok(
  $$
    select public.case_lab_3_create_order(
      'test',
      jsonb_build_object(
        'firstName', 'Active',
        'lastName', 'Reservation',
        'email', 'active@example.test',
        'phone', null,
        'company', null,
        'position', null,
        'expectedTier', 'early_bird',
        'expectedAmountMinor', 789000,
        'offerVersionId', 'offer-2026-09-07',
        'privacyVersionId', 'privacy-2026-09-07',
        'marketingConsent', false,
        'attribution', '{}'::jsonb
      ),
      'inventory-test-active',
      repeat('b', 64)
    )
  $$,
  'the twentieth place can be held as an active Early Bird reservation'
);

select is(
  (public.case_lab_3_get_availability('test')->>'reason'),
  'early_bird_temporarily_reserved',
  'nineteen paid Early Birds plus one active reservation stay temporary, not Standard'
);

select is(
  (public.case_lab_3_get_availability('test')->>'tier'),
  null,
  'temporary Early Bird exhaustion does not silently expose Standard'
);

update public.case_lab_3_reservations
set status = 'released'
where order_id = (
  select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-active'
);

select lives_ok(
  $$
    select public.case_lab_3_create_order(
      'test',
      jsonb_build_object(
        'firstName', 'Paid',
        'lastName', 'Twentieth',
        'email', 'twentieth@example.test',
        'phone', null,
        'company', null,
        'position', null,
        'expectedTier', 'early_bird',
        'expectedAmountMinor', 789000,
        'offerVersionId', 'offer-2026-09-07',
        'privacyVersionId', 'privacy-2026-09-07',
        'marketingConsent', false,
        'attribution', '{}'::jsonb
      ),
      'inventory-test-twentieth',
      repeat('c', 64)
    )
  $$,
  'the remaining Early Bird can be reserved after the temporary hold is released'
);

update public.case_lab_3_orders
set payment_status = 'paid',
    paid_amount_minor = amount_minor,
    refundable_amount_minor = amount_minor,
    paid_at = clock_timestamp()
where idempotency_key = 'inventory-test-twentieth';

update public.case_lab_3_reservations
set status = 'consumed'
where order_id = (
  select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-twentieth'
);

select is(
  (public.case_lab_3_get_availability('test')->>'tier'),
  'standard',
  'twenty confirmed Early Birds activate Standard'
);

select is(
  (public.case_lab_3_get_availability('test')->>'amountMinor')::bigint,
  1500000::bigint,
  'Standard is returned at 1500000 minor units'
);

do $$ begin perform pg_temp.cl3_reset_inventory(); end $$;

do $$
begin
  for i in 1..70 loop
    perform pg_temp.cl3_seed_reservation(1000 + i, 'standard', false, 'active');
  end loop;
end;
$$;

select is(
  (public.case_lab_3_get_availability('test')->>'reason'),
  'sold_out',
  'seventy online paid or reserved seats are sold out below physical capacity'
);

do $$ begin perform pg_temp.cl3_reset_inventory(); end $$;

do $$
begin
  for i in 1..greatest(0, 69 - pg_temp.cl3_existing_online_commitment()) loop
    perform pg_temp.cl3_seed_reservation(2000 + i, 'standard', false, 'active');
  end loop;
end;
$$;

select lives_ok(
  $$
    select public.case_lab_3_create_allocation(
      'test', 'invited', 1, null, true, false, 'online limit allocation', 'pgTAP'
    )
  $$,
  'an active allocation can consume the final online sales seat'
);

select throws_ok(
  $$
    select public.case_lab_3_create_allocation(
      'test', 'invited', 1, null, true, false, 'over-limit allocation', 'pgTAP'
    )
  $$,
  '23514',
  'allocation exceeds online sales limit',
  'existing active online allocations count toward the online sales limit'
);

do $$ begin perform pg_temp.cl3_reset_inventory(); end $$;

do $$
begin
  for i in 1..greatest(0, 69 - pg_temp.cl3_existing_online_commitment()) loop
    perform pg_temp.cl3_seed_reservation(2500 + i, 'standard', false, 'active');
  end loop;
end;
$$;

select lives_ok(
  $$
    select public.case_lab_3_create_allocation(
      'test', 'invited', 31, null, false, false, 'inventory test invitation', 'pgTAP'
    )
  $$,
  'thirty-one invitations can fill the remaining physical capacity'
);

select is(
  (public.case_lab_3_get_availability('test')->>'reason'),
  'sold_out',
  'sixty-nine online seats plus thirty-one invitations are physically sold out'
);

do $$ begin perform pg_temp.cl3_reset_inventory(); end $$;

do $$
begin
  for i in 1..pg_temp.cl3_remaining_early_bird_places() loop
    perform pg_temp.cl3_seed_reservation(3000 + i, 'early_bird', true, 'consumed');
  end loop;
end;
$$;

select is(
  (public.case_lab_3_get_availability('test')->>'tier'),
  'standard',
  'confirmed Early Bird history selects Standard before a full refund'
);

do $$
begin
  for i in 1..50 loop
    perform pg_temp.cl3_seed_reservation(4000 + i, 'standard', true, 'consumed');
  end loop;
end;
$$;

select is(
  (select payment_status from public.case_lab_3_orders where idempotency_key = 'inventory-test-4001'),
  'paid',
  'the full-refund capacity fixture uses a genuinely paid order'
);

select is(
  (select status from public.case_lab_3_reservations where order_id = (
    select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-4001'
  )),
  'consumed',
  'the full-refund capacity fixture uses a consumed reservation'
);

select is(
  (public.case_lab_3_get_availability('test')->>'reason'),
  'sold_out',
  'the full-refund capacity fixture starts sold out before the refund'
);

select public.case_lab_3_create_refund(
  'test',
  (select id from public.case_lab_3_orders where idempotency_key = 'inventory-test-4001'),
  'inventory-full-refund',
  1500000,
  'release sold-out standard seat'
);

select public.case_lab_3_apply_refund(
  'test',
  'tiptoppay',
  'inventory-full-refund-event',
  repeat('a', 64),
  'inventory-full-refund',
  'inventory-payment-4001',
  'inventory-refund-4001',
  1500000,
  'KZT',
  'confirmed',
  '{}'::jsonb
);

select ok(
  (public.case_lab_3_get_availability('test')->>'available')::boolean,
  'a full refund frees online and physical capacity'
);

select is(
  (public.case_lab_3_get_availability('test')->>'tier'),
  'standard',
  'a full refund never restores historical Early Bird quota'
);

select is(
  (pg_temp.cl3_create_order('inventory-test-after-full-refund', 'standard', 1500000)->>'kind'),
  'created',
  'a full refund releases a sold-out seat for a new reservation'
);

do $$ begin perform pg_temp.cl3_reset_inventory(); end $$;

do $$
begin
  for i in 1..greatest(0, pg_temp.cl3_remaining_early_bird_places() - 1) loop
    perform pg_temp.cl3_seed_reservation(6000 + i, 'early_bird', true, 'consumed');
  end loop;
end;
$$;

select throws_ok(
  $$
    select public.case_lab_3_create_allocation(
      'test', 'paid', 2, 'early_bird', false, false, 'over-quota imported payment', 'pgTAP'
    )
  $$,
  '23514',
  'early bird quota is unavailable',
  'a paid imported Early Bird allocation cannot bypass historical quota validation'
);

select throws_ok(
  $$
    select public.case_lab_3_create_allocation(
      'test', null, 1, 'standard', false, false, 'missing allocation category', 'pgTAP'
    )
  $$,
  '22023',
  'invalid allocation input',
  'a null allocation category is rejected as invalid input'
);

select is(
  (public.case_lab_3_create_allocation(
    'test', 'paid', 1, 'early_bird', false, false, 'historical imported payment', 'pgTAP'
  )->>'kind'),
  'created',
  'a paid imported Early Bird allocation can fill the final historical place'
);

select throws_ok(
  $$
    select public.case_lab_3_release_allocation(
      'test',
      (select id from public.case_lab_3_inventory_allocations order by created_at desc limit 1),
      'pgTAP',
      'manual release paid allocation'
    )
  $$,
  '55000',
  'paid allocations cannot be released',
  'paid allocations reject manual release'
);

update public.case_lab_3_inventory_allocations
set holds_early_bird_quota = true,
    released_at = clock_timestamp(),
    released_by = 'pgTAP',
    release_reason = 'historical import fixture'
where id = (select id from public.case_lab_3_inventory_allocations order by created_at desc limit 1);

select is(
  (public.case_lab_3_get_availability('test')->>'tier'),
  'standard',
  'a paid imported Early Bird allocation counts historically despite its hold and release flags'
);

do $$ begin perform pg_temp.cl3_reset_inventory(); end $$;

do $$
begin
  for i in 1..greatest(0, pg_temp.cl3_remaining_early_bird_places() - 1) loop
    perform pg_temp.cl3_seed_reservation(7000 + i, 'early_bird', true, 'consumed');
  end loop;
end;
$$;

select is(
  (public.case_lab_3_create_allocation(
    'test', 'invited', 1, 'early_bird', false, true, 'temporary Early Bird hold', 'pgTAP'
  )->>'kind'),
  'created',
  'an explicit active Early Bird allocation hold can occupy the remaining place'
);

select is(
  (public.case_lab_3_get_availability('test')->>'reason'),
  'early_bird_temporarily_reserved',
  'only an active explicit Early Bird allocation hold causes temporary exhaustion'
);

select is(
  (public.case_lab_3_release_allocation(
    'test',
    (select id from public.case_lab_3_inventory_allocations order by created_at desc limit 1),
    'pgTAP',
    'release temporary Early Bird hold'
  )->>'kind'),
  'released',
  'releasing an explicit Early Bird hold frees temporary quota'
);

select is(
  (public.case_lab_3_get_availability('test')->>'tier'),
  'early_bird',
  'released explicit holds do not remain temporary Early Bird exhaustion'
);

do $$ begin perform pg_temp.cl3_reset_inventory(); end $$;

do $$
begin
  for i in 1..71 loop
    perform pg_temp.cl3_seed_reservation(5000 + i, 'standard', false, 'active');
  end loop;
end;
$$;

select lives_ok(
  $$ select public.case_lab_3_update_settings('test', 100, null, 'pgTAP') $$,
  'raising the online sales limit to the venue capacity succeeds'
);

select is(
  (select online_sales_limit from public.case_lab_3_event_settings where environment = 'test'),
  100,
  'the online sales limit is updated to 100'
);

select throws_ok(
  $$ select public.case_lab_3_update_settings('test', 101, null, 'pgTAP') $$,
  '22023',
  'online_sales_limit must be between 70 and venue capacity',
  'limits above the venue capacity are rejected'
);

select throws_ok(
  $$ select public.case_lab_3_update_settings('test', 70, null, 'pgTAP') $$,
  '23514',
  'online_sales_limit cannot be reduced below committed online seats',
  'reductions below committed online seats are rejected'
);

select ok(
  has_function_privilege('service_role', 'public.case_lab_3_get_availability(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.case_lab_3_get_availability(text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.case_lab_3_get_availability(text)', 'EXECUTE'),
  'availability execution is granted only to service_role'
);

select * from finish();
rollback;
