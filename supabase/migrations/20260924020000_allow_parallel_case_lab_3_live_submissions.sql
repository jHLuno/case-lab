-- Allow different participants to save answers for one open case concurrently.
-- Case transitions still take an exclusive row lock and wait for active saves.
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
  for share;

  if not found or v_case.state <> 'open' or v_case.closes_at is null then
    return jsonb_build_object('kind', 'closed');
  end if;

  if not p_timeout and clock_timestamp() >= v_case.closes_at then
    return jsonb_build_object('kind', 'closed');
  end if;

  if p_timeout and clock_timestamp() > v_case.closes_at + interval '30 seconds' then
    return jsonb_build_object('kind', 'closed');
  end if;

  if p_timeout and clock_timestamp() < v_case.closes_at - interval '10 seconds' then
    raise exception 'timeout submission is too early' using errcode = '22023';
  end if;

  select * into v_participant
  from public.case_lab_3_live_participants
  where id = p_participant_id
    and environment = p_environment
    and claim_status = 'active'
  for update;

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

revoke all on function public.case_lab_3_live_save_submission(text, uuid, uuid, text, boolean) from public, anon, authenticated;
grant execute on function public.case_lab_3_live_save_submission(text, uuid, uuid, text, boolean) to service_role;
