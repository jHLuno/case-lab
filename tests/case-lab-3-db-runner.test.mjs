import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  CASE_LAB_3_DB_SUITES,
  buildSupabaseQueryArgs,
  buildSpawnOptions,
  runSuites,
  validatePreflight,
} from "../scripts/run-case-lab-3-db.mjs";

test("remote runner builds the exact linked JSON query command", () => {
  assert.deepEqual(buildSupabaseQueryArgs("supabase/tests/example.test.sql"), [
    "supabase",
    "db",
    "query",
    "--linked",
    "--output-format",
    "json",
    "--file",
    "supabase/tests/example.test.sql",
  ]);
});

test("remote runner keeps the seven Case Lab suites in dependency order", () => {
  assert.deepEqual(
    CASE_LAB_3_DB_SUITES.map((suite) => suite.name),
    ["schema", "rls", "inventory", "check-in", "webhooks", "refunds", "jobs"],
  );
  assert.deepEqual(
    CASE_LAB_3_DB_SUITES.map((suite) => suite.file),
    [
      "supabase/tests/case_lab_3_schema.test.sql",
      "supabase/tests/case_lab_3_rls.test.sql",
      "supabase/tests/case_lab_3_inventory.test.sql",
      "supabase/tests/case_lab_3_check_in.test.sql",
      "supabase/tests/case_lab_3_webhooks.test.sql",
      "supabase/tests/case_lab_3_refunds.test.sql",
      "supabase/tests/case_lab_3_jobs.test.sql",
    ],
  );
});

test("remote runner forwards the environment and forces non-interactive CLI mode", () => {
  const environment = { SUPABASE_ACCESS_TOKEN: "fixture-token", EXISTING_FLAG: "kept" };
  const options = buildSpawnOptions(environment, "/tmp/case-lab-3");

  assert.equal(options.cwd, "/tmp/case-lab-3");
  assert.equal(options.stdio[0], "ignore");
  assert.equal(options.env.SUPABASE_ACCESS_TOKEN, environment.SUPABASE_ACCESS_TOKEN);
  assert.equal(options.env.EXISTING_FLAG, environment.EXISTING_FLAG);
  assert.equal(options.env.CI, "1");
});

test("preflight requires repository configuration and an existing linked project marker", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "case-lab-3-db-runner-"));
  await mkdir(path.join(root, "supabase", ".temp"), { recursive: true });
  await writeFile(path.join(root, "supabase", "config.toml"), "project_id = \"fixture\"\n");
  await writeFile(path.join(root, "supabase", ".temp", "project-ref"), "fixture-project\n");

  assert.doesNotThrow(() => validatePreflight({ cwd: root, env: {} }));
  assert.throws(
    () => validatePreflight({ cwd: path.join(root, "missing") }),
    /supabase\/config\.toml.*missing/i,
  );
});

test("remote runner stops after the first failed suite", async () => {
  const calls = [];
  const report = await runSuites({
    write: () => {},
    executeSuite: async (suite) => {
      calls.push(suite.name);
      return {
        exitCode: suite.name === "inventory" ? 1 : 0,
        result: { rows: [{ ok: true, name: `${suite.name} fixture` }] },
      };
    },
  });

  assert.deepEqual(calls, ["schema", "rls", "inventory"]);
  assert.equal(report.status, "failed");
  assert.equal(report.failedSuite, "inventory");
});

test("remote runner treats pgTAP finish failure summaries as failed suites", async () => {
  const report = await runSuites({
    write: () => {},
    executeSuite: async () => ({
      exitCode: 0,
      result: { rows: [{ finish: "# Looks like you failed 2 tests of 76" }] },
    }),
  });

  assert.equal(report.status, "failed");
  assert.equal(report.failedSuite, "schema");
  assert.equal(report.suites[0].failure, "pgtap_assertion_failed");
});

test("package script selects remote runner and preserves an explicit local fallback", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));

  assert.equal(packageJson.scripts["test:case-lab-3-db"], "node scripts/run-case-lab-3-db.mjs");
  assert.equal(packageJson.scripts["test:case-lab-3-db:local"], "supabase test db");
});
