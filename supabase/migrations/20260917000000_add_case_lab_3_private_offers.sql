create table public.case_lab_3_private_offers (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  token_hash text not null check (token_hash ~ '^[0-9a-f]{64}$'),
  amount_minor bigint not null default 500000 check (amount_minor = 500000),
  status text not null default 'active' check (status in ('active', 'redeemed', 'revoked')),
  claimed_order_id uuid,
  claimed_until timestamptz,
  redeemed_order_id uuid,
  redeemed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (environment, token_hash),
  check ((status = 'redeemed' and redeemed_order_id is not null and redeemed_at is not null)
    or status <> 'redeemed'),
  check ((claimed_order_id is null and claimed_until is null) or (claimed_order_id is not null and claimed_until is not null))
);

alter table public.case_lab_3_orders
  add column private_offer_id uuid references public.case_lab_3_private_offers(id);

create index case_lab_3_private_offers_claim_idx
  on public.case_lab_3_private_offers (environment, status, claimed_until);

create index case_lab_3_orders_private_offer_idx
  on public.case_lab_3_orders (environment, private_offer_id);

create or replace function public.case_lab_3_private_offer_unavailable()
returns jsonb
language sql
immutable
set search_path = pg_catalog, public, extensions
as $$
  select jsonb_build_object(
    'available', false,
    'reason', 'sold_out',
    'tier', null,
    'amountMinor', null,
    'currency', 'KZT',
    'salesLimit', 1
  );
$$;

