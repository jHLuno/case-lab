create table if not exists public.nbs_forum_runs (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  forum_name text not null default 'NBS Leadership Forum 2026',
  question_set_version text not null,
  questions jsonb not null,
  state text not null default 'ready' check (state in ('ready', 'open', 'analyzing', 'analysis_failed', 'published')),
  state_version integer not null default 1 check (state_version > 0),
  started_at timestamptz,
  closed_at timestamptz,
  snapshot_version integer,
  snapshot_hash text,
  snapshot_response_count integer check (snapshot_response_count is null or snapshot_response_count >= 0),
  published_report_id uuid,
  created_at timestamptz not null default clock_timestamp(),
  unique (environment, id),
  unique (environment)
);

create table if not exists public.nbs_forum_participants (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  run_id uuid not null,
  first_name text not null check (char_length(first_name) between 1 and 100),
  last_name text not null check (char_length(last_name) between 1 and 100),
  session_token_version integer not null default 1 check (session_token_version > 0),
  registered_at timestamptz not null default clock_timestamp(),
  submitted_at timestamptz,
  unique (environment, run_id, id),
  foreign key (environment, run_id) references public.nbs_forum_runs(environment, id) on delete restrict
);

create table if not exists public.nbs_forum_responses (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  run_id uuid not null,
  participant_id uuid not null,
  question_number smallint not null check (question_number between 1 and 3),
  answer_text text not null check (char_length(answer_text) <= 200),
  created_at timestamptz not null default clock_timestamp(),
  unique (environment, run_id, participant_id, question_number),
  foreign key (environment, run_id) references public.nbs_forum_runs(environment, id) on delete restrict,
  foreign key (environment, run_id, participant_id) references public.nbs_forum_participants(environment, run_id, id) on delete restrict
);

create table if not exists public.nbs_forum_commands (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  run_id uuid not null,
  operation text not null check (operation in ('register', 'submit', 'start', 'finish', 'retry')),
  idempotency_key text not null check (char_length(idempotency_key) between 1 and 200),
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  result jsonb not null,
  created_at timestamptz not null default clock_timestamp(),
  unique (environment, run_id, operation, idempotency_key),
  foreign key (environment, run_id) references public.nbs_forum_runs(environment, id) on delete restrict
);

create table if not exists public.nbs_forum_jobs (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  run_id uuid not null,
  snapshot_version integer not null check (snapshot_version > 0),
  job_type text not null check (job_type in ('question_cluster', 'question_report', 'forum_summary')),
  question_number smallint check (question_number between 1 and 3),
  status text not null default 'pending' check (status in ('pending', 'leased', 'completed', 'failed')),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  available_at timestamptz not null default clock_timestamp(),
  lease_token uuid,
  leased_until timestamptz,
  result jsonb,
  model_metadata jsonb,
  error_category text,
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  check ((job_type = 'forum_summary' and question_number is null) or (job_type <> 'forum_summary' and question_number is not null)),
  unique nulls not distinct (environment, run_id, snapshot_version, job_type, question_number),
  foreign key (environment, run_id) references public.nbs_forum_runs(environment, id) on delete restrict
);

create table if not exists public.nbs_forum_reports (
  id uuid primary key default gen_random_uuid(),
  environment text not null,
  run_id uuid not null,
  snapshot_version integer not null,
  prompt_version text not null,
  report jsonb not null,
  published_at timestamptz not null default clock_timestamp(),
  unique (environment, id),
  unique (environment, run_id, snapshot_version),
  foreign key (environment, run_id) references public.nbs_forum_runs(environment, id) on delete restrict
);

alter table public.nbs_forum_runs
  add constraint nbs_forum_runs_published_report_fk
  foreign key (environment, published_report_id)
  references public.nbs_forum_reports(environment, id)
  on delete restrict;

create index if not exists nbs_forum_responses_question_idx
  on public.nbs_forum_responses(environment, run_id, question_number, created_at);
create index if not exists nbs_forum_jobs_due_idx
  on public.nbs_forum_jobs(environment, available_at, created_at) where status = 'pending';
create index if not exists nbs_forum_jobs_expired_idx
  on public.nbs_forum_jobs(environment, leased_until) where status = 'leased';

alter table public.nbs_forum_runs enable row level security;
alter table public.nbs_forum_participants enable row level security;
alter table public.nbs_forum_responses enable row level security;
alter table public.nbs_forum_commands enable row level security;
alter table public.nbs_forum_jobs enable row level security;
alter table public.nbs_forum_reports enable row level security;

