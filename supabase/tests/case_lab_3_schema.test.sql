begin;

select plan(35);

select results_eq(
  $$
    select tablename::text collate "C"
    from pg_tables
    where schemaname = 'public'
      and tablename like 'case_lab_3_%'
    order by tablename
  $$,
  $$
    select value::text collate "C"
    from (values
      ('case_lab_3_analytics_events'),
      ('case_lab_3_audit_log'),
      ('case_lab_3_check_ins'),
      ('case_lab_3_email_deliveries'),
      ('case_lab_3_event_settings'),
      ('case_lab_3_fiscal_operations'),
      ('case_lab_3_fiscal_policy_versions'),
      ('case_lab_3_incidents'),
      ('case_lab_3_inventory_allocations'),
      ('case_lab_3_jobs'),
      ('case_lab_3_legal_document_versions'),
      ('case_lab_3_orders'),
      ('case_lab_3_payment_attempts'),
      ('case_lab_3_provider_events'),
      ('case_lab_3_rate_limits'),
      ('case_lab_3_reconciliation_state'),
      ('case_lab_3_refunds'),
      ('case_lab_3_reservations'),
      ('case_lab_3_ticket_revisions'),
      ('case_lab_3_tickets')
    ) as expected(value)
    order by value
  $$,
  'the exact 20 Case Lab III payment tables exist'
);

select has_table('public', 'case_lab_3_orders', 'orders table exists');
select has_table('public', 'case_lab_3_payment_attempts', 'payment attempts table exists');
select has_table('public', 'case_lab_3_fiscal_operations', 'fiscal operations table exists');
select has_table('public', 'case_lab_3_jobs', 'jobs table exists');
select has_table('public', 'case_lab_3_ticket_revisions', 'ticket revisions table exists');
select col_is_unique('public', 'case_lab_3_tickets', 'order_id', 'ticket order_id is unique');
select col_not_null('public', 'case_lab_3_orders', 'amount_minor', 'order amount is required');

select is(
  (select count(*)::bigint from public.case_lab_3_event_settings),
  2::bigint,
  'both test and live event settings rows are present'
);

select results_eq(
  $$
    select environment, sales_enabled
    from public.case_lab_3_event_settings
    order by environment
  $$,
  $$
    select environment, sales_enabled
    from (values
      ('live', false),
      ('test', true)
    ) as expected(environment, sales_enabled)
    order by environment
  $$,
  'test sales are enabled after complete legal and fiscal gates while live sales remain disabled'
);

select results_eq(
  $$
    select environment collate "C",
           document_kind collate "C",
           version_id collate "C",
           id::text collate "C",
           is_active,
           activated_at,
           char_length(content_snapshot) > 0,
           content_hash = encode(digest(content_snapshot, 'sha256'), 'hex')
    from public.case_lab_3_legal_document_versions
    where is_active
    order by environment, document_kind
  $$,
  $$
    select environment collate "C",
           document_kind collate "C",
           version_id collate "C",
           id collate "C",
           is_active,
           activated_at,
           snapshot_non_empty,
           hash_matches
    from (values
      ('live', 'offer', 'offer-2026-09-07', '00000000-0000-4000-8000-000000000803', true, '2026-09-07 03:00:00 Asia/Almaty'::timestamptz, true, true),
      ('live', 'privacy', 'privacy-2026-09-07', '00000000-0000-4000-8000-000000000804', true, '2026-09-07 03:00:00 Asia/Almaty'::timestamptz, true, true),
      ('test', 'offer', 'offer-2026-09-07', '00000000-0000-4000-8000-000000000801', true, '2026-09-07 03:00:00 Asia/Almaty'::timestamptz, true, true),
      ('test', 'privacy', 'privacy-2026-09-07', '00000000-0000-4000-8000-000000000802', true, '2026-09-07 03:00:00 Asia/Almaty'::timestamptz, true, true)
    ) as expected(environment, document_kind, version_id, id, is_active, activated_at, snapshot_non_empty, hash_matches)
    order by environment, document_kind
  $$,
  'exactly four active legal rows retain stable version IDs, UUID row IDs, timestamps, snapshots, and hashes'
);

