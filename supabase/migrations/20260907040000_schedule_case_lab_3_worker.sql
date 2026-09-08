create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create or replace function public.case_lab_3_install_worker_schedules()
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_worker_url text;
  v_cron_secret text;
  v_worker_job_id bigint;
begin
  select nullif(btrim(decrypted_secret), '')
    into v_worker_url
  from vault.decrypted_secrets
  where name = 'case_lab_3_worker_url';

  select nullif(btrim(decrypted_secret), '')
    into v_cron_secret
  from vault.decrypted_secrets
  where name = 'case_lab_3_cron_secret';

  if v_worker_url is null
     or length(v_worker_url) > 2048
     or v_worker_url !~ '^https://[^[:space:]]+/api/internal/case-lab-3/jobs/?$'
     or v_cron_secret is null
     or length(v_cron_secret) < 32
     or v_cron_secret ~ '[[:cntrl:]]' then
    raise exception 'case lab 3 worker Vault configuration is incomplete'
      using errcode = '22023';
  end if;

  select jobid
    into v_worker_job_id
  from cron.job
  where jobname = 'case-lab-3-worker-test';

  if v_worker_job_id is not null then
    perform cron.unschedule(v_worker_job_id);
  end if;

  v_worker_job_id := cron.schedule(
    'case-lab-3-worker-test',
    '* * * * *',
    $worker$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'case_lab_3_worker_url'
        ),
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', concat(
            'Bearer ',
            (
              select decrypted_secret
              from vault.decrypted_secrets
              where name = 'case_lab_3_cron_secret'
            )
          )
        ),
        body := '{"environment":"test"}'::jsonb
      ) as request_id;
    $worker$
  );

  return jsonb_build_object(
    'kind', 'installed',
    'environment', 'test',
    'workerJobId', v_worker_job_id,
    'vaultConfigured', true
  );
end;
$$;

revoke all on function public.case_lab_3_install_worker_schedules() from public, anon, authenticated;
grant execute on function public.case_lab_3_install_worker_schedules() to service_role;
