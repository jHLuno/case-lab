alter table public.case_lab_3_live_participants
  alter column ticket_id drop not null,
  alter column ticket_revision_id drop not null;

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
  v_participant public.case_lab_3_live_participants%rowtype;
begin
  if p_environment not in ('test', 'live') then
    raise exception 'invalid environment' using errcode = '22023';
  end if;

  v_first_name := public.case_lab_3_live_normalize_name(p_first_name);
  v_last_name := public.case_lab_3_live_normalize_name(p_last_name);

  if v_first_name is null
     or v_last_name is null
     or char_length(v_first_name) not between 1 and 100
     or char_length(v_last_name) not between 1 and 100 then
    return jsonb_build_object('kind', 'not_found');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_environment || chr(31) || v_first_name || chr(31) || v_last_name,
    0
  ));

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
    null,
    null,
    v_first_name,
    v_last_name,
    btrim(regexp_replace(coalesce(p_first_name, ''), '\s+', ' ', 'g')) || ' ' || btrim(regexp_replace(coalesce(p_last_name, ''), '\s+', ' ', 'g')),
    1,
    'active',
    clock_timestamp(),
    null
  )
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