select results_eq(
  $$
    select environment collate "C", early_bird_amount_minor, standard_amount_minor,
           early_bird_quota, online_sales_limit, venue_capacity
    from public.case_lab_3_event_settings
    order by environment
  $$,
  $$
    select environment collate "C", early_bird_amount_minor, standard_amount_minor,
           early_bird_quota, online_sales_limit, venue_capacity
    from (values
      ('live', 789000::bigint, 1500000::bigint, 20, 70, 100),
      ('test', 789000::bigint, 1500000::bigint, 20, 70, 100)
    ) as expected(environment, early_bird_amount_minor, standard_amount_minor, early_bird_quota, online_sales_limit, venue_capacity)
    order by environment
  $$,
  'event settings contain the exact ticket prices, quotas, limits, and capacity'
);

select is(
  (
    select count(*)::bigint
    from public.case_lab_3_event_settings
    where sales_cutoff = '2026-09-24 00:00:00 Asia/Almaty'::timestamptz
  ),
  2::bigint,
  'both settings rows use the exclusive Almaty sales cutoff'
);

select is(
  (
    select count(*)::bigint
    from public.case_lab_3_fiscal_policy_versions
    where environment = 'test'
      and version_number = 1
      and policy_key = 'case-lab-3-test-automated'
      and policy_status = 'approved'
      and is_test_policy
      and is_accountant_approved
      and approved_by = 'automated-test'
      and required_purposes = array['payment_income', 'refund_income_return']::text[]
  ),
  1::bigint,
  'the approved automated test fiscal policy has the exact supported purposes'
);

select is(
  (
    select count(*)::bigint
    from public.case_lab_3_event_settings settings
    join public.case_lab_3_fiscal_policy_versions policy
      on policy.id = settings.active_fiscal_policy_version_id
    where settings.environment = 'test'
      and policy.environment = 'test'
  ),
  1::bigint,
  'the test settings row alone attaches the seeded fiscal policy'
);

select is(
  (
    select count(*)::bigint
    from public.case_lab_3_event_settings
    where environment = 'live'
      and active_fiscal_policy_version_id is null
  ),
  1::bigint,
  'live settings keep the active fiscal policy unset'
);

select is(
  (
    select policy_hash = encode(digest(policy_definition::text, 'sha256'), 'hex')
    from public.case_lab_3_fiscal_policy_versions
    where environment = 'test'
      and policy_key = 'case-lab-3-test-automated'
  ),
  true,
  'fiscal policy hash is bound to the stored jsonb definition'
);

select lives_ok(
  $$
    insert into public.case_lab_3_legal_document_versions (
      id,
      environment,
      document_kind,
      version_id,
      url,
      publication_label,
      content_snapshot,
      content_hash
    )
    values
      (
        '00000000-0000-4000-8000-000000000401'::uuid,
        'test',
        'offer',
        'schema-test-offer-v1',
        'https://caselab.kz/schema-test-offer',
        'Schema test offer',
        'schema-test-offer-content',
        encode(digest('schema-test-offer-content', 'sha256'), 'hex')
      ),
      (
        '00000000-0000-4000-8000-000000000402'::uuid,
        'test',
        'privacy',
        'schema-test-privacy-v1',
        'https://caselab.kz/schema-test-privacy',
        'Schema test privacy',
        'schema-test-privacy-content',
        encode(digest('schema-test-privacy-content', 'sha256'), 'hex')
      )
  $$,
  'transaction-local legal fixtures use valid content hashes'
);

select throws_ok(
  $$
    update public.case_lab_3_legal_document_versions
    set publication_label = 'mutated schema test offer'
    where id = '00000000-0000-4000-8000-000000000401'::uuid
  $$,
  '55000',
  'Case Lab III versioned rows are immutable',
  'legal document updates are rejected'
);

select throws_ok(
  $$
    delete from public.case_lab_3_legal_document_versions
    where id = '00000000-0000-4000-8000-000000000402'::uuid
  $$,
  '55000',
  'Case Lab III versioned rows are immutable',
  'legal document deletes are rejected'
);

select is(
  (
    select count(*)::bigint
    from public.case_lab_3_legal_document_versions
    where char_length(content_snapshot) > 0
      and content_hash <> encode(digest(content_snapshot, 'sha256'), 'hex')
  ),
  0::bigint,
  'every non-empty legal document snapshot has its matching sha256 content hash'
);

