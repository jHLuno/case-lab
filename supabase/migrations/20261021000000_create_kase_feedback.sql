create table public.kase_events (
  environment text primary key check (environment in ('test', 'live')),
  state text not null default 'ready' check (state in ('ready', 'open', 'closed')),
  notes text not null default '' check (char_length(notes) <= 60000),
  presentation_id uuid,
  latest_analysis_id uuid,
  published_analysis_id uuid,
  updated_at timestamptz not null default now()
);
create table public.kase_feedback (
  id uuid primary key default gen_random_uuid(),
  environment text not null references public.kase_events(environment),
  submission_key uuid not null,
  text text not null check (char_length(btrim(text)) between 1 and 5000),
  created_at timestamptz not null default now(),
  unique(environment, submission_key)
);
create index kase_feedback_event_created on public.kase_feedback(environment, created_at, id);
create table public.kase_presentations (
  id uuid primary key,
  environment text not null references public.kase_events(environment),
  filename text not null check (char_length(filename) between 1 and 200),
  kind text not null check (kind in ('pdf', 'pptx')),
  storage_path text not null unique,
  content_hash text not null,
  extracted_text text check (char_length(extracted_text) <= 300000),
  created_at timestamptz not null default now(),
  unique(environment, id)
);
create table public.kase_analyses (
  id uuid primary key default gen_random_uuid(),
  environment text not null references public.kase_events(environment),
  input_hash text not null,
  snapshot jsonb not null,
  checkpoint jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  lease_token uuid,
  leased_until timestamptz,
  report jsonb,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(environment, input_hash),
  unique(environment, id),
  check ((status = 'processing') = (lease_token is not null and leased_until is not null)),
  check ((status = 'completed') = (report is not null and completed_at is not null))
);
alter table public.kase_events
  add foreign key(environment, presentation_id) references public.kase_presentations(environment, id),
  add foreign key(environment, latest_analysis_id) references public.kase_analyses(environment, id),
  add foreign key(environment, published_analysis_id) references public.kase_analyses(environment, id);
create table public.kase_commands (
  environment text not null references public.kase_events(environment),
  idempotency_key uuid not null,
  request_hash text not null,
  result jsonb not null,
  created_at timestamptz not null default now(),
  primary key(environment, idempotency_key)
);
create table public.kase_rate_limits (
  environment text not null references public.kase_events(environment),
  subject_hash text not null,
  bucket timestamptz not null,
  count integer not null,
  primary key(environment, subject_hash, bucket)
);
insert into public.kase_events(environment) values ('test'), ('live');

alter table public.kase_events enable row level security;
alter table public.kase_feedback enable row level security;
alter table public.kase_presentations enable row level security;
alter table public.kase_analyses enable row level security;
alter table public.kase_commands enable row level security;
alter table public.kase_rate_limits enable row level security;
revoke all on public.kase_events, public.kase_feedback, public.kase_presentations,
  public.kase_analyses, public.kase_commands, public.kase_rate_limits from public, anon, authenticated;
