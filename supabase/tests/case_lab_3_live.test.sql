begin;

select plan(29);

select has_table('public', 'case_lab_3_live_cases', 'live cases table exists');
select has_table('public', 'case_lab_3_live_participants', 'live participants table exists');
select has_table('public', 'case_lab_3_live_submissions', 'live submissions table exists');
select has_table('public', 'case_lab_3_live_ai_runs', 'live AI runs table exists');
select has_table('public', 'case_lab_3_live_shortlist_entries', 'live shortlist table exists');
select has_table('public', 'case_lab_3_live_awards', 'live awards table exists');
select has_table('public', 'case_lab_3_live_tie_breaks', 'live tie-break table exists');

select is(
  (
    select count(*)::integer
    from pg_class relation
    join pg_namespace namespace on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relname in (
        'case_lab_3_live_cases',
        'case_lab_3_live_participants',
        'case_lab_3_live_submissions',
        'case_lab_3_live_ai_runs',
        'case_lab_3_live_shortlist_entries',
        'case_lab_3_live_awards',
        'case_lab_3_live_tie_breaks'
      )
      and relation.relrowsecurity
  ),
  7,
  'RLS is enabled on every live interaction table'
);

select ok(
  not has_table_privilege('anon', 'public.case_lab_3_live_participants', 'SELECT')
    and not has_table_privilege('authenticated', 'public.case_lab_3_live_submissions', 'INSERT')
    and has_table_privilege('service_role', 'public.case_lab_3_live_cases', 'SELECT'),
  'live tables are private and remain accessible to service_role'
);

select is(
  public.case_lab_3_live_normalize_name('  АЛИЯ   ЁЛКИНА  '),
  'алия елкина',
  'participant names are trimmed, whitespace-normalized, lower-cased, and ё-normalized'
);

insert into public.case_lab_3_orders (
  id,
  order_number,
  idempotency_key,
  environment,
  first_name,
  last_name,
  participant_email,
  purchaser_email,
  fiscal_email,
  original_contact_snapshot,
  tier,
  amount_minor,
  receipt_label,
  configuration_version,
  offer_version_id,
  privacy_version_id,
  accepted_at,
  payment_status,
  paid_amount_minor,
  refundable_amount_minor
)
select
  fixture.order_id,
  fixture.order_number,
  fixture.idempotency_key,
  'test',
  fixture.first_name,
  fixture.last_name,
  fixture.email,
  fixture.email,
  fixture.email,
  jsonb_build_object('firstName', fixture.first_name, 'lastName', fixture.last_name),
  'standard',
  1500000,
  'Case Lab III live interaction test ticket',
  settings.configuration_version,
  settings.active_offer_version_id,
  settings.active_privacy_version_id,
  clock_timestamp(),
  'paid',
  1500000,
  1500000
from (
  values
    ('00000000-0000-4000-8000-000000009001'::uuid, 'CL3-LIVE-ORDER-1', 'live-test-order-1', 'Алия', 'Ёлкина', 'live-1@example.test'),
    ('00000000-0000-4000-8000-000000009002'::uuid, 'CL3-LIVE-ORDER-2', 'live-test-order-2', 'Борис', 'Смирнов', 'live-2@example.test'),
    ('00000000-0000-4000-8000-000000009003'::uuid, 'CL3-LIVE-ORDER-3', 'live-test-order-3', 'Вера', 'Ким', 'live-3@example.test')
) as fixture(order_id, order_number, idempotency_key, first_name, last_name, email)
join public.case_lab_3_event_settings settings on settings.environment = 'test';

insert into public.case_lab_3_tickets (
  id, order_id, environment, public_ticket_number, status
)
values
  ('00000000-0000-4000-8000-000000009011', '00000000-0000-4000-8000-000000009001', 'test', 'CL3-LIVE-TICKET-1', 'used'),
  ('00000000-0000-4000-8000-000000009012', '00000000-0000-4000-8000-000000009002', 'test', 'CL3-LIVE-TICKET-2', 'used'),
  ('00000000-0000-4000-8000-000000009013', '00000000-0000-4000-8000-000000009003', 'test', 'CL3-LIVE-TICKET-3', 'used');

insert into public.case_lab_3_ticket_revisions (
  id,
  ticket_id,
  environment,
  revision_number,
  first_name,
  last_name,
  participant_email,
  token_version,
  creation_reason
)
values
  ('00000000-0000-4000-8000-000000009021', '00000000-0000-4000-8000-000000009011', 'test', 1, 'Алия', 'Ёлкина', 'live-1@example.test', 1, 'live_test'),
  ('00000000-0000-4000-8000-000000009022', '00000000-0000-4000-8000-000000009012', 'test', 1, 'Борис', 'Смирнов', 'live-2@example.test', 1, 'live_test'),
  ('00000000-0000-4000-8000-000000009023', '00000000-0000-4000-8000-000000009013', 'test', 1, 'Вера', 'Ким', 'live-3@example.test', 1, 'live_test');