select ok(
  (
    select jsonb_typeof(policy_definition) = 'array'
      and jsonb_array_length(policy_definition) = 2
      and policy_definition @> '[
        {"purpose":"payment_income","trigger":"payment_confirmed","depends_on_purpose":null,"provider_receipt_type":"Income","schedule":"immediate"},
        {"purpose":"refund_income_return","trigger":"refund_confirmed","depends_on_purpose":"payment_income","provider_receipt_type":"IncomeReturn","schedule":"after_dependency"}
      ]'::jsonb
      and policy_definition->0->'payload_fields' ?& array[
        'vat', 'taxation_system', 'calculation_place', 'calculation_method'
      ]
      and policy_definition->1->'payload_fields' ?& array[
        'vat', 'taxation_system', 'calculation_place', 'calculation_method'
      ]
    from public.case_lab_3_fiscal_policy_versions
    where environment = 'test'
      and policy_key = 'case-lab-3-test-automated'
  ),
  'the seeded policy uses only the supported two-stage structure and required fields'
);

select has_column('public', 'case_lab_3_event_settings', 'latest_worker_heartbeat_at', 'worker heartbeat column exists');

select results_eq(
  $$
    select conname::text collate "C",
           regexp_replace(pg_get_constraintdef(oid), '\s+', '', 'g')::text collate "C"
    from pg_constraint
    where conname in (
      'case_lab_3_analytics_events_delivery_status_check',
      'case_lab_3_email_deliveries_status_check',
      'case_lab_3_fiscal_operations_status_check',
      'case_lab_3_fiscal_policy_versions_policy_status_check',
      'case_lab_3_jobs_status_check',
      'case_lab_3_orders_email_status_check',
      'case_lab_3_orders_payment_status_check',
      'case_lab_3_orders_receipt_status_check',
      'case_lab_3_orders_ticket_status_check',
      'case_lab_3_payment_attempts_status_check',
      'case_lab_3_refunds_status_check',
      'case_lab_3_reservations_status_check',
      'case_lab_3_tickets_status_check'
    )
    order by conname
  $$,
  $$
    select conname collate "C", definition collate "C"
    from (values
      (
        'case_lab_3_analytics_events_delivery_status_check',
        'CHECK((delivery_status=ANY(ARRAY[''pending''::text,''sent''::text,''failed''::text,''unknown''::text])))'
      ),
      (
        'case_lab_3_email_deliveries_status_check',
        'CHECK((status=ANY(ARRAY[''pending''::text,''sent''::text,''failed''::text,''unknown''::text])))'
      ),
      (
        'case_lab_3_fiscal_operations_status_check',
        'CHECK((status=ANY(ARRAY[''not_requested''::text,''queued''::text,''issued''::text,''error''::text,''unknown''::text])))'
      ),
      (
        'case_lab_3_fiscal_policy_versions_policy_status_check',
        'CHECK((policy_status=ANY(ARRAY[''draft''::text,''approved''::text,''retired''::text])))'
      ),
      (
        'case_lab_3_jobs_status_check',
        'CHECK((status=ANY(ARRAY[''pending''::text,''leased''::text,''completed''::text,''failed''::text,''unknown''::text])))'
      ),
      (
        'case_lab_3_orders_email_status_check',
        'CHECK((email_status=ANY(ARRAY[''pending''::text,''sent''::text,''failed''::text,''unknown''::text])))'
      ),
      (
        'case_lab_3_orders_payment_status_check',
        'CHECK((payment_status=ANY(ARRAY[''pending''::text,''processing''::text,''paid''::text,''failed''::text,''refund_pending''::text,''partially_refunded''::text,''refunded''::text,''review_required''::text])))'
      ),
      (
        'case_lab_3_orders_receipt_status_check',
        'CHECK((receipt_status=ANY(ARRAY[''not_requested''::text,''queued''::text,''issued''::text,''error''::text,''unknown''::text])))'
      ),
      (
        'case_lab_3_orders_ticket_status_check',
        'CHECK((ticket_status=ANY(ARRAY[''pending''::text,''valid''::text,''used''::text,''cancelled''::text])))'
      ),
      (
        'case_lab_3_payment_attempts_status_check',
        'CHECK((status=ANY(ARRAY[''created''::text,''check_approved''::text,''completed''::text,''failed''::text,''review_required''::text])))'
      ),
      (
        'case_lab_3_refunds_status_check',
        'CHECK((status=ANY(ARRAY[''requested''::text,''processing''::text,''confirmed''::text,''failed''::text,''unknown''::text,''review_required''::text])))'
      ),
      (
        'case_lab_3_reservations_status_check',
        'CHECK((status=ANY(ARRAY[''active''::text,''processing''::text,''consumed''::text,''expired''::text,''released''::text])))'
      ),
       (
         'case_lab_3_tickets_status_check',
         'CHECK((status=ANY(ARRAY[''valid''::text,''used''::text,''cancelled''::text])))'
       )
    ) as expected(conname, definition)
    order by conname
  $$,
  'all status constraints expose exactly their supported state sets'
);

