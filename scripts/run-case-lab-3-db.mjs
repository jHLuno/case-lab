import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const CASE_LAB_3_DB_SUITES = [
  { name: "schema", file: "supabase/tests/case_lab_3_schema.test.sql" },
  { name: "rls", file: "supabase/tests/case_lab_3_rls.test.sql" },
  { name: "inventory", file: "supabase/tests/case_lab_3_inventory.test.sql" },
  { name: "check-in", file: "supabase/tests/case_lab_3_check_in.test.sql" },
  { name: "webhooks", file: "supabase/tests/case_lab_3_webhooks.test.sql" },
  { name: "refunds", file: "supabase/tests/case_lab_3_refunds.test.sql" },
  { name: "jobs", file: "supabase/tests/case_lab_3_jobs.test.sql" },
];

export function buildSupabaseQueryArgs(file) {
  return [
    "supabase",
    "db",
    "query",
    "--linked",
    "--output-format",
    "json",
    "--file",
    file,
  ];
}

export function buildSpawnOptions(environment = process.env, cwd = REPOSITORY_ROOT) {
  return {
    cwd,
    env: { ...environment, CI: "1" },
    stdio: ["ignore", "pipe", "pipe"],
  };
}

export function validatePreflight({ cwd = REPOSITORY_ROOT, env = process.env } = {}) {
  const problems = [];

  if (!existsSync(path.join(cwd, "supabase", "config.toml"))) {
    problems.push("supabase/config.toml is missing");
  }

  const projectRefPath = path.join(cwd, "supabase", ".temp", "project-ref");
  if (!existsSync(projectRefPath)) {
    problems.push("the linked project marker supabase/.temp/project-ref is missing");
  } else {
    try {
      if (readFileSync(projectRefPath, "utf8").trim() === "") {
        problems.push("the linked project marker supabase/.temp/project-ref is empty");
      }
    } catch {
      problems.push("the linked project marker supabase/.temp/project-ref cannot be read");
    }
  }

  if (problems.length > 0) {
    throw new Error(
      `Remote Case Lab III database test preflight failed: ${problems.join(", ")}. `
        + "The runner is non-interactive and will not prompt for credentials or project configuration.",
    );
  }
}

function parseQueryResult(stdout) {
  const text = stdout.trim();
  if (text === "") {
    return { result: null, failure: "empty_json_output" };
  }

  try {
    return { result: JSON.parse(text), failure: null };
  } catch {
    return { result: null, failure: "invalid_json_output" };
  }
}

function getRows(result) {
  if (Array.isArray(result)) {
    return result;
  }

  if (result && typeof result === "object") {
    if (Array.isArray(result.rows)) {
      return result.rows;
    }

    if (result.data && typeof result.data === "object" && Array.isArray(result.data.rows)) {
      return result.data.rows;
    }
  }

  return null;
}

export function hasPgTapFailure(result) {
  const rows = getRows(result);
  if (!rows || rows.length === 0) {
    return true;
  }

  return rows.some((row) => {
    if (!row || typeof row !== "object") {
      return false;
    }

    return row.ok === false
      || row.ok === "f"
      || row.ok === 0
      || row.ok === "0"
      || row.status === "not ok"
      || row.result === "not ok"
      || (typeof row.finish === "string" && /# looks like you failed \d+ tests?/iu.test(row.finish));
  });
}

export function executeSupabaseSuite(suite, { cwd = REPOSITORY_ROOT, env = process.env } = {}) {
  return new Promise((resolve) => {
    const child = spawn("npx", buildSupabaseQueryArgs(suite.file), buildSpawnOptions(env, cwd));
    let stdout = "";
    let settled = false;

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", () => {});

    const finish = (outcome) => {
      if (!settled) {
        settled = true;
        resolve(outcome);
      }
    };

    child.once("error", () => {
      finish({ exitCode: 1, result: null, failure: "cli_spawn_error" });
    });
    child.once("close", (exitCode, signal) => {
      if (exitCode !== 0 || signal) {
        finish({ exitCode: exitCode ?? 1, signal, result: null, failure: "cli_exit" });
        return;
      }

      const parsed = parseQueryResult(stdout);
      finish({ exitCode: 0, result: parsed.result, failure: parsed.failure });
    });
  });
}

export async function runSuites({ executeSuite, write = () => {}, cwd = REPOSITORY_ROOT, env = process.env }) {
  const report = {
    runner: "case-lab-3-db",
    mode: "remote-linked",
    status: "passed",
    failedSuite: null,
    suites: [],
  };

  for (const [index, suite] of CASE_LAB_3_DB_SUITES.entries()) {
    write(`=== Case Lab III DB suite ${index + 1}/${CASE_LAB_3_DB_SUITES.length}: ${suite.name} ===`);

    const outcome = await executeSuite(suite, { cwd, env });
    const failed = outcome.exitCode !== 0 || Boolean(outcome.failure) || hasPgTapFailure(outcome.result);
    const suiteReport = {
      name: suite.name,
      file: suite.file,
      status: failed ? "failed" : "passed",
      exitCode: outcome.exitCode,
      result: outcome.result,
    };

    if (failed) {
      suiteReport.failure = outcome.failure ?? "pgtap_assertion_failed";
      report.status = "failed";
      report.failedSuite = suite.name;
      report.suites.push(suiteReport);
      write(`=== Case Lab III DB suite failed: ${suite.name} ===`);
      break;
    }

    report.suites.push(suiteReport);
    write(`=== Case Lab III DB suite passed: ${suite.name} ===`);
  }

  return report;
}

function printFinalReport(report) {
  console.log("=== Case Lab III DB final JSON ===");
  console.log(JSON.stringify(report, null, 2));
}

async function main() {
  try {
    validatePreflight();
  } catch (error) {
    const report = {
      runner: "case-lab-3-db",
      mode: "remote-linked",
      status: "failed",
      failedStage: "preflight",
      suites: [],
      error: error instanceof Error ? error.message : "preflight_failed",
    };
    console.error(report.error);
    printFinalReport(report);
    process.exitCode = 1;
    return;
  }

  console.log("Remote Case Lab III database test preflight passed; running non-interactively.");
  const report = await runSuites({
    executeSuite: executeSupabaseSuite,
    write: (line) => console.log(line),
  });
  printFinalReport(report);

  if (report.status !== "passed") {
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
