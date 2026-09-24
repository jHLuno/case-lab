import assert from "node:assert/strict";
import test from "node:test";

import "../case-lab-3-payments/server-only-test-loader";

import { handleGet as getLive, handlePut as saveLiveCase } from "../../app/api/admin/case-lab-3/live/route";
import { handlePost as issueSpeakerSession } from "../../app/api/admin/case-lab-3/live/speaker-session/route";
import { handlePost as transition } from "../../app/api/admin/case-lab-3/live/cases/[id]/transition/route";
import { handlePost as resetTimer } from "../../app/api/admin/case-lab-3/live/cases/[id]/reset-timer/route";
import { handlePost as rubric } from "../../app/api/admin/case-lab-3/live/cases/[id]/rubric/route";
import { handlePost as analyze } from "../../app/api/admin/case-lab-3/live/cases/[id]/analyze/route";
import { handlePost as awards } from "../../app/api/admin/case-lab-3/live/cases/[id]/awards/route";
import { handlePatch as shortlist } from "../../app/api/admin/case-lab-3/live/cases/[id]/shortlist/route";
import { handlePost as reset } from "../../app/api/admin/case-lab-3/live/participants/[id]/reset/route";
import { handlePost as tieBreak } from "../../app/api/admin/case-lab-3/live/tie-breaks/route";
import { handlePost as analyzeArchive } from "../../app/api/admin/case-lab-3/live/cases/[id]/analyze/route";
import { handlePost as awardArchive } from "../../app/api/admin/case-lab-3/live/cases/[id]/awards/route";
import { handlePost as resetTimerArchive } from "../../app/api/admin/case-lab-3/live/cases/[id]/reset-timer/route";

const ORIGIN = "https://caselab.kz";
const CASE_ID = "00000000-0000-4000-8000-000000000101";
const ADMIN = { role: "crm_admin" as const, token: "crm-token" };

function request(path: string, method: string, body?: unknown, secure = true): Request {
  const headers = new Headers({ origin: ORIGIN });
  if (body !== undefined) headers.set("content-type", "application/json");
  if (secure) {
    headers.set("x-csrf-token", "csrf-token");
    headers.set("idempotency-key", "cl3-live-idempotency");
  }
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

const auth = {
  requireCrmAdmin: async () => ADMIN,
  verifyCrmMutation: () => true,
};

const routeContext = { params: Promise.resolve({ id: CASE_ID }) };

test("operator dashboard rejects unauthenticated access", async () => {
  const response = await getLive(request("/api/admin/case-lab-3/live", "GET"), {
    requireCrmAdmin: async () => null,
  });
  assert.equal(response.status, 401);
});

test("operator dashboard ignores test environment overrides", async () => {
  let requestedEnvironment: string | null = null;
  const response = await getLive(request("/api/admin/case-lab-3/live?environment=test", "GET"), {
    ...auth,
    getEnvironment: () => "live",
    getSnapshot: async (environment) => {
      requestedEnvironment = environment;
      return { environment, cases: [], participants: [], submissions: [], aiRuns: [], shortlist: [], awards: [], tieBreaks: [], leaderboard: [] };
    },
  });
  assert.equal(response.status, 200);
  assert.equal(requestedEnvironment, "live");
});

test("production CRM archive preserves snapshot reads and rejects every live write", async () => {
  const nodeEnvironment = process.env as unknown as Record<string, string | undefined>;
  const originalNodeEnv = nodeEnvironment.NODE_ENV;
  nodeEnvironment.NODE_ENV = "production";
  try {
    let snapshotCalls = 0;
    const snapshot = await getLive(request("/api/admin/case-lab-3/live", "GET"), {
      ...auth,
      getEnvironment: () => "live",
      getSnapshot: async () => {
        snapshotCalls += 1;
        return { environment: "live", cases: [], participants: [], submissions: [], aiRuns: [], shortlist: [], awards: [], tieBreaks: [], leaderboard: [] };
      },
    });
    assert.equal(snapshot.status, 200);
    assert.equal(snapshotCalls, 1);

    const writes = [
      await saveLiveCase(request("/api/admin/case-lab-3/live", "PUT", {}), auth),
      await issueSpeakerSession(request("/api/admin/case-lab-3/live/speaker-session", "POST", {}), auth),
      await tieBreak(request("/api/admin/case-lab-3/live/tie-breaks", "POST", {}), auth),
      await analyzeArchive(request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/analyze`, "POST", {}), routeContext, auth),
      await awardArchive(request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/awards`, "POST", {}), routeContext, auth),
      await resetTimerArchive(request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/reset-timer`, "POST", {}), routeContext, auth),
      await rubric(request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/rubric`, "POST", {}), routeContext, auth),
      await shortlist(request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/shortlist`, "PATCH", {}), routeContext, auth),
      await transition(request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/transition`, "POST", {}), routeContext, auth),
      await reset(request("/api/admin/case-lab-3/live/participants/00000000-0000-4000-8000-000000000201/reset", "POST", {}), { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000201" }) }, auth),
    ];

    for (const response of writes) {
      assert.equal(response.status, 410);
      assert.deepEqual(await response.json(), { error: "event_ended" });
      assert.equal(response.headers.get("cache-control"), "no-store");
    }
  } finally {
    if (originalNodeEnv === undefined) delete nodeEnvironment.NODE_ENV;
    else nodeEnvironment.NODE_ENV = originalNodeEnv;
  }
});