select is(
  (
    select count(*)::bigint
    from pg_trigger
    where tgrelid in (
      'public.case_lab_3_fiscal_policy_versions'::regclass,
      'public.case_lab_3_legal_document_versions'::regclass,
      'public.case_lab_3_ticket_revisions'::regclass,
      'public.case_lab_3_audit_log'::regclass
    )
      and not tgisinternal
      and tgname like 'case_lab_3_immutable_%'
  ),
  4::bigint,
  'fiscal policies, legal documents, ticket revisions, and audit records are immutable'
);

select results_eq(
  $$
    select c.conname::text collate "C",
           string_agg(a.attname::text, ',' order by columns.ordinality)::text collate "C"
    from pg_constraint c
    cross join lateral unnest(c.conkey) with ordinality as columns(attnum, ordinality)
    join pg_attribute a
      on a.attrelid = c.conrelid
     and a.attnum = columns.attnum
    where c.conname in (
      'case_lab_3_payment_attempts_reservation_environment_fk',
      'case_lab_3_tickets_current_revision_environment_fk',
      'case_lab_3_email_deliveries_revision_environment_fk'
    )
    group by c.conname
    order by c.conname
  $$,
  $$
    select conname collate "C", columns collate "C"
    from (values
      ('case_lab_3_email_deliveries_revision_environment_fk', 'ticket_revision_id,ticket_id,environment'),
      ('case_lab_3_payment_attempts_reservation_environment_fk', 'reservation_id,order_id,environment'),
       ('case_lab_3_tickets_current_revision_environment_fk', 'id,current_revision_id,environment')
    ) as expected(conname, columns)
    order by conname
  $$,
  'key foreign keys use the exact parent and environment column order'
);

select is(
  (
    select count(*)::bigint
    from pg_class index_class
    join pg_namespace index_namespace on index_namespace.oid = index_class.relnamespace
    where index_namespace.nspname = 'public'
      and index_class.relname in (
        'case_lab_3_payment_attempts_provider_transaction_uidx',
        'case_lab_3_refunds_provider_transaction_uidx',
        'case_lab_3_tickets_uuid_revision_idx',
        'case_lab_3_ticket_revisions_ticket_revision_idx',
        'case_lab_3_orders_environment_status_idx',
        'case_lab_3_reservations_environment_status_idx',
        'case_lab_3_jobs_due_idx'
      )
      and index_class.relkind = 'i'
  ),
  7::bigint,
  'provider, ticket, order, reservation, and job indexes exist'
);

select is(
  (
    select count(*)::bigint
    from pg_constraint
    where contype = 'f'
      and conname = any(array[
        'case_lab_3_settings_fiscal_policy_environment_fk',
        'case_lab_3_settings_offer_environment_fk',
        'case_lab_3_settings_privacy_environment_fk',
        'case_lab_3_inventory_allocations_ticket_environment_fk',
        'case_lab_3_orders_offer_environment_fk',
        'case_lab_3_orders_privacy_environment_fk',
        'case_lab_3_reservations_order_environment_fk',
        'case_lab_3_payment_attempts_order_environment_fk',
        'case_lab_3_payment_attempts_reservation_environment_fk',
        'case_lab_3_provider_events_order_environment_fk',
        'case_lab_3_reservations_admitted_attempt_environment_fk',
        'case_lab_3_provider_events_attempt_environment_fk',
        'case_lab_3_provider_events_refund_environment_fk',
        'case_lab_3_tickets_order_environment_fk',
        'case_lab_3_ticket_revisions_ticket_environment_fk',
        'case_lab_3_tickets_current_revision_environment_fk',
        'case_lab_3_check_ins_ticket_environment_fk',
        'case_lab_3_check_ins_revision_environment_fk',
        'case_lab_3_refunds_order_environment_fk',
        'case_lab_3_refunds_attempt_environment_fk',
        'case_lab_3_fiscal_operations_order_environment_fk',
        'case_lab_3_fiscal_operations_attempt_environment_fk',
        'case_lab_3_fiscal_operations_policy_environment_fk',
        'case_lab_3_fiscal_operations_refund_environment_fk',
        'case_lab_3_provider_events_incident_environment_fk',
        'case_lab_3_incidents_provider_event_environment_fk',
        'case_lab_3_jobs_order_environment_fk',
        'case_lab_3_jobs_ticket_environment_fk',
        'case_lab_3_jobs_refund_environment_fk',
        'case_lab_3_email_deliveries_order_environment_fk',
        'case_lab_3_email_deliveries_ticket_environment_fk',
        'case_lab_3_email_deliveries_revision_environment_fk',
        'case_lab_3_analytics_events_order_environment_fk',
        'case_lab_3_analytics_events_refund_environment_fk',
        'case_lab_3_incidents_order_environment_fk',
        'case_lab_3_incidents_attempt_environment_fk',
        'case_lab_3_incidents_refund_environment_fk'
      ]::text[])
  ),
    37::bigint,
  'order-side foreign keys include environment consistency'
);

