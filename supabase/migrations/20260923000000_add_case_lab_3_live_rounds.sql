alter table public.case_lab_3_live_cases
  add column question_number integer not null default 1;

alter table public.case_lab_3_live_cases
  add constraint case_lab_3_live_cases_question_number_check
  check (question_number between 1 and 3);

alter table public.case_lab_3_live_cases
  drop constraint case_lab_3_live_cases_environment_number_key;

alter table public.case_lab_3_live_cases
  add constraint case_lab_3_live_cases_environment_number_question_key
  unique (environment, case_number, question_number);

alter table public.case_lab_3_live_submissions
  drop constraint case_lab_3_live_submissions_answer_text_check;

alter table public.case_lab_3_live_submissions
  add constraint case_lab_3_live_submissions_answer_text_check
  check (char_length(btrim(answer_text)) between 1 and 350);

drop function public.case_lab_3_live_save_submission(text, uuid, uuid, text);

create or replace function public.case_lab_3_live_save_submission(
  p_environment text,
  p_case_id uuid,
  p_participant_id uuid,
  p_answer_text text,
  p_timeout boolean default false
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
     or char_length(v_answer) < (case when p_timeout then 1 else 30 end)
     or char_length(v_answer) > 350 then
    raise exception 'invalid submission' using errcode = '22023';
  end if;

  select * into v_case
  from public.case_lab_3_live_cases
  where id = p_case_id and environment = p_environment
  for update;

  if not found or v_case.state <> 'open' or v_case.closes_at is null then
    return jsonb_build_object('kind', 'closed');
  end if;

  if not p_timeout and clock_timestamp() >= v_case.closes_at then
    return jsonb_build_object('kind', 'closed');
  end if;

  if p_timeout and clock_timestamp() > v_case.closes_at + interval '10 seconds' then
    return jsonb_build_object('kind', 'closed');
  end if;

  if p_timeout and clock_timestamp() < v_case.closes_at - interval '10 seconds' then
    raise exception 'timeout submission is too early' using errcode = '22023';
  end if;

  select * into v_participant
  from public.case_lab_3_live_participants
  where id = p_participant_id
    and environment = p_environment
    and claim_status = 'active';

  if not found then
    return jsonb_build_object('kind', 'unauthorized');
  end if;

  select * into v_submission
  from public.case_lab_3_live_submissions
  where case_id = p_case_id
    and participant_id = p_participant_id
    and environment = p_environment
  for update;

  if found then
    return jsonb_build_object('kind', 'already_submitted');
  end if;

  insert into public.case_lab_3_live_submissions (
    environment, case_id, participant_id, answer_text
  ) values (
    p_environment, p_case_id, p_participant_id, v_answer
  )
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

  if p_new_state = 'analyzing' and (v_case.closes_at is null or v_case.closes_at > clock_timestamp()) then
    return jsonb_build_object('kind', 'round_not_closed');
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

revoke all on function public.case_lab_3_live_save_submission(text, uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.case_lab_3_live_save_submission(text, uuid, uuid, text, boolean) to service_role;

create index case_lab_3_live_cases_round_idx
  on public.case_lab_3_live_cases (environment, case_number, question_number);
