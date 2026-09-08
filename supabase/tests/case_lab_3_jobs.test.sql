begin;

select plan(20);

select ok(
  (select prosecdef and proconfig @> array['search_path=pg_catalog, public, extensions']
   from pg_proc where oid = 'public.case_lab_3_claim_jobs(text,text)'::regprocedure),
  'job claiming is SECURITY DEFINER with a fixed search path'
);

select ok(
  has_function_privilege('service_role', 'public.case_lab_3_claim_jobs(text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.case_lab_3_claim_jobs(text,text)', 'EXECUTE'),
  'job execution is restricted to service_role'
);

select is(
  (select count(*)::bigint from pg_proc where proname in (
    'case_lab_3_claim_jobs', 'case_lab_3_complete_job', 'case_lab_3_retry_job',
    'case_lab_3_mark_job_unknown', 'case_lab_3_run_maintenance',
    'case_lab_3_record_worker_heartbeat'
  )),
  6::bigint,
  'all job and maintenance RPCs exist'
);

select is(
  public.case_lab_3_sanitize_error_text('"rawBody": "provider-secret"'),
  '[redacted]',
  'error redaction handles quoted secret keys and values'
);

insert into public.case_lab_3_jobs (
  environment, job_type, logical_key, payload_reference, available_at, status
)
select
  'test', 'send_analytics_event', format('job-test-%s', i),
  jsonb_build_object('ordinal', i), clock_timestamp() - interval '1 second', 'pending'
from generate_series(1, 6) as series(i);

create temp table pg_temp.cl3_claimed_jobs on commit drop as
select
  (claimed.value->>'jobId')::uuid as job_id,
  (claimed.value->>'leaseToken')::uuid as lease_token
from jsonb_array_elements(public.case_lab_3_claim_jobs('test', 'worker-1')) as claimed(value);

select is(
  (select count(*)::integer from pg_temp.cl3_claimed_jobs),
  5,
  'a worker claims at most five due jobs'
);

select is(
  (select count(*)::bigint from public.case_lab_3_jobs where status = 'leased'),
  5::bigint,
  'claiming leases exactly the selected jobs'
);

select is(
  (select count(*)::bigint from public.case_lab_3_jobs where status = 'leased' and attempt_count = 1),
  5::bigint,
  'claiming increments attempts once per lease'
);

select ok(
  (select min(leased_until) > clock_timestamp() + interval '1 minute'
   from public.case_lab_3_jobs where status = 'leased'),
  'claimed jobs receive a two-minute lease'
);

select throws_ok(
  $$ select public.case_lab_3_complete_job(
    'test', (select job_id from pg_temp.cl3_claimed_jobs limit 1), gen_random_uuid(), '{}'::jsonb
  ) $$,
  '55000',
  'job lease token does not match',
  'completion rejects a stale or wrong lease token'
);

select public.case_lab_3_complete_job(
  'test', (select job_id from pg_temp.cl3_claimed_jobs limit 1),
  (select lease_token from pg_temp.cl3_claimed_jobs limit 1),
  jsonb_build_object('status', 'Processed', 'rawBody', 'provider-secret', 'email', 'buyer@example.test')
);

select is(
  (select status from public.case_lab_3_jobs where id = (select job_id from pg_temp.cl3_claimed_jobs limit 1)),
  'completed',
  'completion accepts the matching lease token'
);

select is(
  (select result from public.case_lab_3_jobs where id = (select job_id from pg_temp.cl3_claimed_jobs limit 1)),
  jsonb_build_object('status', 'Processed'),
  'completion stores only the allowlisted provider result fields'
);

create temp table pg_temp.cl3_retry_job on commit drop as
select id as job_id, lease_token
from public.case_lab_3_jobs
where status = 'leased'
  and id <> (select job_id from pg_temp.cl3_claimed_jobs limit 1)
order by created_at
limit 1;

select throws_ok(
  $$ select public.case_lab_3_retry_job(
    'test', (select job_id from pg_temp.cl3_retry_job), gen_random_uuid(), 'bad lease', 10
  ) $$,
  '55000',
  'job lease token does not match',
  'retry rejects a stale or wrong lease token'
);

select public.case_lab_3_retry_job(
  'test', (select job_id from pg_temp.cl3_retry_job),
  (select lease_token from pg_temp.cl3_retry_job), 'temporary failure rawBody=provider-secret', 10
);

select is(
  (select count(*)::bigint from public.case_lab_3_jobs where status = 'pending' and last_error = 'temporary failure [redacted]'),
  1::bigint,
  'retry returns a job to pending with a sanitized error'
);

create temp table pg_temp.cl3_unknown_job on commit drop as
select id as job_id, lease_token
from public.case_lab_3_jobs
where status = 'leased'
order by created_at
limit 1;

