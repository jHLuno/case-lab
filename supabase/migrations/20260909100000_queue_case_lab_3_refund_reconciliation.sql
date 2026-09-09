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
    insert into public.case_lab_3_jobs (
      environment, job_type, logical_key, payload_reference, order_id, refund_id
    )
    values (
      p_environment, 'reconcile_payment', 'reconcile:refund:' || v_refund.id,
      jsonb_build_object('refundId', v_refund.id), v_order.id, v_refund.id
    )
    on conflict (environment, logical_key) do nothing;
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

  insert into public.case_lab_3_jobs (
    environment, job_type, logical_key, payload_reference, order_id, refund_id
  )
  values (
    p_environment, 'reconcile_payment', 'reconcile:refund:' || v_refund.id,
    jsonb_build_object('refundId', v_refund.id), v_order.id, v_refund.id
  )
  on conflict (environment, logical_key) do nothing;

  return jsonb_build_object('kind', 'unknown', 'status', 'unknown');
end;
$$;