select results_eq(
  $$
    select count(*) filter (
             where column_name ~* '(^|_)(qr|manual|check[_]?in)(_|$)'
               and column_name ~* '(^|_)(token|code)(_|$)'
           )::bigint,
           count(distinct table_name)::bigint
    from information_schema.columns
    where table_schema = 'public'
      and table_name like 'case_lab_3_%'
  $$,
  $$ values (0::bigint, 20::bigint) $$,
  'all 20 payment tables are scanned and none stores a clear QR or manual token/code'
);

select lives_ok(
  $$
    update public.case_lab_3_event_settings
    set latest_worker_heartbeat_at = clock_timestamp()
    where environment = 'test'
  $$,
  'worker heartbeat may update without changing configuration_version'
);

select throws_ok(
  $$
    update public.case_lab_3_event_settings
    set configuration_version = configuration_version - 1
    where environment = 'test'
  $$,
  '23514',
  'Case Lab III configuration_version cannot decrease',
  'configuration_version updates are monotonic'
);

select lives_ok(
  $$
    update public.case_lab_3_event_settings
    set sales_enabled = true
    where environment = 'test'
  $$,
  'test sales activation succeeds with complete fiscal and legal configuration'
);

select throws_ok(
  $$
    update public.case_lab_3_event_settings
    set active_offer_version_id = '00000000-0000-4000-8000-000000000401'::uuid,
        sales_enabled = true
    where environment = 'test'
  $$,
  '23514',
  'Case Lab III sales require active offer and privacy versions',
  'sales activation rejects an inactive legal version'
);

select lives_ok(
  $test$
    with policy_definition(definition) as (
      values (
        $policy$[
          {"purpose":"payment_income","trigger":"payment_confirmed","depends_on_purpose":null,"provider_receipt_type":"Income","payload_fields":{"vat":"omitted_or_null","taxation_system":0,"calculation_place":"caselab.kz","calculation_method":"full_payment"},"schedule":"immediate"},
          {"purpose":"refund_income_return","trigger":"refund_confirmed","depends_on_purpose":"payment_income","provider_receipt_type":"IncomeReturn","payload_fields":{"vat":"omitted_or_null","taxation_system":0,"calculation_place":"caselab.kz","calculation_method":"full_payment"},"schedule":"after_dependency","unsupported_feature":true}
        ]$policy$::jsonb
      )
    )
    insert into public.case_lab_3_fiscal_policy_versions (
      id,
      environment,
      version_number,
      policy_key,
      policy_status,
      is_test_policy,
      is_accountant_approved,
      required_purposes,
      policy_definition,
      policy_hash,
      approved_at,
      approved_by
    )
    select
      '00000000-0000-4000-8000-000000000302'::uuid,
      'test',
      2,
      'case-lab-3-test-unsupported',
      'approved',
      true,
      true,
      array['payment_income', 'refund_income_return']::text[],
      definition,
      encode(digest(definition::text, 'sha256'), 'hex'),
      '2026-09-07 00:00:00 Asia/Almaty'::timestamptz,
      'automated-test'
    from policy_definition
  $test$,
  'a hash-valid but structurally unsupported policy can be stored for gate testing'
);

select throws_ok(
  $test$
    update public.case_lab_3_event_settings
    set active_fiscal_policy_version_id = '00000000-0000-4000-8000-000000000302'::uuid,
        sales_enabled = true
    where environment = 'test'
  $test$,
  '23514',
  'Case Lab III sales require an approved complete fiscal policy',
  'sales activation rejects a hash-valid unsupported fiscal policy'
);

select * from finish();
rollback;
