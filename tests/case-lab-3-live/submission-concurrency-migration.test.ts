import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function functionBody(source: string, signature: string): string {
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `expected function ${signature} to exist`);
  const end = source.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `expected function ${signature} to end`);
  return source.slice(start, end);
}

test("live submissions share the case lock and serialize duplicate requests per participant", async () => {
  const [saveSource, transitionSource] = await Promise.all([
    readFile("supabase/migrations/20260924020000_allow_parallel_case_lab_3_live_submissions.sql", "utf8"),
    readFile("supabase/migrations/20260923000000_add_case_lab_3_live_rounds.sql", "utf8"),
  ]);
  const saveFunction = functionBody(
    saveSource,
    "create or replace function public.case_lab_3_live_save_submission(",
  );
  const transitionFunction = functionBody(
    transitionSource,
    "create or replace function public.case_lab_3_live_transition_case(",
  );
  const caseRead = saveFunction.match(/select \* into v_case[\s\S]*?;/iu)?.[0];
  const participantRead = saveFunction.match(/select \* into v_participant[\s\S]*?;/iu)?.[0];
  const transitionCaseRead = transitionFunction.match(/select \* into v_case[\s\S]*?;/iu)?.[0];

  assert.ok(caseRead, "submission function must load its live case");
  assert.ok(participantRead, "submission function must load its participant");
  assert.ok(transitionCaseRead, "case transition function must load its live case");
  assert.match(caseRead, /from public\.case_lab_3_live_cases[\s\S]*?for share/iu);
  assert.match(participantRead, /from public\.case_lab_3_live_participants[\s\S]*?for update/iu);
  assert.match(transitionCaseRead, /from public\.case_lab_3_live_cases[\s\S]*?for update/iu);
});
