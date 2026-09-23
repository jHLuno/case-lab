import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("legal document hash checks have distinct PostgreSQL constraint names", async () => {
  const source = await readFile(
    "supabase/migrations/20260907000000_create_case_lab_3_payment_schema.sql",
    "utf8",
  );

  assert.match(
    source,
    /content_hash\s+text\s+not null\s+constraint\s+case_lab_3_legal_document_versions_content_hash_format_check\s+check/,
  );
  assert.match(
    source,
    /constraint\s+case_lab_3_legal_document_versions_content_hash_check\s+\s*check\s*\(content_hash\s*=\s*encode\(/,
  );
});

test("provider conflict helper declares the settings row it locks", async () => {
  const source = await readFile(
    "supabase/migrations/20260907020000_add_case_lab_3_provider_functions.sql",
    "utf8",
  );

  const helperStart = source.indexOf("create or replace function public.case_lab_3_record_provider_event_conflict");
  const helperEnd = source.indexOf("$$;", helperStart);
  const helper = source.slice(helperStart, helperEnd);

  assert.match(helper, /v_settings\s+public\.case_lab_3_event_settings%rowtype;/);
});

test("atomic refund creation queues one idempotent initiate_refund job", async () => {
  const source = await readFile(
    "supabase/migrations/20260907020000_add_case_lab_3_provider_functions.sql",
    "utf8",
  );
  const start = source.indexOf("create or replace function public.case_lab_3_create_refund(");
  const end = source.indexOf("\ncreate or replace function", start + 1);
  const refundFunction = source.slice(start, end < 0 ? source.length : end);

  assert.notEqual(start, -1);
  assert.match(refundFunction, /insert into public\.case_lab_3_jobs/iu);
  assert.match(refundFunction, /p_environment,\s*'initiate_refund',\s*'refund:'\s*\|\|\s*p_operation_key/iu);
  assert.match(refundFunction, /on conflict \(environment, logical_key\) do nothing/iu);
});

test("refund worker transitions are atomic and persist uncertainty timestamps", async () => {
  const source = await readFile(
    "supabase/migrations/20260909000000_add_case_lab_3_refund_worker_transitions.sql",
    "utf8",
  );

  assert.match(source, /add column if not exists uncertain_since_at timestamptz/iu);
  assert.match(source, /case_lab_3_begin_refund/iu);
  assert.match(source, /case_lab_3_fail_refund/iu);
  assert.match(source, /case_lab_3_mark_refund_unknown/iu);
  assert.match(source, /pg_advisory_xact_lock/iu);
  assert.match(source, /grant execute on function public\.case_lab_3_begin_refund/iu);
});

test("live interaction migration defines protected authoritative tables", async () => {
  const source = await readFile(
    "supabase/migrations/20260920000000_add_case_lab_3_live_interaction.sql",
    "utf8",
  );

  for (const table of [
    "case_lab_3_live_cases",
    "case_lab_3_live_participants",
    "case_lab_3_live_submissions",
    "case_lab_3_live_ai_runs",
    "case_lab_3_live_shortlist_entries",
    "case_lab_3_live_awards",
    "case_lab_3_live_tie_breaks",
  ]) {
    assert.match(source, new RegExp(`create table public\\.${table}`, "iu"));
    assert.match(source, new RegExp(`alter table public\\.${table} enable row level security`, "iu"));
  }

  assert.match(source, /revoke all on table[\s\S]+case_lab_3_live_tie_breaks[\s\S]+from public, anon, authenticated/iu);
  assert.match(source, /case_lab_3_live_claim_participant/iu);
  assert.match(source, /case_lab_3_live_save_submission/iu);
  assert.match(source, /case_lab_3_live_transition_case/iu);
  assert.match(source, /case_lab_3_live_publish_awards/iu);
  assert.match(source, /case_lab_3_live_resolve_tie/iu);
  assert.match(source, /case_lab_3_live_get_leaderboard/iu);
  assert.match(source, /char_length\(btrim\(answer_text\)\) between 30 and 300/iu);
  assert.match(source, /place = 1 and bonus_points = 50/iu);
  assert.match(source, /place = 2 and bonus_points = 35/iu);
  assert.match(source, /place = 3 and bonus_points = 25/iu);
});

test("live participant claims reuse the same name identity", async () => {
  const source = await readFile(
    "supabase/migrations/20260924000000_make_case_lab_3_live_claim_idempotent.sql",
    "utf8",
  );

  assert.match(source, /select[\s\S]+into v_existing[\s\S]+case_lab_3_live_participants/iu);
  assert.match(source, /v_existing\.claim_status\s*=\s*'active'/iu);
  assert.match(source, /update public\.case_lab_3_live_participants[\s\S]+claim_status\s*=\s*'active'/iu);
  assert.match(source, /pg_advisory_xact_lock[\s\S]+normalized_first_name/iu);
});