revoke all on public.nbs_forum_runs, public.nbs_forum_participants, public.nbs_forum_responses,
  public.nbs_forum_commands, public.nbs_forum_jobs, public.nbs_forum_reports from public, anon, authenticated;
grant all on public.nbs_forum_runs, public.nbs_forum_participants, public.nbs_forum_responses,
  public.nbs_forum_commands, public.nbs_forum_jobs, public.nbs_forum_reports to service_role;

insert into public.nbs_forum_runs (environment, question_set_version, questions)
values
  ('test', 'nbs-leadership-forum-2026-v1', '[
    {"number":1,"text":"Что сегодня больше всего мешает вам быть эффективным руководителем?","shortText":"Что мешает быть эффективным руководителем?"},
    {"number":2,"text":"Какое решение вы бы уже сегодня доверили AI?","shortText":"Что готовы доверить AI сегодня?"},
    {"number":3,"text":"Какое решение вы никогда не доверите AI?","shortText":"Что никогда не доверите AI?"}
  ]'::jsonb),
  ('live', 'nbs-leadership-forum-2026-v1', '[
    {"number":1,"text":"Что сегодня больше всего мешает вам быть эффективным руководителем?","shortText":"Что мешает быть эффективным руководителем?"},
    {"number":2,"text":"Какое решение вы бы уже сегодня доверили AI?","shortText":"Что готовы доверить AI сегодня?"},
    {"number":3,"text":"Какое решение вы никогда не доверите AI?","shortText":"Что никогда не доверите AI?"}
  ]'::jsonb)
on conflict (environment) do nothing;

create or replace function public.nbs_forum_register_participant(
  p_environment text,
  p_run_id uuid,
  p_first_name text,
  p_last_name text,
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
  v_participant_id uuid;
begin
  select * into v_run from public.nbs_forum_runs
  where environment = p_environment and id = p_run_id for update;
  if not found then raise exception 'nbs_not_found' using errcode = 'P0001'; end if;

  select * into v_command from public.nbs_forum_commands
  where environment = p_environment and run_id = p_run_id and operation = 'register'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_command.request_hash <> p_request_hash then raise exception 'nbs_conflict' using errcode = 'P0001'; end if;
    return v_command.result || jsonb_build_object('replayed', true);
  end if;
  if v_run.state not in ('ready', 'open') then raise exception 'nbs_closed' using errcode = 'P0001'; end if;
  if p_first_name is null or char_length(p_first_name) not between 1 and 100
     or p_last_name is null or char_length(p_last_name) not between 1 and 100
     or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
     or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'nbs_invalid_input' using errcode = '22023';
  end if;

  insert into public.nbs_forum_participants(environment, run_id, first_name, last_name)
  values (p_environment, p_run_id, p_first_name, p_last_name)
  returning id into v_participant_id;
  insert into public.nbs_forum_commands(environment, run_id, operation, idempotency_key, request_hash, result)
  values (p_environment, p_run_id, 'register', p_idempotency_key, p_request_hash,
    jsonb_build_object('participantId', v_participant_id, 'version', 1));
  return jsonb_build_object('participantId', v_participant_id, 'version', 1, 'replayed', false);
end;
$$;

create or replace function public.nbs_forum_submit_responses(
  p_environment text,
  p_run_id uuid,
  p_participant_id uuid,
  p_answers jsonb,
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
  v_number integer;
  v_answer text;
begin
  select * into v_run from public.nbs_forum_runs
  where environment = p_environment and id = p_run_id for update;
  if not found then raise exception 'nbs_not_found' using errcode = 'P0001'; end if;

  select * into v_command from public.nbs_forum_commands
  where environment = p_environment and run_id = p_run_id and operation = 'submit'
    and idempotency_key = p_idempotency_key;
  if found then
    if v_command.request_hash <> p_request_hash then raise exception 'nbs_conflict' using errcode = 'P0001'; end if;
    return v_command.result || jsonb_build_object('replayed', true);
  end if;
  if v_run.state <> 'open' then raise exception 'nbs_closed' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.nbs_forum_participants p
    where p.environment = p_environment and p.run_id = p_run_id and p.id = p_participant_id) then
    raise exception 'nbs_unauthorized' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_answers) <> 'object' or (select count(*) from jsonb_object_keys(p_answers)) <> 3
     or not (p_answers ? '1' and p_answers ? '2' and p_answers ? '3')
     or p_idempotency_key is null or char_length(p_idempotency_key) not between 1 and 200
     or p_request_hash is null or p_request_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'nbs_invalid_input' using errcode = '22023';
  end if;

  for v_number in 1..3 loop
    v_answer := p_answers ->> v_number::text;
    if v_answer is null or char_length(v_answer) > 200
       or replace(v_answer, chr(10), '') ~ '[[:cntrl:]]' then
      raise exception 'nbs_invalid_input' using errcode = '22023';
    end if;
  end loop;
  if not exists (select 1 from jsonb_each_text(p_answers) a where length(btrim(a.value)) > 0) then
    raise exception 'nbs_invalid_input' using errcode = '22023';
  end if;

  insert into public.nbs_forum_responses(environment, run_id, participant_id, question_number, answer_text)
  select p_environment, p_run_id, p_participant_id, key::smallint, value
  from jsonb_each_text(p_answers);
  update public.nbs_forum_participants set submitted_at = clock_timestamp()
  where environment = p_environment and run_id = p_run_id and id = p_participant_id;
  insert into public.nbs_forum_commands(environment, run_id, operation, idempotency_key, request_hash, result)
  values (p_environment, p_run_id, 'submit', p_idempotency_key, p_request_hash, jsonb_build_object('submitted', true));
  return jsonb_build_object('submitted', true, 'replayed', false);
