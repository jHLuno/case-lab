import assert from "node:assert/strict";
import test from "node:test";

import "../case-lab-3-payments/server-only-test-loader";

import { handleDelete, handlePost } from "../../app/api/case-lab-3/live/session/route";
import { handleGet } from "../../app/api/case-lab-3/live/state/route";
import { handlePut } from "../../app/api/case-lab-3/live/cases/[id]/submission/route";
import { handleGet as getPublicLeaderboard } from "../../app/api/case-lab-3/live/leaderboard/route";
import { issueLiveSession, serializeLiveSession } from "../../app/lib/case-lab-3/live/session.server";

const ORIGIN = "https://caselab.kz";
const CASE_ID = "00000000-0000-4000-8000-000000000101";
const PARTICIPANT_ID = "00000000-0000-4000-8000-000000000201";
const SECRET = "live-api-test-secret-that-is-long-enough";
const serializedSession = serializeLiveSession(issueLiveSession(PARTICIPANT_ID, 1, SECRET));

function jsonRequest(path: string, method: string, body: unknown): Request {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(body),
  });
}

function cookieStore(initial = serializedSession) {
  const writes: Array<{ name: string; value: string; options: unknown }> = [];
  return {
    writes,
    store: {
      get: (name: string) => name === "cl3_live_session" && initial ? { value: initial } : undefined,
      set: (name: string, value: string, options: unknown) => writes.push({ name, value, options }),
    },
  };
}

const authorizedParticipant = {
  id: PARTICIPANT_ID,
  environment: "live" as const,
  displayName: "Алия Ёлкина",
};

test("claim issues a private participant cookie and exposes only the public name", async () => {
  const cookies = cookieStore("");
  const response = await handlePost(
    jsonRequest("/api/case-lab-3/live/session", "POST", { firstName: "Алия", lastName: "Ёлкина" }),
    {
      getEnvironment: () => "live",
      claimParticipant: async () => ({
        kind: "claimed",
        participantId: PARTICIPANT_ID,
        tokenVersion: 1,
        displayName: "Алия Ёлкина",
      }),
      issueSession: (participantId, version) => serializeLiveSession(issueLiveSession(participantId, version, SECRET)),
      getCookies: async () => cookies.store,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "claimed", displayName: "Алия Ёлкина" });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(cookies.writes[0]?.name, "cl3_live_session");
  assert.equal(cookies.writes[0]?.value, serializedSession);
  assert.deepEqual(cookies.writes[0]?.options, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/case-lab-3/live",
    maxAge: 172800,
  });
});

test("claim works without a client IP header", async () => {
  const cookies = cookieStore("");
  const response = await handlePost(
    jsonRequest("/api/case-lab-3/live/session", "POST", { firstName: "Тест", lastName: "Участник" }),
    {
      getEnvironment: () => "live",
      claimParticipant: async () => ({
        kind: "claimed",
        participantId: PARTICIPANT_ID,
        tokenVersion: 1,
        displayName: "Тест Участник",
      }),
      issueSession: (participantId, version) => serializeLiveSession(issueLiveSession(participantId, version, SECRET)),
      getCookies: async () => cookies.store,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "claimed", displayName: "Тест Участник" });
  assert.equal(cookies.writes[0]?.name, "cl3_live_session");
});

test("claim uses only the submitted first and last name", async () => {
  const response = await handlePost(
    jsonRequest("/api/case-lab-3/live/session", "POST", { firstName: "Алия", lastName: "Ёлкина" }),
    {
      getEnvironment: () => "live",
      claimParticipant: async (input) => {
        assert.deepEqual(input, { firstName: "Алия", lastName: "Ёлкина" });
        return { kind: "claimed", participantId: PARTICIPANT_ID, tokenVersion: 1, displayName: "Алия Ёлкина" };
      },
      issueSession: (participantId, version) => serializeLiveSession(issueLiveSession(participantId, version, SECRET)),
      getCookies: async () => cookieStore("").store,
    },
  );
  assert.deepEqual(await response.json(), { status: "claimed", displayName: "Алия Ёлкина" });
});