select public.case_lab_3_mark_job_unknown(
  'test', (select job_id from pg_temp.cl3_unknown_job),
  (select lease_token from pg_temp.cl3_unknown_job), 'provider result unknown token=opaque-token'
);

select is(
  (select count(*)::bigint from public.case_lab_3_jobs
   where status = 'unknown' and last_error = 'provider result unknown [redacted]'),
  1::bigint,
  'unknown marks a job terminal with a sanitized error for reconciliation'
);

insert into public.case_lab_3_legal_document_versions (
  id, environment, document_kind, version_id, url, publication_label,
  content_snapshot, content_hash, is_active, activated_at
)
values
  (
    '00000000-0000-4000-8000-000000000701'::uuid, 'test', 'offer',
    'offer-jobs-1', 'https://caselab.kz/offer/', 'Jobs offer 1',
    'Case Lab III jobs offer snapshot',
    encode(digest('Case Lab III jobs offer snapshot', 'sha256'), 'hex'), true, clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000702'::uuid, 'test', 'privacy',
    'privacy-jobs-1', 'https://caselab.kz/privacy/', 'Jobs privacy 1',
    'Case Lab III jobs privacy snapshot',
    encode(digest('Case Lab III jobs privacy snapshot', 'sha256'), 'hex'), true, clock_timestamp()
  );

insert into public.case_lab_3_jobs (
  environment, job_type, logical_key, available_at, status, leased_until, lease_token
)
values (
  'test', 'daily_provider_reconciliation', 'expired-job',
  clock_timestamp() - interval '1 minute', 'leased', clock_timestamp() - interval '1 second', gen_random_uuid()
);

insert into public.case_lab_3_orders (
  id, order_number, idempotency_key, environment, first_name, last_name,
  participant_email, purchaser_email, fiscal_email, original_contact_snapshot,
  tier, amount_minor, receipt_label, configuration_version,
  offer_version_id, privacy_version_id, accepted_at
)
values
  (
    '00000000-0000-4000-8000-000000000711'::uuid,
    'CL3-JOB-RESERVATION-1', 'job-reservation-1', 'test', 'Job', 'Active Reservation',
    'job-active@example.test', 'job-active@example.test', 'job-active@example.test', '{"fixture":true}'::jsonb,
    'standard', 1500000, 'Case Lab III Standard', 1,
    '00000000-0000-4000-8000-000000000701'::uuid,
    '00000000-0000-4000-8000-000000000702'::uuid,
    clock_timestamp()
  ),
  (
    '00000000-0000-4000-8000-000000000712'::uuid,
    'CL3-JOB-RESERVATION-2', 'job-reservation-2', 'test', 'Job', 'Processing Reservation',
    'job-processing@example.test', 'job-processing@example.test', 'job-processing@example.test', '{"fixture":true}'::jsonb,
    'standard', 1500000, 'Case Lab III Standard', 1,
    '00000000-0000-4000-8000-000000000701'::uuid,
    '00000000-0000-4000-8000-000000000702'::uuid,
    clock_timestamp()
  );

insert into public.case_lab_3_reservations (
  order_id, environment, tier, expires_at, status
)
select id, 'test', 'standard', clock_timestamp() - interval '1 minute', status
from (
  values
    ('00000000-0000-4000-8000-000000000711'::uuid, 'active'::text),
    ('00000000-0000-4000-8000-000000000712'::uuid, 'processing'::text)
) as reservation_fixture(order_id, status)
join public.case_lab_3_orders order_row on order_row.id = reservation_fixture.order_id;

select throws_ok(
  $$ select public.case_lab_3_run_maintenance('not-an-environment') $$,
  '22023',
  'invalid environment',
  'maintenance validates the environment'
);

select public.case_lab_3_record_worker_heartbeat('test');

select ok(
  (select latest_worker_heartbeat_at is not null from public.case_lab_3_event_settings where environment = 'test'),
  'worker heartbeat is persisted on the environment settings row'
);

select is(
  (select (public.case_lab_3_run_maintenance('test')->>'requeuedJobs')::integer),
  1,
  'maintenance requeues expired job leases'
);

select is(
  (select count(*)::bigint from public.case_lab_3_jobs where logical_key = 'expired-job' and status = 'pending'),
  1::bigint,
  'expired job lease becomes claimable again'
);

select is(
  (select count(*)::bigint from public.case_lab_3_reservations where status = 'expired'),
  1::bigint,
  'maintenance expires only active reservations'
);

select is(
  (select count(*)::bigint from public.case_lab_3_reservations where status = 'processing'),
  1::bigint,
  'maintenance retains processing reservations for reconciliation'
);

select * from finish();
rollback;
