create or replace function public.case_lab_3_sanitize_bounded_text(
  p_text text,
  p_max_length integer
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_max_length integer := least(greatest(coalesce(p_max_length, 256), 1), 2048);
begin
  if p_text is null then
    return null;
  end if;

  return nullif(
    btrim(
      regexp_replace(
        regexp_replace(
          left(p_text, v_max_length),
          '[[:cntrl:]]+', ' ', 'g'
        ),
        '(?i)["'']?(rawbody|cardnumber|cvv|token|opaque-token|secret|password|authorization)["'']?[[:space:]]*[:=][[:space:]]*["'']?[^[:space:],;}"'']+["'']?',
        '[redacted]', 'g'
      )
    ),
    ''
  );
end;
$$;

create or replace function public.case_lab_3_sanitize_provider_fields(
  p_fields jsonb,
  p_context text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_allowed text[];
begin
  if p_fields is null or jsonb_typeof(p_fields) <> 'object' then
    return '{}'::jsonb;
  end if;

  v_allowed := case p_context
    when 'provider' then array[
      'invoiceId', 'accountId', 'transactionId', 'paymentTransactionId', 'refundTransactionId',
      'operationType', 'status', 'failureCode', 'amountMinor', 'currency', 'testMode'
    ]::text[]
    when 'receipt' then array[
      'receiptId', 'kassirReceiptId', 'receiptStatus', 'status', 'type', 'amountMinor',
      'operationKey', 'receiptUrl', 'fiscalDocumentNumber'
    ]::text[]
    when 'conflict' then array[
      'reason', 'providerEventId', 'bodyHash', 'externalId', 'providerTransactionId',
       'paymentProviderTransactionId', 'operationKey', 'amountMinor', 'expectedAmountMinor',
       'actualAmountMinor', 'currency', 'receiptType', 'failureCode',
       'expectedProviderTransactionId', 'actualProviderTransactionId'
    ]::text[]
    else array[]::text[]
  end;

  return coalesce(
    (
       select jsonb_object_agg(
         entry.key,
         case
           when jsonb_typeof(entry.value) = 'string'
             then to_jsonb(public.case_lab_3_sanitize_bounded_text(entry.value #>> '{}', 256))
           else entry.value
         end
       )
      from jsonb_each(p_fields) as entry(key, value)
      where entry.key = any(v_allowed)
        and jsonb_typeof(entry.value) in ('string', 'number', 'boolean', 'null')
        and (
          jsonb_typeof(entry.value) <> 'string'
          or length(entry.value #>> '{}') <= 256
        )
    ),
    '{}'::jsonb
  );
end;
$$;

create or replace function public.case_lab_3_sanitize_error_text(
  p_error text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
begin
  return public.case_lab_3_sanitize_bounded_text(p_error, 512);
end;
$$;

create or replace function public.case_lab_3_sanitize_failure_code(
  p_failure_code text
)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_code text;
begin
  v_code := lower(
    regexp_replace(left(btrim(coalesce(p_failure_code, '')), 128), '[^a-z0-9_].*$', '')
  );

  if v_code in (
    'declined', 'late_failure', 'reconciled_failure', 'indeterminate',
    'unknown', 'timeout', 'provider_timeout', 'failed', 'provider_declined'
  ) then
    return v_code;
  end if;

  return 'unknown';
end;
$$;

create or replace function public.case_lab_3_record_provider_conflict(
  p_environment text,
  p_incident_type text,
  p_order_id uuid,
  p_payment_attempt_id uuid,
  p_refund_id uuid,
  p_summary jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_incident_id uuid;
  v_safe_summary jsonb;
begin
  if p_environment is null
     or p_environment not in ('test', 'live')
     or p_incident_type not in (
       'unexpected_payment', 'unknown_provider_result', 'overdue_receipt',
       'overdue_email', 'reconciliation_mismatch'
     )
     or p_summary is null
     or jsonb_typeof(p_summary) <> 'object' then
      raise exception 'invalid provider conflict input'
      using errcode = '22023';
  end if;

  v_safe_summary := public.case_lab_3_sanitize_provider_fields(p_summary, 'conflict');

  select id
  into v_incident_id
  from public.case_lab_3_incidents
  where environment = p_environment
    and incident_type = p_incident_type
    and order_id is not distinct from p_order_id
    and payment_attempt_id is not distinct from p_payment_attempt_id
    and refund_id is not distinct from p_refund_id
    and summary = v_safe_summary
  for update;

  if found then
    return v_incident_id;
  end if;

  insert into public.case_lab_3_incidents (
    environment, incident_type, order_id, payment_attempt_id, refund_id, summary
  )
  values (
    p_environment,
    p_incident_type,
    p_order_id,
    p_payment_attempt_id,
    p_refund_id,
    v_safe_summary
  )
  returning id into v_incident_id;

  if p_incident_type = 'unexpected_payment' then
    insert into public.case_lab_3_jobs (
      environment, job_type, logical_key, payload_reference, order_id
    )
    values (
      p_environment,
      'send_organizer_alert',
      'organizer-alert:incident:' || v_incident_id,
      jsonb_build_object('incidentId', v_incident_id),
      p_order_id
    )
    on conflict (environment, logical_key) do nothing;
  end if;

  return v_incident_id;
end;
$$;

create or replace function public.case_lab_3_record_provider_event_conflict(
  p_environment text,
  p_provider text,
  p_event_type text,
  p_provider_event_id text,
  p_external_id text,
  p_provider_transaction_id text,
  p_order_id uuid,
  p_payment_attempt_id uuid,
  p_refund_id uuid,
  p_body_hash text,
  p_sanitized_fields jsonb,
  p_incident_type text,
  p_incident_summary jsonb,
  p_processing_result text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_existing public.case_lab_3_provider_events%rowtype;
  v_settings public.case_lab_3_event_settings%rowtype;
  v_event_id uuid;
  v_incident_id uuid;
  v_safe_fields jsonb;
begin
  p_processing_result := nullif(btrim(p_processing_result), '');
  if p_environment is null
     or p_environment not in ('test', 'live')
     or p_provider not in ('tiptoppay', 'kassir')
     or p_event_type not in ('Pay', 'Fail', 'Refund')
       or p_provider_event_id is null
       or length(btrim(p_provider_event_id)) = 0
       or length(p_provider_event_id) > 256
       or p_provider_event_id ~ '[[:cntrl:]]'
       or p_external_id is null
       or length(btrim(p_external_id)) = 0
       or length(p_external_id) > 256
       or p_external_id ~ '[[:cntrl:]]'
       or p_provider_transaction_id is null and p_event_type in ('Pay', 'Refund')
       or p_provider_transaction_id is not null
          and (
            length(btrim(p_provider_transaction_id)) = 0
            or length(p_provider_transaction_id) > 256
            or p_provider_transaction_id ~ '[[:cntrl:]]'
          )
     or p_body_hash is null
     or p_body_hash !~ '^[0-9a-f]{64}$'
     or p_sanitized_fields is null
     or jsonb_typeof(p_sanitized_fields) <> 'object'
     or p_incident_type not in (
       'unexpected_payment', 'unknown_provider_result', 'overdue_receipt',
       'overdue_email', 'reconciliation_mismatch'
     )
     or p_incident_summary is null
     or jsonb_typeof(p_incident_summary) <> 'object'
      or p_processing_result is null
      or length(p_processing_result) > 64
      or p_processing_result ~ '[[:cntrl:]]' then
    raise exception 'invalid provider event conflict input'
      using errcode = '22023';
  end if;

  v_safe_fields := public.case_lab_3_sanitize_provider_fields(p_sanitized_fields, 'provider');

  perform pg_advisory_xact_lock(
    hashtextextended('case_lab_3:provider:' || p_environment, 0)
  );

  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = p_environment
  for update;

  select *
  into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and provider_event_id = p_provider_event_id
  for update;

  if found then
    if v_existing.body_hash = p_body_hash
       and v_existing.event_type = p_event_type
       and v_existing.external_id = p_external_id
       and v_existing.provider_transaction_id is not distinct from p_provider_transaction_id
       and v_existing.order_id is not distinct from p_order_id
       and v_existing.payment_attempt_id is not distinct from p_payment_attempt_id
       and v_existing.refund_id is not distinct from p_refund_id then
      return jsonb_build_object(
        'kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id,
        'incidentId', v_existing.incident_id
      );
    end if;

    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, p_incident_type, p_order_id, p_payment_attempt_id, p_refund_id,
      p_incident_summary
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  select *
  into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and body_hash = p_body_hash
  for update;

  if found then
    if v_existing.event_type = p_event_type
       and v_existing.external_id = p_external_id
       and v_existing.provider_transaction_id is not distinct from p_provider_transaction_id
       and v_existing.order_id is not distinct from p_order_id
       and v_existing.payment_attempt_id is not distinct from p_payment_attempt_id
       and v_existing.refund_id is not distinct from p_refund_id then
      return jsonb_build_object(
        'kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id,
        'incidentId', v_existing.incident_id
      );
    end if;

    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, p_incident_type, p_order_id, p_payment_attempt_id, p_refund_id,
      p_incident_summary
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  insert into public.case_lab_3_provider_events (
    environment, provider, event_type, provider_event_id, external_id,
    provider_transaction_id, order_id, payment_attempt_id, refund_id,
    body_hash, verified_at, sanitized_fields, processing_result
  )
  values (
    p_environment, p_provider, p_event_type, p_provider_event_id, p_external_id,
    p_provider_transaction_id, p_order_id, p_payment_attempt_id, p_refund_id,
    p_body_hash, clock_timestamp(), v_safe_fields, p_processing_result
  )
  returning id into v_event_id;

  v_incident_id := public.case_lab_3_record_provider_conflict(
    p_environment, p_incident_type, p_order_id, p_payment_attempt_id, p_refund_id,
    p_incident_summary
  );

  update public.case_lab_3_provider_events
  set incident_id = v_incident_id
  where id = v_event_id;

  return jsonb_build_object(
    'kind', 'review_required', 'eventId', v_event_id, 'incidentId', v_incident_id
  );
end;
$$;

create or replace function public.case_lab_3_apply_check(
  p_environment text,
  p_provider text,
  p_provider_event_id text,
  p_body_hash text,
  p_external_id text,
  p_amount_minor bigint,
  p_currency text,
  p_sanitized_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_existing public.case_lab_3_provider_events%rowtype;
  v_event_id uuid;
  v_settings public.case_lab_3_event_settings%rowtype;
  v_attempt public.case_lab_3_payment_attempts%rowtype;
  v_order public.case_lab_3_orders%rowtype;
  v_reservation public.case_lab_3_reservations%rowtype;
  v_safe_fields jsonb;
  v_incident_id uuid;
  v_result text;
  v_code integer;
begin
  if p_environment is null
      or p_environment not in ('test', 'live')
      or p_provider <> 'tiptoppay'
      or p_provider_event_id is null
      or length(btrim(p_provider_event_id)) = 0
      or length(p_provider_event_id) > 256
      or p_provider_event_id ~ '[[:cntrl:]]'
      or p_body_hash is null
      or p_body_hash !~ '^[0-9a-f]{64}$'
      or p_external_id is null
      or length(btrim(p_external_id)) = 0
      or length(p_external_id) > 256
      or p_external_id ~ '[[:cntrl:]]'
      or p_amount_minor is null
     or p_amount_minor < 0
     or p_currency <> 'KZT'
     or p_sanitized_fields is null
     or jsonb_typeof(p_sanitized_fields) <> 'object' then
    raise exception 'invalid provider Check input'
      using errcode = '22023';
  end if;

  v_safe_fields := public.case_lab_3_sanitize_provider_fields(p_sanitized_fields, 'provider');

  perform pg_advisory_xact_lock(
    hashtextextended('case_lab_3:provider:' || p_environment, 0)
  );

  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = p_environment
  for update;

  select *
  into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and provider_event_id = p_provider_event_id
  for update;

  if found then
    if v_existing.body_hash = p_body_hash
       and v_existing.event_type = 'Check'
       and v_existing.external_id = p_external_id then
      return jsonb_build_object(
        'kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id,
        'result', v_existing.processing_result
      );
    end if;

    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, 'unknown_provider_result', null, null, null,
      jsonb_build_object(
        'reason', 'provider_event_identity_conflict',
        'providerEventId', p_provider_event_id,
        'bodyHash', p_body_hash,
        'externalId', p_external_id
      )
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  select *
  into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and body_hash = p_body_hash
  for update;

  if found then
    if v_existing.event_type = 'Check'
       and v_existing.external_id = p_external_id then
      return jsonb_build_object(
        'kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id,
        'result', v_existing.processing_result
      );
    end if;

    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, 'unknown_provider_result', null, null, null,
      jsonb_build_object(
        'reason', 'provider_body_identity_conflict',
        'providerEventId', p_provider_event_id,
        'bodyHash', p_body_hash,
        'externalId', p_external_id
      )
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  select *
  into v_attempt
  from public.case_lab_3_payment_attempts
  where environment = p_environment
    and external_id = p_external_id
  ;

  if not found then
    insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id, external_id,
      body_hash, verified_at, sanitized_fields, processing_result
    )
    values (
      p_environment, p_provider, 'Check', p_provider_event_id, p_external_id,
      p_body_hash, clock_timestamp(), v_safe_fields, 'rejected_unknown_attempt'
    )
    returning id into v_event_id;

    return jsonb_build_object('kind', 'rejected', 'code', 10, 'eventId', v_event_id);
  end if;

  select *
  into strict v_order
  from public.case_lab_3_orders
  where id = v_attempt.order_id
    and environment = p_environment
  for update;

  select *
  into strict v_reservation
  from public.case_lab_3_reservations
  where id = v_attempt.reservation_id
    and order_id = v_attempt.order_id
   and environment = p_environment
  for update;

  select *
  into strict v_attempt
  from public.case_lab_3_payment_attempts
  where id = v_attempt.id
    and environment = p_environment
    and external_id = p_external_id
  for update;

  if jsonb_typeof(p_sanitized_fields->'testMode') <> 'boolean'
     or (p_sanitized_fields->>'testMode')::boolean is distinct from (p_environment = 'test')
     or p_sanitized_fields->>'invoiceId' is distinct from p_external_id
     or p_sanitized_fields->>'accountId' is distinct from v_order.id::text then
    v_result := 'rejected_provider_metadata';
    v_code := 20;
  elsif not v_settings.sales_enabled
     or clock_timestamp() >= v_settings.sales_cutoff then
    v_result := 'rejected_sales_closed';
    v_code := 20;
  elsif p_amount_minor <> v_attempt.amount_minor
     or p_currency <> v_attempt.currency then
    v_result := 'rejected_amount_or_currency';
    v_code := 11;
  elsif v_attempt.status in ('completed', 'failed')
     or v_order.payment_status in ('paid', 'failed', 'refund_pending', 'partially_refunded', 'refunded') then
    v_result := 'rejected_terminal_state';
    v_code := 12;
  elsif v_attempt.status = 'review_required'
     or v_order.payment_status = 'review_required' then
    v_result := 'rejected_review_required';
    v_code := 20;
  elsif exists (
    select 1
    from public.case_lab_3_payment_attempts competing
    where competing.order_id = v_order.id
      and competing.environment = p_environment
      and competing.id <> v_attempt.id
      and competing.status in ('check_approved', 'completed', 'review_required')
  ) then
    v_result := 'rejected_competing_attempt';
    v_code := 13;
  elsif v_attempt.status = 'check_approved' then
    v_result := 'accepted';
    v_code := 0;
  elsif v_attempt.status <> 'created'
     or v_order.payment_status <> 'pending'
     or v_reservation.status <> 'active'
     or v_reservation.expires_at <= clock_timestamp() then
    v_result := 'rejected_reservation';
    v_code := 20;
  else
    update public.case_lab_3_payment_attempts
    set status = 'check_approved',
        check_approved_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where id = v_attempt.id
      and order_id = v_order.id
      and environment = p_environment;

    update public.case_lab_3_orders
    set payment_status = 'processing', updated_at = clock_timestamp()
    where id = v_order.id and environment = p_environment;

    update public.case_lab_3_reservations
    set status = 'processing',
        admitted_payment_attempt_id = v_attempt.id,
        updated_at = clock_timestamp()
    where id = v_reservation.id and order_id = v_order.id and environment = p_environment;

    v_result := 'accepted';
    v_code := 0;
  end if;

  insert into public.case_lab_3_provider_events (
    environment, provider, event_type, provider_event_id, external_id,
    order_id, payment_attempt_id, body_hash, verified_at, sanitized_fields,
    processing_result
  )
  values (
    p_environment, p_provider, 'Check', p_provider_event_id, p_external_id,
    v_order.id, v_attempt.id, p_body_hash, clock_timestamp(), v_safe_fields,
    v_result
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'kind', case when v_code = 0 then 'accepted' else 'rejected' end,
    'code', v_code,
    'eventId', v_event_id,
    'result', v_result,
    'attemptId', v_attempt.id
  );
end;
$$;

create or replace function public.case_lab_3_apply_pay(
  p_environment text,
  p_provider text,
  p_provider_event_id text,
  p_body_hash text,
  p_external_id text,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_currency text,
  p_sanitized_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_existing public.case_lab_3_provider_events%rowtype;
  v_event_id uuid;
  v_incident_id uuid;
  v_settings public.case_lab_3_event_settings%rowtype;
  v_attempt public.case_lab_3_payment_attempts%rowtype;
  v_conflicting_attempt public.case_lab_3_payment_attempts%rowtype;
  v_order public.case_lab_3_orders%rowtype;
  v_reservation public.case_lab_3_reservations%rowtype;
  v_ticket public.case_lab_3_tickets%rowtype;
  v_revision_id uuid;
  v_revision_number integer;
  v_policy_id uuid;
  v_fiscal_key text;
  v_email_key text;
  v_job_key text;
  v_purchase_key text;
  v_snapshot jsonb;
  v_receipt_event public.case_lab_3_provider_events%rowtype;
  v_safe_fields jsonb;
  v_conflict_result jsonb;
begin
  if p_environment is null
      or p_environment not in ('test', 'live')
      or p_provider <> 'tiptoppay'
      or p_provider_event_id is null
      or length(btrim(p_provider_event_id)) = 0
      or length(p_provider_event_id) > 256
      or p_provider_event_id ~ '[[:cntrl:]]'
      or p_body_hash is null
      or p_body_hash !~ '^[0-9a-f]{64}$'
      or p_external_id is null
      or length(btrim(p_external_id)) = 0
      or length(p_external_id) > 256
      or p_external_id ~ '[[:cntrl:]]'
      or p_provider_transaction_id is null
      or length(btrim(p_provider_transaction_id)) = 0
      or length(p_provider_transaction_id) > 256
      or p_provider_transaction_id ~ '[[:cntrl:]]'
      or p_amount_minor is null
     or p_amount_minor < 0
     or p_currency <> 'KZT'
     or p_sanitized_fields is null
     or jsonb_typeof(p_sanitized_fields) <> 'object' then
    raise exception 'invalid provider Pay input'
      using errcode = '22023';
  end if;

  v_safe_fields := public.case_lab_3_sanitize_provider_fields(p_sanitized_fields, 'provider');

  perform pg_advisory_xact_lock(
    hashtextextended('case_lab_3:provider:' || p_environment, 0)
  );

  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = p_environment
  for update;

  select *
  into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and provider_event_id = p_provider_event_id
  for update;

  if found then
    if v_existing.body_hash = p_body_hash
       and v_existing.event_type = 'Pay'
       and v_existing.external_id = p_external_id
       and v_existing.provider_transaction_id = p_provider_transaction_id then
      return jsonb_build_object(
        'kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id,
        'result', v_existing.processing_result
      );
    end if;

    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, 'unknown_provider_result', null, null, null,
      jsonb_build_object(
        'reason', 'provider_event_identity_conflict',
        'providerEventId', p_provider_event_id,
        'bodyHash', p_body_hash,
        'externalId', p_external_id,
        'providerTransactionId', p_provider_transaction_id
      )
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  select *
  into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and body_hash = p_body_hash
  for update;

  if found then
    if v_existing.event_type = 'Pay'
       and v_existing.external_id = p_external_id
       and v_existing.provider_transaction_id = p_provider_transaction_id then
      return jsonb_build_object(
        'kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id,
        'result', v_existing.processing_result
      );
    end if;

    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, 'unknown_provider_result', null, null, null,
      jsonb_build_object(
        'reason', 'provider_body_identity_conflict',
        'providerEventId', p_provider_event_id,
        'bodyHash', p_body_hash,
        'externalId', p_external_id,
        'providerTransactionId', p_provider_transaction_id
      )
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  select *
  into v_attempt
  from public.case_lab_3_payment_attempts
  where environment = p_environment
    and external_id = p_external_id
  ;

  if not found then
    insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id, external_id,
      provider_transaction_id, body_hash, verified_at, sanitized_fields,
      processing_result
    )
    values (
      p_environment, p_provider, 'Pay', p_provider_event_id, p_external_id,
      p_provider_transaction_id, p_body_hash, clock_timestamp(), v_safe_fields,
      'unexpected_payment'
    )
    returning id into v_event_id;

    insert into public.case_lab_3_incidents (
      environment, incident_type, order_id, provider_event_id, summary
    )
    values (
      p_environment, 'unexpected_payment', null, v_event_id,
      public.case_lab_3_sanitize_provider_fields(
        jsonb_build_object(
          'reason', 'unknown_attempt',
          'externalId', p_external_id,
          'providerTransactionId', p_provider_transaction_id,
          'amountMinor', p_amount_minor,
          'currency', p_currency
        ), 'conflict'
      )
    )
    returning id into v_incident_id;

    update public.case_lab_3_provider_events
    set incident_id = v_incident_id, processing_result = 'unexpected_payment'
    where id = v_event_id;

    insert into public.case_lab_3_jobs (
      environment, job_type, logical_key, payload_reference
    )
    values (
      p_environment, 'send_organizer_alert', 'organizer-alert:incident:' || v_incident_id,
      jsonb_build_object('incidentId', v_incident_id, 'providerEventId', v_event_id)
    )
    on conflict (environment, logical_key) do nothing;

    return jsonb_build_object(
      'kind', 'review_required', 'incidentId', v_incident_id, 'eventId', v_event_id
    );
  end if;

  select *
  into strict v_order
  from public.case_lab_3_orders
  where id = v_attempt.order_id and environment = p_environment
  for update;

  select *
  into strict v_reservation
  from public.case_lab_3_reservations
  where id = v_attempt.reservation_id
    and order_id = v_order.id
    and environment = p_environment
  for update;

  select *
  into strict v_attempt
  from public.case_lab_3_payment_attempts
  where id = v_attempt.id
    and environment = p_environment
    and external_id = p_external_id
  for update;

  select *
  into v_conflicting_attempt
  from public.case_lab_3_payment_attempts
  where environment = p_environment
    and provider_transaction_id = p_provider_transaction_id
    and id <> v_attempt.id;

  if found then
    select public.case_lab_3_record_provider_event_conflict(
      p_environment, p_provider, 'Pay', p_provider_event_id, p_external_id,
      p_provider_transaction_id, v_order.id, v_attempt.id, null, p_body_hash,
      v_safe_fields, 'unexpected_payment',
      jsonb_build_object(
        'reason', 'provider_transaction_already_attached',
        'providerTransactionId', p_provider_transaction_id,
        'paymentProviderTransactionId', v_conflicting_attempt.provider_transaction_id
       ), 'unexpected_payment'
    ) into v_conflict_result;

    update public.case_lab_3_payment_attempts
    set status = 'review_required', updated_at = clock_timestamp()
    where id = v_attempt.id and order_id = v_order.id and environment = p_environment;

    update public.case_lab_3_orders
    set payment_status = 'review_required', updated_at = clock_timestamp()
    where id = v_order.id and environment = p_environment;

    update public.case_lab_3_reservations
    set status = 'processing',
        admitted_payment_attempt_id = v_attempt.id,
        updated_at = clock_timestamp()
    where id = v_reservation.id and order_id = v_order.id and environment = p_environment;

    return v_conflict_result;
  end if;

  if v_attempt.status = 'completed'
     and v_attempt.provider_transaction_id = p_provider_transaction_id
     and p_amount_minor = v_attempt.amount_minor
     and p_currency = v_attempt.currency then
    insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id, external_id,
      provider_transaction_id, order_id, payment_attempt_id, body_hash,
      verified_at, sanitized_fields, processing_result
    )
    values (
      p_environment, p_provider, 'Pay', p_provider_event_id, p_external_id,
      p_provider_transaction_id, v_order.id, v_attempt.id, p_body_hash,
      clock_timestamp(), v_safe_fields, 'accepted_duplicate_state'
    )
    returning id into v_event_id;

    return jsonb_build_object(
      'kind', 'accepted', 'duplicate', true, 'eventId', v_event_id,
      'attemptId', v_attempt.id, 'orderId', v_order.id
    );
  elsif p_amount_minor <> v_attempt.amount_minor
     or p_currency <> v_attempt.currency
     or v_attempt.status = 'failed'
     or v_order.payment_status in ('paid', 'refund_pending', 'partially_refunded', 'refunded')
     or (
       (
         v_reservation.status in ('expired', 'released')
         or v_reservation.expires_at <= clock_timestamp()
       )
       and not (
         v_attempt.status in ('check_approved', 'review_required')
         and v_reservation.status = 'processing'
         and v_reservation.admitted_payment_attempt_id = v_attempt.id
       )
     ) then
    insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id, external_id,
      provider_transaction_id, order_id, payment_attempt_id, body_hash,
      verified_at, sanitized_fields, processing_result
    )
    values (
      p_environment, p_provider, 'Pay', p_provider_event_id, p_external_id,
      p_provider_transaction_id, v_order.id, v_attempt.id, p_body_hash,
      clock_timestamp(), v_safe_fields, 'unexpected_payment'
    )
    returning id into v_event_id;

    insert into public.case_lab_3_incidents (
      environment, incident_type, order_id, payment_attempt_id, provider_event_id, summary
    )
    values (
      p_environment, 'unexpected_payment', v_order.id, v_attempt.id, v_event_id,
      public.case_lab_3_sanitize_provider_fields(
        jsonb_build_object(
          'reason', case
            when p_amount_minor <> v_attempt.amount_minor then 'amount_mismatch'
            when p_currency <> v_attempt.currency then 'currency_mismatch'
            when v_attempt.status = 'failed' then 'attempt_already_failed'
            when v_order.payment_status in ('paid', 'refund_pending', 'partially_refunded', 'refunded') then 'second_capture'
            else 'reservation_unavailable'
          end,
          'providerTransactionId', p_provider_transaction_id,
          'amountMinor', p_amount_minor,
          'currency', p_currency
        ), 'conflict'
      )
    )
    returning id into v_incident_id;

    update public.case_lab_3_provider_events
    set incident_id = v_incident_id
    where id = v_event_id;

    insert into public.case_lab_3_jobs (
      environment, job_type, logical_key, payload_reference, order_id
    )
    values (
      p_environment, 'send_organizer_alert', 'organizer-alert:incident:' || v_incident_id,
      jsonb_build_object('incidentId', v_incident_id, 'providerEventId', v_event_id), v_order.id
    )
    on conflict (environment, logical_key) do nothing;

    return jsonb_build_object(
      'kind', 'review_required', 'incidentId', v_incident_id, 'eventId', v_event_id
    );
  end if;

  update public.case_lab_3_payment_attempts
  set status = 'completed',
      provider_transaction_id = p_provider_transaction_id,
      completed_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = v_attempt.id and order_id = v_order.id and environment = p_environment;

  update public.case_lab_3_orders
  set payment_status = 'paid',
      paid_amount_minor = v_attempt.amount_minor,
      refundable_amount_minor = v_attempt.amount_minor,
      paid_at = coalesce(paid_at, clock_timestamp()),
      updated_at = clock_timestamp()
  where id = v_order.id and environment = p_environment;

  update public.case_lab_3_reservations
  set status = 'consumed',
      admitted_payment_attempt_id = v_attempt.id,
      updated_at = clock_timestamp()
  where id = v_reservation.id and order_id = v_order.id and environment = p_environment;

  select *
  into v_ticket
  from public.case_lab_3_tickets
  where order_id = v_order.id and environment = p_environment
  for update;

  if not found then
    insert into public.case_lab_3_tickets (
      order_id, environment, public_ticket_number, status
    )
    values (
      v_order.id,
      p_environment,
      'CL3-TICKET-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
      'valid'
    )
    returning * into v_ticket;

    select coalesce(max(revision_number), 0) + 1
    into v_revision_number
    from public.case_lab_3_ticket_revisions
    where ticket_id = v_ticket.id and environment = p_environment;

    insert into public.case_lab_3_ticket_revisions (
      ticket_id, environment, revision_number, first_name, last_name,
      participant_email, phone, company, position, token_version, creation_reason
    )
    values (
      v_ticket.id, p_environment, v_revision_number, v_order.first_name, v_order.last_name,
      v_order.participant_email, v_order.phone, v_order.company, v_order.position,
      1, 'payment_confirmed'
    )
    returning id into v_revision_id;

    update public.case_lab_3_tickets
    set current_revision_id = v_revision_id, updated_at = clock_timestamp()
    where id = v_ticket.id and order_id = v_order.id and environment = p_environment;
  else
    v_revision_id := v_ticket.current_revision_id;
  end if;

  select active_fiscal_policy_version_id
  into v_policy_id
  from public.case_lab_3_event_settings
  where environment = p_environment;

  if v_policy_id is null then
    raise exception 'fiscal policy is not configured'
      using errcode = '55000';
  end if;

  v_snapshot := jsonb_build_object(
    'type', 'Income',
    'invoiceId', v_order.order_number,
    'accountId', v_order.id,
    'item', jsonb_build_object(
      'name', v_order.receipt_label,
      'priceMinor', v_order.amount_minor,
      'amountMinor', v_order.amount_minor,
      'quantity', 1
    ),
    'taxationSystem', v_order.taxation_system,
    'vatRate', v_order.vat_rate,
    'calculationPlace', 'caselab.kz',
    'calculationMethod', 'full_payment'
  );
  v_fiscal_key := 'fiscal:payment_income:' || p_provider_transaction_id;
  v_email_key := 'email:ticket:' || v_ticket.id || ':' || v_revision_id;
  v_job_key := 'ticket:' || v_order.id;
  v_purchase_key := 'ga4:purchase:' || v_order.id;

  insert into public.case_lab_3_fiscal_operations (
    environment, order_id, payment_attempt_id, fiscal_policy_version_id,
    policy_purpose, provider_receipt_type, amount_minor, payload_snapshot,
    request_hash, operation_key, status
  )
  values (
    p_environment, v_order.id, v_attempt.id, v_policy_id,
    'payment_income', 'Income', v_order.amount_minor, v_snapshot,
    encode(digest(v_snapshot::text, 'sha256'), 'hex'), v_fiscal_key, 'not_requested'
  )
  on conflict (environment, operation_key) do nothing;

  insert into public.case_lab_3_jobs (
    environment, job_type, logical_key, payload_reference, order_id
  )
  values (
    p_environment, 'issue_fiscal_operation', 'job:' || v_fiscal_key,
    jsonb_build_object('operationKey', v_fiscal_key, 'purpose', 'payment_income'), v_order.id
  )
  on conflict (environment, logical_key) do nothing;

  insert into public.case_lab_3_email_deliveries (
    environment, operation_key, delivery_kind, order_id, ticket_id,
    ticket_revision_id, recipient_email, status
  )
  values (
    p_environment, v_email_key, 'ticket', v_order.id, v_ticket.id,
    v_revision_id, v_order.participant_email, 'pending'
  )
  on conflict (environment, operation_key) do nothing;

  insert into public.case_lab_3_jobs (
    environment, job_type, logical_key, payload_reference, order_id, ticket_id
  )
  values (
    p_environment, 'send_ticket_email', v_job_key,
    jsonb_build_object('operationKey', v_email_key, 'ticketId', v_ticket.id),
    v_order.id, v_ticket.id
  )
  on conflict (environment, logical_key) do nothing;

  insert into public.case_lab_3_analytics_events (
    environment, event_key, event_name, order_id, ga_client_id,
    payload_snapshot, delivery_status
  )
  values (
    p_environment, v_purchase_key, 'purchase', v_order.id, v_order.ga_client_id,
    jsonb_build_object(
      'transactionId', v_order.order_number,
      'valueMinor', v_order.amount_minor,
      'currency', 'KZT'
    ), 'pending'
  )
  on conflict (environment, event_key) do nothing;

  insert into public.case_lab_3_jobs (
    environment, job_type, logical_key, payload_reference, order_id
  )
  values (
    p_environment, 'send_analytics_event', 'job:' || v_purchase_key,
    jsonb_build_object('eventKey', v_purchase_key, 'eventName', 'purchase'), v_order.id
  )
  on conflict (environment, logical_key) do nothing;

  update public.case_lab_3_orders
  set ticket_status = 'valid', receipt_status = 'queued', email_status = 'pending',
      updated_at = clock_timestamp()
  where id = v_order.id and environment = p_environment;

  select *
  into v_receipt_event
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = 'kassir'
    and event_type = 'Receipt'
    and order_id = v_order.id
    and refund_id is null
    and sanitized_fields->>'receiptType' = 'Income'
    and (
      sanitized_fields->>'operationKey' = v_fiscal_key
      or (
        sanitized_fields->>'operationKey' is null
        and external_id = sanitized_fields->>'kassirReceiptId'
        and sanitized_fields->>'receiptType' = 'Income'
      )
    )
    and (sanitized_fields->>'amountMinor')::bigint = v_order.amount_minor
  order by created_at
  limit 1
  for update;

  if found then
    update public.case_lab_3_fiscal_operations
    set status = case
          when lower(v_receipt_event.sanitized_fields->>'receiptStatus') in ('processed', 'issued') then 'issued'
          when lower(v_receipt_event.sanitized_fields->>'receiptStatus') = 'error' then 'error'
          else 'queued'
         end,
         kassir_receipt_id = v_receipt_event.sanitized_fields->>'kassirReceiptId',
         receipt_url = v_receipt_event.sanitized_fields->>'receiptUrl',
         fiscal_fields = coalesce(
           v_receipt_event.sanitized_fields->'fiscalFields',
           public.case_lab_3_sanitize_provider_fields(v_receipt_event.sanitized_fields, 'receipt')
         ),
         issued_at = case
          when lower(v_receipt_event.sanitized_fields->>'receiptStatus') in ('processed', 'issued')
            then coalesce(issued_at, clock_timestamp())
          else issued_at
        end,
        updated_at = clock_timestamp()
    where environment = p_environment and operation_key = v_fiscal_key;

    update public.case_lab_3_provider_events
    set order_id = v_order.id,
        payment_attempt_id = v_attempt.id,
        sanitized_fields = sanitized_fields || jsonb_build_object('operationKey', v_fiscal_key),
        processing_result = 'matched_early'
    where id = v_receipt_event.id;

    update public.case_lab_3_orders
    set receipt_status = case
          when lower(v_receipt_event.sanitized_fields->>'receiptStatus') in ('processed', 'issued') then 'issued'
          when lower(v_receipt_event.sanitized_fields->>'receiptStatus') = 'error' then 'error'
          else 'queued'
        end,
        updated_at = clock_timestamp()
    where id = v_order.id and environment = p_environment;
  end if;

  insert into public.case_lab_3_provider_events (
    environment, provider, event_type, provider_event_id, external_id,
    provider_transaction_id, order_id, payment_attempt_id, body_hash,
    verified_at, sanitized_fields, processing_result
  )
  values (
    p_environment, p_provider, 'Pay', p_provider_event_id, p_external_id,
    p_provider_transaction_id, v_order.id, v_attempt.id, p_body_hash,
    clock_timestamp(), v_safe_fields, 'accepted'
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'kind', 'accepted',
    'eventId', v_event_id,
    'attemptId', v_attempt.id,
    'orderId', v_order.id,
    'ticketId', v_ticket.id,
    'revisionId', v_revision_id,
    'ticketNumber', v_ticket.public_ticket_number
  );
end;
$$;

create or replace function public.case_lab_3_apply_fail(
  p_environment text,
  p_provider text,
  p_provider_event_id text,
  p_body_hash text,
  p_external_id text,
  p_failure_code text,
  p_failure_reason text,
  p_sanitized_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_existing public.case_lab_3_provider_events%rowtype;
  v_settings public.case_lab_3_event_settings%rowtype;
  v_attempt public.case_lab_3_payment_attempts%rowtype;
  v_order public.case_lab_3_orders%rowtype;
  v_reservation public.case_lab_3_reservations%rowtype;
  v_event_id uuid;
  v_incident_id uuid;
  v_result text;
  v_reconcile boolean;
  v_incident_type text;
  v_safe_fields jsonb;
  v_conflict_result jsonb;
  v_failure_code text;
begin
  if p_environment is null
      or p_environment not in ('test', 'live')
      or p_provider <> 'tiptoppay'
      or p_provider_event_id is null
      or length(btrim(p_provider_event_id)) = 0
      or length(p_provider_event_id) > 256
      or p_provider_event_id ~ '[[:cntrl:]]'
      or p_body_hash is null
      or p_body_hash !~ '^[0-9a-f]{64}$'
      or p_external_id is null
      or length(btrim(p_external_id)) = 0
      or length(p_external_id) > 256
      or p_external_id ~ '[[:cntrl:]]'
      or p_failure_code is null
     or p_sanitized_fields is null
     or jsonb_typeof(p_sanitized_fields) <> 'object' then
    raise exception 'invalid provider Fail input'
      using errcode = '22023';
  end if;

  v_failure_code := public.case_lab_3_sanitize_failure_code(p_failure_code);
  v_safe_fields := public.case_lab_3_sanitize_provider_fields(p_sanitized_fields, 'provider');

  perform pg_advisory_xact_lock(
    hashtextextended('case_lab_3:provider:' || p_environment, 0)
  );

  select *
  into strict v_settings
  from public.case_lab_3_event_settings
  where environment = p_environment
  for update;

  select *
  into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and provider_event_id = p_provider_event_id
  for update;

  if found then
    if v_existing.body_hash = p_body_hash
       and v_existing.event_type = 'Fail'
       and v_existing.external_id = p_external_id then
      return jsonb_build_object('kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id);
    end if;
    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, 'unknown_provider_result', null, null, null,
      jsonb_build_object(
        'reason', 'provider_event_identity_conflict',
        'providerEventId', p_provider_event_id,
        'bodyHash', p_body_hash,
        'externalId', p_external_id
      )
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  select *
  into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and body_hash = p_body_hash
  for update;

  if found then
    if v_existing.event_type = 'Fail' and v_existing.external_id = p_external_id then
      return jsonb_build_object('kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id);
    end if;
    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, 'unknown_provider_result', null, null, null,
      jsonb_build_object(
        'reason', 'provider_body_identity_conflict',
        'providerEventId', p_provider_event_id,
        'bodyHash', p_body_hash,
        'externalId', p_external_id
      )
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  select *
  into v_attempt
  from public.case_lab_3_payment_attempts
  where environment = p_environment and external_id = p_external_id
  ;

  if not found then
    insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id, external_id,
      body_hash, verified_at, sanitized_fields, processing_result
    )
    values (
      p_environment, p_provider, 'Fail', p_provider_event_id, p_external_id,
      p_body_hash, clock_timestamp(), v_safe_fields, 'rejected_unknown_attempt'
    )
    returning id into v_event_id;
    return jsonb_build_object('kind', 'rejected', 'code', 10, 'eventId', v_event_id);
  end if;

  select * into strict v_order
  from public.case_lab_3_orders
  where id = v_attempt.order_id and environment = p_environment
  for update;

  select * into strict v_reservation
  from public.case_lab_3_reservations
  where id = v_attempt.reservation_id
    and order_id = v_order.id
    and environment = p_environment
  for update;

  select *
  into strict v_attempt
  from public.case_lab_3_payment_attempts
  where id = v_attempt.id
    and environment = p_environment
    and external_id = p_external_id
  for update;

  if v_attempt.status = 'failed' or v_order.payment_status = 'failed' then
    v_result := case
      when v_failure_code in ('indeterminate', 'unknown', 'timeout', 'provider_timeout')
        then 'late_failure_conflict'
      else 'late_failure_ignored'
    end;
    v_reconcile := v_failure_code in ('indeterminate', 'unknown', 'timeout', 'provider_timeout');
    v_incident_type := 'unknown_provider_result';
  elsif v_attempt.status = 'completed' or v_order.payment_status in ('paid', 'refund_pending', 'partially_refunded', 'refunded') then
    v_result := 'late_failure_ignored';
    v_reconcile := false;
  elsif v_failure_code in ('indeterminate', 'unknown', 'timeout', 'provider_timeout') then
    update public.case_lab_3_payment_attempts
    set status = 'review_required',
        failure_code = v_failure_code,
        failure_reason = public.case_lab_3_sanitize_error_text(p_failure_reason),
        updated_at = clock_timestamp()
    where id = v_attempt.id and order_id = v_order.id and environment = p_environment;

    update public.case_lab_3_orders
    set payment_status = 'review_required', updated_at = clock_timestamp()
    where id = v_order.id and environment = p_environment;

    update public.case_lab_3_reservations
    set status = 'processing',
        admitted_payment_attempt_id = v_attempt.id,
        updated_at = clock_timestamp()
    where id = v_reservation.id and order_id = v_order.id and environment = p_environment;

    v_result := 'review_required';
    v_reconcile := true;
    v_incident_type := 'unknown_provider_result';
  else
    update public.case_lab_3_payment_attempts
    set status = 'failed',
        failure_code = v_failure_code,
        failure_reason = public.case_lab_3_sanitize_error_text(p_failure_reason),
        updated_at = clock_timestamp()
    where id = v_attempt.id and order_id = v_order.id and environment = p_environment;

    update public.case_lab_3_orders
    set payment_status = 'failed', updated_at = clock_timestamp()
    where id = v_order.id and environment = p_environment;

    update public.case_lab_3_reservations
    set status = case when expires_at > clock_timestamp() then 'active' else 'expired' end,
        admitted_payment_attempt_id = null,
        updated_at = clock_timestamp()
    where id = v_reservation.id and order_id = v_order.id and environment = p_environment;

    v_result := 'failed';
    v_reconcile := false;
  end if;

  if v_reconcile then
    select public.case_lab_3_record_provider_event_conflict(
      p_environment, p_provider, 'Fail', p_provider_event_id, p_external_id,
      null, v_order.id, v_attempt.id, null, p_body_hash, v_safe_fields,
      v_incident_type,
      jsonb_build_object(
        'reason', case when v_result = 'late_failure_conflict'
          then 'terminal_failure_conflict' else 'indeterminate_failure' end
      ), v_result
    ) into v_conflict_result;

    v_event_id := (v_conflict_result->>'eventId')::uuid;
    v_incident_id := (v_conflict_result->>'incidentId')::uuid;

    insert into public.case_lab_3_jobs (
      environment, job_type, logical_key, payload_reference, order_id
    )
    values (
      p_environment, 'reconcile_payment', 'reconcile:payment:' || v_attempt.id,
      jsonb_build_object('attemptId', v_attempt.id, 'incidentId', v_incident_id), v_order.id
    )
    on conflict (environment, logical_key) do nothing;
  else
    insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id, external_id,
      order_id, payment_attempt_id, body_hash, verified_at, sanitized_fields,
      processing_result
    )
    values (
      p_environment, p_provider, 'Fail', p_provider_event_id, p_external_id,
      v_order.id, v_attempt.id, p_body_hash, clock_timestamp(), v_safe_fields,
      v_result
    )
    returning id into v_event_id;
  end if;

  return jsonb_build_object(
    'kind', case when v_result = 'review_required' then 'review_required' else 'accepted' end,
    'result', v_result,
    'eventId', v_event_id,
    'attemptId', v_attempt.id
  );
end;
$$;

create or replace function public.case_lab_3_apply_receipt(
  p_environment text,
  p_provider text,
  p_provider_event_id text,
  p_body_hash text,
  p_kassir_receipt_id text,
  p_operation_key text,
  p_order_id uuid,
  p_refund_id uuid,
  p_receipt_type text,
  p_receipt_status text,
  p_amount_minor bigint,
  p_receipt_url text,
  p_fiscal_fields jsonb,
  p_sanitized_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_existing public.case_lab_3_provider_events%rowtype;
  v_operation public.case_lab_3_fiscal_operations%rowtype;
  v_event_id uuid;
  v_status text;
  v_fields jsonb;
  v_order_id uuid;
  v_refund_id uuid;
  v_order public.case_lab_3_orders%rowtype;
  v_safe_fiscal_fields jsonb;
  v_payment_operation public.case_lab_3_fiscal_operations%rowtype;
  v_pending_receipt public.case_lab_3_provider_events%rowtype;
  v_incident_id uuid;
  v_safe_kassir_receipt_id text;
  v_safe_receipt_url text;
begin
  if p_environment is null
       or p_environment not in ('test', 'live')
       or p_provider <> 'kassir'
       or p_provider_event_id is null
       or length(btrim(p_provider_event_id)) = 0
       or length(p_provider_event_id) > 256
       or p_provider_event_id ~ '[[:cntrl:]]'
       or p_kassir_receipt_id is null
       or length(btrim(p_kassir_receipt_id)) = 0
       or length(p_kassir_receipt_id) > 256
       or p_kassir_receipt_id ~ '[[:cntrl:]]'
       or p_order_id is null
      or p_body_hash is null
     or p_body_hash !~ '^[0-9a-f]{64}$'
      or p_receipt_type not in ('Income', 'IncomeReturn')
      or p_receipt_type = 'Income' and p_refund_id is not null
      or p_receipt_type = 'IncomeReturn' and p_refund_id is null
     or p_receipt_status is null
     or p_amount_minor is null
     or p_amount_minor < 0
     or p_fiscal_fields is null
     or jsonb_typeof(p_fiscal_fields) <> 'object'
     or p_sanitized_fields is null
     or jsonb_typeof(p_sanitized_fields) <> 'object' then
    raise exception 'invalid Kassir Receipt input'
      using errcode = '22023';
  end if;

  p_operation_key := nullif(btrim(p_operation_key), '');
  if p_operation_key is not null
     and (
       length(p_operation_key) > 200
       or p_operation_key ~ '[[:cntrl:]]'
       or p_operation_key ~* '(rawbody|cardnumber|cvv|token|opaque-token|secret|password|authorization)[[:space:]]*[:=]'
     ) then
    raise exception 'invalid Kassir Receipt operation key'
      using errcode = '22023';
  end if;

  v_safe_kassir_receipt_id := btrim(p_kassir_receipt_id);
  v_safe_receipt_url := public.case_lab_3_sanitize_bounded_text(p_receipt_url, 2048);
  if v_safe_kassir_receipt_id is null then
    raise exception 'invalid Kassir Receipt id'
      using errcode = '22023';
  end if;

  v_status := case
    when lower(btrim(left(p_receipt_status, 64))) in ('processed', 'issued') then 'issued'
    when lower(btrim(left(p_receipt_status, 64))) in ('queued', 'accepted') then 'queued'
    when lower(btrim(left(p_receipt_status, 64))) in ('error', 'failed') then 'error'
    else 'unknown'
  end;

  v_safe_fiscal_fields := public.case_lab_3_sanitize_provider_fields(p_fiscal_fields, 'receipt');
  v_fields := public.case_lab_3_sanitize_provider_fields(p_sanitized_fields, 'receipt') || jsonb_build_object(
    'kassirReceiptId', v_safe_kassir_receipt_id,
    'operationKey', p_operation_key,
    'receiptType', p_receipt_type,
    'receiptStatus', v_status,
    'amountMinor', p_amount_minor,
    'receiptUrl', v_safe_receipt_url,
    'fiscalFields', v_safe_fiscal_fields
  );

  perform pg_advisory_xact_lock(
    hashtextextended('case_lab_3:provider:' || p_environment, 0)
  );

  select * into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and provider_event_id = p_provider_event_id
  for update;

  if found then
    if v_existing.body_hash = p_body_hash
       and v_existing.event_type = 'Receipt'
       and v_existing.external_id = v_safe_kassir_receipt_id then
      return jsonb_build_object('kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id);
    end if;
    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, 'unknown_provider_result', p_order_id, null, p_refund_id,
      jsonb_build_object(
        'reason', 'provider_event_identity_conflict',
        'providerEventId', p_provider_event_id,
        'bodyHash', p_body_hash,
         'externalId', v_safe_kassir_receipt_id,
        'receiptType', p_receipt_type,
        'amountMinor', p_amount_minor
      )
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  select * into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and body_hash = p_body_hash
  for update;

  if found then
     if v_existing.event_type = 'Receipt' and v_existing.external_id = v_safe_kassir_receipt_id then
      return jsonb_build_object('kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id);
    end if;
    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, 'unknown_provider_result', p_order_id, null, p_refund_id,
      jsonb_build_object(
        'reason', 'provider_body_identity_conflict',
        'providerEventId', p_provider_event_id,
        'bodyHash', p_body_hash,
         'externalId', v_safe_kassir_receipt_id,
        'receiptType', p_receipt_type,
        'amountMinor', p_amount_minor
      )
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  select *
  into v_operation
  from public.case_lab_3_fiscal_operations
  where environment = p_environment
    and (
      (p_operation_key is not null and operation_key = p_operation_key)
      or (
        p_operation_key is not null
         and kassir_receipt_id = v_safe_kassir_receipt_id
        and order_id = p_order_id
        and refund_id is not distinct from p_refund_id
      )
      or (
        p_operation_key is null
        and
         kassir_receipt_id = v_safe_kassir_receipt_id
        and order_id = p_order_id
        and refund_id is not distinct from p_refund_id
        and provider_receipt_type = p_receipt_type
        and amount_minor = p_amount_minor
      )
    )
  order by case
    when p_operation_key is not null and operation_key = p_operation_key then 1
    when p_operation_key is not null
       and kassir_receipt_id = v_safe_kassir_receipt_id
      and order_id = p_order_id
      and refund_id is not distinct from p_refund_id then 2
    when p_operation_key is null
       and kassir_receipt_id = v_safe_kassir_receipt_id
      and order_id = p_order_id
      and refund_id is not distinct from p_refund_id
      and provider_receipt_type = p_receipt_type
      and amount_minor = p_amount_minor then 2
    else 3
  end, created_at
  limit 1
  for update;

  if found then
    if v_operation.provider_receipt_type <> p_receipt_type
       or v_operation.amount_minor <> p_amount_minor
       or v_operation.order_id is distinct from p_order_id
       or v_operation.refund_id is distinct from p_refund_id
       or (
         v_operation.kassir_receipt_id is not null
          and v_operation.kassir_receipt_id is distinct from v_safe_kassir_receipt_id
       )
       or (
         p_operation_key is not null
         and v_operation.operation_key is distinct from p_operation_key
       ) then
      insert into public.case_lab_3_provider_events (
        environment, provider, event_type, provider_event_id, external_id,
        order_id, refund_id, body_hash, verified_at, sanitized_fields, processing_result
      )
      values (
         p_environment, p_provider, 'Receipt', p_provider_event_id, v_safe_kassir_receipt_id,
        p_order_id, p_refund_id, p_body_hash, clock_timestamp(), v_fields, 'overdue_receipt'
      )
      returning id into v_event_id;

      insert into public.case_lab_3_incidents (
        environment, incident_type, order_id, refund_id, provider_event_id, summary
      )
      values (
        p_environment, 'overdue_receipt', p_order_id, p_refund_id, v_event_id,
        public.case_lab_3_sanitize_provider_fields(
          jsonb_build_object(
            'reason', 'receipt_identity_mismatch',
            'expectedAmountMinor', v_operation.amount_minor,
            'actualAmountMinor', p_amount_minor,
            'receiptType', p_receipt_type,
            'operationKey', p_operation_key
          ), 'conflict'
        )
      )
      returning id into v_incident_id;

      update public.case_lab_3_provider_events
      set incident_id = v_incident_id
      where id = v_event_id;

      return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
    end if;

    v_order_id := v_operation.order_id;
    v_refund_id := v_operation.refund_id;

    select * into v_order
    from public.case_lab_3_orders
    where id = v_order_id and environment = p_environment
    for update;

    if v_operation.policy_purpose = 'refund_income_return' then
      select * into v_payment_operation
      from public.case_lab_3_fiscal_operations
      where environment = p_environment
        and order_id = v_operation.order_id
        and policy_purpose = 'payment_income'
      order by created_at
      limit 1
      for update;

      if not found or v_payment_operation.status <> 'issued' then
        update public.case_lab_3_fiscal_operations
        set status = case when status = 'queued' then 'queued' else 'not_requested' end,
            fiscal_fields = v_safe_fiscal_fields,
            updated_at = clock_timestamp()
        where id = v_operation.id and environment = p_environment;

        insert into public.case_lab_3_provider_events (
          environment, provider, event_type, provider_event_id, external_id,
          order_id, refund_id, body_hash, verified_at, sanitized_fields, processing_result
        )
        values (
           p_environment, p_provider, 'Receipt', p_provider_event_id, v_safe_kassir_receipt_id,
          v_order_id, v_refund_id, p_body_hash, clock_timestamp(), v_fields, 'dependency_pending'
        )
        returning id into v_event_id;

        return jsonb_build_object(
          'kind', 'accepted', 'eventId', v_event_id, 'operationKey', v_operation.operation_key,
          'status', 'not_requested'
        );
      end if;
    end if;

    update public.case_lab_3_fiscal_operations
    set status = case when status = 'issued' then 'issued' else v_status end,
         kassir_receipt_id = v_safe_kassir_receipt_id,
         receipt_url = v_safe_receipt_url,
        fiscal_fields = v_safe_fiscal_fields,
        issued_at = case when (status = 'issued' or v_status = 'issued') then coalesce(issued_at, clock_timestamp()) else issued_at end,
        updated_at = clock_timestamp()
    where id = v_operation.id and environment = p_environment;

    if v_operation.policy_purpose = 'payment_income' then
      update public.case_lab_3_orders
      set receipt_status = case when receipt_status = 'issued' then 'issued' else v_status end,
          updated_at = clock_timestamp()
      where id = v_operation.order_id and environment = p_environment;

      if v_status = 'issued' then
        update public.case_lab_3_fiscal_operations
        set status = 'queued', updated_at = clock_timestamp()
        where environment = p_environment
          and order_id = v_operation.order_id
          and policy_purpose = 'refund_income_return'
          and status = 'not_requested';

        for v_pending_receipt in
          select pe.*
          from public.case_lab_3_provider_events pe
          join public.case_lab_3_fiscal_operations fo
            on fo.environment = pe.environment
           and fo.order_id = pe.order_id
           and fo.refund_id = pe.refund_id
           and fo.policy_purpose = 'refund_income_return'
          where pe.environment = p_environment
            and pe.provider = 'kassir'
            and pe.event_type = 'Receipt'
            and pe.refund_id is not null
            and pe.order_id = v_operation.order_id
            and pe.sanitized_fields->>'receiptType' = 'IncomeReturn'
            and pe.sanitized_fields->>'operationKey' = fo.operation_key
            and (pe.sanitized_fields->>'amountMinor')::bigint = fo.amount_minor
            and pe.processing_result in ('pending_match', 'dependency_pending')
            and lower(pe.sanitized_fields->>'receiptStatus') in ('processed', 'issued')
        loop
          update public.case_lab_3_fiscal_operations fo
          set status = 'issued',
               kassir_receipt_id = v_pending_receipt.external_id,
               receipt_url = v_pending_receipt.sanitized_fields->>'receiptUrl',
               fiscal_fields = coalesce(
                 v_pending_receipt.sanitized_fields->'fiscalFields',
                 public.case_lab_3_sanitize_provider_fields(v_pending_receipt.sanitized_fields, 'receipt')
               ),
              issued_at = coalesce(fo.issued_at, clock_timestamp()),
              updated_at = clock_timestamp()
          where fo.environment = p_environment
            and fo.order_id = v_operation.order_id
             and fo.refund_id = v_pending_receipt.refund_id
             and fo.policy_purpose = 'refund_income_return'
             and fo.status <> 'issued';

           update public.case_lab_3_provider_events
           set processing_result = 'matched_early'
           where id = v_pending_receipt.id and environment = p_environment;
         end loop;
      end if;
    end if;
  else
    insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id, order_id,
      external_id, refund_id, body_hash, verified_at, sanitized_fields, processing_result
    )
    values (
      p_environment, p_provider, 'Receipt', p_provider_event_id, p_order_id,
       v_safe_kassir_receipt_id,
      p_refund_id, p_body_hash, clock_timestamp(), v_fields, 'pending_match'
    )
    returning id into v_event_id;

    return jsonb_build_object(
      'kind', 'accepted', 'pendingMatch', true, 'eventId', v_event_id
    );
  end if;

  select * into v_order
  from public.case_lab_3_orders
  where id = v_order_id and environment = p_environment
  for update;

  insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id, order_id,
      external_id, refund_id, body_hash, verified_at, sanitized_fields, processing_result
  )
  values (
      p_environment, p_provider, 'Receipt', p_provider_event_id, v_order_id,
       v_safe_kassir_receipt_id,
      v_refund_id, p_body_hash, clock_timestamp(), v_fields, 'matched'
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'kind', 'accepted', 'eventId', v_event_id, 'operationKey', v_operation.operation_key,
    'status', v_status
  );
end;
$$;

create or replace function public.case_lab_3_create_refund(
  p_environment text,
  p_order_id uuid,
  p_operation_key text,
  p_amount_minor bigint,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_existing public.case_lab_3_refunds%rowtype;
  v_order public.case_lab_3_orders%rowtype;
  v_refund_id uuid;
  v_attempt_id uuid;
  v_payment_provider_transaction_id text;
  v_confirmed bigint;
  v_pending bigint;
  v_available bigint;
  v_refund_type text;
begin
  p_operation_key := nullif(btrim(p_operation_key), '');
  if p_environment is null
     or p_environment not in ('test', 'live')
     or p_order_id is null
     or p_operation_key is null
      or length(p_operation_key) > 200
      or p_operation_key ~ '[[:cntrl:]]'
      or p_operation_key ~* '(rawbody|cardnumber|cvv|token|opaque-token|secret|password|authorization)[[:space:]]*[:=]'
      or p_amount_minor is null
     or p_amount_minor <= 0 then
    raise exception 'invalid refund input'
      using errcode = '22023';
  end if;

  select * into v_existing
  from public.case_lab_3_refunds
  where environment = p_environment and operation_key = p_operation_key
  for update;

  if found then
    if v_existing.order_id is distinct from p_order_id
       or v_existing.amount_minor <> p_amount_minor
       or v_existing.currency <> 'KZT' then
      raise exception 'refund operation key conflicts with an existing refund'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'kind', 'accepted', 'duplicate', true, 'refundId', v_existing.id,
      'operationKey', v_existing.operation_key, 'status', v_existing.status
    );
  end if;

  select * into strict v_order
  from public.case_lab_3_orders
  where id = p_order_id and environment = p_environment
  for update;

  select * into v_existing
  from public.case_lab_3_refunds
  where environment = p_environment and operation_key = p_operation_key
  for update;

  if found then
    if v_existing.order_id is distinct from p_order_id
       or v_existing.amount_minor <> p_amount_minor
       or v_existing.currency <> 'KZT' then
      raise exception 'refund operation key conflicts with an existing refund'
        using errcode = '23505';
    end if;
    return jsonb_build_object(
      'kind', 'accepted', 'duplicate', true, 'refundId', v_existing.id,
      'operationKey', v_existing.operation_key, 'status', v_existing.status
    );
  end if;

  select coalesce(sum(amount_minor), 0)
  into v_confirmed
  from public.case_lab_3_refunds
  where order_id = v_order.id
    and environment = p_environment
    and status = 'confirmed';

  select coalesce(sum(amount_minor), 0)
  into v_pending
  from public.case_lab_3_refunds
  where order_id = v_order.id
    and environment = p_environment
     and status in ('requested', 'processing', 'unknown', 'review_required');

  v_available := v_order.paid_amount_minor - v_confirmed - v_pending;

  if v_order.paid_amount_minor <= 0
     or p_amount_minor > v_available
     or v_available <= 0
     or v_order.payment_status not in ('paid', 'partially_refunded', 'refund_pending') then
    raise exception 'refund amount exceeds the remaining refundable balance'
      using errcode = '23514';
  end if;

  select id, provider_transaction_id
  into v_attempt_id, v_payment_provider_transaction_id
  from public.case_lab_3_payment_attempts
  where order_id = v_order.id
    and environment = p_environment
    and status = 'completed'
  order by completed_at desc nulls last, created_at desc
  limit 1;

  v_refund_type := case when p_amount_minor = v_available then 'full' else 'partial' end;

  insert into public.case_lab_3_refunds (
    order_id, payment_attempt_id, environment, operation_key,
    payment_provider_transaction_id, refund_type, amount_minor,
    remaining_refundable_amount_minor, currency, status, reason
  )
  values (
    v_order.id, v_attempt_id, p_environment, p_operation_key,
    v_payment_provider_transaction_id, v_refund_type, p_amount_minor,
     p_amount_minor, 'KZT', 'requested', public.case_lab_3_sanitize_error_text(p_reason)
  )
  returning id into v_refund_id;

  update public.case_lab_3_orders
  set payment_status = 'refund_pending',
      refundable_amount_minor = v_available - p_amount_minor,
      updated_at = clock_timestamp()
  where id = v_order.id and environment = p_environment;

  insert into public.case_lab_3_jobs (
    environment, job_type, logical_key, payload_reference, order_id, refund_id
  )
  values (
    p_environment, 'initiate_refund', 'refund:' || p_operation_key,
    jsonb_build_object(
      'refundId', v_refund_id,
      'operationKey', p_operation_key,
      'amountMinor', p_amount_minor,
      'requestId', p_operation_key
    ), v_order.id, v_refund_id
  )
  on conflict (environment, logical_key) do nothing;

  return jsonb_build_object(
    'kind', 'created', 'refundId', v_refund_id, 'operationKey', p_operation_key,
    'refundType', v_refund_type, 'amountMinor', p_amount_minor,
    'remainingRefundableAmountMinor', v_available - p_amount_minor
  );
end;
$$;

create or replace function public.case_lab_3_apply_refund(
  p_environment text,
  p_provider text,
  p_provider_event_id text,
  p_body_hash text,
  p_operation_key text,
  p_payment_provider_transaction_id text,
  p_provider_transaction_id text,
  p_amount_minor bigint,
  p_currency text,
  p_provider_status text,
  p_sanitized_fields jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_existing public.case_lab_3_provider_events%rowtype;
  v_refund public.case_lab_3_refunds%rowtype;
  v_order public.case_lab_3_orders%rowtype;
  v_attempt public.case_lab_3_payment_attempts%rowtype;
  v_event_id uuid;
  v_incident_id uuid;
  v_policy_id uuid;
  v_fiscal_operation_id uuid;
  v_snapshot jsonb;
  v_fiscal_key text;
  v_total_confirmed bigint;
  v_total_pending bigint;
  v_refundable bigint;
  v_full boolean;
  v_status text;
  v_conflicting_refund public.case_lab_3_refunds%rowtype;
  v_safe_fields jsonb;
  v_pending_receipt public.case_lab_3_provider_events%rowtype;
  v_conflict_result jsonb;
begin
  p_operation_key := nullif(btrim(p_operation_key), '');
  p_payment_provider_transaction_id := nullif(btrim(p_payment_provider_transaction_id), '');
  p_provider_transaction_id := nullif(btrim(p_provider_transaction_id), '');
  p_provider_status := lower(nullif(btrim(p_provider_status), ''));
  if p_environment is null
       or p_environment not in ('test', 'live')
       or p_provider <> 'tiptoppay'
       or p_provider_event_id is null
       or length(btrim(p_provider_event_id)) = 0
       or length(p_provider_event_id) > 256
       or p_provider_event_id ~ '[[:cntrl:]]'
       or p_operation_key is null
       or length(p_operation_key) > 200
       or p_operation_key ~ '[[:cntrl:]]'
       or p_operation_key ~* '(rawbody|cardnumber|cvv|token|opaque-token|secret|password|authorization)[[:space:]]*[:=]'
      or p_payment_provider_transaction_id is null
       or length(p_payment_provider_transaction_id) > 256
       or p_payment_provider_transaction_id ~ '[[:cntrl:]]'
      or p_provider_transaction_id is null
       or length(p_provider_transaction_id) > 256
       or p_provider_transaction_id ~ '[[:cntrl:]]'
      or p_body_hash is null
     or p_body_hash !~ '^[0-9a-f]{64}$'
      or p_amount_minor is null
      or p_amount_minor <= 0
      or p_currency <> 'KZT'
      or p_provider_status is null
       or length(p_provider_status) > 64
       or p_provider_status ~ '[[:cntrl:]]'
       or p_provider_status not in ('confirmed', 'completed', 'failed', 'unknown', 'review_required', 'indeterminate')
     or p_sanitized_fields is null
     or jsonb_typeof(p_sanitized_fields) <> 'object' then
    raise exception 'invalid provider Refund input'
      using errcode = '22023';
  end if;

  v_safe_fields := public.case_lab_3_sanitize_provider_fields(p_sanitized_fields, 'provider');

  perform pg_advisory_xact_lock(
    hashtextextended('case_lab_3:provider:' || p_environment, 0)
  );

  select * into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and provider_event_id = p_provider_event_id
  for update;

  if found then
    if v_existing.body_hash = p_body_hash
       and v_existing.event_type = 'Refund'
       and v_existing.external_id = p_operation_key then
      return jsonb_build_object('kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id);
    end if;
    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, 'reconciliation_mismatch', null, null, null,
      jsonb_build_object(
        'reason', 'provider_event_identity_conflict',
        'providerEventId', p_provider_event_id,
        'bodyHash', p_body_hash,
        'operationKey', p_operation_key
      )
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  select * into v_existing
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = p_provider
    and body_hash = p_body_hash
  for update;

  if found then
    if v_existing.event_type = 'Refund' and v_existing.external_id = p_operation_key then
      return jsonb_build_object('kind', 'accepted', 'duplicate', true, 'eventId', v_existing.id);
    end if;
    v_incident_id := public.case_lab_3_record_provider_conflict(
      p_environment, 'reconciliation_mismatch', null, null, null,
      jsonb_build_object(
        'reason', 'provider_body_identity_conflict',
        'providerEventId', p_provider_event_id,
        'bodyHash', p_body_hash,
        'operationKey', p_operation_key
      )
    );
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id);
  end if;

  select * into v_refund
  from public.case_lab_3_refunds
  where environment = p_environment
    and operation_key = p_operation_key
  for update;

  if not found then
    insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id,
      external_id, provider_transaction_id, body_hash, verified_at, sanitized_fields,
      processing_result
    )
    values (
      p_environment, p_provider, 'Refund', p_provider_event_id,
      p_operation_key, p_provider_transaction_id, p_body_hash, clock_timestamp(), v_safe_fields,
      'unexpected_refund'
    )
    returning id into v_event_id;

    insert into public.case_lab_3_incidents (
      environment, incident_type, provider_event_id, summary
    )
    values (
      p_environment, 'reconciliation_mismatch', v_event_id,
      public.case_lab_3_sanitize_provider_fields(
        jsonb_build_object(
          'reason', 'unknown_refund',
          'providerTransactionId', p_provider_transaction_id
        ), 'conflict'
      )
    )
    returning id into v_incident_id;

    update public.case_lab_3_provider_events set incident_id = v_incident_id where id = v_event_id;
    return jsonb_build_object('kind', 'review_required', 'incidentId', v_incident_id, 'eventId', v_event_id);
  end if;

  select * into strict v_order
  from public.case_lab_3_orders
  where id = v_refund.order_id and environment = p_environment
  for update;

  if v_refund.payment_provider_transaction_id is distinct from p_payment_provider_transaction_id
     or v_refund.amount_minor <> p_amount_minor
     or v_refund.currency <> p_currency then
    select public.case_lab_3_record_provider_event_conflict(
      p_environment, p_provider, 'Refund', p_provider_event_id, p_operation_key,
      p_provider_transaction_id, v_order.id, null, v_refund.id, p_body_hash,
      v_safe_fields, 'reconciliation_mismatch',
      jsonb_build_object(
        'reason', 'refund_identity_mismatch',
        'operationKey', p_operation_key,
        'paymentProviderTransactionId', p_payment_provider_transaction_id,
        'expectedAmountMinor', v_refund.amount_minor,
        'actualAmountMinor', p_amount_minor
      ), 'reconciliation_mismatch'
    ) into v_conflict_result;
    return v_conflict_result;
  end if;

  select * into v_conflicting_refund
  from public.case_lab_3_refunds
  where environment = p_environment
    and provider_transaction_id = p_provider_transaction_id
    and id <> v_refund.id
  for update;

  if found then
    select public.case_lab_3_record_provider_event_conflict(
      p_environment, p_provider, 'Refund', p_provider_event_id, p_operation_key,
      p_provider_transaction_id, v_order.id, null, v_refund.id, p_body_hash,
      v_safe_fields, 'reconciliation_mismatch',
      jsonb_build_object(
        'reason', 'refund_provider_transaction_reused',
        'operationKey', p_operation_key,
        'providerTransactionId', p_provider_transaction_id
      ), 'reconciliation_mismatch'
    ) into v_conflict_result;
    return v_conflict_result;
  end if;

  if v_refund.provider_transaction_id is not null
     and v_refund.provider_transaction_id is distinct from p_provider_transaction_id then
    select public.case_lab_3_record_provider_event_conflict(
      p_environment, p_provider, 'Refund', p_provider_event_id, p_operation_key,
      p_provider_transaction_id, v_order.id, null, v_refund.id, p_body_hash,
      v_safe_fields, 'reconciliation_mismatch',
      jsonb_build_object(
        'reason', 'refund_provider_transaction_id_changed',
        'operationKey', p_operation_key,
        'expectedProviderTransactionId', v_refund.provider_transaction_id,
        'actualProviderTransactionId', p_provider_transaction_id
      ), 'reconciliation_mismatch'
    ) into v_conflict_result;
    return v_conflict_result;
  end if;

  if lower(p_provider_status) in ('unknown', 'review_required', 'indeterminate') then
    if v_refund.status in ('confirmed', 'failed') then
      select public.case_lab_3_record_provider_event_conflict(
        p_environment, p_provider, 'Refund', p_provider_event_id, p_operation_key,
        p_provider_transaction_id, v_order.id, null, v_refund.id, p_body_hash,
        v_safe_fields, 'reconciliation_mismatch',
        jsonb_build_object(
          'reason', 'late_terminal_refund',
          'refundStatus', v_refund.status,
          'operationKey', p_operation_key
        ), 'late_terminal_ignored'
      ) into v_conflict_result;
      if v_conflict_result->>'eventId' is null then
        return v_conflict_result;
      end if;
      return jsonb_build_object(
        'kind', 'accepted', 'result', 'late_indeterminate_ignored',
        'refundId', v_refund.id, 'eventId', v_conflict_result->'eventId',
        'incidentId', v_conflict_result->'incidentId'
      );
    end if;

    update public.case_lab_3_refunds
    set status = 'review_required',
        provider_transaction_id = p_provider_transaction_id,
        last_error = 'provider result is indeterminate',
        updated_at = clock_timestamp()
    where id = v_refund.id and order_id = v_order.id and environment = p_environment;

    update public.case_lab_3_orders
    set payment_status = 'refund_pending', updated_at = clock_timestamp()
    where id = v_order.id and environment = p_environment;

    insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id, provider_transaction_id,
      external_id, order_id, refund_id, body_hash, verified_at, sanitized_fields, processing_result
    )
    values (
      p_environment, p_provider, 'Refund', p_provider_event_id, p_provider_transaction_id,
      p_operation_key,
      v_order.id, v_refund.id, p_body_hash, clock_timestamp(), v_safe_fields,
      'review_required'
    )
    returning id into v_event_id;

    insert into public.case_lab_3_jobs (
      environment, job_type, logical_key, payload_reference, order_id, refund_id
    )
    values (
      p_environment, 'reconcile_payment', 'reconcile:refund:' || v_refund.id,
      jsonb_build_object('refundId', v_refund.id), v_order.id, v_refund.id
    )
    on conflict (environment, logical_key) do nothing;

    return jsonb_build_object('kind', 'review_required', 'eventId', v_event_id, 'refundId', v_refund.id);
  end if;

  if lower(p_provider_status) in ('failed') then
    if v_refund.status in ('confirmed', 'failed') then
      select public.case_lab_3_record_provider_event_conflict(
        p_environment, p_provider, 'Refund', p_provider_event_id, p_operation_key,
        p_provider_transaction_id, v_order.id, null, v_refund.id, p_body_hash,
        v_safe_fields, 'reconciliation_mismatch',
        jsonb_build_object(
          'reason', 'late_terminal_refund',
          'refundStatus', v_refund.status,
          'operationKey', p_operation_key
        ), 'late_terminal_ignored'
      ) into v_conflict_result;
      if v_conflict_result->>'eventId' is null then
        return v_conflict_result;
      end if;
      return jsonb_build_object(
        'kind', 'accepted', 'result', 'late_failure_ignored',
        'refundId', v_refund.id, 'eventId', v_conflict_result->'eventId',
        'incidentId', v_conflict_result->'incidentId'
      );
    end if;

    update public.case_lab_3_refunds
    set status = 'failed',
        provider_transaction_id = p_provider_transaction_id,
        remaining_refundable_amount_minor = amount_minor,
        last_error = 'provider rejected refund',
        updated_at = clock_timestamp()
    where id = v_refund.id and order_id = v_order.id and environment = p_environment;

    select coalesce(sum(amount_minor), 0) into v_total_confirmed
    from public.case_lab_3_refunds
    where order_id = v_order.id and environment = p_environment and status = 'confirmed';
    select coalesce(sum(amount_minor), 0) into v_total_pending
    from public.case_lab_3_refunds
    where order_id = v_order.id and environment = p_environment and status in ('requested', 'processing', 'unknown', 'review_required');
    v_refundable := v_order.paid_amount_minor - v_total_confirmed - v_total_pending;

    update public.case_lab_3_orders
    set payment_status = case
          when v_total_pending > 0 then 'refund_pending'
          when v_total_confirmed >= paid_amount_minor then 'refunded'
          when v_total_confirmed > 0 then 'partially_refunded'
          else 'paid'
        end,
        refundable_amount_minor = greatest(v_refundable, 0),
        updated_at = clock_timestamp()
    where id = v_order.id and environment = p_environment;

    insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id, provider_transaction_id,
      external_id, order_id, refund_id, body_hash, verified_at, sanitized_fields, processing_result
    )
    values (
      p_environment, p_provider, 'Refund', p_provider_event_id, p_provider_transaction_id,
      p_operation_key, v_order.id, v_refund.id, p_body_hash, clock_timestamp(), v_safe_fields, 'failed'
    )
    returning id into v_event_id;

    return jsonb_build_object('kind', 'accepted', 'result', 'failed', 'eventId', v_event_id, 'refundId', v_refund.id);
  end if;

  if p_amount_minor <> v_refund.amount_minor then
    raise exception 'provider refund amount does not match the requested amount'
      using errcode = '23514';
  end if;

  if v_refund.status = 'confirmed' then
    insert into public.case_lab_3_provider_events (
      environment, provider, event_type, provider_event_id, provider_transaction_id,
      external_id, order_id, refund_id, body_hash, verified_at, sanitized_fields, processing_result
    )
    values (
      p_environment, p_provider, 'Refund', p_provider_event_id, p_provider_transaction_id,
      p_operation_key, v_order.id, v_refund.id, p_body_hash, clock_timestamp(), v_safe_fields, 'accepted_duplicate_state'
    )
    returning id into v_event_id;
    return jsonb_build_object('kind', 'accepted', 'duplicate', true, 'eventId', v_event_id, 'refundId', v_refund.id);
  end if;

  update public.case_lab_3_refunds
  set status = 'confirmed',
      provider_transaction_id = p_provider_transaction_id,
      payment_provider_transaction_id = coalesce(payment_provider_transaction_id, p_payment_provider_transaction_id),
      remaining_refundable_amount_minor = 0,
      confirmed_at = coalesce(confirmed_at, clock_timestamp()),
      updated_at = clock_timestamp()
  where id = v_refund.id and order_id = v_order.id and environment = p_environment;

  select coalesce(sum(amount_minor), 0) into v_total_confirmed
  from public.case_lab_3_refunds
  where order_id = v_order.id and environment = p_environment and status = 'confirmed';
  select coalesce(sum(amount_minor), 0) into v_total_pending
  from public.case_lab_3_refunds
  where order_id = v_order.id and environment = p_environment and status in ('requested', 'processing', 'unknown', 'review_required');
  v_refundable := v_order.paid_amount_minor - v_total_confirmed - v_total_pending;
  v_full := v_total_pending = 0 and v_total_confirmed >= v_order.paid_amount_minor;

  update public.case_lab_3_orders
  set payment_status = case
        when v_total_pending > 0 then 'refund_pending'
        when v_full then 'refunded'
        else 'partially_refunded'
      end,
      refunded_amount_minor = v_total_confirmed,
      refundable_amount_minor = greatest(v_refundable, 0),
      refunded_at = case when v_full then coalesce(refunded_at, clock_timestamp()) else refunded_at end,
      updated_at = clock_timestamp()
  where id = v_order.id and environment = p_environment;

  if v_full then
    update public.case_lab_3_tickets
    set status = 'cancelled', updated_at = clock_timestamp()
    where order_id = v_order.id and environment = p_environment and status <> 'cancelled';

    update public.case_lab_3_orders
    set ticket_status = 'cancelled', updated_at = clock_timestamp()
    where id = v_order.id and environment = p_environment;

    update public.case_lab_3_reservations
    set status = 'released', updated_at = clock_timestamp()
    where order_id = v_order.id and environment = p_environment and status = 'consumed';
  end if;

  select active_fiscal_policy_version_id into v_policy_id
  from public.case_lab_3_event_settings where environment = p_environment;
  if v_policy_id is null then
    raise exception 'fiscal policy is not configured'
      using errcode = '55000';
  end if;

  v_snapshot := jsonb_build_object(
    'type', 'IncomeReturn',
    'invoiceId', v_order.order_number,
    'accountId', v_order.id,
    'item', jsonb_build_object(
      'name', v_order.receipt_label,
      'priceMinor', p_amount_minor,
      'amountMinor', p_amount_minor,
      'quantity', 1
    ),
    'taxationSystem', v_order.taxation_system,
    'vatRate', v_order.vat_rate,
    'calculationPlace', 'caselab.kz',
    'calculationMethod', 'full_payment'
  );
  v_fiscal_key := 'fiscal:refund_income_return:' || v_refund.id;

  insert into public.case_lab_3_fiscal_operations (
    environment, order_id, payment_attempt_id, refund_id, fiscal_policy_version_id,
    policy_purpose, provider_receipt_type, amount_minor, payload_snapshot,
    request_hash, operation_key, status
  )
  values (
    p_environment, v_order.id, v_refund.payment_attempt_id, v_refund.id, v_policy_id,
    'refund_income_return', 'IncomeReturn', p_amount_minor, v_snapshot,
    encode(digest(v_snapshot::text, 'sha256'), 'hex'), v_fiscal_key,
    case when exists (
      select 1 from public.case_lab_3_fiscal_operations payment_operation
      where payment_operation.order_id = v_order.id
        and payment_operation.environment = p_environment
        and payment_operation.policy_purpose = 'payment_income'
        and payment_operation.status = 'issued'
    ) then 'queued' else 'not_requested' end
  )
  on conflict (environment, operation_key) do nothing
  returning id into v_fiscal_operation_id;

  if v_fiscal_operation_id is null then
    select id into v_fiscal_operation_id
    from public.case_lab_3_fiscal_operations
    where environment = p_environment and operation_key = v_fiscal_key;
  end if;

  select * into v_pending_receipt
  from public.case_lab_3_provider_events
  where environment = p_environment
    and provider = 'kassir'
    and event_type = 'Receipt'
    and refund_id = v_refund.id
    and sanitized_fields->>'receiptType' = 'IncomeReturn'
    and (
      sanitized_fields->>'operationKey' = v_fiscal_key
      or (
        sanitized_fields->>'operationKey' is null
        and external_id = sanitized_fields->>'kassirReceiptId'
        and order_id = v_order.id
        and sanitized_fields->>'receiptType' = 'IncomeReturn'
      )
    )
     and (sanitized_fields->>'amountMinor')::bigint = v_refund.amount_minor
     and processing_result in ('pending_match', 'dependency_pending')
     and lower(sanitized_fields->>'receiptStatus') in ('processed', 'issued')
  order by created_at
  limit 1
  for update;

  if found then
    update public.case_lab_3_fiscal_operations
    set status = case when exists (
          select 1
          from public.case_lab_3_fiscal_operations payment_operation
          where payment_operation.environment = p_environment
            and payment_operation.order_id = v_order.id
            and payment_operation.policy_purpose = 'payment_income'
            and payment_operation.status = 'issued'
        ) then 'issued' else 'not_requested' end,
        kassir_receipt_id = v_pending_receipt.external_id,
        receipt_url = v_pending_receipt.sanitized_fields->>'receiptUrl',
        fiscal_fields = coalesce(
          v_pending_receipt.sanitized_fields->'fiscalFields',
          public.case_lab_3_sanitize_provider_fields(v_pending_receipt.sanitized_fields, 'receipt')
        ),
        issued_at = case when exists (
          select 1
          from public.case_lab_3_fiscal_operations payment_operation
          where payment_operation.environment = p_environment
            and payment_operation.order_id = v_order.id
            and payment_operation.policy_purpose = 'payment_income'
            and payment_operation.status = 'issued'
        ) then coalesce(issued_at, clock_timestamp()) else issued_at end,
        updated_at = clock_timestamp()
     where id = v_fiscal_operation_id and environment = p_environment;

    update public.case_lab_3_provider_events
    set sanitized_fields = sanitized_fields || jsonb_build_object('operationKey', v_fiscal_key),
        processing_result = case when exists (
          select 1
          from public.case_lab_3_fiscal_operations payment_operation
          where payment_operation.environment = p_environment
            and payment_operation.order_id = v_order.id
            and payment_operation.policy_purpose = 'payment_income'
            and payment_operation.status = 'issued'
        ) then 'matched_early' else 'dependency_pending' end
    where id = v_pending_receipt.id and environment = p_environment;
  end if;

  insert into public.case_lab_3_jobs (
    environment, job_type, logical_key, payload_reference, order_id, refund_id
  )
  values (
    p_environment, 'issue_fiscal_operation', 'job:' || v_fiscal_key,
    jsonb_build_object(
      'operationKey', v_fiscal_key,
      'purpose', 'refund_income_return',
      'dependsOnPurpose', 'payment_income'
    ), v_order.id, v_refund.id
  )
  on conflict (environment, logical_key) do nothing;

  if v_full then
    insert into public.case_lab_3_email_deliveries (
      environment, operation_key, delivery_kind, order_id, recipient_email, status
    )
    values (
      p_environment, 'email:refund:' || v_refund.id, 'refund_notification',
      v_order.id, v_order.purchaser_email, 'pending'
    )
    on conflict (environment, operation_key) do nothing;

    insert into public.case_lab_3_jobs (
      environment, job_type, logical_key, payload_reference, order_id, refund_id
    )
    values (
      p_environment, 'send_refund_notification', 'job:email:refund:' || v_refund.id,
      jsonb_build_object('refundId', v_refund.id, 'operationKey', 'email:refund:' || v_refund.id),
      v_order.id, v_refund.id
    )
    on conflict (environment, logical_key) do nothing;
  end if;

  insert into public.case_lab_3_analytics_events (
    environment, event_key, event_name, order_id, refund_id, ga_client_id,
    payload_snapshot, delivery_status
  )
  values (
    p_environment, 'ga4:refund:' || v_refund.id, 'refund', v_order.id, v_refund.id,
    v_order.ga_client_id,
    jsonb_build_object(
      'transactionId', v_order.order_number,
      'refundOperationId', v_refund.id,
      'valueMinor', p_amount_minor,
      'currency', 'KZT'
    ), 'pending'
  )
  on conflict (environment, event_key) do nothing;

  insert into public.case_lab_3_jobs (
    environment, job_type, logical_key, payload_reference, order_id, refund_id
  )
  values (
    p_environment, 'send_analytics_event', 'job:ga4:refund:' || v_refund.id,
    jsonb_build_object('eventKey', 'ga4:refund:' || v_refund.id, 'eventName', 'refund'),
    v_order.id, v_refund.id
  )
  on conflict (environment, logical_key) do nothing;

  insert into public.case_lab_3_provider_events (
    environment, provider, event_type, provider_event_id, provider_transaction_id,
    external_id, order_id, refund_id, body_hash, verified_at, sanitized_fields, processing_result
  )
  values (
    p_environment, p_provider, 'Refund', p_provider_event_id, p_provider_transaction_id,
    p_operation_key, v_order.id, v_refund.id, p_body_hash, clock_timestamp(), v_safe_fields, 'confirmed'
  )
  returning id into v_event_id;

  return jsonb_build_object(
    'kind', 'accepted', 'result', 'confirmed', 'eventId', v_event_id,
    'refundId', v_refund.id, 'fullRefund', v_full
  );
end;
$$;

create or replace function public.case_lab_3_resolve_incident(
  p_environment text,
  p_incident_id uuid,
  p_status text,
  p_resolution text,
  p_actor_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_incident public.case_lab_3_incidents%rowtype;
begin
  if p_environment is null
     or p_environment not in ('test', 'live')
     or p_incident_id is null
     or p_status not in ('open', 'investigating', 'resolved', 'ignored')
     or p_actor_id is null
     or length(btrim(p_actor_id)) = 0 then
    raise exception 'invalid incident resolution input'
      using errcode = '22023';
  end if;

  select * into v_incident
  from public.case_lab_3_incidents
  where id = p_incident_id and environment = p_environment
  for update;

  if not found then
    raise exception 'incident not found'
      using errcode = '22023';
  end if;

  update public.case_lab_3_incidents
  set status = p_status,
      resolution = nullif(btrim(p_resolution), ''),
      resolved_at = case when p_status in ('resolved', 'ignored') then coalesce(resolved_at, clock_timestamp()) else null end,
      resolved_by = case when p_status in ('resolved', 'ignored') then p_actor_id else null end,
      updated_at = clock_timestamp()
  where id = p_incident_id and environment = p_environment;

  return jsonb_build_object('kind', 'updated', 'incidentId', p_incident_id, 'status', p_status);
end;
$$;

create or replace function public.case_lab_3_claim_jobs(
  p_environment text,
  p_worker_id text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_job record;
  v_token uuid;
  v_claimed jsonb := '[]'::jsonb;
begin
  if p_environment is null
     or p_environment not in ('test', 'live')
     or p_worker_id is null
     or length(btrim(p_worker_id)) = 0 then
    raise exception 'invalid worker input'
      using errcode = '22023';
  end if;

  for v_job in
    select *
    from public.case_lab_3_jobs
    where environment = p_environment
      and available_at <= clock_timestamp()
      and (
        status = 'pending'
        or (status = 'leased' and leased_until <= clock_timestamp())
      )
    order by available_at, created_at, id
    limit 5
    for update skip locked
  loop
    v_token := gen_random_uuid();
    update public.case_lab_3_jobs
    set status = 'leased',
        attempt_count = attempt_count + 1,
        leased_until = clock_timestamp() + interval '2 minutes',
        lease_token = v_token,
        last_error = null,
        updated_at = clock_timestamp()
    where id = v_job.id and environment = p_environment;

    v_claimed := v_claimed || jsonb_build_array(jsonb_build_object(
      'jobId', v_job.id,
      'jobType', v_job.job_type,
      'logicalKey', v_job.logical_key,
      'payloadReference', v_job.payload_reference,
      'orderId', v_job.order_id,
      'ticketId', v_job.ticket_id,
      'refundId', v_job.refund_id,
      'leaseToken', v_token,
      'leasedUntil', clock_timestamp() + interval '2 minutes',
      'workerId', p_worker_id
    ));
  end loop;

  return v_claimed;
end;
$$;

create or replace function public.case_lab_3_complete_job(
  p_environment text,
  p_job_id uuid,
  p_lease_token uuid,
  p_result jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_job public.case_lab_3_jobs%rowtype;
  v_safe_result jsonb;
begin
  select * into v_job
  from public.case_lab_3_jobs
  where id = p_job_id and environment = p_environment
  for update;

  if not found or v_job.status <> 'leased' or v_job.lease_token is distinct from p_lease_token or v_job.leased_until <= clock_timestamp() then
    raise exception 'job lease token does not match'
      using errcode = '55000';
  end if;

  v_safe_result := public.case_lab_3_sanitize_provider_fields(coalesce(p_result, '{}'::jsonb), 'provider');

  update public.case_lab_3_jobs
   set status = 'completed', result = v_safe_result,
      leased_until = null, lease_token = null, last_error = null,
      updated_at = clock_timestamp()
  where id = p_job_id and environment = p_environment;

  return jsonb_build_object('kind', 'completed', 'jobId', p_job_id);
end;
$$;

create or replace function public.case_lab_3_retry_job(
  p_environment text,
  p_job_id uuid,
  p_lease_token uuid,
  p_error text,
  p_delay_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_job public.case_lab_3_jobs%rowtype;
  v_delay integer := greatest(coalesce(p_delay_seconds, 0), 0);
begin
  select * into v_job
  from public.case_lab_3_jobs
  where id = p_job_id and environment = p_environment
  for update;

  if not found or v_job.status <> 'leased' or v_job.lease_token is distinct from p_lease_token or v_job.leased_until <= clock_timestamp() then
    raise exception 'job lease token does not match'
      using errcode = '55000';
  end if;

  update public.case_lab_3_jobs
   set status = 'pending', result = null,
       available_at = clock_timestamp() + make_interval(secs => least(v_delay, 86400)),
       leased_until = null, lease_token = null,
       last_error = public.case_lab_3_sanitize_error_text(p_error), updated_at = clock_timestamp()
  where id = p_job_id and environment = p_environment;

  return jsonb_build_object('kind', 'retried', 'jobId', p_job_id, 'delaySeconds', least(v_delay, 86400));
end;
$$;

create or replace function public.case_lab_3_mark_job_unknown(
  p_environment text,
  p_job_id uuid,
  p_lease_token uuid,
  p_error text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_job public.case_lab_3_jobs%rowtype;
begin
  select * into v_job
  from public.case_lab_3_jobs
  where id = p_job_id and environment = p_environment
  for update;

  if not found or v_job.status <> 'leased' or v_job.lease_token is distinct from p_lease_token or v_job.leased_until <= clock_timestamp() then
    raise exception 'job lease token does not match'
      using errcode = '55000';
  end if;

  update public.case_lab_3_jobs
   set status = 'unknown', result = null,
       leased_until = null, lease_token = null,
       last_error = public.case_lab_3_sanitize_error_text(p_error), updated_at = clock_timestamp()
  where id = p_job_id and environment = p_environment;

  return jsonb_build_object('kind', 'unknown', 'jobId', p_job_id);
end;
$$;

create or replace function public.case_lab_3_run_maintenance(
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_expired_reservations integer;
  v_requeued_jobs integer;
begin
  if p_environment is null or p_environment not in ('test', 'live') then
    raise exception 'invalid environment'
      using errcode = '22023';
  end if;

  update public.case_lab_3_reservations
  set status = 'expired', updated_at = clock_timestamp()
  where environment = p_environment
    and status = 'active'
    and expires_at <= clock_timestamp();
  get diagnostics v_expired_reservations = row_count;

  update public.case_lab_3_jobs
  set status = 'pending', leased_until = null, lease_token = null,
      available_at = clock_timestamp(), updated_at = clock_timestamp()
  where environment = p_environment
    and status = 'leased'
    and leased_until <= clock_timestamp();
  get diagnostics v_requeued_jobs = row_count;

  return jsonb_build_object(
    'kind', 'maintained',
    'expiredReservations', v_expired_reservations,
    'requeuedJobs', v_requeued_jobs
  );
end;
$$;

create or replace function public.case_lab_3_record_worker_heartbeat(
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, extensions
as $$
declare
  v_heartbeat timestamptz := clock_timestamp();
begin
  if p_environment is null or p_environment not in ('test', 'live') then
    raise exception 'invalid environment'
      using errcode = '22023';
  end if;

  update public.case_lab_3_event_settings
  set latest_worker_heartbeat_at = v_heartbeat,
      updated_at = clock_timestamp()
  where environment = p_environment;

  if not found then
    raise exception 'event settings not found'
      using errcode = '22023';
  end if;

  return jsonb_build_object('kind', 'recorded', 'environment', p_environment, 'recordedAt', v_heartbeat);
end;
$$;

revoke all on function public.case_lab_3_sanitize_bounded_text(text, integer) from public, anon, authenticated;
revoke all on function public.case_lab_3_sanitize_provider_fields(jsonb, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_sanitize_error_text(text) from public, anon, authenticated;
revoke all on function public.case_lab_3_sanitize_failure_code(text) from public, anon, authenticated;
revoke all on function public.case_lab_3_record_provider_conflict(text, text, uuid, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.case_lab_3_record_provider_event_conflict(text, text, text, text, text, text, uuid, uuid, uuid, text, jsonb, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_apply_check(text, text, text, text, text, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.case_lab_3_apply_pay(text, text, text, text, text, text, bigint, text, jsonb) from public, anon, authenticated;
revoke all on function public.case_lab_3_apply_fail(text, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.case_lab_3_apply_refund(text, text, text, text, text, text, text, bigint, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.case_lab_3_apply_receipt(text, text, text, text, text, text, uuid, uuid, text, text, bigint, text, jsonb, jsonb) from public, anon, authenticated;
revoke all on function public.case_lab_3_create_refund(text, uuid, text, bigint, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_resolve_incident(text, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_claim_jobs(text, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_complete_job(text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.case_lab_3_retry_job(text, uuid, uuid, text, integer) from public, anon, authenticated;
revoke all on function public.case_lab_3_mark_job_unknown(text, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.case_lab_3_run_maintenance(text) from public, anon, authenticated;
revoke all on function public.case_lab_3_record_worker_heartbeat(text) from public, anon, authenticated;

grant execute on function public.case_lab_3_sanitize_bounded_text(text, integer) to service_role;
grant execute on function public.case_lab_3_sanitize_provider_fields(jsonb, text) to service_role;
grant execute on function public.case_lab_3_sanitize_error_text(text) to service_role;
grant execute on function public.case_lab_3_sanitize_failure_code(text) to service_role;
grant execute on function public.case_lab_3_record_provider_conflict(text, text, uuid, uuid, uuid, jsonb) to service_role;
grant execute on function public.case_lab_3_record_provider_event_conflict(text, text, text, text, text, text, uuid, uuid, uuid, text, jsonb, text, jsonb, text) to service_role;
grant execute on function public.case_lab_3_apply_check(text, text, text, text, text, bigint, text, jsonb) to service_role;
grant execute on function public.case_lab_3_apply_pay(text, text, text, text, text, text, bigint, text, jsonb) to service_role;
grant execute on function public.case_lab_3_apply_fail(text, text, text, text, text, text, text, jsonb) to service_role;
grant execute on function public.case_lab_3_apply_refund(text, text, text, text, text, text, text, bigint, text, text, jsonb) to service_role;
grant execute on function public.case_lab_3_apply_receipt(text, text, text, text, text, text, uuid, uuid, text, text, bigint, text, jsonb, jsonb) to service_role;
grant execute on function public.case_lab_3_create_refund(text, uuid, text, bigint, text) to service_role;
grant execute on function public.case_lab_3_resolve_incident(text, uuid, text, text, text) to service_role;
grant execute on function public.case_lab_3_claim_jobs(text, text) to service_role;
grant execute on function public.case_lab_3_complete_job(text, uuid, uuid, jsonb) to service_role;
grant execute on function public.case_lab_3_retry_job(text, uuid, uuid, text, integer) to service_role;
grant execute on function public.case_lab_3_mark_job_unknown(text, uuid, uuid, text) to service_role;
grant execute on function public.case_lab_3_run_maintenance(text) to service_role;
grant execute on function public.case_lab_3_record_worker_heartbeat(text) to service_role;