grant all on public.kase_events, public.kase_feedback, public.kase_presentations,
  public.kase_analyses, public.kase_commands, public.kase_rate_limits to service_role;

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('kase-presentations', 'kase-presentations', false, 3145728,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation']);
-- Keep this bucket private even if an existing permissive policy covers other buckets.
create policy kase_presentations_private on storage.objects as restrictive for all to anon, authenticated
  using (bucket_id <> 'kase-presentations') with check (bucket_id <> 'kase-presentations');

create function public.kase_submit_feedback(p_environment text, p_key uuid, p_text text, p_subject text)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_event public.kase_events%rowtype; v_old public.kase_feedback%rowtype; v_count integer;
begin
  select * into strict v_event from public.kase_events where environment = p_environment for update;
  select * into v_old from public.kase_feedback where environment = p_environment and submission_key = p_key;
  if found then
    if v_old.text <> p_text then raise exception 'kase_conflict'; end if;
    return jsonb_build_object('submitted', true, 'replayed', true);
  end if;
  if v_event.state <> 'open' then raise exception 'kase_closed'; end if;
  if p_text is null or char_length(btrim(p_text)) not between 1 and 5000
    or p_subject is null or p_subject !~ '^[a-f0-9]{64}$' then raise exception 'kase_invalid_input'; end if;
  -- The workshop can share one network; allow its expected audience to submit together.
  insert into public.kase_rate_limits(environment, subject_hash, bucket, count)
  values (p_environment, p_subject, date_trunc('minute', now()), 1)
  on conflict(environment, subject_hash, bucket) do update set count = kase_rate_limits.count + 1
  returning count into v_count;
  if v_count > 180 then raise exception 'kase_rate_limited'; end if;
  insert into public.kase_feedback(environment, submission_key, text) values (p_environment, p_key, p_text);
  delete from public.kase_rate_limits where bucket < now() - interval '2 days';
  return jsonb_build_object('submitted', true, 'replayed', false);
end $$;

create function public.kase_command(p_environment text, p_key uuid, p_operation text, p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_event public.kase_events%rowtype; v_command public.kase_commands%rowtype;
  v_job public.kase_analyses%rowtype; v_presentation public.kase_presentations%rowtype;
  v_snapshot jsonb; v_feedback jsonb; v_hash text; v_input_hash text; v_result jsonb := '{}'; v_id uuid;
begin
  select * into strict v_event from public.kase_events where environment = p_environment for update;
  v_hash := encode(digest(p_operation || ':' || p_payload::text, 'sha256'), 'hex');
  select * into v_command from public.kase_commands where environment = p_environment and idempotency_key = p_key;
  if found then
    if v_command.request_hash <> v_hash then raise exception 'kase_conflict'; end if;
    return v_command.result;
  end if;
  select * into v_job from public.kase_analyses where environment = p_environment and id = v_event.latest_analysis_id;
  if p_operation = 'open' then
    if v_job.status in ('pending', 'processing') then raise exception 'kase_busy'; end if;
    update public.kase_events set state = 'open' where environment = p_environment;
  elsif p_operation = 'close' then
    update public.kase_events set state = 'closed' where environment = p_environment;
  elsif p_operation = 'notes' then
    if jsonb_typeof(p_payload->'notes') is distinct from 'string'
      or char_length(p_payload->>'notes') > 60000 then raise exception 'kase_invalid_input'; end if;
    update public.kase_events set notes = p_payload->>'notes' where environment = p_environment;
  elsif p_operation = 'presentation' then
    v_id := (p_payload->>'id')::uuid;
    if (p_payload->>'storagePath') <> p_environment || '/' || v_id::text || '.' || (p_payload->>'kind')
      or (p_payload->>'contentHash') !~ '^[a-f0-9]{64}$' then raise exception 'kase_invalid_input'; end if;
    insert into public.kase_presentations(id, environment, filename, kind, storage_path, content_hash, extracted_text)
    values (v_id, p_environment, p_payload->>'filename', p_payload->>'kind', p_payload->>'storagePath',
      p_payload->>'contentHash', p_payload->>'text');
    update public.kase_events set presentation_id = v_id where environment = p_environment;
  elsif p_operation = 'analyze' then
    if v_event.state <> 'closed' then raise exception 'kase_collection_open'; end if;
    if v_job.status in ('pending', 'processing') then
      v_result := jsonb_build_object('analysisId', v_job.id);
    else
      select * into v_presentation from public.kase_presentations where environment = p_environment and id = v_event.presentation_id;
      if not found then raise exception 'kase_presentation_required'; end if;
      select jsonb_agg(jsonb_build_object('id', id, 'text', text, 'createdAt', created_at) order by created_at, id)
      into v_feedback from public.kase_feedback where environment = p_environment;
      if v_feedback is null then raise exception 'kase_no_feedback'; end if;
      v_snapshot := jsonb_build_object('feedback', v_feedback, 'notes', v_event.notes, 'presentation',
        jsonb_build_object('id', v_presentation.id, 'filename', v_presentation.filename, 'kind', v_presentation.kind,
          'storagePath', v_presentation.storage_path, 'text', v_presentation.extracted_text));
      v_input_hash := encode(digest(v_snapshot::text, 'sha256'), 'hex');
      insert into public.kase_analyses(environment, input_hash, snapshot)
      values (p_environment, v_input_hash, v_snapshot)
      on conflict(environment, input_hash) do nothing;
      select id into v_id from public.kase_analyses where environment = p_environment and input_hash = v_input_hash;
      update public.kase_events set latest_analysis_id = v_id where environment = p_environment;
      v_result := jsonb_build_object('analysisId', v_id);
    end if;
  elsif p_operation = 'retry' then
    if v_event.state <> 'closed' then raise exception 'kase_collection_open'; end if;
    if v_job.status is distinct from 'failed' then raise exception 'kase_conflict'; end if;
    update public.kase_analyses set status = 'pending', error_code = null where environment = p_environment and id = v_job.id;
    v_result := jsonb_build_object('analysisId', v_job.id);
  elsif p_operation = 'publish' then
    v_id := (p_payload->>'analysisId')::uuid;
    if not exists (select 1 from public.kase_analyses where environment = p_environment and id = v_id and status = 'completed')
      then raise exception 'kase_report_not_ready'; end if;
    update public.kase_events set published_analysis_id = v_id where environment = p_environment;
  else raise exception 'kase_invalid_input';
  end if;
  update public.kase_events set updated_at = now() where environment = p_environment;
  insert into public.kase_commands(environment, idempotency_key, request_hash, result) values(p_environment, p_key, v_hash, v_result);
  return v_result;
end $$;

create function public.kase_claim_step(p_environment text, p_analysis_id uuid)
returns jsonb language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare v_job public.kase_analyses%rowtype; v_token uuid := gen_random_uuid();
begin
  select * into v_job from public.kase_analyses where environment = p_environment and id = p_analysis_id for update;
  if not found or v_job.status in ('completed', 'failed') then return null; end if;
  if v_job.status = 'processing' and v_job.leased_until > clock_timestamp() then return null; end if;
  update public.kase_analyses set status = 'processing', lease_token = v_token,
    leased_until = clock_timestamp() + interval '180 seconds', error_code = null
  where environment = p_environment and id = p_analysis_id;
  return jsonb_build_object('leaseToken', v_token, 'snapshot', v_job.snapshot, 'checkpoint', v_job.checkpoint);
end $$;

create function public.kase_finish_step(p_environment text, p_analysis_id uuid, p_lease_token uuid,
  p_checkpoint jsonb, p_report jsonb default null, p_error text default null)
returns boolean language plpgsql security definer set search_path = public, extensions, pg_temp as $$
begin
  if jsonb_typeof(p_checkpoint) is distinct from 'object' or octet_length(p_checkpoint::text) > 1048576
    or (p_report is not null and (jsonb_typeof(p_report) <> 'object' or octet_length(p_report::text) > 196608))
    or (p_error is not null and p_error !~ '^[a-z_]{1,60}$') then raise exception 'kase_invalid_input'; end if;
  update public.kase_analyses set
    checkpoint = p_checkpoint,
    report = case when p_error is null then p_report else null end,
    status = case when p_error is not null then 'failed' when p_report is not null then 'completed' else 'pending' end,
    completed_at = case when p_error is null and p_report is not null then now() else null end,
    error_code = p_error, lease_token = null, leased_until = null
  where environment = p_environment and id = p_analysis_id and status = 'processing'
    and lease_token = p_lease_token and leased_until > clock_timestamp();
  return found;
end $$;

revoke all on function public.kase_submit_feedback(text,uuid,text,text),
  public.kase_command(text,uuid,text,jsonb), public.kase_claim_step(text,uuid),
  public.kase_finish_step(text,uuid,uuid,jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.kase_submit_feedback(text,uuid,text,text),
  public.kase_command(text,uuid,text,jsonb), public.kase_claim_step(text,uuid),
  public.kase_finish_step(text,uuid,uuid,jsonb,jsonb,text) to service_role;
