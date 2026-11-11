begin;

do $$
declare
  v_run public.nbs_forum_runs%rowtype;
  v_result jsonb;
  v_claim jsonb;
  v_done jsonb;
  v_participant_id uuid;
  v_index integer;
  v_participant_one uuid := '1a3d2c83-2c7e-4c89-8b76-901d7ac64a01';
  v_participant_two uuid := '1a3d2c83-2c7e-4c89-8b76-901d7ac64a02';
begin
  select * into v_run from public.nbs_forum_runs where environment = 'test';
  if not found or v_run.state <> 'ready' then
    raise exception 'expected test NBS run to be ready inside the rolled-back test';
  end if;

  v_result := public.nbs_forum_start('test', v_run.id, v_run.state_version, 'participant-jobs-test-start', repeat('a', 64));
  if v_result ->> 'state' <> 'open' then raise exception 'expected test run to open'; end if;

  insert into public.nbs_forum_participants(environment, run_id, id, first_name, last_name, submitted_at)
  values
    ('test', v_run.id, v_participant_one, 'Тестовый', 'Участник Один', clock_timestamp()),
    ('test', v_run.id, v_participant_two, 'Тестовый', 'Участник Два', clock_timestamp());
  insert into public.nbs_forum_responses(environment, run_id, participant_id, question_number, answer_text)
  select 'test', v_run.id, participant_id, question_number, 'Синтетический ответ для регрессионной проверки'
  from (values (v_participant_one), (v_participant_two)) participants(participant_id)
  cross join generate_series(1, 3) questions(question_number);

  select r.* into v_run from public.nbs_forum_runs r where r.environment = 'test' and r.id = v_run.id;
  v_result := public.nbs_forum_finish('test', v_run.id, v_run.state_version, 'participant-jobs-test-finish', repeat('b', 64));
  if v_result ->> 'state' <> 'analyzing' then raise exception 'expected test run to begin analysis'; end if;
  if (select count(*) from public.nbs_forum_jobs where environment = 'test' and run_id = v_run.id
      and job_type = 'participant_analysis') <> 2 then
    raise exception 'finish must queue one analysis task per submitted participant';
  end if;
  if exists (select 1 from public.nbs_forum_jobs where environment = 'test' and run_id = v_run.id
      and job_type = 'question_cluster') then
    raise exception 'question clustering must wait for participant analysis';
  end if;

  for v_index in 1..2 loop
    v_claim := public.nbs_forum_claim_job('test', 'nbs-participant-jobs-regression');
    if v_claim is null or v_claim ->> 'jobType' <> 'participant_analysis'
       or v_claim ->> 'participantId' is null then
      raise exception 'worker claim must return a participant analysis task';
    end if;
    v_participant_id := (v_claim ->> 'participantId')::uuid;
    v_result := (select jsonb_build_object('answers', jsonb_agg(jsonb_build_object(
      'questionNumber', r.question_number,
      'answerId', r.id,
      'meaning', 'Синтетический смысл ответа',
      'excludedReason', null
    ) order by r.question_number))
      from public.nbs_forum_responses r
      where r.environment = 'test' and r.run_id = v_run.id and r.participant_id = v_participant_id);
    v_done := public.nbs_forum_complete_job(
      'test', (v_claim ->> 'jobId')::uuid, (v_claim ->> 'leaseToken')::uuid, v_result, null
    );
    if v_done ->> 'kind' <> 'completed' then raise exception 'participant analysis task must complete'; end if;
    if v_index = 1 and exists (select 1 from public.nbs_forum_jobs where environment = 'test'
        and run_id = v_run.id and job_type = 'question_cluster') then
      raise exception 'question clustering started before every participant was analysed';
    end if;
  end loop;

  if (select count(*) from public.nbs_forum_jobs where environment = 'test' and run_id = v_run.id
      and job_type = 'question_cluster') <> 3 then
    raise exception 'three question clustering tasks must follow participant analysis';
  end if;
end;
$$;

rollback;
