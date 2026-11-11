alter table public.nbs_forum_jobs add column if not exists participant_id uuid;

alter table public.nbs_forum_jobs drop constraint if exists nbs_forum_jobs_job_type_check;
alter table public.nbs_forum_jobs add constraint nbs_forum_jobs_job_type_check
  check (job_type in ('participant_analysis', 'question_cluster', 'question_report', 'forum_summary'));

alter table public.nbs_forum_jobs drop constraint if exists nbs_forum_jobs_check;
alter table public.nbs_forum_jobs add constraint nbs_forum_jobs_check
  check (
    (job_type = 'participant_analysis' and question_number is null and participant_id is not null)
    or (job_type = 'forum_summary' and question_number is null and participant_id is null)
    or (job_type in ('question_cluster', 'question_report') and question_number is not null and participant_id is null)
  );

alter table public.nbs_forum_jobs
  drop constraint if exists nbs_forum_jobs_environment_run_id_snapshot_version_job_type_key;
alter table public.nbs_forum_jobs
  add constraint nbs_forum_jobs_environment_run_id_snapshot_version_job_type_key
  unique nulls not distinct (environment, run_id, snapshot_version, job_type, question_number, participant_id);

create index if not exists nbs_forum_jobs_participant_analysis_idx
  on public.nbs_forum_jobs(environment, run_id, snapshot_version, status)
  where job_type = 'participant_analysis';