end;
$$;

create or replace function public.nbs_forum_start(
  p_environment text, p_run_id uuid, p_expected_version integer,
  p_idempotency_key text, p_request_hash text
)
returns jsonb
language plpgsql security definer set search_path = pg_catalog, public, extensions
as $$
declare
  v_run public.nbs_forum_runs%rowtype;
  v_command public.nbs_forum_commands%rowtype;
  v_result jsonb;
  v_state_version integer;
begin
  select * into v_run from public.nbs_forum_runs where environment = p_environment and id = p_run_id for update;
  if not found then raise exception 'nbs_not_found' using errcode = 'P0001'; end if;
  select * into v_command from public.nbs_forum_commands where environment = p_environment and run_id = p_run_id
    and operation = 'start' and idempotency_key = p_idempotency_key;
  if found then
    if v_command.request_hash <> p_request_hash then raise exception 'nbs_conflict' using errcode = 'P0001'; end if;
    return v_command.result || jsonb_build_object('replayed', true);
  end if;
  if v_run.state <> 'ready' or v_run.state_version <> p_expected_version then raise exception 'nbs_conflict' using errcode = 'P0001'; end if;
  update public.nbs_forum_runs set state = 'open', state_version = state_version + 1, started_at = clock_timestamp()
  where id = p_run_id and environment = p_environment returning state_version into v_state_version;
  v_result := jsonb_build_object('state', 'open', 'stateVersion', v_state_version);
  insert into public.nbs_forum_commands(environment, run_id, operation, idempotency_key, request_hash, result)
  values (p_environment, p_run_id, 'start', p_idempotency_key, p_request_hash, v_result);
  return v_result || jsonb_build_object('replayed', false);
end;
$$;

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
  insert into public.nbs_forum_jobs(environment, run_id, snapshot_version, job_type, question_number)
  select p_environment, p_run_id, v_version, 'question_cluster', question_number::smallint
  from generate_series(1, 3) as series(question_number)
  on conflict do nothing;
  insert into public.nbs_forum_commands(environment, run_id, operation, idempotency_key, request_hash, result)
  values (p_environment, p_run_id, 'finish', p_idempotency_key, p_request_hash,
    jsonb_build_object('state', 'analyzing', 'stateVersion', v_version, 'snapshotVersion', v_version));
  return jsonb_build_object('state', 'analyzing', 'stateVersion', v_version, 'snapshotVersion', v_version, 'replayed', false);
end;
$$;

do $$
declare
  v_signature text;
begin
  foreach v_signature in array array[
    'public.nbs_forum_register_participant(text,uuid,text,text,text,text)',
    'public.nbs_forum_submit_responses(text,uuid,uuid,jsonb,text,text)',
    'public.nbs_forum_start(text,uuid,integer,text,text)',
    'public.nbs_forum_finish(text,uuid,integer,text,text)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', v_signature);
    execute format('grant execute on function %s to service_role', v_signature);
  end loop;
end;
$$;
