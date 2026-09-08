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

  if not v_configuration_complete then
    v_reason := 'configuration_incomplete';
    v_tier := null;
    v_amount := null;
  elsif not v_settings.sales_enabled then
    v_reason := 'sales_closed';
    v_tier := null;
    v_amount := null;
  elsif now() >= v_settings.sales_cutoff then
    v_reason := 'sales_closed';
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

revoke all on function public.case_lab_3_inventory_availability(text) from public, anon, authenticated;
grant execute on function public.case_lab_3_inventory_availability(text) to service_role;
