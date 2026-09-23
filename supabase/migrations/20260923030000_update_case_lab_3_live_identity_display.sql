alter table public.case_lab_3_live_participants
  drop constraint if exists case_lab_3_live_participants_public_display_name_check;

alter table public.case_lab_3_live_participants
  add constraint case_lab_3_live_participants_public_display_name_check
  check (char_length(public_display_name) between 2 and 420);

update public.case_lab_3_live_participants participant
set public_display_name = btrim(revision.first_name) || ' ' || btrim(revision.last_name)
from public.case_lab_3_ticket_revisions revision
where participant.ticket_id = revision.ticket_id
  and participant.ticket_revision_id = revision.id
  and participant.environment = revision.environment;

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
     or char_length(v_last_name) not between 1 and 100 then
    return jsonb_build_object('kind', 'not_found');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_environment || chr(31) || v_first_name || chr(31) || v_last_name,
    0
  ));

  -- The ticket argument is intentionally ignored. Matching is now name-only.
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
    and public.case_lab_3_live_normalize_name(revision.last_name) = v_last_name;

  if v_candidate_count = 0 then
    return jsonb_build_object('kind', 'not_found');
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
  left join public.case_lab_3_live_participants participant
    on participant.ticket_id = ticket.id
   and participant.environment = p_environment
  where ticket.environment = p_environment
    and ticket.status <> 'cancelled'
    and public.case_lab_3_live_normalize_name(revision.first_name) = v_first_name
    and public.case_lab_3_live_normalize_name(revision.last_name) = v_last_name
    and (participant.id is null or participant.claim_status = 'reset')
  order by ticket.created_at, ticket.id
  limit 1
  for update of ticket;

  if not found then
    return jsonb_build_object('kind', 'already_claimed');
  end if;

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
    btrim(v_revision.first_name) || ' ' || btrim(v_revision.last_name),
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

revoke all on function public.case_lab_3_live_claim_participant(text, text, text, text) from public, anon, authenticated;
grant execute on function public.case_lab_3_live_claim_participant(text, text, text, text) to service_role;
