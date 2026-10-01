alter table public.nbs_forum_commands
  drop constraint if exists nbs_forum_commands_operation_check;

alter table public.nbs_forum_commands
  add constraint nbs_forum_commands_operation_check
  check (operation in ('register', 'submit', 'start', 'finish', 'retry', 'reset'));

create or replace function public.nbs_forum_reset(
  p_environment text,
  p_run_id uuid,
  p_expected_version integer,
  p_idempotency_key text,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_run public.nbs_forum_runs%rowtype;
  v_command public.nbs_forum_commands%rowtype;
  v_result jsonb;
  v_state_version integer;
  v_participants integer;
  v_responses integer;
  v_jobs integer;
  v_reports integer;
begin
  if p_environment is null or p_environment not in ('test', 'live')
     or p_expected_version is null or p_expected_version < 1
     or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
     or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'nbs_invalid_input' using errcode = '22023';
  end if;

  select * into v_run
  from public.nbs_forum_runs
  where environment = p_environment and id = p_run_id
  for update;
  if not found then raise exception 'nbs_not_found' using errcode = 'P0001'; end if;

  select * into v_command
  from public.nbs_forum_commands
  where environment = p_environment and run_id = p_run_id
    and operation = 'reset' and idempotency_key = p_idempotency_key;
  if found then
    if v_command.request_hash is distinct from p_request_hash then
      raise exception 'nbs_conflict' using errcode = 'P0001';
    end if;
    return v_command.result || jsonb_build_object('replayed', true);
  end if;

  if v_run.state_version <> p_expected_version then
    raise exception 'nbs_conflict' using errcode = 'P0001';
  end if;

  update public.nbs_forum_runs
  set state = 'ready',
      state_version = state_version + 1,
      started_at = null,
      closed_at = null,
      snapshot_version = null,
      snapshot_hash = null,
      snapshot_response_count = null,
      published_report_id = null
  where environment = p_environment and id = p_run_id
  returning state_version into v_state_version;

  delete from public.nbs_forum_responses
  where environment = p_environment and run_id = p_run_id;
  get diagnostics v_responses = row_count;

  delete from public.nbs_forum_participants
  where environment = p_environment and run_id = p_run_id;
  get diagnostics v_participants = row_count;

  delete from public.nbs_forum_jobs
  where environment = p_environment and run_id = p_run_id;
  get diagnostics v_jobs = row_count;

  delete from public.nbs_forum_reports
  where environment = p_environment and run_id = p_run_id;
  get diagnostics v_reports = row_count;

  delete from public.nbs_forum_commands
  where environment = p_environment and run_id = p_run_id and operation <> 'reset';

  v_result := jsonb_build_object(
    'state', 'ready',
    'stateVersion', v_state_version,
    'cleared', jsonb_build_object(
      'participants', v_participants,
      'responses', v_responses,
      'jobs', v_jobs,
      'reports', v_reports
    )
  );

  insert into public.nbs_forum_commands(environment, run_id, operation, idempotency_key, request_hash, result)
  values (p_environment, p_run_id, 'reset', p_idempotency_key, p_request_hash, v_result);

  return v_result || jsonb_build_object('replayed', false);
end;
$$;

revoke all on function public.nbs_forum_reset(text, uuid, integer, text, text) from public, anon, authenticated;
grant execute on function public.nbs_forum_reset(text, uuid, integer, text, text) to service_role;
