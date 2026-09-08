import assert from "node:assert/strict";
import test from "node:test";

import { formatKzt, minorToMajor } from "../../app/lib/case-lab-3/money";

test("formats approved ticket amounts from integer minor units", () => {
  assert.equal(minorToMajor(789000), 7890);
  assert.equal(minorToMajor(789001), 7890.01);
  assert.equal(formatKzt(1500000), "15 000 ₸");
  assert.throws(() => minorToMajor(789000.5), /integer minor units/i);
});

test("rejects negative and unsafe minor-unit amounts", () => {
  assert.throws(() => minorToMajor(-1), /non-negative/i);
  assert.throws(() => minorToMajor(Number.MAX_SAFE_INTEGER + 1), /safe integer/i);
});
