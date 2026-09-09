alter table public.case_lab_3_refunds
  add column if not exists uncertain_since_at timestamptz;

create or replace function public.case_lab_3_begin_refund(
  p_environment text,
  p_order_id uuid,
  p_refund_id uuid,
  p_operation_key text,
  p_amount_minor bigint
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_order public.case_lab_3_orders%rowtype;
  v_refund public.case_lab_3_refunds%rowtype;
begin
  p_operation_key := nullif(btrim(p_operation_key), '');
  if p_environment is null
     or p_environment not in ('test', 'live')
     or p_order_id is null
     or p_refund_id is null
     or p_operation_key is null
     or length(p_operation_key) > 200
     or p_operation_key ~ '[[:cntrl:]]'
     or p_amount_minor is null
     or p_amount_minor <= 0 then
    raise exception 'invalid refund worker input'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('case_lab_3:provider:' || p_environment, 0)
  );

  select *
  into strict v_refund
  from public.case_lab_3_refunds
  where id = p_refund_id
    and order_id = p_order_id
    and environment = p_environment
  for update;

  select *
  into strict v_order
  from public.case_lab_3_orders
  where id = p_order_id
    and environment = p_environment
  for update;

  if v_refund.operation_key <> p_operation_key
     or v_refund.amount_minor <> p_amount_minor
     or v_refund.currency <> 'KZT' then
    raise exception 'refund worker identity mismatch'
      using errcode = '23514';
  end if;

  if v_refund.status = 'requested' then
    if v_order.payment_status not in ('paid', 'partially_refunded', 'refund_pending') then
      raise exception 'refund order is not refundable'
        using errcode = '23514';
    end if;

    update public.case_lab_3_refunds
    set status = 'processing',
        attempt_count = attempt_count + 1,
        next_attempt_at = null,
        uncertain_since_at = null,
        last_error = null,
        updated_at = clock_timestamp()
    where id = v_refund.id
      and order_id = v_order.id
      and environment = p_environment;

    return jsonb_build_object('kind', 'claimed', 'status', 'processing');
  end if;

  if v_refund.status = 'processing' then
    return jsonb_build_object('kind', 'already_processing', 'status', 'processing');
  end if;

  if v_refund.status in ('confirmed', 'failed') then
    return jsonb_build_object('kind', 'terminal', 'status', v_refund.status);
  end if;

  return jsonb_build_object('kind', 'review_required', 'status', v_refund.status);
end;
$$;

