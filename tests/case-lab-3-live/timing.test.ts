import assert from "node:assert/strict";
import test from "node:test";

import {
  LIVE_ROUND_SETTLE_GRACE_MS,
  analysisDelayMs,
  isAnalysisReady,
} from "../../app/lib/case-lab-3/live/timing";

test("round analysis waits for the participant submission settlement window", () => {
  assert.equal(LIVE_ROUND_SETTLE_GRACE_MS, 15_000);
  assert.equal(analysisDelayMs(180_000, 0), 195_000);
  assert.equal(isAnalysisReady(180_000, 194_999), false);
  assert.equal(isAnalysisReady(180_000, 195_000), true);
});
