import assert from "node:assert/strict";
import test from "node:test";

import "../case-lab-3-payments/server-only-test-loader";

import { handlePost as issueSpeakerSession } from "../../app/api/admin/case-lab-3/live/speaker-session/route";
import { handlePost as selectSpeakerAwards } from "../../app/api/case-lab-3/live/selection/route";
import { issueSpeakerToken, parseSpeakerToken } from "../../app/lib/case-lab-3/live/speaker.server";

const ORIGIN = "https://caselab.kz";
const CASE_ID = "00000000-0000-4000-8000-000000000101";
const CANDIDATE_IDS = [
  "00000000-0000-4000-8000-000000000301",
  "00000000-0000-4000-8000-000000000302",
  "00000000-0000-4000-8000-000000000303",
];
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

test("CRM can issue a speaker URL only for the current case version", async () => {
  let received: unknown;
  const response = await issueSpeakerSession(
    request("/api/admin/case-lab-3/live/speaker-session", { caseId: CASE_ID, expectedVersion: 7 }),
    {
      requireCrmAdmin: async () => ({ role: "crm_admin", token: "crm-token" }),
      verifyCrmMutation: () => true,
      issueSpeakerLink: async (input) => {
        received = input;
        return { kind: "issued" as const, url: `${ORIGIN}/case-lab-3/live/leaderboard#speakerToken=token`, expiresAt: "2026-09-24T10:15:00.000Z" };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(received, { caseId: CASE_ID, expectedVersion: 7, origin: ORIGIN });
  assert.deepEqual(await response.json(), { url: `${ORIGIN}/case-lab-3/live/leaderboard#speakerToken=token`, expiresAt: "2026-09-24T10:15:00.000Z" });
});

test("speaker selection requires exactly three distinct candidates", async () => {
  let calls = 0;
  const dependencies = {
    selectAwards: async (input: { token: string; candidateIds: string[] }) => {
      calls += 1;
      assert.equal(input.token, "speaker-token");
      assert.deepEqual(input.candidateIds, CANDIDATE_IDS);
      return { kind: "published" as const, stateVersion: 8 };
    },
  };

  const invalid = await selectSpeakerAwards(request("/api/case-lab-3/live/selection", {
    speakerToken: "speaker-token",
    candidateIds: [CANDIDATE_IDS[0], CANDIDATE_IDS[0], CANDIDATE_IDS[1]],
  }), dependencies);
  assert.equal(invalid.status, 400);
  assert.equal(calls, 0);

  const valid = await selectSpeakerAwards(request("/api/case-lab-3/live/selection", {
    speakerToken: "speaker-token",
    candidateIds: CANDIDATE_IDS,
  }), dependencies);
  assert.equal(valid.status, 200);
  assert.deepEqual(await valid.json(), { status: "published", stateVersion: 8 });
  assert.equal(calls, 1);
});
