create or replace function public.case_lab_3_create_payment_attempt(
  p_order_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_settings public.case_lab_3_event_settings%rowtype;
  v_order public.case_lab_3_orders%rowtype;
  v_reservation public.case_lab_3_reservations%rowtype;
  v_environment text;
  v_attempt_id uuid;
  v_external_id text;
begin
  select order_row.environment
  into strict v_environment
  from public.case_lab_3_orders order_row
  where order_row.id = p_order_id;

  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = v_environment
  for update;

  select *
  into strict v_order
  from public.case_lab_3_orders
  where id = p_order_id
  for update;

  update public.case_lab_3_reservations reservation
  set status = 'expired',
      updated_at = clock_timestamp()
  where reservation.order_id = p_order_id
    and reservation.status = 'active'
    and reservation.expires_at <= clock_timestamp();

  update public.case_lab_3_payment_attempts attempt
  set status = 'failed',
      failure_code = 'reservation_expired',
      failure_reason = 'Reservation expired before the payment attempt completed',
      completed_at = coalesce(attempt.completed_at, clock_timestamp()),
      updated_at = clock_timestamp()
  from public.case_lab_3_reservations reservation
  where attempt.order_id = p_order_id
    and attempt.reservation_id = reservation.id
    and attempt.environment = reservation.environment
    and attempt.status = 'created'
    and reservation.status in ('expired', 'released')
    and reservation.expires_at <= clock_timestamp();

  select *
  into strict v_reservation
  from public.case_lab_3_reservations reservation
  where reservation.order_id = p_order_id
    and reservation.environment = v_environment
  for update;

  if v_reservation.status <> 'active'
     or v_reservation.expires_at <= clock_timestamp() then
    raise exception 'reservation is not available for payment'
      using errcode = '55000';
  end if;

  if not exists (
    select 1
    from public.case_lab_3_payment_attempts attempt
    where attempt.order_id = p_order_id
      and attempt.environment = v_environment
  ) then
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
      v_environment,
      v_order.amount_minor,
      'KZT',
      'created'
    );

    return jsonb_build_object(
      'attempt_id', v_attempt_id,
      'external_id', v_external_id,
      'reservation_expires_at', v_reservation.expires_at
    );
  end if;

  return public.case_lab_3_create_payment_attempt_legacy(p_order_id);
end;
$$;

revoke all on function public.case_lab_3_create_payment_attempt(uuid) from public, anon, authenticated;
grant execute on function public.case_lab_3_create_payment_attempt(uuid) to service_role;
