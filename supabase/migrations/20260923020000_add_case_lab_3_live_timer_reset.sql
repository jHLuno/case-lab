create or replace function public.case_lab_3_live_reset_timer(
  p_case_id uuid,
  p_expected_version integer,
  p_actor_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_case public.case_lab_3_live_cases%rowtype;
  v_updated public.case_lab_3_live_cases%rowtype;
begin
  select * into v_case
  from public.case_lab_3_live_cases
  where id = p_case_id
  for update;

  if not found then
    return jsonb_build_object('kind', 'not_found');
  end if;

  if v_case.state_version <> p_expected_version then
    return jsonb_build_object('kind', 'conflict');
  end if;

  if v_case.state <> 'open' then
    return jsonb_build_object('kind', 'invalid_state');
  end if;

  update public.case_lab_3_live_cases
  set closes_at = clock_timestamp() + interval '3 minutes',
      state_version = state_version + 1
  where id = v_case.id
  returning * into v_updated;

  insert into public.case_lab_3_audit_log (
    environment, action, target_table, target_id, before_summary, after_summary, actor_id
  ) values (
    v_case.environment,
    'live_case_timer_reset',
    'case_lab_3_live_cases',
    v_case.id,
    jsonb_build_object('state', v_case.state, 'stateVersion', v_case.state_version, 'closesAt', v_case.closes_at),
    jsonb_build_object('state', v_updated.state, 'stateVersion', v_updated.state_version, 'closesAt', v_updated.closes_at),
    p_actor_id
  );

  return jsonb_build_object(
    'kind', 'timer_reset',
    'state', v_updated.state,
    'stateVersion', v_updated.state_version,
    'closesAt', v_updated.closes_at
  );
end;
$$;

revoke all on function public.case_lab_3_live_reset_timer(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.case_lab_3_live_reset_timer(uuid, integer, text) to service_role;
