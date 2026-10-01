begin;

do $$
declare
  v_run_id uuid;
  v_snapshot_version integer;
  v_job_id uuid;
  v_lease_token uuid := gen_random_uuid();
  v_state text;
begin
  update public.nbs_forum_runs
  set state = 'analyzing',
      state_version = state_version + 1,
      snapshot_version = state_version + 1,
      snapshot_hash = repeat('0', 64),
      snapshot_response_count = 0
  where environment = 'test'
  returning id, snapshot_version into v_run_id, v_snapshot_version;

  insert into public.nbs_forum_jobs (
    environment, run_id, snapshot_version, job_type, question_number,
    status, attempt_count, error_category
  ) values ('test', v_run_id, v_snapshot_version, 'question_cluster', 2, 'failed', 3, 'worker_error');

  insert into public.nbs_forum_jobs (
    environment, run_id, snapshot_version, job_type, question_number,
    status, attempt_count, lease_token, leased_until
  ) values (
    'test', v_run_id, v_snapshot_version, 'question_report', 1,
    'leased', 1, v_lease_token, clock_timestamp() + interval '2 minutes'
  ) returning id into v_job_id;

  perform public.nbs_forum_complete_job(
    'test', v_job_id, v_lease_token,
    jsonb_build_object(
      'questionNumber', 1,
      'total', 0,
      'valid', 0,
      'ignored', 0,
      'clusters', '[]'::jsonb,
      'conclusion', 'Нет валидных ответов.'
    )
  );
  perform public.nbs_forum_dispatch_jobs('test');

  select state into v_state from public.nbs_forum_runs where id = v_run_id;
  if v_state is distinct from 'analysis_failed' then
    raise exception 'expected analysis_failed after terminal worker failure, got %', v_state;
  end if;
end;
$$;

rollback;
