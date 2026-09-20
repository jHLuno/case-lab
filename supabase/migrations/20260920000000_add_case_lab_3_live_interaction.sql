create table public.case_lab_3_live_cases (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  case_number integer not null check (case_number between 1 and 3),
  speaker_label text not null check (char_length(btrim(speaker_label)) between 1 and 120),
  title text not null check (char_length(btrim(title)) between 1 and 200),
  question text not null check (char_length(btrim(question)) between 1 and 1000),
  speaker_reference_answer text not null check (char_length(btrim(speaker_reference_answer)) between 1 and 4000),
  context text check (context is null or char_length(btrim(context)) between 1 and 4000),
  key_insight text check (key_insight is null or char_length(btrim(key_insight)) between 1 and 1000),
  generated_rubric jsonb not null default '{}'::jsonb check (jsonb_typeof(generated_rubric) = 'object'),
  approved_rubric jsonb not null default '{}'::jsonb check (jsonb_typeof(approved_rubric) = 'object'),
  state text not null default 'draft'
    check (state in ('draft', 'ready', 'open', 'analyzing', 'shortlist_ready', 'awarded', 'closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  state_version integer not null default 1 check (state_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_live_cases_id_environment_key unique (id, environment),
  constraint case_lab_3_live_cases_environment_number_key unique (environment, case_number),
  constraint case_lab_3_live_cases_window_check
    check (opens_at is null or closes_at is null or opens_at < closes_at)
);

create table public.case_lab_3_live_participants (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  ticket_id uuid not null,
  ticket_revision_id uuid not null,
  normalized_first_name text not null check (char_length(normalized_first_name) between 1 and 100),
  normalized_last_name text not null check (char_length(normalized_last_name) between 1 and 100),
  public_display_name text not null check (char_length(public_display_name) between 2 and 120),
  session_token_version integer not null default 1 check (session_token_version > 0),
  claim_status text not null default 'active' check (claim_status in ('active', 'reset')),
  claimed_at timestamptz not null default now(),
  reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_live_participants_id_environment_key unique (id, environment),
  constraint case_lab_3_live_participants_ticket_environment_key unique (ticket_id, environment),
  constraint case_lab_3_live_participants_ticket_fk
    foreign key (ticket_id, environment)
    references public.case_lab_3_tickets(id, environment),
  constraint case_lab_3_live_participants_revision_fk
    foreign key (ticket_id, ticket_revision_id, environment)
    references public.case_lab_3_ticket_revisions(ticket_id, id, environment)
);

create table public.case_lab_3_live_submissions (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  case_id uuid not null,
  participant_id uuid not null,
  answer_text text not null check (char_length(btrim(answer_text)) between 30 and 300),
  content_version integer not null default 1 check (content_version > 0),
  validity_state text not null default 'valid' check (validity_state in ('valid', 'invalid')),
  invalid_reason text check (invalid_reason is null or char_length(btrim(invalid_reason)) between 3 and 500),
  participation_points integer not null default 10 check (participation_points in (0, 10)),
  first_submitted_at timestamptz not null default now(),
  last_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_live_submissions_id_case_environment_key unique (id, case_id, environment),
  constraint case_lab_3_live_submissions_case_participant_key unique (case_id, participant_id),
  constraint case_lab_3_live_submissions_case_fk
    foreign key (case_id, environment)
    references public.case_lab_3_live_cases(id, environment),
  constraint case_lab_3_live_submissions_participant_fk
    foreign key (participant_id, environment)
    references public.case_lab_3_live_participants(id, environment),
  constraint case_lab_3_live_submissions_validity_points_check
    check (
      (validity_state = 'valid' and participation_points = 10 and invalid_reason is null)
      or (validity_state = 'invalid' and participation_points = 0 and invalid_reason is not null)
    )
);

create table public.case_lab_3_live_ai_runs (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  case_id uuid not null,
  run_number integer not null check (run_number > 0),
  requested_models jsonb not null check (jsonb_typeof(requested_models) = 'array'),
  served_model text,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response_payload jsonb,
  usage_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(usage_payload) = 'object'),
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  status text not null check (status in ('running', 'succeeded', 'failed')),
  error_category text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint case_lab_3_live_ai_runs_id_case_environment_key unique (id, case_id, environment),
  constraint case_lab_3_live_ai_runs_case_run_key unique (case_id, run_number),
  constraint case_lab_3_live_ai_runs_case_fk
    foreign key (case_id, environment)
    references public.case_lab_3_live_cases(id, environment)
);

create table public.case_lab_3_live_shortlist_entries (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  case_id uuid not null,
  ai_run_id uuid,
  submission_id uuid not null,
  ai_order integer check (ai_order is null or ai_order > 0),
  ai_score integer check (ai_score is null or ai_score between 0 and 100),
  ai_reason text check (ai_reason is null or char_length(btrim(ai_reason)) between 1 and 500),
  approach_label text check (approach_label is null or char_length(btrim(approach_label)) between 1 and 120),
  candidate_type text
    check (candidate_type is null or candidate_type in ('strong', 'alternative', 'wildcard', 'manual')),
  included boolean not null default true,
  operator_reason text check (operator_reason is null or char_length(btrim(operator_reason)) between 3 and 500),
  final_order integer check (final_order is null or final_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint case_lab_3_live_shortlist_entries_case_submission_key unique (case_id, submission_id),
  constraint case_lab_3_live_shortlist_entries_case_fk
    foreign key (case_id, environment)
    references public.case_lab_3_live_cases(id, environment),
  constraint case_lab_3_live_shortlist_entries_submission_fk
    foreign key (submission_id, case_id, environment)
    references public.case_lab_3_live_submissions(id, case_id, environment),
  constraint case_lab_3_live_shortlist_entries_ai_run_fk
    foreign key (ai_run_id, case_id, environment)
    references public.case_lab_3_live_ai_runs(id, case_id, environment)
);

create table public.case_lab_3_live_awards (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  case_id uuid not null,
  submission_id uuid not null,
  place integer not null check (place between 1 and 3),
  bonus_points integer not null,
  actor_id text not null,
  decision_reason text check (decision_reason is null or char_length(btrim(decision_reason)) between 3 and 500),
  corrected_from_id uuid,
  active boolean not null default true,
  awarded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint case_lab_3_live_awards_id_case_environment_key unique (id, case_id, environment),
  constraint case_lab_3_live_awards_case_fk
    foreign key (case_id, environment)
    references public.case_lab_3_live_cases(id, environment),
  constraint case_lab_3_live_awards_submission_fk
    foreign key (submission_id, case_id, environment)
    references public.case_lab_3_live_submissions(id, case_id, environment),
  constraint case_lab_3_live_awards_corrected_from_fk
    foreign key (corrected_from_id, case_id, environment)
    references public.case_lab_3_live_awards(id, case_id, environment),
  constraint case_lab_3_live_awards_place_points_check check (
    (place = 1 and bonus_points = 50)
    or (place = 2 and bonus_points = 35)
    or (place = 3 and bonus_points = 25)
  )
);

create table public.case_lab_3_live_tie_breaks (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  participant_id uuid not null,
  resolved_rank integer not null check (resolved_rank > 0),
  actor_id text not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  active boolean not null default true,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint case_lab_3_live_tie_breaks_participant_fk
    foreign key (participant_id, environment)
    references public.case_lab_3_live_participants(id, environment)
);

create unique index case_lab_3_live_one_open_or_analyzing_idx
  on public.case_lab_3_live_cases (environment)
  where state in ('open', 'analyzing');
create index case_lab_3_live_cases_state_idx
  on public.case_lab_3_live_cases (environment, state, case_number);
create index case_lab_3_live_participants_name_idx
  on public.case_lab_3_live_participants (environment, normalized_first_name, normalized_last_name);
create index case_lab_3_live_submissions_case_valid_idx
  on public.case_lab_3_live_submissions (case_id, validity_state, last_submitted_at);
create index case_lab_3_live_shortlist_order_idx
  on public.case_lab_3_live_shortlist_entries (case_id, included, final_order, ai_order);
create unique index case_lab_3_live_awards_active_place_uidx
  on public.case_lab_3_live_awards (case_id, place)
  where active;
create unique index case_lab_3_live_awards_active_submission_uidx
  on public.case_lab_3_live_awards (case_id, submission_id)
  where active;
create unique index case_lab_3_live_tie_breaks_active_participant_uidx
  on public.case_lab_3_live_tie_breaks (environment, participant_id)
  where active;
create unique index case_lab_3_live_tie_breaks_active_rank_uidx
  on public.case_lab_3_live_tie_breaks (environment, resolved_rank)
  where active;

create trigger case_lab_3_live_cases_updated_at
before update on public.case_lab_3_live_cases
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_live_participants_updated_at
before update on public.case_lab_3_live_participants
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_live_submissions_updated_at
before update on public.case_lab_3_live_submissions
for each row execute function public.case_lab_3_set_updated_at();

create trigger case_lab_3_live_shortlist_entries_updated_at
before update on public.case_lab_3_live_shortlist_entries
for each row execute function public.case_lab_3_set_updated_at();

create or replace function public.case_lab_3_live_normalize_name(p_value text)
returns text
language sql
immutable
set search_path = pg_catalog
as $$
  select lower(translate(regexp_replace(btrim(coalesce(p_value, '')), '\s+', ' ', 'g'), 'Ёё', 'Ее'));
$$;

create or replace function public.case_lab_3_live_claim_participant(
  p_environment text,
  p_first_name text,
  p_last_name text,
  p_ticket_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_first_name text;
  v_last_name text;
  v_candidate_count integer;
  v_ticket public.case_lab_3_tickets%rowtype;
  v_revision public.case_lab_3_ticket_revisions%rowtype;
  v_existing public.case_lab_3_live_participants%rowtype;
  v_participant public.case_lab_3_live_participants%rowtype;
begin
  if p_environment not in ('test', 'live') then
    raise exception 'invalid environment' using errcode = '22023';
  end if;

  v_first_name := public.case_lab_3_live_normalize_name(p_first_name);
  v_last_name := public.case_lab_3_live_normalize_name(p_last_name);

  if char_length(v_first_name) not between 1 and 100
     or char_length(v_last_name) not between 1 and 100
     or (p_ticket_number is not null and char_length(btrim(p_ticket_number)) not between 1 and 100) then
    return jsonb_build_object('kind', 'not_found');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_environment || E'\000' || v_first_name || E'\000' || v_last_name,
    0
  ));

  select count(*)
  into v_candidate_count
  from public.case_lab_3_tickets ticket
  join public.case_lab_3_ticket_revisions revision
    on revision.id = ticket.current_revision_id
   and revision.ticket_id = ticket.id
   and revision.environment = ticket.environment
  join public.case_lab_3_check_ins check_in
    on check_in.ticket_id = ticket.id
   and check_in.ticket_revision_id = revision.id
   and check_in.environment = ticket.environment
  where ticket.environment = p_environment
    and ticket.status <> 'cancelled'
    and public.case_lab_3_live_normalize_name(revision.first_name) = v_first_name
    and public.case_lab_3_live_normalize_name(revision.last_name) = v_last_name
    and (p_ticket_number is null or ticket.public_ticket_number = btrim(p_ticket_number));

  if v_candidate_count = 0 then
    return jsonb_build_object('kind', 'not_found');
  end if;

  if v_candidate_count > 1 then
    return jsonb_build_object('kind', 'ambiguous');
  end if;

  select ticket.*
  into v_ticket
  from public.case_lab_3_tickets ticket
  join public.case_lab_3_ticket_revisions revision
    on revision.id = ticket.current_revision_id
   and revision.ticket_id = ticket.id
   and revision.environment = ticket.environment
  join public.case_lab_3_check_ins check_in
    on check_in.ticket_id = ticket.id
   and check_in.ticket_revision_id = revision.id
   and check_in.environment = ticket.environment
  where ticket.environment = p_environment
    and ticket.status <> 'cancelled'
    and public.case_lab_3_live_normalize_name(revision.first_name) = v_first_name
    and public.case_lab_3_live_normalize_name(revision.last_name) = v_last_name
    and (p_ticket_number is null or ticket.public_ticket_number = btrim(p_ticket_number))
  limit 1
  for update of ticket;

  select revision.*
  into strict v_revision
  from public.case_lab_3_ticket_revisions revision
  where revision.id = v_ticket.current_revision_id
    and revision.ticket_id = v_ticket.id
    and revision.environment = v_ticket.environment;

  select *
  into v_existing
  from public.case_lab_3_live_participants participant
  where participant.environment = p_environment
    and participant.ticket_id = v_ticket.id
  for update;

  if found and v_existing.claim_status = 'active' then
    return jsonb_build_object('kind', 'already_claimed');
  end if;

  insert into public.case_lab_3_live_participants (
    environment,
    ticket_id,
    ticket_revision_id,
    normalized_first_name,
    normalized_last_name,
    public_display_name,
    session_token_version,
    claim_status,
    claimed_at,
    reset_at
  ) values (
    p_environment,
    v_ticket.id,
    v_revision.id,
    v_first_name,
    v_last_name,
    btrim(v_revision.first_name) || ' ' || substring(btrim(v_revision.last_name) from 1 for 1) || '.',
    coalesce(v_existing.session_token_version + 1, 1),
    'active',
    clock_timestamp(),
    null
  )
  on conflict (ticket_id, environment) do update
  set ticket_revision_id = excluded.ticket_revision_id,
      normalized_first_name = excluded.normalized_first_name,
      normalized_last_name = excluded.normalized_last_name,
      public_display_name = excluded.public_display_name,
      session_token_version = excluded.session_token_version,
      claim_status = 'active',
      claimed_at = excluded.claimed_at,
      reset_at = null
  returning * into v_participant;

  return jsonb_build_object(
    'kind', 'claimed',
    'participantId', v_participant.id,
    'tokenVersion', v_participant.session_token_version,
    'displayName', v_participant.public_display_name
  );
end;
$$;

create or replace function public.case_lab_3_live_save_submission(
  p_environment text,
  p_case_id uuid,
  p_participant_id uuid,
  p_answer_text text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_case public.case_lab_3_live_cases%rowtype;
  v_participant public.case_lab_3_live_participants%rowtype;
  v_submission public.case_lab_3_live_submissions%rowtype;
  v_answer text;
begin
  v_answer := btrim(p_answer_text);
  if p_environment not in ('test', 'live')
     or char_length(v_answer) not between 30 and 300 then
    raise exception 'invalid submission' using errcode = '22023';
  end if;

  select * into v_case
  from public.case_lab_3_live_cases
  where id = p_case_id and environment = p_environment
  for update;

  if not found or v_case.state <> 'open' or v_case.closes_at is null or clock_timestamp() >= v_case.closes_at then
    return jsonb_build_object('kind', 'closed');
  end if;

  select * into v_participant
  from public.case_lab_3_live_participants
  where id = p_participant_id
    and environment = p_environment
    and claim_status = 'active';

  if not found then
    return jsonb_build_object('kind', 'unauthorized');
  end if;

  insert into public.case_lab_3_live_submissions (
    environment, case_id, participant_id, answer_text
  ) values (
    p_environment, p_case_id, p_participant_id, v_answer
  )
  on conflict (case_id, participant_id) do update
  set answer_text = excluded.answer_text,
      content_version = public.case_lab_3_live_submissions.content_version + 1,
      validity_state = 'valid',
      invalid_reason = null,
      participation_points = 10,
      last_submitted_at = clock_timestamp()
  returning * into v_submission;

  return jsonb_build_object(
    'kind', 'saved',
    'submissionId', v_submission.id,
    'contentVersion', v_submission.content_version,
    'savedAt', v_submission.last_submitted_at,
    'participationPoints', v_submission.participation_points
  );
end;
$$;

create or replace function public.case_lab_3_live_transition_case(
  p_case_id uuid,
  p_expected_version integer,
  p_new_state text,
  p_closes_at timestamptz,
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
  v_allowed boolean;
begin
  select * into v_case
  from public.case_lab_3_live_cases
  where id = p_case_id
  for update;

  if not found or v_case.state_version <> p_expected_version then
    return jsonb_build_object('kind', 'conflict');
  end if;

  v_allowed := (v_case.state = 'draft' and p_new_state = 'ready')
    or (v_case.state = 'ready' and p_new_state = 'open')
    or (v_case.state = 'open' and p_new_state = 'analyzing')
    or (v_case.state = 'analyzing' and p_new_state = 'shortlist_ready')
    or (v_case.state = 'shortlist_ready' and p_new_state = 'awarded')
    or (v_case.state = 'awarded' and p_new_state = 'closed');

  if not v_allowed then
    return jsonb_build_object('kind', 'invalid_transition');
  end if;

  if p_new_state = 'ready' and (v_case.approved_rubric = '{}'::jsonb or jsonb_typeof(v_case.approved_rubric) <> 'object') then
    return jsonb_build_object('kind', 'incomplete');
  end if;

  if p_new_state = 'open' and (p_closes_at is null or p_closes_at <= clock_timestamp()) then
    return jsonb_build_object('kind', 'invalid_deadline');
  end if;

  update public.case_lab_3_live_cases
  set state = p_new_state,
      opens_at = case when p_new_state = 'open' then clock_timestamp() else opens_at end,
      closes_at = case when p_new_state = 'open' then p_closes_at else closes_at end,
      state_version = state_version + 1
  where id = v_case.id
  returning * into v_updated;

  insert into public.case_lab_3_audit_log (
    environment, action, target_table, target_id, before_summary, after_summary, actor_id
  ) values (
    v_case.environment,
    'live_case_transition',
    'case_lab_3_live_cases',
    v_case.id,
    jsonb_build_object('state', v_case.state, 'stateVersion', v_case.state_version),
    jsonb_build_object('state', v_updated.state, 'stateVersion', v_updated.state_version),
    p_actor_id
  );

  return jsonb_build_object(
    'kind', 'transitioned',
    'state', v_updated.state,
    'stateVersion', v_updated.state_version,
    'closesAt', v_updated.closes_at
  );
exception
  when unique_violation then
    return jsonb_build_object('kind', 'another_case_active');
end;
$$;

create or replace function public.case_lab_3_live_publish_awards(
  p_case_id uuid,
  p_expected_version integer,
  p_awards jsonb,
  p_actor_id text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_case public.case_lab_3_live_cases%rowtype;
  v_award jsonb;
  v_submission_id uuid;
  v_place integer;
  v_bonus integer;
begin
  select * into v_case
  from public.case_lab_3_live_cases
  where id = p_case_id
  for update;

  if not found or v_case.state <> 'shortlist_ready' or v_case.state_version <> p_expected_version then
    return jsonb_build_object('kind', 'conflict');
  end if;

  if jsonb_typeof(p_awards) <> 'array' or jsonb_array_length(p_awards) <> 3 then
    return jsonb_build_object('kind', 'invalid_awards');
  end if;

  if (
    select count(distinct (entry->>'place')::integer) = 3
       and min((entry->>'place')::integer) = 1
       and max((entry->>'place')::integer) = 3
       and count(distinct entry->>'submissionId') = 3
    from jsonb_array_elements(p_awards) entry
  ) is not true then
    return jsonb_build_object('kind', 'invalid_awards');
  end if;

  for v_award in select value from jsonb_array_elements(p_awards)
  loop
    begin
      v_submission_id := (v_award->>'submissionId')::uuid;
      v_place := (v_award->>'place')::integer;
    exception when others then
      return jsonb_build_object('kind', 'invalid_awards');
    end;

    if not exists (
      select 1
      from public.case_lab_3_live_submissions submission
      join public.case_lab_3_live_shortlist_entries shortlist
        on shortlist.submission_id = submission.id
       and shortlist.case_id = submission.case_id
       and shortlist.environment = submission.environment
       and shortlist.included
      where submission.id = v_submission_id
        and submission.case_id = v_case.id
        and submission.environment = v_case.environment
        and submission.validity_state = 'valid'
    ) then
      return jsonb_build_object('kind', 'invalid_awards');
    end if;

    v_bonus := case v_place when 1 then 50 when 2 then 35 when 3 then 25 end;
    insert into public.case_lab_3_live_awards (
      environment, case_id, submission_id, place, bonus_points, actor_id, decision_reason
    ) values (
      v_case.environment, v_case.id, v_submission_id, v_place, v_bonus, p_actor_id, nullif(btrim(p_reason), '')
    );
  end loop;

  update public.case_lab_3_live_cases
  set state = 'awarded', state_version = state_version + 1
  where id = v_case.id;

  insert into public.case_lab_3_audit_log (
    environment, action, target_table, target_id, before_summary, after_summary, actor_id
  ) values (
    v_case.environment,
    'live_awards_publish',
    'case_lab_3_live_cases',
    v_case.id,
    jsonb_build_object('state', v_case.state, 'stateVersion', v_case.state_version),
    jsonb_build_object('state', 'awarded', 'stateVersion', v_case.state_version + 1, 'awards', p_awards),
    p_actor_id
  );

  return jsonb_build_object('kind', 'published', 'state', 'awarded', 'stateVersion', v_case.state_version + 1);
end;
$$;

create or replace function public.case_lab_3_live_reset_participant(
  p_participant_id uuid,
  p_actor_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_participant public.case_lab_3_live_participants%rowtype;
begin
  if char_length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'invalid reason' using errcode = '22023';
  end if;

  update public.case_lab_3_live_participants
  set claim_status = 'reset',
      reset_at = clock_timestamp(),
      session_token_version = session_token_version + 1
  where id = p_participant_id
  returning * into v_participant;

  if not found then
    return jsonb_build_object('kind', 'not_found');
  end if;

  insert into public.case_lab_3_audit_log (
    environment, action, target_table, target_id, before_summary, after_summary, actor_id
  ) values (
    v_participant.environment,
    'live_participant_reset',
    'case_lab_3_live_participants',
    v_participant.id,
    jsonb_build_object('claimStatus', 'active'),
    jsonb_build_object('claimStatus', 'reset', 'reason', btrim(p_reason)),
    p_actor_id
  );

  return jsonb_build_object('kind', 'reset');
end;
$$;

create or replace function public.case_lab_3_live_resolve_tie(
  p_environment text,
  p_decisions jsonb,
  p_actor_id text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_decision jsonb;
  v_participant_id uuid;
  v_rank integer;
begin
  if p_environment not in ('test', 'live')
     or jsonb_typeof(p_decisions) <> 'array'
     or jsonb_array_length(p_decisions) < 2
     or char_length(btrim(coalesce(p_reason, ''))) not between 3 and 500 then
    raise exception 'invalid tie decision' using errcode = '22023';
  end if;

  if (
    select count(*) = count(distinct entry->>'participantId')
       and count(*) = count(distinct (entry->>'rank')::integer)
    from jsonb_array_elements(p_decisions) entry
  ) is not true then
    raise exception 'invalid tie decision' using errcode = '22023';
  end if;

  for v_decision in select value from jsonb_array_elements(p_decisions)
  loop
    begin
      v_participant_id := (v_decision->>'participantId')::uuid;
      v_rank := (v_decision->>'rank')::integer;
    exception when others then
      raise exception 'invalid tie decision' using errcode = '22023';
    end;

    if v_rank < 1 or not exists (
      select 1 from public.case_lab_3_live_participants participant
      where participant.id = v_participant_id
        and participant.environment = p_environment
        and participant.claim_status = 'active'
    ) then
      raise exception 'invalid tie decision' using errcode = '22023';
    end if;
  end loop;

  update public.case_lab_3_live_tie_breaks
  set active = false
  where environment = p_environment and active;

  for v_decision in select value from jsonb_array_elements(p_decisions)
  loop
    insert into public.case_lab_3_live_tie_breaks (
      environment, participant_id, resolved_rank, actor_id, reason
    ) values (
      p_environment,
      (v_decision->>'participantId')::uuid,
      (v_decision->>'rank')::integer,
      p_actor_id,
      btrim(p_reason)
    );
  end loop;

  insert into public.case_lab_3_audit_log (
    environment, action, target_table, before_summary, after_summary, actor_id
  ) values (
    p_environment,
    'live_tie_resolve',
    'case_lab_3_live_tie_breaks',
    null,
    jsonb_build_object('decisions', p_decisions, 'reason', btrim(p_reason)),
    p_actor_id
  );

  return jsonb_build_object('kind', 'resolved');
end;
$$;

create or replace function public.case_lab_3_live_get_leaderboard(p_environment text)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, extensions
as $$
  with scores as (
    select
      participant.id as participant_id,
      participant.public_display_name,
      coalesce(sum(submission.participation_points), 0)::integer
        + coalesce(sum(award.bonus_points) filter (where award.active), 0)::integer as points,
      count(award.id) filter (where award.active and award.place = 1)::integer as first_places,
      count(award.id) filter (where award.active)::integer as podiums
    from public.case_lab_3_live_participants participant
    left join public.case_lab_3_live_submissions submission
      on submission.participant_id = participant.id
     and submission.environment = participant.environment
     and submission.validity_state = 'valid'
    left join public.case_lab_3_live_awards award
      on award.submission_id = submission.id
     and award.environment = submission.environment
    where participant.environment = p_environment
      and participant.claim_status = 'active'
    group by participant.id, participant.public_display_name
  ), base_ranked as (
    select
      scores.*,
      dense_rank() over (
        order by points desc, first_places desc, podiums desc
      )::integer as base_rank
    from scores
  ), ordered as (
    select
      base_ranked.*,
      tie_break.resolved_rank,
      row_number() over (
        order by
          points desc,
          first_places desc,
          podiums desc,
          coalesce(tie_break.resolved_rank, 2147483647),
          public_display_name,
          participant_id
      )::integer as display_order
    from base_ranked
    left join public.case_lab_3_live_tie_breaks tie_break
      on tie_break.participant_id = base_ranked.participant_id
     and tie_break.environment = p_environment
     and tie_break.active
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'participantId', participant_id,
        'displayName', public_display_name,
        'points', points,
        'firstPlaces', first_places,
        'podiums', podiums,
        'rank', coalesce(resolved_rank, base_rank)
      ) order by display_order
    ),
    '[]'::jsonb
  )
  from ordered;
$$;

alter table public.case_lab_3_live_cases enable row level security;
alter table public.case_lab_3_live_participants enable row level security;
alter table public.case_lab_3_live_submissions enable row level security;
alter table public.case_lab_3_live_ai_runs enable row level security;
alter table public.case_lab_3_live_shortlist_entries enable row level security;
alter table public.case_lab_3_live_awards enable row level security;
alter table public.case_lab_3_live_tie_breaks enable row level security;

revoke all on table
  public.case_lab_3_live_cases,
  public.case_lab_3_live_participants,
  public.case_lab_3_live_submissions,
  public.case_lab_3_live_ai_runs,
  public.case_lab_3_live_shortlist_entries,
  public.case_lab_3_live_awards,
  public.case_lab_3_live_tie_breaks
from public, anon, authenticated;

grant all on table
  public.case_lab_3_live_cases,
  public.case_lab_3_live_participants,
  public.case_lab_3_live_submissions,
  public.case_lab_3_live_ai_runs,
  public.case_lab_3_live_shortlist_entries,
  public.case_lab_3_live_awards,
  public.case_lab_3_live_tie_breaks
to service_role;

revoke all on function public.case_lab_3_live_normalize_name(text) from public, anon, authenticated;
revoke all on function public.case_lab_3_live_claim_participant(text, text, text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_live_save_submission(text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_live_transition_case(uuid, integer, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_live_publish_awards(uuid, integer, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_live_reset_participant(uuid, text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_live_resolve_tie(text, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_live_get_leaderboard(text) from public, anon, authenticated;

grant execute on function public.case_lab_3_live_normalize_name(text) to service_role;
grant execute on function public.case_lab_3_live_claim_participant(text, text, text, text) to service_role;
grant execute on function public.case_lab_3_live_save_submission(text, uuid, uuid, text) to service_role;
grant execute on function public.case_lab_3_live_transition_case(uuid, integer, text, timestamptz, text) to service_role;
grant execute on function public.case_lab_3_live_publish_awards(uuid, integer, jsonb, text, text) to service_role;
grant execute on function public.case_lab_3_live_reset_participant(uuid, text, text) to service_role;
grant execute on function public.case_lab_3_live_resolve_tie(text, jsonb, text, text) to service_role;
grant execute on function public.case_lab_3_live_get_leaderboard(text) to service_role;
