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
  order by available_at, job_type, question_number
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

  if v_job.job_type = 'question_cluster' then
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
       or jsonb_array_length(p_result -> 'questions') <> 3
       or jsonb_typeof(p_result -> 'comparison') is distinct from 'string' then
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

  if v_job.job_type = 'question_cluster' then
    insert into public.nbs_forum_jobs(environment, run_id, snapshot_version, job_type, question_number)
    values (p_environment, v_run.id, v_run.snapshot_version, 'question_report', v_job.question_number)
    on conflict do nothing;
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

create or replace function public.nbs_forum_fail_job(
  p_environment text,
  p_job_id uuid,
  p_lease_token uuid,
  p_error_category text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_run public.nbs_forum_runs%rowtype;
  v_job public.nbs_forum_jobs%rowtype;
  v_failed boolean;
begin
  select r.* into v_run from public.nbs_forum_runs r
  join public.nbs_forum_jobs j on j.environment = r.environment and j.run_id = r.id
  where j.id = p_job_id and r.environment = p_environment for update of r;
  if not found then return jsonb_build_object('kind', 'unknown'); end if;
  select * into v_job from public.nbs_forum_jobs where id = p_job_id and environment = p_environment for update;
  if v_run.state <> 'analyzing' or v_job.status <> 'leased' or v_job.lease_token is distinct from p_lease_token
     or v_job.leased_until <= clock_timestamp() then return jsonb_build_object('kind', 'unknown'); end if;

  v_failed := v_job.attempt_count >= 3;
  update public.nbs_forum_jobs set status = case when v_failed then 'failed' else 'pending' end,
    error_category = case when p_error_category ~ '^[a-z_]{1,64}$' then p_error_category else 'provider_error' end,
    available_at = clock_timestamp() + case v_job.attempt_count when 1 then interval '15 seconds' when 2 then interval '60 seconds' else interval '0 seconds' end,
    lease_token = null, leased_until = null
  where id = v_job.id;
  if v_failed and not exists (select 1 from public.nbs_forum_jobs j where j.environment = p_environment and j.run_id = v_run.id
      and j.snapshot_version = v_run.snapshot_version and j.status in ('pending', 'leased')) then
    update public.nbs_forum_runs set state = 'analysis_failed', state_version = state_version + 1
    where id = v_run.id and environment = p_environment;
  end if;
  return jsonb_build_object('kind', case when v_failed then 'failed' else 'retried' end);
end;
$$;

create or replace function public.nbs_forum_retry_failed_jobs(
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
  v_reset integer;
begin
  select * into v_run from public.nbs_forum_runs where id = p_run_id and environment = p_environment for update;
  if not found then raise exception 'nbs_not_found' using errcode = 'P0001'; end if;
  select * into v_command from public.nbs_forum_commands where environment = p_environment and run_id = p_run_id
    and operation = 'retry' and idempotency_key = p_idempotency_key;
  if found then
    if v_command.request_hash <> p_request_hash then raise exception 'nbs_conflict' using errcode = 'P0001'; end if;
    return v_command.result || jsonb_build_object('replayed', true);
  end if;
  if v_run.state <> 'analysis_failed' or v_run.state_version <> p_expected_version then
    raise exception 'nbs_conflict' using errcode = 'P0001';
  end if;
  update public.nbs_forum_jobs set status = 'pending', attempt_count = 0, error_category = null,
    available_at = clock_timestamp(), lease_token = null, leased_until = null
  where environment = p_environment and run_id = p_run_id and snapshot_version = v_run.snapshot_version and status = 'failed';
  get diagnostics v_reset = row_count;
  if v_reset = 0 then raise exception 'nbs_conflict' using errcode = 'P0001'; end if;
  update public.nbs_forum_runs set state = 'analyzing', state_version = state_version + 1
  where id = p_run_id and environment = p_environment returning state_version into v_reset;
  insert into public.nbs_forum_commands(environment, run_id, operation, idempotency_key, request_hash, result)
  values (p_environment, p_run_id, 'retry', p_idempotency_key, p_request_hash,
    jsonb_build_object('state', 'analyzing', 'stateVersion', v_reset));
  return jsonb_build_object('state', 'analyzing', 'stateVersion', v_reset, 'replayed', false);
end;
$$;

create or replace function public.nbs_forum_dispatch_jobs(p_environment text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_run public.nbs_forum_runs%rowtype;
  v_worker_url text;
  v_worker_secret text;
  v_pending integer;
  v_leased integer;
  v_slots integer;
  v_sent integer := 0;
  v_job_id bigint;
  i integer;
begin
  if p_environment not in ('test', 'live') then raise exception 'nbs_invalid_input' using errcode = '22023'; end if;
  select * into v_run from public.nbs_forum_runs where environment = p_environment;
  if not found or v_run.state <> 'analyzing' then return jsonb_build_object('dispatched', 0); end if;
  select count(*) into v_pending from public.nbs_forum_jobs where environment = p_environment and run_id = v_run.id
    and snapshot_version = v_run.snapshot_version and status = 'pending' and available_at <= clock_timestamp();
  if v_pending = 0 then return jsonb_build_object('dispatched', 0); end if;
  select count(*) into v_leased from public.nbs_forum_jobs where environment = p_environment and run_id = v_run.id
    and snapshot_version = v_run.snapshot_version and status = 'leased' and leased_until > clock_timestamp();
  v_slots := least(3 - v_leased, v_pending);
  if v_slots <= 0 then return jsonb_build_object('dispatched', 0); end if;

  select nullif(btrim(decrypted_secret), '') into v_worker_url from vault.decrypted_secrets
    where name = 'nbs_worker_url_' || p_environment;
  select nullif(btrim(decrypted_secret), '') into v_worker_secret from vault.decrypted_secrets
    where name = 'nbs_worker_secret_' || p_environment;
  if v_worker_url is null or length(v_worker_url) > 2048
     or v_worker_url !~ '^https://[^[:space:]]+/api/internal/nbs/jobs/?$'
     or v_worker_secret is null or length(v_worker_secret) < 32 or v_worker_secret ~ '[[:cntrl:]]' then
    raise exception 'nbs_worker_vault_configuration_incomplete' using errcode = '22023';
  end if;
  for i in 1..v_slots loop
    select net.http_post(
      url := v_worker_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_worker_secret),
      body := jsonb_build_object('environment', p_environment),
      timeout_milliseconds := 65000
    ) into v_job_id;
    v_sent := v_sent + 1;
  end loop;
  return jsonb_build_object('dispatched', v_sent);
end;
$$;

create or replace function public.nbs_forum_install_worker_schedule(p_environment text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_worker_url text;
  v_worker_secret text;
  v_name text;
  v_job_id bigint;
begin
  if p_environment not in ('test', 'live') then raise exception 'nbs_invalid_input' using errcode = '22023'; end if;
  v_name := 'nbs-forum-worker-' || p_environment;
  select nullif(btrim(decrypted_secret), '') into v_worker_url from vault.decrypted_secrets
    where name = 'nbs_worker_url_' || p_environment;
  select nullif(btrim(decrypted_secret), '') into v_worker_secret from vault.decrypted_secrets
    where name = 'nbs_worker_secret_' || p_environment;
  if v_worker_url is null or length(v_worker_url) > 2048
     or v_worker_url !~ '^https://[^[:space:]]+/api/internal/nbs/jobs/?$'
     or v_worker_secret is null or length(v_worker_secret) < 32 or v_worker_secret ~ '[[:cntrl:]]' then
    raise exception 'nbs_worker_vault_configuration_incomplete' using errcode = '22023';
  end if;
  select jobid into v_job_id from cron.job where jobname = v_name;
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
  v_job_id := cron.schedule(v_name, '* * * * *',
    'select public.nbs_forum_dispatch_jobs(''' || p_environment || ''');');
  return jsonb_build_object('kind', 'installed', 'environment', p_environment, 'workerJobId', v_job_id);
end;
$$;

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.nbs_forum_claim_job(text,text)',
    'public.nbs_forum_complete_job(text,uuid,uuid,jsonb,jsonb)',
    'public.nbs_forum_fail_job(text,uuid,uuid,text)',
    'public.nbs_forum_retry_failed_jobs(text,uuid,integer,text,text)',
    'public.nbs_forum_dispatch_jobs(text)',
    'public.nbs_forum_install_worker_schedule(text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to service_role', v_signature);
  end loop;
end;
$$;
