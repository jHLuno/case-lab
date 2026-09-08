begin;

select plan(4);

select is(
  (
    select count(*)::bigint
    from pg_class
    where relnamespace = 'public'::regnamespace
      and relname like 'case_lab_3_%'
      and relkind = 'r'
      and relrowsecurity
  ),
  20::bigint,
  'every Case Lab III payment table has RLS enabled'
);

select is(
  (
    select count(*)::bigint
    from pg_policies
    where schemaname = 'public'
      and tablename like 'case_lab_3_%'
  ),
  0::bigint,
  'Case Lab III payment tables have no policies'
);

select is(
  (
    select count(*)::bigint
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname like 'case_lab_3_%'
      and c.relkind = 'r'
      and (
        has_table_privilege('anon', c.oid, 'select')
        or has_table_privilege('anon', c.oid, 'insert')
        or has_table_privilege('anon', c.oid, 'update')
        or has_table_privilege('anon', c.oid, 'delete')
      )
  ),
  0::bigint,
  'anon has no direct table privileges'
);

create or replace function pg_temp.case_lab_3_anon_attempts()
returns table (
  table_name text,
  operation text,
  denied boolean,
  detail text
)
language plpgsql
as $$
declare
  v_table text;
  v_row_count bigint;
begin
  for v_table in
    select unnest(array[
      'case_lab_3_event_settings',
      'case_lab_3_fiscal_policy_versions',
      'case_lab_3_inventory_allocations',
      'case_lab_3_legal_document_versions',
      'case_lab_3_orders',
      'case_lab_3_reservations',
      'case_lab_3_payment_attempts',
      'case_lab_3_provider_events',
      'case_lab_3_fiscal_operations',
      'case_lab_3_tickets',
      'case_lab_3_ticket_revisions',
      'case_lab_3_check_ins',
      'case_lab_3_refunds',
      'case_lab_3_jobs',
      'case_lab_3_email_deliveries',
      'case_lab_3_analytics_events',
      'case_lab_3_audit_log',
      'case_lab_3_incidents',
      'case_lab_3_rate_limits',
      'case_lab_3_reconciliation_state'
    ])
  loop
    begin
      execute format('select count(*) from public.%I', v_table) into v_row_count;
      return query select v_table, 'select', v_row_count = 0, format('rows=%s', v_row_count);
    exception when insufficient_privilege then
      return query select v_table, 'select', true, 'insufficient privilege';
    when others then
      return query select v_table, 'select', false, sqlstate || ': ' || sqlerrm;
    end;

    begin
      execute format('insert into public.%I default values', v_table);
      get diagnostics v_row_count = row_count;
      return query select v_table, 'insert', v_row_count = 0, format('rows=%s', v_row_count);
    exception when insufficient_privilege then
      return query select v_table, 'insert', true, 'insufficient privilege';
    when others then
      return query select v_table, 'insert', false, sqlstate || ': ' || sqlerrm;
    end;

    begin
      execute format('update public.%I set id = id where false', v_table);
      get diagnostics v_row_count = row_count;
      return query select v_table, 'update', v_row_count = 0, format('rows=%s', v_row_count);
    exception when insufficient_privilege then
      return query select v_table, 'update', true, 'insufficient privilege';
    when others then
      return query select v_table, 'update', false, sqlstate || ': ' || sqlerrm;
    end;

    begin
      execute format('delete from public.%I where false', v_table);
      get diagnostics v_row_count = row_count;
      return query select v_table, 'delete', v_row_count = 0, format('rows=%s', v_row_count);
    exception when insufficient_privilege then
      return query select v_table, 'delete', true, 'insufficient privilege';
    when others then
      return query select v_table, 'delete', false, sqlstate || ': ' || sqlerrm;
    end;
  end loop;
end;
$$;

set local role anon;

select is(
  (
    select count(*)::bigint
    from pg_temp.case_lab_3_anon_attempts()
    where denied
  ),
  80::bigint,
  'anon direct select/insert/update/delete attempts affect zero rows or are denied'
);

reset role;
select * from finish();
rollback;
