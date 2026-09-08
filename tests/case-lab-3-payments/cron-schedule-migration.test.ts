import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cron installer is Vault-backed and does not persist worker credentials", async () => {
  const migration = await readFile(
    "supabase/migrations/20260907040000_schedule_case_lab_3_worker.sql",
    "utf8",
  );

  assert.match(migration, /create extension if not exists pg_cron/iu);
  assert.match(migration, /create extension if not exists pg_net/iu);
  assert.match(migration, /create extension if not exists supabase_vault/iu);
  assert.match(migration, /case_lab_3_install_worker_schedules/iu);
  assert.match(migration, /vault\.decrypted_secrets/iu);
  assert.match(migration, /case_lab_3_worker_url/gu);
  assert.match(migration, /case_lab_3_cron_secret/gu);
  assert.match(migration, /cron\.schedule/iu);
  assert.match(migration, /\* \* \* \* \*/u);

  assert.doesNotMatch(migration, /https:\/\/case-lab-test-payments\.vercel\.app/iu);
  assert.doesNotMatch(migration, /Bearer\s+[A-Za-z0-9._~+/=-]{12,}/u);
  assert.doesNotMatch(migration, /Authorization:\s*Bearer/iu);
});
