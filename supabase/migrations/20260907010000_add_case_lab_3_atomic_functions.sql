create or replace function public.case_lab_3_inventory_availability(
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_settings public.case_lab_3_event_settings%rowtype;
  v_online_committed bigint;
  v_physical_occupied bigint;
  v_early_historical bigint;
  v_early_held bigint;
  v_configuration_complete boolean;
  v_reason text;
  v_tier text;
  v_amount bigint;
begin
  if p_environment is null or p_environment not in ('test', 'live') then
    raise exception 'invalid environment'
      using errcode = '22023';
  end if;

  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = p_environment
  for update;

  update public.case_lab_3_reservations
  set status = 'expired', updated_at = clock_timestamp()
  where environment = p_environment
    and status = 'active'
    and expires_at <= clock_timestamp();

  v_configuration_complete :=
    v_settings.active_fiscal_policy_version_id is not null
    and exists (
      select 1
      from public.case_lab_3_fiscal_policy_versions policy
      where policy.id = v_settings.active_fiscal_policy_version_id
        and policy.environment = p_environment
        and policy.policy_status = 'approved'
        and policy.is_accountant_approved
        and policy.approved_at is not null
        and policy.approved_by is not null
        and public.case_lab_3_is_supported_fiscal_policy(policy.id, p_environment)
    )
    and v_settings.active_offer_version_id is not null
    and exists (
      select 1
      from public.case_lab_3_legal_document_versions document
      where document.id = v_settings.active_offer_version_id
        and document.environment = p_environment
        and document.document_kind = 'offer'
        and document.is_active
        and document.activated_at is not null
    )
    and v_settings.active_privacy_version_id is not null
    and exists (
      select 1
      from public.case_lab_3_legal_document_versions document
      where document.id = v_settings.active_privacy_version_id
        and document.environment = p_environment
        and document.document_kind = 'privacy'
        and document.is_active
        and document.activated_at is not null
    );

  select coalesce(sum(1), 0)
  into v_online_committed
  from public.case_lab_3_reservations reservation
  where reservation.environment = p_environment
    and reservation.status in ('active', 'processing', 'consumed');

  select v_online_committed + coalesce(sum(allocation.quantity), 0)
  into v_physical_occupied
  from public.case_lab_3_inventory_allocations allocation
  where allocation.environment = p_environment
    and allocation.released_at is null;

  select v_online_committed + coalesce(sum(allocation.quantity), 0)
  into v_online_committed
  from public.case_lab_3_inventory_allocations allocation
  where allocation.environment = p_environment
    and allocation.counts_toward_online_limit
    and allocation.released_at is null;

  select coalesce(sum(1), 0)
  into v_early_historical
  from public.case_lab_3_orders order_row
  where order_row.environment = p_environment
    and order_row.tier = 'early_bird'
    and order_row.paid_amount_minor > 0
    and order_row.payment_status in (
      'paid', 'refund_pending', 'partially_refunded', 'refunded'
    );

  -- Paid imported Early Birds are historical sales even when released or not marked as a hold.
  select v_early_historical + coalesce(sum(allocation.quantity), 0)
  into v_early_historical
  from public.case_lab_3_inventory_allocations allocation
  where allocation.environment = p_environment
    and allocation.allocation_category = 'paid'
    and allocation.tier = 'early_bird';

  select coalesce(sum(1), 0)
  into v_early_held
  from public.case_lab_3_reservations reservation
  where reservation.environment = p_environment
    and reservation.tier = 'early_bird'
    and reservation.status in ('active', 'processing');

  select v_early_held + coalesce(sum(allocation.quantity), 0)
  into v_early_held
  from public.case_lab_3_inventory_allocations allocation
  where allocation.environment = p_environment
    and allocation.holds_early_bird_quota
    and allocation.released_at is null;

  if not v_settings.sales_enabled then
    v_reason := 'sales_closed';
    v_tier := null;
    v_amount := null;
  elsif now() >= v_settings.sales_cutoff then
    v_reason := 'sales_closed';
    v_tier := null;
    v_amount := null;
  elsif not v_configuration_complete then
    v_reason := 'configuration_incomplete';
    v_tier := null;
    v_amount := null;
  elsif v_online_committed >= v_settings.online_sales_limit
     or v_physical_occupied >= v_settings.venue_capacity then
    v_reason := 'sold_out';
    v_tier := null;
    v_amount := null;
  elsif v_early_historical < v_settings.early_bird_quota
     and v_early_held >= v_settings.early_bird_quota - v_early_historical then
    v_reason := 'early_bird_temporarily_reserved';
    v_tier := null;
    v_amount := null;
  elsif v_early_historical < v_settings.early_bird_quota then
    v_reason := 'available';
    v_tier := 'early_bird';
    v_amount := v_settings.early_bird_amount_minor;
  else
    v_reason := 'available';
    v_tier := 'standard';
    v_amount := v_settings.standard_amount_minor;
  end if;

  return jsonb_build_object(
    'available', v_reason = 'available',
    'reason', v_reason,
    'tier', v_tier,
    'amountMinor', v_amount,
    'currency', 'KZT',
    'salesLimit', v_settings.online_sales_limit
  );
end;
$$;

create or replace function public.case_lab_3_get_availability(
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  return public.case_lab_3_inventory_availability(p_environment);
end;
$$;

create or replace function public.case_lab_3_create_order(
  p_environment text,
  p_input jsonb,
  p_idempotency_key text,
  p_hashed_client_ip text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_settings public.case_lab_3_event_settings%rowtype;
  v_existing public.case_lab_3_orders%rowtype;
  v_order_id uuid;
  v_order_number text;
  v_reservation_expires_at timestamptz;
  v_availability jsonb;
  v_tier text;
  v_expected_tier text;
  v_expected_amount numeric;
  v_amount bigint;
  v_offer_version_id uuid;
  v_privacy_version_id uuid;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_phone text;
  v_company text;
  v_position text;
  v_attribution jsonb;
  v_marketing_consent boolean;
begin
  if p_environment is null or p_environment not in ('test', 'live') then
    raise exception 'invalid environment'
      using errcode = '22023';
  end if;

  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'invalid order input'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null
     or length(btrim(p_idempotency_key)) = 0
     or length(p_idempotency_key) > 128 then
    raise exception 'invalid idempotency key'
      using errcode = '22023';
  end if;

  if p_hashed_client_ip is null
     or p_hashed_client_ip !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid client identity'
      using errcode = '22023';
  end if;

  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = p_environment
  for update;

  update public.case_lab_3_reservations
  set status = 'expired', updated_at = clock_timestamp()
  where environment = p_environment
    and status = 'active'
    and expires_at <= clock_timestamp();

  v_expected_tier := p_input->>'expectedTier';
  begin
    v_expected_amount := (p_input->>'expectedAmountMinor')::numeric;
  exception when others then
    raise exception 'invalid order input'
      using errcode = '22023';
  end;

  if v_expected_tier is null
     or v_expected_amount is null
     or v_expected_tier not in ('early_bird', 'standard')
     or v_expected_amount <> trunc(v_expected_amount)
     or v_expected_amount < 0
     or v_expected_amount > 9223372036854775807 then
    raise exception 'invalid order input'
      using errcode = '22023';
  end if;

  v_first_name := btrim(p_input->>'firstName');
  v_last_name := btrim(p_input->>'lastName');
  v_email := lower(btrim(p_input->>'email'));
  v_phone := nullif(btrim(p_input->>'phone'), '');
  v_company := nullif(btrim(p_input->>'company'), '');
  v_position := nullif(btrim(p_input->>'position'), '');
  v_attribution := case
    when p_input->'attribution' is null
      or jsonb_typeof(p_input->'attribution') = 'null'
      then '{}'::jsonb
    else p_input->'attribution'
  end;

  if jsonb_typeof(v_attribution) <> 'object'
     or v_first_name is null or length(v_first_name) = 0 or length(v_first_name) > 200
     or v_last_name is null or length(v_last_name) = 0 or length(v_last_name) > 200
     or v_email is null or length(v_email) > 320
     or position('@' in v_email) < 2
     or position('.' in substring(v_email from position('@' in v_email) + 1)) < 2 then
    raise exception 'invalid order input'
      using errcode = '22023';
  end if;

  begin
    v_marketing_consent := coalesce((p_input->>'marketingConsent')::boolean, false);
  exception when others then
    raise exception 'invalid order input'
      using errcode = '22023';
  end;

  select document.id
  into v_offer_version_id
  from public.case_lab_3_legal_document_versions document
  where document.environment = p_environment
    and document.document_kind = 'offer'
    and document.version_id = p_input->>'offerVersionId'
    and document.is_active
    and document.activated_at is not null;

  select document.id
  into v_privacy_version_id
  from public.case_lab_3_legal_document_versions document
  where document.environment = p_environment
    and document.document_kind = 'privacy'
    and document.version_id = p_input->>'privacyVersionId'
    and document.is_active
    and document.activated_at is not null;

  select *
  into v_existing
  from public.case_lab_3_orders
  where environment = p_environment
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.first_name is distinct from v_first_name
       or v_existing.last_name is distinct from v_last_name
       or v_existing.participant_email is distinct from v_email
       or v_existing.phone is distinct from v_phone
       or v_existing.company is distinct from v_company
       or v_existing.position is distinct from v_position
       or v_existing.tier is distinct from v_expected_tier
       or v_existing.amount_minor is distinct from v_expected_amount::bigint
       or v_existing.offer_version_id is distinct from v_offer_version_id
       or v_existing.privacy_version_id is distinct from v_privacy_version_id
       or v_existing.marketing_consent is distinct from v_marketing_consent
       or v_existing.utm_source is distinct from v_attribution->>'utm_source'
       or v_existing.utm_medium is distinct from v_attribution->>'utm_medium'
       or v_existing.utm_campaign is distinct from v_attribution->>'utm_campaign'
       or v_existing.utm_term is distinct from v_attribution->>'utm_term'
       or v_existing.utm_content is distinct from v_attribution->>'utm_content'
       or v_existing.referrer is distinct from v_attribution->>'referrer'
       or v_existing.ga_client_id is distinct from v_attribution->>'ga_client_id' then
      raise exception 'idempotency key conflicts with an existing order'
        using errcode = '23505';
    end if;

    return jsonb_build_object(
      'kind', 'created',
      'orderId', v_existing.id,
      'orderNumber', v_existing.order_number,
      'tier', v_existing.tier,
      'amountMinor', v_existing.amount_minor,
      'reservationExpiresAt', v_existing.reservation_expires_at
    );
  end if;

  if v_offer_version_id is distinct from v_settings.active_offer_version_id
     or v_privacy_version_id is distinct from v_settings.active_privacy_version_id then
    raise exception 'active legal versions are required'
      using errcode = '23514';
  end if;

  v_availability := public.case_lab_3_inventory_availability(p_environment);

  if coalesce((v_availability->>'available')::boolean, false) is not true then
    return jsonb_build_object(
      'kind', 'unavailable',
      'availability', v_availability
    );
  end if;

  v_tier := v_availability->>'tier';
  v_amount := (v_availability->>'amountMinor')::bigint;

  if v_expected_tier is distinct from v_tier
     or v_expected_amount::bigint is distinct from v_amount then
    return jsonb_build_object(
      'kind', 'offer_changed',
      'availability', v_availability
    );
  end if;

  v_order_id := gen_random_uuid();
  v_order_number := 'CL3-' || upper(substr(replace(v_order_id::text, '-', ''), 1, 12));
  v_reservation_expires_at := clock_timestamp() + interval '15 minutes';

  insert into public.case_lab_3_orders (
    id,
    order_number,
    idempotency_key,
    environment,
    first_name,
    last_name,
    participant_email,
    phone,
    company,
    position,
    purchaser_email,
    fiscal_email,
    original_contact_snapshot,
    tier,
    amount_minor,
    receipt_label,
    taxation_system,
    vat_rate,
    configuration_version,
    offer_version_id,
    privacy_version_id,
    accepted_at,
    marketing_consent,
    utm_source,
    utm_medium,
    utm_campaign,
    utm_term,
    utm_content,
    referrer,
    ga_client_id,
    reservation_expires_at
  )
  values (
    v_order_id,
    v_order_number,
    p_idempotency_key,
    p_environment,
    v_first_name,
    v_last_name,
    v_email,
    v_phone,
    v_company,
    v_position,
    v_email,
    v_email,
    jsonb_build_object(
      'firstName', v_first_name,
      'lastName', v_last_name,
      'email', v_email,
      'phone', v_phone,
      'company', v_company,
      'position', v_position,
      'purchaserEmail', v_email,
      'fiscalEmail', v_email
    ),
    v_tier,
    v_amount,
    case when v_tier = 'early_bird'
      then v_settings.early_bird_receipt_label
      else v_settings.standard_receipt_label
    end,
    v_settings.taxation_system,
    v_settings.vat_rate,
    v_settings.configuration_version,
    v_offer_version_id,
    v_privacy_version_id,
    clock_timestamp(),
    v_marketing_consent,
    v_attribution->>'utm_source',
    v_attribution->>'utm_medium',
    v_attribution->>'utm_campaign',
    v_attribution->>'utm_term',
    v_attribution->>'utm_content',
    v_attribution->>'referrer',
    v_attribution->>'ga_client_id',
    v_reservation_expires_at
  );

  insert into public.case_lab_3_reservations (
    order_id,
    environment,
    tier,
    expires_at,
    status
  )
  values (
    v_order_id,
    p_environment,
    v_tier,
    v_reservation_expires_at,
    'active'
  );

  return jsonb_build_object(
    'kind', 'created',
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'tier', v_tier,
    'amountMinor', v_amount,
    'reservationExpiresAt', v_reservation_expires_at
  );
end;
$$;

create or replace function public.case_lab_3_create_payment_attempt(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_order public.case_lab_3_orders%rowtype;
  v_reservation public.case_lab_3_reservations%rowtype;
  v_attempt public.case_lab_3_payment_attempts%rowtype;
  v_latest_attempt public.case_lab_3_payment_attempts%rowtype;
  v_settings public.case_lab_3_event_settings%rowtype;
  v_environment text;
  v_availability jsonb;
  v_attempt_id uuid;
  v_external_id text;
  v_new_expires_at timestamptz;
begin
  select order_row.environment
  into v_environment
  from public.case_lab_3_orders order_row
  where order_row.id = p_order_id;

  if not found then
    raise exception 'order not found'
      using errcode = '22023';
  end if;

  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = v_environment
  for update;

  update public.case_lab_3_reservations
  set status = 'expired', updated_at = clock_timestamp()
  where environment = v_environment
    and status = 'active'
    and expires_at <= clock_timestamp();

  select *
  into strict v_order
  from public.case_lab_3_orders
  where id = p_order_id
  for update;

  select *
  into v_reservation
  from public.case_lab_3_reservations
  where order_id = v_order.id
    and environment = v_order.environment
  for update;

  if not found then
    raise exception 'reservation is not available for payment'
      using errcode = '55000';
  end if;

  select *
  into v_attempt
  from public.case_lab_3_payment_attempts
  where order_id = v_order.id
    and environment = v_order.environment
    and status = 'created'
  order by created_at desc
  limit 1
  for update;

  if exists (
    select 1
    from public.case_lab_3_payment_attempts attempt
    where attempt.order_id = v_order.id
      and attempt.environment = v_order.environment
      and attempt.status in ('check_approved', 'review_required')
   ) or v_order.payment_status in (
     'processing', 'paid', 'refund_pending', 'partially_refunded', 'refunded', 'review_required'
   ) then
    raise exception 'payment attempt is not retryable'
      using errcode = '55000';
  end if;

  if v_attempt.id is not null
     and v_reservation.status = 'active'
     and v_reservation.expires_at > clock_timestamp() then
    return jsonb_build_object(
      'attempt_id', v_attempt.id,
      'external_id', v_attempt.external_id,
      'reservation_expires_at', v_reservation.expires_at
    );
  end if;

  select *
  into v_latest_attempt
  from public.case_lab_3_payment_attempts
  where order_id = v_order.id
    and environment = v_order.environment
  order by created_at desc
  limit 1
  for update;

  if v_latest_attempt.id is null or v_latest_attempt.status <> 'failed' then
    raise exception 'reservation is not available for payment'
      using errcode = '55000';
  end if;

  if v_reservation.status in ('expired', 'released')
     or (v_reservation.status = 'active' and v_reservation.expires_at <= clock_timestamp())
     or (v_reservation.status = 'processing' and v_latest_attempt.status = 'failed') then
    if v_reservation.status = 'processing' then
      update public.case_lab_3_reservations
      set status = 'released',
          updated_at = clock_timestamp()
      where id = v_reservation.id;
      v_reservation.status := 'released';
    end if;

    v_availability := public.case_lab_3_inventory_availability(v_order.environment);
    if coalesce((v_availability->>'available')::boolean, false) is not true
       or v_availability->>'tier' is distinct from v_reservation.tier then
      return jsonb_build_object(
        'kind', 'offer_changed',
        'availability', v_availability
      );
    end if;

    v_new_expires_at := clock_timestamp() + interval '15 minutes';

    update public.case_lab_3_reservations
    set status = 'active',
        expires_at = v_new_expires_at,
        admitted_payment_attempt_id = null,
        updated_at = clock_timestamp()
    where id = v_reservation.id;

    select expires_at
    into v_new_expires_at
    from public.case_lab_3_reservations
    where id = v_reservation.id;

    update public.case_lab_3_orders
    set reservation_expires_at = v_new_expires_at,
        updated_at = clock_timestamp()
    where id = v_order.id;

    v_reservation.status := 'active';
    v_reservation.expires_at := v_new_expires_at;
  end if;

  if v_reservation.status <> 'active' or v_reservation.expires_at <= clock_timestamp() then
    raise exception 'reservation is not available for payment'
      using errcode = '55000';
  end if;

  if v_order.payment_status = 'failed' then
    update public.case_lab_3_orders
    set payment_status = 'pending',
        updated_at = clock_timestamp()
    where id = v_order.id
      and environment = v_order.environment
      and payment_status = 'failed';

    v_order.payment_status := 'pending';
  end if;

  v_attempt_id := gen_random_uuid();
  v_external_id := 'cl3-' || replace(v_attempt_id::text, '-', '');

  insert into public.case_lab_3_payment_attempts (
    id,
    external_id,
    order_id,
    reservation_id,
    environment,
    amount_minor,
    currency,
    status
  )
  values (
    v_attempt_id,
    v_external_id,
    v_order.id,
    v_reservation.id,
    v_order.environment,
    v_order.amount_minor,
    'KZT',
    'created'
  );

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'external_id', v_external_id,
    'reservation_expires_at', v_reservation.expires_at
  );
end;
$$;

create or replace function public.case_lab_3_transfer_participant(
  p_ticket_id uuid,
  p_input jsonb,
  p_actor_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_ticket public.case_lab_3_tickets%rowtype;
  v_revision public.case_lab_3_ticket_revisions%rowtype;
  v_order public.case_lab_3_orders%rowtype;
  v_revision_id uuid;
  v_revision_number integer;
  v_token_version integer;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_phone text;
  v_company text;
  v_position text;
begin
  if p_input is null or jsonb_typeof(p_input) <> 'object' then
    raise exception 'invalid participant input'
      using errcode = '22023';
  end if;

  v_first_name := btrim(p_input->>'firstName');
  v_last_name := btrim(p_input->>'lastName');
  v_email := lower(btrim(p_input->>'email'));
  v_phone := nullif(btrim(p_input->>'phone'), '');
  v_company := nullif(btrim(p_input->>'company'), '');
  v_position := nullif(btrim(p_input->>'position'), '');

  if v_first_name is null or length(v_first_name) = 0 or length(v_first_name) > 200
     or v_last_name is null or length(v_last_name) = 0 or length(v_last_name) > 200
     or v_email is null or length(v_email) > 320 or position('@' in v_email) < 2 then
    raise exception 'invalid participant input'
      using errcode = '22023';
  end if;

  select *
  into v_ticket
  from public.case_lab_3_tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'ticket not transferable'
      using errcode = '55000';
  end if;

  if v_ticket.status <> 'valid'
     or exists (
       select 1
       from public.case_lab_3_check_ins check_in
       where check_in.ticket_id = v_ticket.id
     ) then
    raise exception 'ticket is not transferable'
      using errcode = '55000';
  end if;

  select *
  into v_revision
  from public.case_lab_3_ticket_revisions
  where id = v_ticket.current_revision_id
    and ticket_id = v_ticket.id
    and environment = v_ticket.environment
  for update;

  if not found then
    raise exception 'ticket is not transferable'
      using errcode = '55000';
  end if;

  select *
  into v_order
  from public.case_lab_3_orders
  where id = v_ticket.order_id
    and environment = v_ticket.environment
  for update;

  if not found then
    raise exception 'ticket is not transferable'
      using errcode = '55000';
  end if;

  select coalesce(max(revision_number), 0) + 1
  into v_revision_number
  from public.case_lab_3_ticket_revisions
  where ticket_id = v_ticket.id
    and environment = v_ticket.environment;

  v_revision_id := gen_random_uuid();
  v_token_version := v_revision.token_version + 1;

  insert into public.case_lab_3_ticket_revisions (
    id,
    ticket_id,
    environment,
    revision_number,
    first_name,
    last_name,
    participant_email,
    phone,
    company,
    position,
    token_version,
    creation_reason
  )
  values (
    v_revision_id,
    v_ticket.id,
    v_ticket.environment,
    v_revision_number,
    v_first_name,
    v_last_name,
    v_email,
    v_phone,
    v_company,
    v_position,
    v_token_version,
    coalesce(nullif(p_reason, ''), 'participant_transfer')
  );

  update public.case_lab_3_orders
  set first_name = v_first_name,
      last_name = v_last_name,
      participant_email = v_email,
      phone = v_phone,
      company = v_company,
      position = v_position,
      updated_at = clock_timestamp()
  where id = v_order.id;

  update public.case_lab_3_tickets
  set current_revision_id = v_revision_id,
      updated_at = clock_timestamp()
  where id = v_ticket.id;

  insert into public.case_lab_3_audit_log (
    environment,
    action,
    target_table,
    target_id,
    before_summary,
    after_summary,
    actor_id,
    actor_label
  )
  values (
    v_ticket.environment,
    'participant_transfer',
    'case_lab_3_tickets',
    v_ticket.id,
    jsonb_build_object('revisionId', v_revision.id, 'revisionNumber', v_revision.revision_number),
    jsonb_build_object('revisionId', v_revision_id, 'revisionNumber', v_revision_number),
    coalesce(nullif(p_actor_id, ''), 'service_role'),
    p_actor_id
  );

  return jsonb_build_object(
    'kind', 'transferred',
    'ticketId', v_ticket.id,
    'revisionId', v_revision_id,
    'revisionNumber', v_revision_number,
    'tokenVersion', v_token_version
  );
end;
$$;

create or replace function public.case_lab_3_transfer_participant(
  p_ticket_id uuid,
  p_input jsonb,
  p_actor_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  return public.case_lab_3_transfer_participant(
    p_ticket_id,
    p_input,
    p_actor_id,
    'participant_transfer'
  );
end;
$$;

create or replace function public.case_lab_3_cancel_ticket(
  p_ticket_id uuid,
  p_actor_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_ticket public.case_lab_3_tickets%rowtype;
  v_before text;
begin
  select *
  into v_ticket
  from public.case_lab_3_tickets
  where id = p_ticket_id
  for update;

  if not found then
    raise exception 'ticket not found'
      using errcode = '22023';
  end if;

  v_before := v_ticket.status;

  if v_ticket.status <> 'cancelled' then
    update public.case_lab_3_tickets
    set status = 'cancelled', updated_at = clock_timestamp()
    where id = v_ticket.id;

    update public.case_lab_3_orders
    set ticket_status = 'cancelled', updated_at = clock_timestamp()
    where id = v_ticket.order_id
      and environment = v_ticket.environment;
  end if;

  insert into public.case_lab_3_audit_log (
    environment,
    action,
    target_table,
    target_id,
    before_summary,
    after_summary,
    actor_id,
    actor_label
  )
  values (
    v_ticket.environment,
    'ticket_cancelled',
    'case_lab_3_tickets',
    v_ticket.id,
    jsonb_build_object('status', v_before, 'reason', p_reason),
    jsonb_build_object('status', 'cancelled'),
    coalesce(nullif(p_actor_id, ''), 'service_role'),
    p_actor_id
  );

  return jsonb_build_object(
    'kind', 'cancelled',
    'ticketId', v_ticket.id,
    'status', 'cancelled'
  );
end;
$$;

create or replace function public.case_lab_3_check_in(
  p_ticket_id uuid,
  p_ticket_revision_id uuid,
  p_token_version integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_ticket public.case_lab_3_tickets%rowtype;
  v_revision public.case_lab_3_ticket_revisions%rowtype;
  v_checked_in_at timestamptz;
begin
  select *
  into v_ticket
  from public.case_lab_3_tickets
  where id = p_ticket_id
  for update;

  if not found then
    return jsonb_build_object('result', 'invalid', 'checked_in_at', null);
  end if;

  select *
  into v_revision
  from public.case_lab_3_ticket_revisions
  where id = p_ticket_revision_id
    and ticket_id = v_ticket.id
    and environment = v_ticket.environment
  for share;

  if not found
     or v_ticket.current_revision_id is distinct from v_revision.id
     or p_token_version is distinct from v_revision.token_version then
    return jsonb_build_object('result', 'invalid', 'checked_in_at', null);
  end if;

  if v_ticket.status = 'cancelled' then
    return jsonb_build_object('result', 'cancelled', 'checked_in_at', null);
  end if;

  if v_ticket.status = 'used' then
    select check_in.checked_in_at
    into v_checked_in_at
    from public.case_lab_3_check_ins check_in
    where check_in.ticket_id = v_ticket.id;

    return jsonb_build_object('result', 'already_used', 'checked_in_at', v_checked_in_at);
  end if;

  v_checked_in_at := clock_timestamp();

  insert into public.case_lab_3_check_ins (
    ticket_id,
    ticket_revision_id,
    environment,
    checked_in_by,
    checked_in_at
  )
  values (
    v_ticket.id,
    v_revision.id,
    v_ticket.environment,
    session_user,
    v_checked_in_at
  );

  update public.case_lab_3_tickets
  set status = 'used', updated_at = clock_timestamp()
  where id = v_ticket.id;

  return jsonb_build_object('result', 'admitted', 'checked_in_at', v_checked_in_at);
end;
$$;

create or replace function public.case_lab_3_consume_rate_limit(
  p_scope text,
  p_purpose_ip_hash text,
  p_limit_count integer,
  p_bucket_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_bucket_start timestamptz;
  v_bucket public.case_lab_3_rate_limits%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_scope is null
     or p_scope !~ '^[a-z][a-z0-9_-]{0,63}$'
     or p_purpose_ip_hash is null
     or p_purpose_ip_hash !~ '^[0-9a-f]{64}$'
     or p_limit_count is null
     or p_limit_count < 1
     or p_limit_count > 100
     or p_bucket_seconds is null
     or p_bucket_seconds < 1
     or p_bucket_seconds > 86400 then
    raise exception 'invalid rate limit parameters'
      using errcode = '22023';
  end if;

  v_bucket_start := date_bin(
    make_interval(secs => p_bucket_seconds),
    v_now,
    timestamptz 'epoch'
  );

  insert into public.case_lab_3_rate_limits (
    scope,
    purpose_ip_hash,
    bucket_start,
    limit_count,
    used_count
  )
  values (
    p_scope,
    p_purpose_ip_hash,
    v_bucket_start,
    p_limit_count,
    1
  )
  on conflict (scope, purpose_ip_hash, bucket_start)
  do update set
    used_count = public.case_lab_3_rate_limits.used_count + 1,
    updated_at = clock_timestamp()
  where public.case_lab_3_rate_limits.used_count < public.case_lab_3_rate_limits.limit_count
  returning * into v_bucket;

  if found then
    return jsonb_build_object(
      'allowed', true,
      'remaining', greatest(v_bucket.limit_count - v_bucket.used_count, 0),
      'reset_at', v_bucket_start + make_interval(secs => p_bucket_seconds)
    );
  end if;

  select *
  into strict v_bucket
  from public.case_lab_3_rate_limits
  where scope = p_scope
    and purpose_ip_hash = p_purpose_ip_hash
    and bucket_start = v_bucket_start
  for update;

  return jsonb_build_object(
    'allowed', false,
    'remaining', 0,
    'reset_at', v_bucket_start + make_interval(secs => p_bucket_seconds)
  );
end;
$$;

create or replace function public.case_lab_3_update_settings(
  p_environment text,
  p_online_sales_limit integer,
  p_sales_enabled boolean,
  p_actor_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_settings public.case_lab_3_event_settings%rowtype;
  v_committed_online bigint;
  v_new_limit integer;
  v_new_enabled boolean;
begin
  if p_environment is null or p_environment not in ('test', 'live') then
    raise exception 'invalid environment'
      using errcode = '22023';
  end if;

  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = p_environment
  for update;

  update public.case_lab_3_reservations
  set status = 'expired', updated_at = clock_timestamp()
  where environment = p_environment
    and status = 'active'
    and expires_at <= clock_timestamp();

  v_new_limit := coalesce(p_online_sales_limit, v_settings.online_sales_limit);
  v_new_enabled := coalesce(p_sales_enabled, v_settings.sales_enabled);

  if v_new_limit < 70 or v_new_limit > v_settings.venue_capacity then
    raise exception 'online_sales_limit must be between 70 and venue capacity'
      using errcode = '22023';
  end if;

  select coalesce(sum(1), 0)
  into v_committed_online
  from public.case_lab_3_reservations reservation
  where reservation.environment = p_environment
    and reservation.status in ('active', 'processing', 'consumed');

  select v_committed_online + coalesce(sum(allocation.quantity), 0)
  into v_committed_online
  from public.case_lab_3_inventory_allocations allocation
  where allocation.environment = p_environment
    and allocation.counts_toward_online_limit
    and allocation.released_at is null;

  if v_new_limit < v_committed_online then
    raise exception 'online_sales_limit cannot be reduced below committed online seats'
      using errcode = '23514';
  end if;

  update public.case_lab_3_event_settings
  set online_sales_limit = v_new_limit,
      sales_enabled = v_new_enabled,
      configuration_version = configuration_version + 1,
      updated_at = clock_timestamp()
  where id = v_settings.id;

  insert into public.case_lab_3_audit_log (
    environment,
    action,
    target_table,
    target_id,
    before_summary,
    after_summary,
    actor_id,
    actor_label
  )
  values (
    p_environment,
    'event_settings_updated',
    'case_lab_3_event_settings',
    v_settings.id,
    jsonb_build_object(
      'onlineSalesLimit', v_settings.online_sales_limit,
      'salesEnabled', v_settings.sales_enabled,
      'configurationVersion', v_settings.configuration_version
    ),
    jsonb_build_object(
      'onlineSalesLimit', v_new_limit,
      'salesEnabled', v_new_enabled,
      'configurationVersion', v_settings.configuration_version + 1
    ),
    coalesce(nullif(p_actor_id, ''), 'service_role'),
    p_actor_id
  );

  return jsonb_build_object(
    'kind', 'updated',
    'environment', p_environment,
    'onlineSalesLimit', v_new_limit,
    'salesEnabled', v_new_enabled,
    'configurationVersion', v_settings.configuration_version + 1
  );
end;
$$;

create or replace function public.case_lab_3_create_allocation(
  p_environment text,
  p_allocation_category text,
  p_quantity integer,
  p_tier text,
  p_counts_toward_online_limit boolean,
  p_holds_early_bird_quota boolean,
  p_reason text,
  p_actor_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_settings public.case_lab_3_event_settings%rowtype;
  v_online_committed bigint;
  v_physical_occupied bigint;
  v_early_historical bigint;
  v_early_held bigint;
  v_allocation_id uuid;
begin
  if p_environment is null or p_environment not in ('test', 'live')
     or p_allocation_category is null
     or p_allocation_category not in ('paid', 'invited', 'organizer_reserved')
     or p_quantity is null or p_quantity < 1
     or p_tier is not null and p_tier not in ('early_bird', 'standard')
     or p_counts_toward_online_limit is null
     or p_holds_early_bird_quota is null
     or p_holds_early_bird_quota and p_tier is distinct from 'early_bird'
     or p_reason is null or length(btrim(p_reason)) = 0
     or p_actor_id is null or length(btrim(p_actor_id)) = 0 then
    raise exception 'invalid allocation input'
      using errcode = '22023';
  end if;

  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = p_environment
  for update;

  update public.case_lab_3_reservations
  set status = 'expired', updated_at = clock_timestamp()
  where environment = p_environment
    and status = 'active'
    and expires_at <= clock_timestamp();

  select coalesce(sum(1), 0)
  into v_online_committed
  from public.case_lab_3_reservations reservation
  where reservation.environment = p_environment
    and reservation.status in ('active', 'processing', 'consumed');

  select v_online_committed + coalesce(sum(allocation.quantity), 0)
  into v_physical_occupied
  from public.case_lab_3_inventory_allocations allocation
  where allocation.environment = p_environment
    and allocation.released_at is null;

  select v_online_committed + coalesce(sum(allocation.quantity), 0)
  into v_online_committed
  from public.case_lab_3_inventory_allocations allocation
  where allocation.environment = p_environment
    and allocation.counts_toward_online_limit
    and allocation.released_at is null;

  select v_online_committed + case
    when p_counts_toward_online_limit then p_quantity else 0 end
  into v_online_committed;

  if v_online_committed > v_settings.online_sales_limit then
    raise exception 'allocation exceeds online sales limit'
      using errcode = '23514';
  end if;

  if v_physical_occupied + p_quantity > v_settings.venue_capacity then
    raise exception 'allocation exceeds venue capacity'
      using errcode = '23514';
  end if;

  select coalesce(sum(1), 0)
  into v_early_historical
  from public.case_lab_3_orders order_row
  where order_row.environment = p_environment
    and order_row.tier = 'early_bird'
    and order_row.paid_amount_minor > 0
    and order_row.payment_status in (
      'paid', 'refund_pending', 'partially_refunded', 'refunded'
    );

  -- Paid imported Early Birds are historical sales regardless of either flag or release state.
  select v_early_historical + coalesce(sum(allocation.quantity), 0)
  into v_early_historical
  from public.case_lab_3_inventory_allocations allocation
  where allocation.environment = p_environment
    and allocation.allocation_category = 'paid'
    and allocation.tier = 'early_bird';

  -- Only active reservations and explicitly marked, unreleased allocations are temporary holds.
  select coalesce(sum(1), 0)
  into v_early_held
  from public.case_lab_3_reservations reservation
  where reservation.environment = p_environment
    and reservation.tier = 'early_bird'
    and reservation.status in ('active', 'processing');

  select v_early_held + coalesce(sum(allocation.quantity), 0)
  into v_early_held
  from public.case_lab_3_inventory_allocations allocation
  where allocation.environment = p_environment
    and allocation.holds_early_bird_quota
    and allocation.released_at is null;

  if p_tier = 'early_bird' and p_allocation_category = 'paid' then
    if v_early_historical + p_quantity > v_settings.early_bird_quota then
      raise exception 'early bird quota is unavailable'
        using errcode = '23514';
    end if;
  elsif p_holds_early_bird_quota
     and v_early_historical + v_early_held + p_quantity > v_settings.early_bird_quota then
    raise exception 'early bird quota is unavailable'
      using errcode = '23514';
  end if;

  v_allocation_id := gen_random_uuid();

  insert into public.case_lab_3_inventory_allocations (
    id,
    environment,
    allocation_category,
    quantity,
    tier,
    counts_toward_online_limit,
    holds_early_bird_quota,
    reason,
    actor_label
  )
  values (
    v_allocation_id,
    p_environment,
    p_allocation_category,
    p_quantity,
    p_tier,
    p_counts_toward_online_limit,
    p_holds_early_bird_quota,
    btrim(p_reason),
    btrim(p_actor_id)
  );

  insert into public.case_lab_3_audit_log (
    environment,
    action,
    target_table,
    target_id,
    after_summary,
    actor_id,
    actor_label
  )
  values (
    p_environment,
    'inventory_allocation_created',
    'case_lab_3_inventory_allocations',
    v_allocation_id,
    jsonb_build_object(
      'quantity', p_quantity,
      'category', p_allocation_category,
      'tier', p_tier,
      'countsTowardOnlineLimit', p_counts_toward_online_limit,
      'holdsEarlyBirdQuota', p_holds_early_bird_quota
    ),
    p_actor_id,
    p_actor_id
  );

  return jsonb_build_object(
    'kind', 'created',
    'allocationId', v_allocation_id,
    'environment', p_environment,
    'quantity', p_quantity
  );
end;
$$;

create or replace function public.case_lab_3_release_allocation(
  p_environment text,
  p_allocation_id uuid,
  p_actor_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_settings public.case_lab_3_event_settings%rowtype;
  v_allocation public.case_lab_3_inventory_allocations%rowtype;
begin
  if p_environment is null or p_environment not in ('test', 'live')
     or p_actor_id is null or length(btrim(p_actor_id)) = 0
     or p_reason is null or length(btrim(p_reason)) = 0 then
    raise exception 'invalid allocation release input'
      using errcode = '22023';
  end if;

  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = p_environment
  for update;

  update public.case_lab_3_reservations
  set status = 'expired', updated_at = clock_timestamp()
  where environment = p_environment
    and status = 'active'
    and expires_at <= clock_timestamp();

  select *
  into v_allocation
  from public.case_lab_3_inventory_allocations
  where id = p_allocation_id
    and environment = p_environment
  for update;

  if not found then
    raise exception 'allocation not found'
      using errcode = '22023';
  end if;

  if v_allocation.allocation_category = 'paid' then
    raise exception 'paid allocations cannot be released'
      using errcode = '55000';
  end if;

  if v_allocation.released_at is null then
    update public.case_lab_3_inventory_allocations
    set released_at = clock_timestamp(),
        released_by = btrim(p_actor_id),
        release_reason = btrim(p_reason),
        updated_at = clock_timestamp()
    where id = v_allocation.id;
  end if;

  insert into public.case_lab_3_audit_log (
    environment,
    action,
    target_table,
    target_id,
    before_summary,
    after_summary,
    actor_id,
    actor_label
  )
  values (
    p_environment,
    'inventory_allocation_released',
    'case_lab_3_inventory_allocations',
    v_allocation.id,
    jsonb_build_object('releasedAt', v_allocation.released_at),
    jsonb_build_object('releasedAt', coalesce(v_allocation.released_at, clock_timestamp()), 'reason', p_reason),
    p_actor_id,
    p_actor_id
  );

  return jsonb_build_object(
    'kind', 'released',
    'allocationId', v_allocation.id,
    'environment', p_environment
  );
end;
$$;

revoke all on function public.case_lab_3_inventory_availability(text) from public, anon, authenticated;
revoke all on function public.case_lab_3_get_availability(text) from public, anon, authenticated;
revoke all on function public.case_lab_3_create_order(text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_create_payment_attempt(uuid) from public, anon, authenticated;
revoke all on function public.case_lab_3_transfer_participant(uuid, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_transfer_participant(uuid, jsonb, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_cancel_ticket(uuid, text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_check_in(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.case_lab_3_consume_rate_limit(text, text, integer, integer) from public, anon, authenticated;
revoke all on function public.case_lab_3_update_settings(text, integer, boolean, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_create_allocation(text, text, integer, text, boolean, boolean, text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_release_allocation(text, uuid, text, text) from public, anon, authenticated;

grant execute on function public.case_lab_3_inventory_availability(text) to service_role;
grant execute on function public.case_lab_3_get_availability(text) to service_role;
grant execute on function public.case_lab_3_create_order(text, jsonb, text, text) to service_role;
grant execute on function public.case_lab_3_create_payment_attempt(uuid) to service_role;
grant execute on function public.case_lab_3_transfer_participant(uuid, jsonb, text, text) to service_role;
grant execute on function public.case_lab_3_transfer_participant(uuid, jsonb, text) to service_role;
grant execute on function public.case_lab_3_cancel_ticket(uuid, text, text) to service_role;
grant execute on function public.case_lab_3_check_in(uuid, uuid, integer) to service_role;
grant execute on function public.case_lab_3_consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.case_lab_3_update_settings(text, integer, boolean, text) to service_role;
grant execute on function public.case_lab_3_create_allocation(text, text, integer, text, boolean, boolean, text, text) to service_role;
grant execute on function public.case_lab_3_release_allocation(text, uuid, text, text) to service_role;
