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
    parseParticipantClaim({ firstName: "  Алия ", lastName: " Ёлкина  ", ticketNumber: " CL3-101 " }),
    { firstName: "Алия", lastName: "Ёлкина", ticketNumber: "CL3-101" },
  );
});

test("formats only the first name and last-name initial", () => {
  assert.equal(formatPublicDisplayName(" Аружан ", " Касымова "), "Аружан К.");
});

test("rejects unknown claim fields and control characters", () => {
  assert.throws(
    () => parseParticipantClaim({ firstName: "Алия\n", lastName: "Ёлкина", email: "hidden@example.test" }),
    (error) => error instanceof LiveInputValidationError
      && error.issues.some((issue) => issue.code === "control_character")
      && error.issues.some((issue) => issue.code === "unknown_field"),
  );
});

test("accepts answers from 30 through 300 Unicode characters", () => {
  assert.equal(parseSubmission({ answer: "а".repeat(30) }).answer.length, 30);
  assert.equal(parseSubmission({ answer: "я".repeat(300) }).answer.length, 300);
});

test("rejects answers outside 30 through 300 characters", () => {
  assert.throws(
    () => parseSubmission({ answer: "а".repeat(29) }),
    (error) => error instanceof LiveInputValidationError
      && error.issues.some((issue) => issue.code === "too_short"),
  );
  assert.throws(
    () => parseSubmission({ answer: "а".repeat(301) }),
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
