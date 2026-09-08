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
