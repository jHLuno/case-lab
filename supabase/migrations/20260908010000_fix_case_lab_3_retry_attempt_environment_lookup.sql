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
  v_environment text;
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

  return public.case_lab_3_create_payment_attempt_legacy(p_order_id);
end;
$$;

revoke all on function public.case_lab_3_create_payment_attempt(uuid) from public, anon, authenticated;
grant execute on function public.case_lab_3_create_payment_attempt(uuid) to service_role;