update public.case_lab_3_tickets ticket
set current_revision_id = revision.id
from public.case_lab_3_ticket_revisions revision
where revision.ticket_id = ticket.id
  and ticket.id in (
    '00000000-0000-4000-8000-000000009011',
    '00000000-0000-4000-8000-000000009012',
    '00000000-0000-4000-8000-000000009013'
  );

insert into public.case_lab_3_check_ins (
  id, ticket_id, ticket_revision_id, environment, checked_in_by
)
values
  ('00000000-0000-4000-8000-000000009031', '00000000-0000-4000-8000-000000009011', '00000000-0000-4000-8000-000000009021', 'test', 'live-test'),
  ('00000000-0000-4000-8000-000000009032', '00000000-0000-4000-8000-000000009012', '00000000-0000-4000-8000-000000009022', 'test', 'live-test'),
  ('00000000-0000-4000-8000-000000009033', '00000000-0000-4000-8000-000000009013', '00000000-0000-4000-8000-000000009023', 'test', 'live-test');

select is(
  public.case_lab_3_live_claim_participant('test', '  АЛИЯ ', ' елкина ', null)->>'kind',
  'claimed',
  'a checked-in guest can claim a participant session by normalized full name'
);

select is(
  public.case_lab_3_live_claim_participant('test', 'Алия', 'Ёлкина', null)->>'kind',
  'already_claimed',
  'an active participant claim cannot be silently taken over'
);

select is(
  public.case_lab_3_live_claim_participant('test', 'Борис', 'Смирнов', 'CL3-LIVE-TICKET-2')->>'kind',
  'claimed',
  'a ticket number can be supplied as an additional participant check'
);

select is(
  public.case_lab_3_live_claim_participant('test', 'Вера', 'Ким', null)->>'kind',
  'claimed',
  'another checked-in guest can claim independently'
);

select is(
  public.case_lab_3_live_claim_participant('test', 'Нет', 'Гостя', null)->>'kind',
  'not_found',
  'an unknown or unchecked guest cannot claim a participant session'
);

select is(
  (select public_display_name from public.case_lab_3_live_participants where normalized_first_name = 'алия'),
  'Алия Ё.',
  'only first name and the first last-name letter are stored for public display'
);

insert into public.case_lab_3_live_cases (
  id,
  environment,
  case_number,
  speaker_label,
  title,
  question,
  speaker_reference_answer,
  approved_rubric,
  state
)
values (
  '00000000-0000-4000-8000-000000009101',
  'test',
  1,
  'Тестовый спикер',
  'Тестовый кейс',
  'Какое решение вы предложите?',
  'Сильный ответ учитывает клиента, ограничения и измеримый результат.',
  '{"criteria":[{"name":"relevance","weight":100}]}'::jsonb,
  'ready'
);

select is(
  public.case_lab_3_live_transition_case(
    '00000000-0000-4000-8000-000000009101',
    1,
    'open',
    clock_timestamp() + interval '15 minutes',
    'live-test'
  )->>'kind',
  'transitioned',
  'an approved ready case can be opened with a server deadline'
);

select throws_ok(
  $$
    select public.case_lab_3_live_save_submission(
      'test',
      '00000000-0000-4000-8000-000000009101',
      (select id from public.case_lab_3_live_participants where normalized_first_name = 'алия'),
      'Слишком коротко'
    )
  $$,
  '22023',
  'invalid submission',
  'answers shorter than 30 characters are rejected'
);

select is(
  public.case_lab_3_live_save_submission(
    'test',
    '00000000-0000-4000-8000-000000009101',
    (select id from public.case_lab_3_live_participants where normalized_first_name = 'алия'),
    'Сначала проверю главную гипотезу на клиентах и измерю изменение конверсии.'
  )->>'participationPoints',
  '10',
  'a valid free-text answer immediately receives ten participation points'
);

select is(
  public.case_lab_3_live_save_submission(
    'test',
    '00000000-0000-4000-8000-000000009101',
    (select id from public.case_lab_3_live_participants where normalized_first_name = 'алия'),
    'Сначала проверю гипотезу на пяти клиентах, затем сравню конверсию с контрольной группой.'
  )->>'contentVersion',
  '2',
  'an answer can be edited before the server deadline without creating a duplicate'
);

select is(
  public.case_lab_3_live_save_submission(
    'test',
    '00000000-0000-4000-8000-000000009101',
    (select id from public.case_lab_3_live_participants where normalized_first_name = 'борис'),
    'Сегментирую аудиторию, найду узкое место и проверю решение дешёвым экспериментом.'
  )->>'kind',
  'saved',
  'a second participant answer is saved'
);