create or replace function public.case_lab_3_get_private_offer_availability(
  p_environment text,
  p_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_offer public.case_lab_3_private_offers%rowtype;
  v_public_availability jsonb;
  v_reason text;
begin
  if p_environment is null or p_environment not in ('test', 'live')
     or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    return public.case_lab_3_private_offer_unavailable();
  end if;

  select *
  into v_offer
  from public.case_lab_3_private_offers
  where environment = p_environment
    and token_hash = p_token_hash
  for update;

  if not found or v_offer.status <> 'active' then
    return public.case_lab_3_private_offer_unavailable();
  end if;

  if v_offer.claimed_until is not null and v_offer.claimed_until <= clock_timestamp() then
    update public.case_lab_3_private_offers
    set claimed_order_id = null,
        claimed_until = null,
        updated_at = clock_timestamp()
    where id = v_offer.id and environment = p_environment;
    v_offer.claimed_order_id := null;
    v_offer.claimed_until := null;
  end if;

  if v_offer.claimed_order_id is not null then
    return public.case_lab_3_private_offer_unavailable();
  end if;

  v_public_availability := public.case_lab_3_inventory_availability(p_environment);
  v_reason := v_public_availability->>'reason';
  if coalesce((v_public_availability->>'available')::boolean, false) is not true then
    return jsonb_build_object(
      'available', false,
      'reason', v_reason,
      'tier', null,
      'amountMinor', null,
      'currency', 'KZT',
      'salesLimit', coalesce((v_public_availability->>'salesLimit')::integer, 0)
    );
  end if;

  return jsonb_build_object(
    'available', true,
    'reason', 'available',
    'tier', v_public_availability->>'tier',
    'amountMinor', v_offer.amount_minor,
    'currency', 'KZT',
    'salesLimit', 1
  );
end;
$$;

create or replace function public.case_lab_3_create_private_offer(
  p_environment text,
  p_token_hash text,
  p_amount_minor bigint default 500000
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_offer public.case_lab_3_private_offers%rowtype;
begin
  if p_environment is null or p_environment not in ('test', 'live')
     or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_amount_minor <> 500000 then
    raise exception 'invalid private offer'
      using errcode = '22023';
  end if;

  insert into public.case_lab_3_private_offers (environment, token_hash, amount_minor)
  values (p_environment, p_token_hash, p_amount_minor)
  returning * into v_offer;

  return jsonb_build_object(
    'kind', 'created',
    'offerId', v_offer.id,
    'environment', v_offer.environment,
    'amountMinor', v_offer.amount_minor,
    'status', v_offer.status
  );
end;
$$;

create or replace function public.case_lab_3_create_private_order(
  p_environment text,
  p_input jsonb,
  p_idempotency_key text,
  p_hashed_client_ip text,
  p_private_offer_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_offer public.case_lab_3_private_offers%rowtype;
  v_existing public.case_lab_3_orders%rowtype;
  v_public_availability jsonb;
  v_public_input jsonb;
  v_result jsonb;
  v_order_id uuid;
  v_tier text;
  v_amount bigint;
  v_settings public.case_lab_3_event_settings%rowtype;
begin
  if p_environment is null or p_environment not in ('test', 'live')
     or p_private_offer_token_hash is null
     or p_private_offer_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid private offer'
      using errcode = '22023';
  end if;

  select *
  into v_offer
  from public.case_lab_3_private_offers
  where environment = p_environment
    and token_hash = p_private_offer_token_hash
  for update;

  if not found then
    return jsonb_build_object(
      'kind', 'unavailable',
      'availability', public.case_lab_3_private_offer_unavailable()
    );
  end if;

  select *
  into v_existing
  from public.case_lab_3_orders
  where environment = p_environment
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_existing.private_offer_id is distinct from v_offer.id then
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

  if v_offer.status <> 'active' then
    return jsonb_build_object(
      'kind', 'unavailable',
      'availability', public.case_lab_3_private_offer_unavailable()
    );
  end if;

  if v_offer.claimed_until is not null and v_offer.claimed_until <= clock_timestamp() then
    update public.case_lab_3_private_offers
    set claimed_order_id = null,
        claimed_until = null,
        updated_at = clock_timestamp()
    where id = v_offer.id and environment = p_environment;
    v_offer.claimed_order_id := null;
    v_offer.claimed_until := null;
  end if;

  if v_offer.claimed_order_id is not null then
    return jsonb_build_object(
      'kind', 'unavailable',
      'availability', public.case_lab_3_private_offer_unavailable()
    );
  end if;

  v_public_availability := public.case_lab_3_inventory_availability(p_environment);
  if coalesce((v_public_availability->>'available')::boolean, false) is not true then
    return jsonb_build_object(
      'kind', 'unavailable',
      'availability', jsonb_build_object(
        'available', false,
        'reason', v_public_availability->>'reason',
        'tier', null,
        'amountMinor', null,
        'currency', 'KZT',
        'salesLimit', coalesce((v_public_availability->>'salesLimit')::integer, 0)
      )
    );
  end if;

  v_tier := v_public_availability->>'tier';
  v_amount := (v_public_availability->>'amountMinor')::bigint;
  v_public_input := coalesce(p_input, '{}'::jsonb)
    || jsonb_build_object('expectedTier', v_tier, 'expectedAmountMinor', v_amount);

  v_result := public.case_lab_3_create_order(
    p_environment,
    v_public_input,
    p_idempotency_key,
    p_hashed_client_ip
  );

  if v_result->>'kind' <> 'created' then
    return jsonb_build_object(
      'kind', 'unavailable',
      'availability', public.case_lab_3_get_private_offer_availability(p_environment, p_private_offer_token_hash)
    );
  end if;

  v_order_id := (v_result->>'orderId')::uuid;
  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = p_environment;

  update public.case_lab_3_orders
  set private_offer_id = v_offer.id,
      amount_minor = v_offer.amount_minor,
      receipt_label = v_settings.standard_receipt_label,
      updated_at = clock_timestamp()
  where id = v_order_id and environment = p_environment;

  update public.case_lab_3_private_offers
  set claimed_order_id = v_order_id,
      claimed_until = (v_result->>'reservationExpiresAt')::timestamptz,
      updated_at = clock_timestamp()
  where id = v_offer.id
    and environment = p_environment
    and status = 'active'
    and claimed_order_id is null;

  if not found then
    raise exception 'private offer claim failed'
      using errcode = '55000';
  end if;

  return jsonb_build_object(
    'kind', 'created',
    'orderId', v_order_id,
    'orderNumber', v_result->>'orderNumber',
    'tier', v_result->>'tier',
    'amountMinor', v_offer.amount_minor,
    'reservationExpiresAt', v_result->>'reservationExpiresAt'
  );
end;
$$;

create or replace function public.case_lab_3_sync_private_offer_after_order_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if new.private_offer_id is null then
    return new;
  end if;

  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    update public.case_lab_3_private_offers
    set status = 'redeemed',
        claimed_order_id = null,
        claimed_until = null,
        redeemed_order_id = new.id,
        redeemed_at = coalesce(redeemed_at, clock_timestamp()),
        updated_at = clock_timestamp()
    where id = new.private_offer_id
      and environment = new.environment
      and (
        (status = 'active' and claimed_order_id = new.id)
        or (status = 'redeemed' and redeemed_order_id = new.id)
      );

    if not found then
      raise exception 'private offer cannot be redeemed'
        using errcode = '55000';
    end if;
  elsif new.payment_status = 'failed' and old.payment_status is distinct from 'failed' then
    update public.case_lab_3_private_offers
    set claimed_order_id = null,
        claimed_until = null,
        updated_at = clock_timestamp()
    where id = new.private_offer_id
      and environment = new.environment
      and status = 'active'
      and claimed_order_id = new.id;
  end if;

  return new;
end;
$$;

create or replace function public.case_lab_3_release_private_offer_after_reservation_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  if new.status in ('expired', 'released') then
    update public.case_lab_3_private_offers offer
    set claimed_order_id = null,
        claimed_until = null,
        updated_at = clock_timestamp()
    from public.case_lab_3_orders order_row
    where order_row.id = new.order_id
      and order_row.environment = new.environment
      and offer.id = order_row.private_offer_id
      and offer.environment = new.environment
      and offer.status = 'active'
      and offer.claimed_order_id = order_row.id;
  end if;

  return new;
end;
$$;

drop trigger if exists case_lab_3_private_offer_order_sync on public.case_lab_3_orders;
create trigger case_lab_3_private_offer_order_sync
after update of payment_status on public.case_lab_3_orders
for each row execute function public.case_lab_3_sync_private_offer_after_order_update();

drop trigger if exists case_lab_3_private_offer_reservation_release on public.case_lab_3_reservations;
create trigger case_lab_3_private_offer_reservation_release
after update of status on public.case_lab_3_reservations
for each row execute function public.case_lab_3_release_private_offer_after_reservation_update();

revoke all on table public.case_lab_3_private_offers from public, anon, authenticated;
grant all on table public.case_lab_3_private_offers to service_role;

alter table public.case_lab_3_private_offers enable row level security;

revoke all on function public.case_lab_3_private_offer_unavailable() from public, anon, authenticated;
revoke all on function public.case_lab_3_get_private_offer_availability(text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_create_private_offer(text, text, bigint) from public, anon, authenticated;
revoke all on function public.case_lab_3_create_private_order(text, jsonb, text, text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_sync_private_offer_after_order_update() from public, anon, authenticated;
revoke all on function public.case_lab_3_release_private_offer_after_reservation_update() from public, anon, authenticated;

grant execute on function public.case_lab_3_private_offer_unavailable() to service_role;
grant execute on function public.case_lab_3_get_private_offer_availability(text, text) to service_role;
grant execute on function public.case_lab_3_create_private_offer(text, text, bigint) to service_role;
grant execute on function public.case_lab_3_create_private_order(text, jsonb, text, text, text) to service_role;
grant execute on function public.case_lab_3_sync_private_offer_after_order_update() to service_role;
grant execute on function public.case_lab_3_release_private_offer_after_reservation_update() to service_role;
