set search_path = public, extensions, pg_catalog;

alter table public.case_lab_3_private_offers
  drop constraint if exists case_lab_3_private_offers_amount_minor_check;

alter table public.case_lab_3_private_offers
  add constraint case_lab_3_private_offers_amount_minor_check
  check (amount_minor in (500000, 798000));

create or replace function public.case_lab_3_create_private_offer(
  p_environment text,
  p_token_hash text,
  p_amount_minor bigint default 500000
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_offer public.case_lab_3_private_offers%rowtype;
begin
  if p_environment is null or p_environment not in ('test', 'live')
     or p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$'
     or p_amount_minor is null or p_amount_minor not in (500000, 798000) then
    raise exception 'invalid private offer'
      using errcode = '22023';
  end if;

  insert into public.case_lab_3_private_offers (environment, token_hash, amount_minor)
  values (p_environment, p_token_hash, p_amount_minor)
  returning * into v_offer;

  return jsonb_build_object(
    'kind', 'created',
    'offerId', v_offer.id,
    'environment', v_offer.environment,
    'amountMinor', v_offer.amount_minor,
    'status', v_offer.status
  );
end;
$$;