create or replace function public.nbs_forum_finish(
  p_environment text, p_run_id uuid, p_expected_version integer,
  p_idempotency_key text, p_request_hash text
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, extensions
as $$
declare
  v_run public.nbs_forum_runs%rowtype;
  v_command public.nbs_forum_commands%rowtype;
  v_snapshot_hash text;
  v_version integer;
  v_participants integer;
begin
  select * into v_run from public.nbs_forum_runs where environment = p_environment and id = p_run_id for update;
  if not found then raise exception 'nbs_not_found' using errcode = 'P0001'; end if;
  select * into v_command from public.nbs_forum_commands where environment = p_environment and run_id = p_run_id
    and operation = 'finish' and idempotency_key = p_idempotency_key;
  if found then
    if v_command.request_hash <> p_request_hash then raise exception 'nbs_conflict' using errcode = 'P0001'; end if;
    return v_command.result || jsonb_build_object('replayed', true);
  end if;
  if v_run.state <> 'open' or v_run.state_version <> p_expected_version then raise exception 'nbs_conflict' using errcode = 'P0001'; end if;

  select encode(digest(coalesce(string_agg(r.question_number::text || ':' || r.participant_id::text || ':' || r.answer_text, chr(10) order by r.question_number, r.participant_id), ''), 'sha256'), 'hex')
  into v_snapshot_hash from public.nbs_forum_responses r where r.environment = p_environment and r.run_id = p_run_id;
  update public.nbs_forum_runs set state = 'analyzing', state_version = state_version + 1,
    closed_at = clock_timestamp(), snapshot_version = state_version + 1, snapshot_hash = v_snapshot_hash,
    snapshot_response_count = (select count(*)::integer from public.nbs_forum_responses r where r.environment = p_environment and r.run_id = p_run_id)
  where id = p_run_id and environment = p_environment returning state_version into v_version;

  insert into public.nbs_forum_jobs(environment, run_id, snapshot_version, job_type, question_number, participant_id)
  select p_environment, p_run_id, v_version, 'participant_analysis', null, p.id
  from public.nbs_forum_participants p
  where p.environment = p_environment and p.run_id = p_run_id and p.submitted_at is not null
  on conflict do nothing;
  get diagnostics v_participants = row_count;
  if v_participants = 0 then
    insert into public.nbs_forum_jobs(environment, run_id, snapshot_version, job_type, question_number)
    select p_environment, p_run_id, v_version, 'question_cluster', question_number::smallint
    from generate_series(1, 3) as series(question_number)
    on conflict do nothing;
  end if;

  insert into public.nbs_forum_commands(environment, run_id, operation, idempotency_key, request_hash, result)
  values (p_environment, p_run_id, 'finish', p_idempotency_key, p_request_hash,
    jsonb_build_object('state', 'analyzing', 'stateVersion', v_version, 'snapshotVersion', v_version));
  return jsonb_build_object('state', 'analyzing', 'stateVersion', v_version, 'snapshotVersion', v_version, 'replayed', false);
end;
$$;

create or replace function public.nbs_forum_claim_job(p_environment text, p_worker_id text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_run public.nbs_forum_runs%rowtype;
  v_job public.nbs_forum_jobs%rowtype;
  v_leased integer;
begin
  if p_environment not in ('test', 'live') or p_worker_id is null or char_length(p_worker_id) not between 1 and 128 then
    raise exception 'nbs_invalid_input' using errcode = '22023';
  end if;
  select * into v_run from public.nbs_forum_runs where environment = p_environment for update;
  if not found or v_run.state not in ('analyzing', 'analysis_failed') then return null; end if;

  update public.nbs_forum_jobs
  set status = case when attempt_count >= 3 then 'failed' else 'pending' end,
      error_category = case when attempt_count >= 3 then 'worker_timeout' else error_category end,
      available_at = clock_timestamp() + case attempt_count when 1 then interval '15 seconds' when 2 then interval '60 seconds' else interval '0 seconds' end,
      lease_token = null,
      leased_until = null
  where environment = p_environment and run_id = v_run.id and snapshot_version = v_run.snapshot_version
    and status = 'leased' and leased_until < clock_timestamp();

  select count(*) into v_leased from public.nbs_forum_jobs
  where environment = p_environment and run_id = v_run.id and snapshot_version = v_run.snapshot_version
    and status = 'leased';
  if v_leased >= 3 then return null; end if;

  select * into v_job from public.nbs_forum_jobs
  where environment = p_environment and run_id = v_run.id and snapshot_version = v_run.snapshot_version
    and status = 'pending' and available_at <= clock_timestamp()
  order by available_at, job_type, question_number, participant_id
  for update skip locked
  limit 1;
  if not found then
    if exists (select 1 from public.nbs_forum_jobs where environment = p_environment and run_id = v_run.id
        and snapshot_version = v_run.snapshot_version and status = 'failed')
       and not exists (select 1 from public.nbs_forum_jobs where environment = p_environment and run_id = v_run.id
        and snapshot_version = v_run.snapshot_version and status in ('pending', 'leased')) then
      update public.nbs_forum_runs set state = 'analysis_failed', state_version = state_version + 1
      where id = v_run.id and environment = p_environment and state = 'analyzing';
    end if;
    return null;
  end if;

  update public.nbs_forum_jobs set status = 'leased', attempt_count = attempt_count + 1,
    lease_token = gen_random_uuid(), leased_until = clock_timestamp() + interval '120 seconds'
  where id = v_job.id returning * into v_job;
  return jsonb_build_object(
    'jobId', v_job.id,
    'runId', v_job.run_id,
    'environment', v_job.environment,
    'snapshotVersion', v_job.snapshot_version,
    'jobType', v_job.job_type,
    'questionNumber', v_job.question_number,
    'participantId', v_job.participant_id,
    'attemptCount', v_job.attempt_count,
    'leaseToken', v_job.lease_token,
    'leasedUntil', v_job.leased_until
  );
end;
$$;

create or replace function public.nbs_forum_complete_job(
  p_environment text,
  p_job_id uuid,
  p_lease_token uuid,
  p_result jsonb,
  p_model_metadata jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_run public.nbs_forum_runs%rowtype;
  v_job public.nbs_forum_jobs%rowtype;
  v_report_id uuid;
  v_published_at timestamptz;
  v_report jsonb;
begin
  select r.* into v_run
  from public.nbs_forum_runs r
  join public.nbs_forum_jobs j on j.environment = r.environment and j.run_id = r.id
  where j.id = p_job_id and r.environment = p_environment
  for update of r;
  if not found then return jsonb_build_object('kind', 'unknown'); end if;
  select * into v_job from public.nbs_forum_jobs where id = p_job_id and environment = p_environment for update;
  if v_run.state <> 'analyzing' or v_job.status <> 'leased' or v_job.lease_token is distinct from p_lease_token
     or v_job.leased_until <= clock_timestamp() or v_job.snapshot_version <> v_run.snapshot_version
     or p_result is null or jsonb_typeof(p_result) <> 'object' then
    return jsonb_build_object('kind', 'unknown');
  end if;

  if v_job.job_type = 'participant_analysis' then
    if jsonb_typeof(p_result -> 'answers') is distinct from 'array' then
      raise exception 'nbs_invalid_result' using errcode = '22023';
    end if;
    if jsonb_array_length(p_result -> 'answers') not between 1 and 3 then
      raise exception 'nbs_invalid_result' using errcode = '22023';
    end if;
  elsif v_job.job_type = 'question_cluster' then
    if not (p_result ? 'clusters' and p_result ? 'excluded'
        and jsonb_typeof(p_result -> 'clusters') = 'array'
        and jsonb_typeof(p_result -> 'excluded') = 'array') then
      raise exception 'nbs_invalid_result' using errcode = '22023';
    end if;
  elsif v_job.job_type = 'question_report' then
    if not (p_result ? 'questionNumber' and p_result ? 'total' and p_result ? 'valid' and p_result ? 'ignored'
      and p_result ? 'clusters' and p_result ? 'conclusion') then
      raise exception 'nbs_invalid_result' using errcode = '22023';
    end if;
  elsif v_job.job_type = 'forum_summary' then
    if jsonb_typeof(p_result -> 'questions') is distinct from 'array'
       or jsonb_typeof(p_result -> 'comparison') is distinct from 'string' then
      raise exception 'nbs_invalid_result' using errcode = '22023';
    end if;
    if jsonb_array_length(p_result -> 'questions') <> 3 then
      raise exception 'nbs_invalid_result' using errcode = '22023';
    end if;
    if (select count(*) from public.nbs_forum_jobs j where j.environment = p_environment and j.run_id = v_run.id
       and j.snapshot_version = v_run.snapshot_version and j.job_type = 'question_report' and j.status = 'completed') <> 3 then
      raise exception 'nbs_dependency_incomplete' using errcode = '22023';
    end if;
  end if;

  update public.nbs_forum_jobs set status = 'completed', result = p_result,
    model_metadata = p_model_metadata, completed_at = clock_timestamp(), lease_token = null, leased_until = null
  where id = v_job.id;

  if v_job.job_type = 'participant_analysis' then
    if not exists (select 1 from public.nbs_forum_jobs j where j.environment = p_environment and j.run_id = v_run.id
        and j.snapshot_version = v_run.snapshot_version and j.job_type = 'participant_analysis' and j.status <> 'completed') then
      insert into public.nbs_forum_jobs(environment, run_id, snapshot_version, job_type, question_number)
      select p_environment, v_run.id, v_run.snapshot_version, 'question_cluster', question_number::smallint
      from generate_series(1, 3) as series(question_number)
      on conflict do nothing;
    end if;
  elsif v_job.job_type = 'question_cluster' then
    if (select count(*) from public.nbs_forum_jobs j where j.environment = p_environment and j.run_id = v_run.id
       and j.snapshot_version = v_run.snapshot_version and j.job_type = 'question_cluster' and j.status = 'completed') = 3 then
      insert into public.nbs_forum_jobs(environment, run_id, snapshot_version, job_type, question_number)
      select p_environment, v_run.id, v_run.snapshot_version, 'question_report', question_number::smallint
      from generate_series(1, 3) as series(question_number)
      on conflict do nothing;
    end if;
  elsif v_job.job_type = 'question_report' then
    if (select count(*) from public.nbs_forum_jobs j where j.environment = p_environment and j.run_id = v_run.id
       and j.snapshot_version = v_run.snapshot_version and j.job_type = 'question_report' and j.status = 'completed') = 3 then
      insert into public.nbs_forum_jobs(environment, run_id, snapshot_version, job_type, question_number)
      values (p_environment, v_run.id, v_run.snapshot_version, 'forum_summary', null)
      on conflict do nothing;
    end if;
  else
    v_report_id := gen_random_uuid();
    v_published_at := clock_timestamp();
    v_report := jsonb_set(
      jsonb_set(
        jsonb_set(p_result, '{reportId}', to_jsonb(v_report_id::text), true),
        '{reportVersion}', to_jsonb(v_run.snapshot_version), true
      ),
      '{publishedAt}', to_jsonb(v_published_at), true
    );
    insert into public.nbs_forum_reports(id, environment, run_id, snapshot_version, prompt_version, report)
    values (v_report_id, p_environment, v_run.id, v_run.snapshot_version, 'nbs-report-v1', v_report);
    update public.nbs_forum_runs set state = 'published', state_version = state_version + 1,
      published_report_id = v_report_id
    where id = v_run.id and environment = p_environment and state = 'analyzing';
  end if;
  return jsonb_build_object('kind', 'completed', 'jobId', v_job.id);
end;
$$;

revoke all on function public.nbs_forum_finish(text,uuid,integer,text,text) from public, anon, authenticated;
revoke all on function public.nbs_forum_claim_job(text,text) from public, anon, authenticated;
revoke all on function public.nbs_forum_complete_job(text,uuid,uuid,jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.nbs_forum_finish(text,uuid,integer,text,text) to service_role;
grant execute on function public.nbs_forum_claim_job(text,text) to service_role;
grant execute on function public.nbs_forum_complete_job(text,uuid,uuid,jsonb,jsonb) to service_role;