select is(
  public.case_lab_3_live_save_submission(
    'test',
    '00000000-0000-4000-8000-000000009101',
    (select id from public.case_lab_3_live_participants where normalized_first_name = 'вера'),
    'Сопоставлю влияние решения с ограничениями команды и заранее определю метрику успеха.'
  )->>'kind',
  'saved',
  'a third participant answer is saved'
);

select is(
  public.case_lab_3_live_transition_case(
    '00000000-0000-4000-8000-000000009101', 2, 'analyzing', null, 'live-test'
  )->>'kind',
  'transitioned',
  'an open case can be locked for analysis'
);

select is(
  public.case_lab_3_live_save_submission(
    'test',
    '00000000-0000-4000-8000-000000009101',
    (select id from public.case_lab_3_live_participants where normalized_first_name = 'алия'),
    'После закрытия этот достаточно длинный ответ уже не должен сохраняться системой.'
  )->>'kind',
  'closed',
  'the database rejects edits after the case leaves the open state'
);

insert into public.case_lab_3_live_ai_runs (
  id,
  environment,
  case_id,
  run_number,
  requested_models,
  served_model,
  request_hash,
  response_payload,
  status,
  completed_at
)
values (
  '00000000-0000-4000-8000-000000009201',
  'test',
  '00000000-0000-4000-8000-000000009101',
  1,
  '["google/gemini-3-flash-preview","openai/gpt-5-mini"]'::jsonb,
  'google/gemini-3-flash-preview',
  repeat('a', 64),
  '{"shortlist":[]}'::jsonb,
  'succeeded',
  clock_timestamp()
);

insert into public.case_lab_3_live_shortlist_entries (
  environment,
  case_id,
  ai_run_id,
  submission_id,
  ai_order,
  ai_score,
  ai_reason,
  candidate_type,
  final_order
)
select
  'test',
  submission.case_id,
  '00000000-0000-4000-8000-000000009201',
  submission.id,
  row_number() over (order by participant.normalized_first_name),
  90 - row_number() over (order by participant.normalized_first_name),
  'Тестовая релевантная аргументация',
  'strong',
  row_number() over (order by participant.normalized_first_name)
from public.case_lab_3_live_submissions submission
join public.case_lab_3_live_participants participant on participant.id = submission.participant_id
where submission.case_id = '00000000-0000-4000-8000-000000009101';

select is(
  public.case_lab_3_live_transition_case(
    '00000000-0000-4000-8000-000000009101', 3, 'shortlist_ready', null, 'live-test'
  )->>'kind',
  'transitioned',
  'an analyzing case can expose its shortlist to the operator'
);

select is(
  public.case_lab_3_live_publish_awards(
    '00000000-0000-4000-8000-000000009101',
    4,
    jsonb_build_array(
      jsonb_build_object(
        'place', 1,
        'submissionId', (select submission.id from public.case_lab_3_live_submissions submission join public.case_lab_3_live_participants participant on participant.id = submission.participant_id where participant.normalized_first_name = 'алия')
      ),
      jsonb_build_object(
        'place', 2,
        'submissionId', (select submission.id from public.case_lab_3_live_submissions submission join public.case_lab_3_live_participants participant on participant.id = submission.participant_id where participant.normalized_first_name = 'борис')
      ),
      jsonb_build_object(
        'place', 3,
        'submissionId', (select submission.id from public.case_lab_3_live_submissions submission join public.case_lab_3_live_participants participant on participant.id = submission.participant_id where participant.normalized_first_name = 'вера')
      )
    ),
    'live-test',
    'Выбор тестового спикера'
  )->>'kind',
  'published',
  'speaker awards are atomically published from the approved shortlist'
);

select results_eq(
  $$
    select (entry->>'displayName')::text, (entry->>'points')::integer, (entry->>'rank')::integer
    from jsonb_array_elements(public.case_lab_3_live_get_leaderboard('test')) entry
    order by (entry->>'rank')::integer
  $$,
  $$
    values
      ('Алия Ё.'::text, 60, 1),
      ('Борис С.'::text, 45, 2),
      ('Вера К.'::text, 35, 3)
  $$,
  'leaderboard combines participation and speaker bonus points without exposing full names'
);

select is(
  (select count(*)::integer from public.case_lab_3_live_awards where active),
  3,
  'publishing records exactly three active awards'
);

select ok(
  has_function_privilege('service_role', 'public.case_lab_3_live_claim_participant(text,text,text,text)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.case_lab_3_live_save_submission(text,uuid,uuid,text)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.case_lab_3_live_claim_participant(text,text,text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.case_lab_3_live_get_leaderboard(text)', 'EXECUTE'),
  'live interaction functions execute only through the server service role'
);

select * from finish();
rollback;