test("operator mutations require CRM mutation verification", async () => {
  const response = await transition(
    request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/transition`, "POST", { expectedVersion: 1, state: "open" }, false),
    routeContext,
    { ...auth, verifyCrmMutation: () => false },
  );
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: "forbidden" });
});

test("operator can generate and store a draft rubric", async () => {
  let savedRubric: unknown = null;
  const response = await rubric(
    request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/rubric`, "POST", {}),
    routeContext,
    {
      ...auth,
      getCase: async () => ({
        id: CASE_ID,
        state: "draft" as const,
        question: "Какое решение вы предложите?",
        referenceAnswer: "Проверить гипотезу экспериментом.",
        context: null,
        keyInsight: null,
      }),
      generateRubric: async () => ({ criteria: [{ name: "relevance", description: "Связь с вопросом", weight: 100 }] }),
      saveRubric: async (_caseId, value) => { savedRubric = value; },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(savedRubric, { criteria: [{ name: "relevance", description: "Связь с вопросом", weight: 100 }] });
});

test("operator can transition a case with an expected version", async () => {
  const response = await transition(
    request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/transition`, "POST", {
      expectedVersion: 1,
      state: "open",
      closesAt: "2026-09-24T10:30:00.000Z",
    }),
    routeContext,
    { ...auth, transitionCase: async () => ({ kind: "transitioned", state: "open", stateVersion: 2, closesAt: "2026-09-24T10:30:00.000Z" }) },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "transitioned", state: "open", stateVersion: 2, closesAt: "2026-09-24T10:30:00.000Z" });
});

test("operator can reset an open timer with an expected version", async () => {
  let input: unknown = null;
  const response = await resetTimer(
    request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/reset-timer`, "POST", { expectedVersion: 4 }),
    routeContext,
    {
      ...auth,
      resetTimer: async (value) => {
        input = value;
        return { kind: "timer_reset", state: "open", stateVersion: 5, closesAt: "2026-09-24T10:33:00.000Z" };
      },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(input, { caseId: CASE_ID, expectedVersion: 4, actorId: ADMIN.role });
  assert.deepEqual(await response.json(), { status: "timer_reset", state: "open", stateVersion: 5, closesAt: "2026-09-24T10:33:00.000Z" });
});

test("AI failure leaves submissions intact and enables manual shortlist mode", async () => {
  let failedRun: unknown = null;
  const response = await analyze(
    request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/analyze`, "POST", { expectedVersion: 2 }),
    routeContext,
    {
      ...auth,
      getEnvironment: () => "live",
      transitionCase: async () => ({ kind: "transitioned", state: "analyzing", stateVersion: 3, closesAt: null }),
      getCaseAndSubmissions: async () => ({
        question: "Вопрос",
        referenceAnswer: "Эталон",
        context: null,
        approvedRubric: { criteria: [] },
        submissions: [{ submissionId: "sub-1", answer: "Длинный ответ участника, который содержит достаточно много символов для оценки." }],
      }),
      generateShortlist: async () => { throw new Error("timeout"); },
      saveAiRun: async (value) => { failedRun = value; },
      saveFailedAiRun: async (value) => { failedRun = { ...value, status: "failed" }; },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "manual_mode", reason: "ai_unavailable" });
  assert.equal((failedRun as { status: string }).status, "failed");
});

test("awards require three distinct submission IDs and preserve server authority", async () => {
  let input: unknown = null;
  const response = await awards(
    request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/awards`, "POST", {
      expectedVersion: 5,
      awards: [
        { place: 1, submissionId: "sub-1" },
        { place: 2, submissionId: "sub-2" },
        { place: 3, submissionId: "sub-3" },
      ],
    }),
    routeContext,
    {
      ...auth,
      publishAwards: async (value) => { input = value; return { kind: "published", state: "awarded", stateVersion: 6 }; },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual((input as { awards: unknown }).awards, [
    { place: 1, submissionId: "sub-1" },
    { place: 2, submissionId: "sub-2" },
    { place: 3, submissionId: "sub-3" },
  ]);
});

test("manual shortlist mode can add an answer when AI produced no entries", async () => {
  let input: unknown = null;
  const response = await shortlist(
    request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/shortlist`, "PATCH", {
      environment: "live",
      entries: [{ submissionId: "sub-1", included: true, finalOrder: 1, operatorReason: "Решение добавлено спикером" }],
    }),
    routeContext,
    {
      ...auth,
      updateShortlist: async (value) => { input = value; },
    },
  );
  assert.equal(response.status, 200);
  assert.deepEqual(input, {
    caseId: CASE_ID,
    environment: "live",
    entries: [{ submissionId: "sub-1", included: true, finalOrder: 1, operatorReason: "Решение добавлено спикером" }],
  });
});

test("manual shortlist rejects the test environment", async () => {
  const response = await shortlist(
    request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/shortlist`, "PATCH", {
      environment: "test",
      entries: [{ submissionId: "sub-1", included: true, finalOrder: 1, operatorReason: "Решение добавлено спикером" }],
    }),
    routeContext,
    { ...auth, updateShortlist: async () => { throw new Error("should not update test shortlist"); } },
  );
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "invalid_request" });
});

