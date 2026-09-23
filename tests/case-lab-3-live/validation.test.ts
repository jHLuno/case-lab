import assert from "node:assert/strict";
import test from "node:test";

import {
  LiveInputValidationError,
  formatPublicDisplayName,
  normalizeParticipantLookupName,
  parseParticipantClaim,
  parseSubmission,
} from "../../app/lib/case-lab-3/live/validation";

test("normalizes Unicode names, whitespace, and ё for ticket lookup", () => {
  assert.equal(normalizeParticipantLookupName("  АЛИЯ\u00a0\tЁЛКИНА  "), "алия елкина");
  assert.deepEqual(
    parseParticipantClaim({ firstName: "  Алия ", lastName: " Ёлкина  " }),
    { firstName: "Алия", lastName: "Ёлкина" },
  );
});

test("formats the full first and last name for the public leaderboard", () => {
  assert.equal(formatPublicDisplayName(" Аружан ", " Касымова "), "Аружан Касымова");
});

test("rejects ticket numbers and control characters in the name-only claim", () => {
  assert.throws(
    () => parseParticipantClaim({ firstName: "Алия\n", lastName: "Ёлкина", ticketNumber: "CL3-101" }),
    (error) => error instanceof LiveInputValidationError
      && error.issues.some((issue) => issue.code === "control_character")
      && error.issues.some((issue) => issue.field === "ticketNumber" && issue.code === "unknown_field"),
  );
});

test("accepts answers from 30 through 350 Unicode characters", () => {
  assert.equal(parseSubmission({ answer: "а".repeat(30) }).answer.length, 30);
  assert.equal(parseSubmission({ answer: "я".repeat(350) }).answer.length, 350);
});

test("timeout mode accepts a non-empty answer for automatic submission", () => {
  assert.deepEqual(parseSubmission({ answer: "Да", mode: "timeout" }), { answer: "Да", mode: "timeout" });
});

test("rejects answers outside 30 through 350 characters", () => {
  assert.throws(
    () => parseSubmission({ answer: "а".repeat(29) }),
    (error) => error instanceof LiveInputValidationError
      && error.issues.some((issue) => issue.code === "too_short"),
  );
  assert.throws(
    () => parseSubmission({ answer: "а".repeat(351) }),
    (error) => error instanceof LiveInputValidationError
      && error.issues.some((issue) => issue.code === "too_long"),
  );
});

test("rejects control characters in answers", () => {
  assert.throws(
    () => parseSubmission({ answer: `${"а".repeat(30)}\u0000` }),
    (error) => error instanceof LiveInputValidationError
      && error.issues.some((issue) => issue.code === "control_character"),
  );
});