create or replace function public.case_lab_3_fail_refund(
  p_environment text,
  p_order_id uuid,
  p_refund_id uuid,
  p_operation_key text,
  p_amount_minor bigint,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_order public.case_lab_3_orders%rowtype;
  v_refund public.case_lab_3_refunds%rowtype;
  v_confirmed bigint;
  v_pending bigint;
  v_refundable bigint;
  v_error text;
begin
  p_operation_key := nullif(btrim(p_operation_key), '');
  if p_environment is null
     or p_environment not in ('test', 'live')
     or p_order_id is null
     or p_refund_id is null
     or p_operation_key is null
     or length(p_operation_key) > 200
     or p_operation_key ~ '[[:cntrl:]]'
     or p_amount_minor is null
     or p_amount_minor <= 0 then
    raise exception 'invalid refund failure input'
      using errcode = '22023';
  end if;
  v_error := coalesce(public.case_lab_3_sanitize_error_text(p_error), 'provider refused refund');

  perform pg_advisory_xact_lock(
    hashtextextended('case_lab_3:provider:' || p_environment, 0)
  );

  select *
  into strict v_refund
  from public.case_lab_3_refunds
  where id = p_refund_id
    and order_id = p_order_id
    and environment = p_environment
  for update;

  select *
  into strict v_order
  from public.case_lab_3_orders
  where id = p_order_id
    and environment = p_environment
  for update;

  if v_refund.operation_key <> p_operation_key
     or v_refund.amount_minor <> p_amount_minor
     or v_refund.currency <> 'KZT' then
    raise exception 'refund failure identity mismatch'
      using errcode = '23514';
  end if;

  if v_refund.status = 'confirmed' or v_refund.status = 'failed' then
    return jsonb_build_object('kind', 'terminal', 'status', v_refund.status);
  end if;
  if v_refund.status in ('unknown', 'review_required') then
    return jsonb_build_object('kind', 'review_required', 'status', v_refund.status);
  end if;

  update public.case_lab_3_refunds
  set status = 'failed',
      remaining_refundable_amount_minor = amount_minor,
      uncertain_since_at = null,
      last_error = v_error,
      updated_at = clock_timestamp()
  where id = v_refund.id
    and order_id = v_order.id
    and environment = p_environment;

  select coalesce(sum(amount_minor), 0)
  into v_confirmed
  from public.case_lab_3_refunds
  where order_id = v_order.id
    and environment = p_environment
    and status = 'confirmed';

  select coalesce(sum(amount_minor), 0)
  into v_pending
  from public.case_lab_3_refunds
  where order_id = v_order.id
    and environment = p_environment
    and status in ('requested', 'processing', 'unknown', 'review_required');

  v_refundable := v_order.paid_amount_minor - v_confirmed - v_pending;
  update public.case_lab_3_orders
  set payment_status = case
        when v_pending > 0 then 'refund_pending'
        when v_confirmed >= paid_amount_minor then 'refunded'
        when v_confirmed > 0 then 'partially_refunded'
        else 'paid'
      end,
      refunded_amount_minor = v_confirmed,
      refundable_amount_minor = greatest(v_refundable, 0),
      updated_at = clock_timestamp()
  where id = v_order.id
    and environment = p_environment;

  return jsonb_build_object('kind', 'failed', 'status', 'failed');
end;
$$;

create or replace function public.case_lab_3_mark_refund_unknown(
  p_environment text,
  p_order_id uuid,
  p_refund_id uuid,
  p_operation_key text,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_order public.case_lab_3_orders%rowtype;
  v_refund public.case_lab_3_refunds%rowtype;
  v_error text;
begin
  p_operation_key := nullif(btrim(p_operation_key), '');
  if p_environment is null
     or p_environment not in ('test', 'live')
     or p_order_id is null
     or p_refund_id is null
     or p_operation_key is null
     or length(p_operation_key) > 200
     or p_operation_key ~ '[[:cntrl:]]' then
    raise exception 'invalid refund uncertainty input'
      using errcode = '22023';
  end if;
  v_error := coalesce(public.case_lab_3_sanitize_error_text(p_error), 'provider result is unknown');

  perform pg_advisory_xact_lock(
    hashtextextended('case_lab_3:provider:' || p_environment, 0)
  );

  select *
  into strict v_refund
  from public.case_lab_3_refunds
  where id = p_refund_id
    and order_id = p_order_id
    and environment = p_environment
  for update;

  select *
  into strict v_order
  from public.case_lab_3_orders
  where id = p_order_id
    and environment = p_environment
  for update;

  if v_refund.operation_key <> p_operation_key then
    raise exception 'refund uncertainty identity mismatch'
      using errcode = '23514';
  end if;
  if v_refund.status in ('confirmed', 'failed') then
    return jsonb_build_object('kind', 'terminal', 'status', v_refund.status);
  end if;
  if v_refund.status in ('unknown', 'review_required') then
    return jsonb_build_object('kind', 'review_required', 'status', v_refund.status);
  end if;

  update public.case_lab_3_refunds
  set status = 'unknown',
      uncertain_since_at = coalesce(uncertain_since_at, clock_timestamp()),
      next_attempt_at = null,
      last_error = v_error,
      updated_at = clock_timestamp()
  where id = v_refund.id
    and order_id = v_order.id
    and environment = p_environment;

  update public.case_lab_3_orders
  set payment_status = 'refund_pending',
      updated_at = clock_timestamp()
  where id = v_order.id
    and environment = p_environment
    and payment_status in ('paid', 'partially_refunded', 'refund_pending');

  return jsonb_build_object('kind', 'unknown', 'status', 'unknown');
end;
$$;

revoke all on function public.case_lab_3_begin_refund(text, uuid, uuid, text, bigint) from public, anon, authenticated;
revoke all on function public.case_lab_3_fail_refund(text, uuid, uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_mark_refund_unknown(text, uuid, uuid, text, text) from public, anon, authenticated;

grant execute on function public.case_lab_3_begin_refund(text, uuid, uuid, text, bigint) to service_role;
grant execute on function public.case_lab_3_fail_refund(text, uuid, uuid, text, bigint, text) to service_role;
grant execute on function public.case_lab_3_mark_refund_unknown(text, uuid, uuid, text, text) to service_role;