test("manual shortlist is capped at five unique answers", async () => {
  let called = false;
  const response = await shortlist(
    request(`/api/admin/case-lab-3/live/cases/${CASE_ID}/shortlist`, "PATCH", {
      environment: "live",
      entries: Array.from({ length: 6 }, (_, index) => ({ submissionId: `sub-${index + 1}`, included: true, finalOrder: index + 1 })),
    }),
    routeContext,
    { ...auth, updateShortlist: async () => { called = true; } },
  );
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("tie resolution requires a reason and ordered participant decisions", async () => {
  const response = await tieBreak(
    request("/api/admin/case-lab-3/live/tie-breaks", "POST", {
      decisions: [{ participantId: "participant-1", rank: 1 }, { participantId: "participant-2", rank: 2 }],
      reason: "",
    }),
    { ...auth, resolveTie: async () => ({ kind: "resolved" }) },
  );
  assert.equal(response.status, 400);
});

test("participant reset requires an explicit reason", async () => {
  const response = await reset(
    request("/api/admin/case-lab-3/live/participants/00000000-0000-4000-8000-000000000201/reset", "POST", { reason: "" }),
    { params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000201" }) },
    { ...auth, resetParticipant: async () => ({ kind: "reset" }) },
  );
  assert.equal(response.status, 400);
});

test("operator dashboard hides service details on database failure", async () => {
  const response = await getLive(request("/api/admin/case-lab-3/live", "GET"), {
    ...auth,
    getSnapshot: async () => { throw new Error("database password leaked"); },
  });
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { error: "service_unavailable" });
});