test("returns a middle-name challenge without issuing a cookie for a duplicate name", async () => {
  const cookies = cookieStore("");
  const response = await handlePost(
    jsonRequest("/api/case-lab-3/live/session", "POST", { firstName: "Алия", lastName: "Ёлкина" }),
    {
      getEnvironment: () => "live",
      claimParticipant: async () => ({ kind: "needs_middle_name" } as never),
      getCookies: async () => cookies.store,
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "needs_middle_name" });
  assert.equal(cookies.writes.length, 0);
});

test("claim collapses missing and already claimed participants into one public response", async () => {
  for (const kind of ["not_found", "already_claimed"] as const) {
    const response = await handlePost(
      jsonRequest("/api/case-lab-3/live/session", "POST", { firstName: "Нет", lastName: "Гостя" }),
      {
        getEnvironment: () => "live",
        claimParticipant: async () => ({ kind }),
      },
    );
    assert.deepEqual(await response.json(), { status: "not_available" });
  }
});

test("logout expires the live cookie", async () => {
  const cookies = cookieStore();
  const response = await handleDelete(new Request(`${ORIGIN}/api/case-lab-3/live/session`, {
    method: "DELETE",
    headers: { origin: ORIGIN },
  }), { getCookies: async () => cookies.store });

  assert.equal(response.status, 200);
  assert.equal(cookies.writes[0]?.value, "");
  assert.equal((cookies.writes[0]?.options as { maxAge?: number }).maxAge, 0);
});

test("state rejects a missing session and returns only sanitized participant data", async () => {
  const missing = cookieStore("");
  const missingResponse = await handleGet(new Request(`${ORIGIN}/api/case-lab-3/live/state`), {
    getCookies: async () => missing.store,
  });
  assert.equal(missingResponse.status, 401);

  const present = cookieStore();
  const state = {
    participant: { displayName: "Алия Ёлкина", points: 10, rank: 2 },
    activeCase: {
      id: CASE_ID,
      caseNumber: 1,
      questionNumber: 1,
      speakerLabel: "Спикер",
      question: "Что вы предложите?",
      state: "open" as const,
      closesAt: "2026-09-24T10:00:00.000Z",
      answer: null,
      answerLocked: false,
    },
    leaderboard: [{ participantId: PARTICIPANT_ID, displayName: "Алия Ёлкина", points: 10, firstPlaces: 0, podiums: 0, rank: 2 }],
  };
  const response = await handleGet(new Request(`${ORIGIN}/api/case-lab-3/live/state`), {
    getCookies: async () => present.store,
    getEnvironment: () => "live",
    authorizeParticipant: async () => authorizedParticipant,
    loadState: async () => state,
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), state);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("submission saves an answer for the authorized participant", async () => {
  const cookies = cookieStore();
  const response = await handlePut(
    jsonRequest(`/api/case-lab-3/live/cases/${CASE_ID}/submission`, "PUT", { answer: "а".repeat(30) }),
    { params: Promise.resolve({ id: CASE_ID }) },
    {
      getCookies: async () => cookies.store,
      getEnvironment: () => "live",
      authorizeParticipant: async () => authorizedParticipant,
      saveSubmission: async () => ({
        kind: "saved",
        submissionId: "00000000-0000-4000-8000-000000000301",
        contentVersion: 1,
        savedAt: "2026-09-24T09:55:00.000Z",
        participationPoints: 10,
      }),
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    status: "saved",
    contentVersion: 1,
    savedAt: "2026-09-24T09:55:00.000Z",
    participationPoints: 10,
  });
});

test("submission maps a server-side close to conflict", async () => {
  const response = await handlePut(
    jsonRequest(`/api/case-lab-3/live/cases/${CASE_ID}/submission`, "PUT", { answer: "а".repeat(30) }),
    { params: Promise.resolve({ id: CASE_ID }) },
    {
      getCookies: async () => cookieStore().store,
      getEnvironment: () => "live",
      authorizeParticipant: async () => authorizedParticipant,
      saveSubmission: async () => ({ kind: "closed" }),
    },
  );
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "case_closed" });
});

