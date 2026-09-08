import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("inventory DB fixtures never reset pre-existing orders", async () => {
  const suite = await readFile("supabase/tests/case_lab_3_inventory.test.sql", "utf8");
  const resetFunction = suite.match(
    /create or replace function pg_temp\.cl3_reset_inventory\(\)[\s\S]*?\n\$\$;/iu,
  )?.[0];

  assert.ok(resetFunction, "inventory reset helper exists");
  assert.doesNotMatch(resetFunction, /delete from public\.case_lab_3_orders\s*;/iu);
  assert.match(resetFunction, /idempotency_key like \x27inventory-test-%\x27/iu);
  assert.match(resetFunction, /actor_label = \x27pgTAP\x27/iu);
});

test("webhook DB assertions preserve pre-existing provider rows", async () => {
  const suite = await readFile("supabase/tests/case_lab_3_webhooks.test.sql", "utf8");

  assert.match(suite, /cl3_webhook_baseline/iu);
  assert.match(suite, /provider_event_count/iu);
  assert.match(suite, /unknown_provider_result_count/iu);
  assert.match(suite, /from cl3_webhook_baseline/iu);
});
