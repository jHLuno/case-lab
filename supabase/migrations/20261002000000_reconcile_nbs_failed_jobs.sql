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
  select * into v_run from public.nbs_forum_runs where environment = p_environment for update;
  if not found or v_run.state <> 'analyzing' then return jsonb_build_object('dispatched', 0); end if;

  select count(*) into v_pending from public.nbs_forum_jobs where environment = p_environment and run_id = v_run.id
    and snapshot_version = v_run.snapshot_version and status = 'pending' and available_at <= clock_timestamp();
  if v_pending = 0 then
    if exists (select 1 from public.nbs_forum_jobs where environment = p_environment and run_id = v_run.id
        and snapshot_version = v_run.snapshot_version and status = 'failed')
       and not exists (select 1 from public.nbs_forum_jobs where environment = p_environment and run_id = v_run.id
        and snapshot_version = v_run.snapshot_version and status in ('pending', 'leased')) then
      update public.nbs_forum_runs set state = 'analysis_failed', state_version = state_version + 1
      where id = v_run.id and environment = p_environment and state = 'analyzing';
    end if;
    return jsonb_build_object('dispatched', 0);
  end if;

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

update public.nbs_forum_runs r
set state = 'analysis_failed', state_version = state_version + 1
where r.state = 'analyzing'
  and exists (select 1 from public.nbs_forum_jobs j
    where j.environment = r.environment and j.run_id = r.id
      and j.snapshot_version = r.snapshot_version and j.status = 'failed')
  and not exists (select 1 from public.nbs_forum_jobs j
    where j.environment = r.environment and j.run_id = r.id
      and j.snapshot_version = r.snapshot_version and j.status in ('pending', 'leased'));