test("submission allows the timeout path to save a short non-empty answer once", async () => {
  let receivedMode: string | null = null;
  const response = await handlePut(
    jsonRequest(`/api/case-lab-3/live/cases/${CASE_ID}/submission`, "PUT", { answer: "Да", mode: "timeout" }),
    { params: Promise.resolve({ id: CASE_ID }) },
    {
      getCookies: async () => cookieStore().store,
      getEnvironment: () => "live",
      authorizeParticipant: async () => authorizedParticipant,
      saveSubmission: async (input) => {
        receivedMode = input.mode;
        return { kind: "saved", submissionId: "00000000-0000-4000-8000-000000000302", contentVersion: 1, savedAt: "2026-09-24T09:59:59.000Z", participationPoints: 10 };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(receivedMode, "timeout");
});

test("submission maps a duplicate answer to a conflict without allowing an edit", async () => {
  const response = await handlePut(
    jsonRequest(`/api/case-lab-3/live/cases/${CASE_ID}/submission`, "PUT", { answer: "а".repeat(30) }),
    { params: Promise.resolve({ id: CASE_ID }) },
    {
      getCookies: async () => cookieStore().store,
      getEnvironment: () => "live",
      authorizeParticipant: async () => authorizedParticipant,
      saveSubmission: async () => ({ kind: "already_submitted" }),
    },
  );

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: "already_submitted" });
});

test("submission rejects oversized bodies and hides database failures", async () => {
  const oversized = await handlePut(
    jsonRequest(`/api/case-lab-3/live/cases/${CASE_ID}/submission`, "PUT", { answer: "а".repeat(5000) }),
    { params: Promise.resolve({ id: CASE_ID }) },
  );
  assert.equal(oversized.status, 413);

  const failed = await handlePut(
    jsonRequest(`/api/case-lab-3/live/cases/${CASE_ID}/submission`, "PUT", { answer: "а".repeat(30) }),
    { params: Promise.resolve({ id: CASE_ID }) },
    {
      getCookies: async () => cookieStore().store,
      getEnvironment: () => "live",
      authorizeParticipant: async () => authorizedParticipant,
      saveSubmission: async () => { throw new Error("database detail"); },
    },
  );
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { error: "service_unavailable" });
});

test("public leaderboard strips internal identifiers and AI rationale", async () => {
  const response = await getPublicLeaderboard(new Request(`${ORIGIN}/api/case-lab-3/live/leaderboard`), {
    getPublicData: async () => ({
      entries: [{ participantId: PARTICIPANT_ID, displayName: "Алия Ёлкина", points: 60, rank: 1, firstPlaces: 1, podiums: 1 }],
      activeCase: { caseNumber: 1, state: "awarded" as const },
      podiumAnswers: [{ place: 1, displayName: "Алия Ёлкина", answer: "Опубликованный ответ победителя.", submissionId: "hidden" }],
      questionAnswers: [{ id: CASE_ID, caseNumber: 1, questionNumber: 1, question: "Что предложите?", state: "shortlist_ready" as const, answers: [{ candidateId: "hidden", displayName: "Алия Ёлкина", answer: "Сильный ответ." }] }],
    }),
    getEnvironment: () => "live",
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(body, {
    entries: [{ displayName: "Алия Ёлкина", points: 60, rank: 1 }],
    activeCase: { caseNumber: 1, state: "awarded" },
    podiumAnswers: [{ place: 1, displayName: "Алия Ёлкина", answer: "Опубликованный ответ победителя." }],
    questionAnswers: [{ id: CASE_ID, caseNumber: 1, questionNumber: 1, question: "Что предложите?", state: "shortlist_ready", answers: [{ displayName: "Алия Ёлкина", answer: "Сильный ответ." }] }],
  });
  assert.equal(JSON.stringify(body).includes(PARTICIPANT_ID), false);
  assert.equal(JSON.stringify(body).includes("submissionId"), false);
});
