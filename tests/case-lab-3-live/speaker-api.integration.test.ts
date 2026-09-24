import assert from "node:assert/strict";
import test from "node:test";

import "../case-lab-3-payments/server-only-test-loader";

import { handlePost as selectSpeakerAwards } from "../../app/api/case-lab-3/live/selection/route";
import { issueSpeakerToken, parseSpeakerToken } from "../../app/lib/case-lab-3/live/speaker.server";

const ORIGIN = "https://caselab.kz";
const CASE_ID = "00000000-0000-4000-8000-000000000101";
const SECRET = "speaker-api-test-secret-that-is-long-enough";

function request(path: string, body: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: ORIGIN,
      "x-csrf-token": "csrf",
      "idempotency-key": "speaker-test-idempotency",
    },
    body: JSON.stringify(body),
  });
}

test("speaker tokens are bound to case version and expire", () => {
  const now = 1_800_000_000_000;
  const token = issueSpeakerToken(CASE_ID, 7, 60_000, SECRET, now);
  assert.deepEqual(parseSpeakerToken(token, SECRET, now + 30_000), {
    caseId: CASE_ID,
    stateVersion: 7,
    expiresAt: now + 60_000,
  });
  assert.equal(parseSpeakerToken(token, SECRET, now + 60_001), null);
  assert.equal(parseSpeakerToken(token, SECRET, now, CASE_ID, 8), null);
});

test("public speaker selection requires exactly three distinct shortlist positions", async () => {
  let calls = 0;
  const dependencies = {
    selectAwards: async (input: { caseId: string; candidateIndexes: number[] }) => {
      calls += 1;
      assert.equal(input.caseId, CASE_ID);
      assert.deepEqual(input.candidateIndexes, [0, 1, 2]);
      return { kind: "published" as const, stateVersion: 8 };
    },
  };

  const invalid = await selectSpeakerAwards(request("/api/case-lab-3/live/selection", {
    caseId: CASE_ID,
    candidateIndexes: [0, 0, 1],
  }), dependencies);
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);

  const outOfRange = await selectSpeakerAwards(request("/api/case-lab-3/live/selection", {
    caseId: CASE_ID,
    candidateIndexes: [0, 1, 5],
  }), dependencies);
  assert.equal(outOfRange.status, 400);
  assert.equal(calls, 0);

  const valid = await selectSpeakerAwards(request("/api/case-lab-3/live/selection", {
    caseId: CASE_ID,
    candidateIndexes: [0, 1, 2],
  }), dependencies);
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { status: "published", stateVersion: 8 });
  assert.equal(calls, 1);
});
