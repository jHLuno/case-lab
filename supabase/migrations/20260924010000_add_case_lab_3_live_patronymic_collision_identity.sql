alter table public.case_lab_3_live_participants
  add column if not exists normalized_middle_name text;

alter table public.case_lab_3_live_participants
  drop constraint if exists case_lab_3_live_participants_middle_name_check;

alter table public.case_lab_3_live_participants
  add constraint case_lab_3_live_participants_middle_name_check
  check (normalized_middle_name is null or char_length(normalized_middle_name) between 1 and 100);

create index if not exists case_lab_3_live_participants_identity_idx
  on public.case_lab_3_live_participants (
    environment,
    normalized_first_name,
    normalized_last_name,
    normalized_middle_name
  );

create or replace function public.case_lab_3_live_claim_participant_with_middle_name(
  p_environment text,
  p_first_name text,
  p_last_name text,
  p_middle_name text default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_first_name text;
  v_last_name text;
  v_middle_name text;
  v_existing public.case_lab_3_live_participants%rowtype;
  v_participant public.case_lab_3_live_participants%rowtype;
begin
  if p_environment not in ('test', 'live') then
    raise exception 'invalid environment' using errcode = '22023';
  end if;

  v_first_name := public.case_lab_3_live_normalize_name(p_first_name);
  v_last_name := public.case_lab_3_live_normalize_name(p_last_name);
  v_middle_name := nullif(public.case_lab_3_live_normalize_name(p_middle_name), '');

  if char_length(v_first_name) not between 1 and 100
     or char_length(v_last_name) not between 1 and 100
     or (v_middle_name is not null and char_length(v_middle_name) not between 1 and 100) then
    return jsonb_build_object('kind', 'not_found');
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_environment || chr(31) || v_first_name || chr(31) || v_last_name,
    0
  ));

  if v_middle_name is null then
    select *
      into v_existing
    from public.case_lab_3_live_participants
    where environment = p_environment
      and normalized_first_name = v_first_name
      and normalized_last_name = v_last_name
    order by case when claim_status = 'active' then 0 else 1 end,
             created_at asc,
             id asc
    limit 1
    for update;

    if found then
      if v_existing.claim_status = 'reset' then
        update public.case_lab_3_live_participants
        set claim_status = 'active',
            claimed_at = clock_timestamp(),
            reset_at = null,
            session_token_version = session_token_version + 1
        where id = v_existing.id
        returning * into v_participant;

        return jsonb_build_object(
          'kind', 'claimed',
          'participantId', v_participant.id,
          'tokenVersion', v_participant.session_token_version,
          'displayName', v_participant.public_display_name
        );
      end if;

      return jsonb_build_object('kind', 'needs_middle_name');
    end if;
  else
    select *
      into v_existing
    from public.case_lab_3_live_participants
    where environment = p_environment
      and normalized_first_name = v_first_name
      and normalized_last_name = v_last_name
      and normalized_middle_name = v_middle_name
    order by case when claim_status = 'active' then 0 else 1 end,
             created_at asc,
             id asc
    limit 1
    for update;

    if found then
      if v_existing.claim_status = 'active' then
        return jsonb_build_object(
          'kind', 'claimed',
          'participantId', v_existing.id,
          'tokenVersion', v_existing.session_token_version,
          'displayName', v_existing.public_display_name
        );
      end if;

      update public.case_lab_3_live_participants
      set claim_status = 'active',
          claimed_at = clock_timestamp(),
          reset_at = null,
          session_token_version = session_token_version + 1
      where id = v_existing.id
      returning * into v_participant;

      return jsonb_build_object(
        'kind', 'claimed',
        'participantId', v_participant.id,
        'tokenVersion', v_participant.session_token_version,
        'displayName', v_participant.public_display_name
      );
    end if;
  end if;

  insert into public.case_lab_3_live_participants (
    environment,
    ticket_id,
    ticket_revision_id,
    normalized_first_name,
    normalized_last_name,
    normalized_middle_name,
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
    v_middle_name,
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
begin
  return public.case_lab_3_live_claim_participant_with_middle_name(
    p_environment,
    p_first_name,
    p_last_name,
    null
  );
end;
$$;

revoke all on function public.case_lab_3_live_claim_participant_with_middle_name(text, text, text, text) from public, anon, authenticated;
grant execute on function public.case_lab_3_live_claim_participant_with_middle_name(text, text, text, text) to service_role;
revoke all on function public.case_lab_3_live_claim_participant(text, text, text, text) from public, anon, authenticated;
grant execute on function public.case_lab_3_live_claim_participant(text, text, text, text) to service_role;
