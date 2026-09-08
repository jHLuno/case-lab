create or replace function public.case_lab_3_record_provider_conflict(
  p_environment text,
  p_incident_type text,
  p_order_id uuid,
  p_payment_attempt_id uuid,
  p_refund_id uuid,
  p_summary jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_incident_id uuid;
  v_safe_summary jsonb;
begin
  if p_environment is null
     or p_environment not in ('test', 'live')
     or p_incident_type not in (
       'unexpected_payment', 'unknown_provider_result', 'overdue_receipt',
       'overdue_email', 'reconciliation_mismatch'
     )
     or p_summary is null
     or jsonb_typeof(p_summary) <> 'object' then
    raise exception 'invalid provider conflict input'
      using errcode = '22023';
  end if;

  v_safe_summary := public.case_lab_3_sanitize_provider_fields(p_summary, 'conflict');

  if p_incident_type = 'reconciliation_mismatch'
     and p_refund_id is not null
     and v_safe_summary->>'reason' = 'late_terminal_refund' then
    select id
    into v_incident_id
    from public.case_lab_3_incidents
    where environment = p_environment
      and incident_type = p_incident_type
      and refund_id = p_refund_id
    order by created_at, id
    limit 1
    for update;

    if found then
      return v_incident_id;
    end if;
  end if;

  select id
  into v_incident_id
  from public.case_lab_3_incidents
  where environment = p_environment
    and incident_type = p_incident_type
    and order_id is not distinct from p_order_id
    and payment_attempt_id is not distinct from p_payment_attempt_id
    and refund_id is not distinct from p_refund_id
    and summary = v_safe_summary
  for update;

  if found then
    return v_incident_id;
  end if;

  insert into public.case_lab_3_incidents (
    environment, incident_type, order_id, payment_attempt_id, refund_id, summary
  )
  values (
    p_environment,
    p_incident_type,
    p_order_id,
    p_payment_attempt_id,
    p_refund_id,
    v_safe_summary
  )
  returning id into v_incident_id;

  if p_incident_type = 'unexpected_payment' then
    insert into public.case_lab_3_jobs (
      environment, job_type, logical_key, payload_reference, order_id
    )
    values (
      p_environment, 'send_organizer_alert', 'organizer-alert:incident:' || v_incident_id,
      jsonb_build_object('incidentId', v_incident_id), p_order_id
    )
    on conflict (environment, logical_key) do nothing;
  end if;

  return v_incident_id;
end;
$$;

revoke all on function public.case_lab_3_record_provider_conflict(text, text, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.case_lab_3_record_provider_conflict(text, text, uuid, uuid, uuid, jsonb) to service_role;
