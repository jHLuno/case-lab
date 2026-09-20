import assert from "node:assert/strict";
import test from "node:test";

import "../case-lab-3-payments/server-only-test-loader";

import {
  LIVE_SESSION_COOKIE,
  LIVE_SESSION_COOKIE_OPTIONS,
  LiveSessionAuthorizationError,
  assertLiveSession,
  issueLiveSession,
  parseLiveSession,
  serializeLiveSession,
} from "../../app/lib/case-lab-3/live/session.server";

const PARTICIPANT_ID = "00000000-0000-4000-8000-000000000001";
const SECRET = "test-secret-that-is-long-enough-for-session-signing";

test("issues and parses the exact participant cookie format", () => {
  const session = issueLiveSession(PARTICIPANT_ID, 3, SECRET);
  const serialized = serializeLiveSession(session);

  assert.match(serialized, /^[0-9a-f-]{36}\.3\.[A-Za-z0-9_-]{43}$/u);
  assert.deepEqual(parseLiveSession(serialized), session);
  assert.equal(LIVE_SESSION_COOKIE, "cl3_live_session");
  assert.deepEqual(LIVE_SESSION_COOKIE_OPTIONS, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/case-lab-3/live",
    maxAge: 172800,
  });
});

test("rejects malformed and tampered participant sessions", () => {
  const serialized = serializeLiveSession(issueLiveSession(PARTICIPANT_ID, 1, SECRET));
  assert.equal(parseLiveSession("not-a-session"), null);

  const parsed = parseLiveSession(serialized);
  assert.ok(parsed);
  assert.throws(
    () => assertLiveSession(parsed, {
      id: PARTICIPANT_ID,
      environment: "live",
      sessionTokenVersion: 1,
      claimStatus: "active",
      ticketStatus: "used",
      ticketRevisionId: "revision-a",
      currentRevisionId: "revision-a",
    }, "live", `${SECRET}-tampered`),
    LiveSessionAuthorizationError,
  );

  const tampered = parseLiveSession(`${serialized.slice(0, -1)}x`);
  assert.ok(tampered);
  assert.throws(
    () => assertLiveSession(tampered, {
      id: PARTICIPANT_ID,
      environment: "live",
      sessionTokenVersion: 1,
      claimStatus: "active",
      ticketStatus: "used",
      ticketRevisionId: "revision-a",
      currentRevisionId: "revision-a",
    }, "live", SECRET),
    LiveSessionAuthorizationError,
  );
});

test("authorizes only the active current participant and matching environment", () => {
  const session = issueLiveSession(PARTICIPANT_ID, 2, SECRET);
  const participant = {
    id: PARTICIPANT_ID,
    environment: "live" as const,
    sessionTokenVersion: 2,
    claimStatus: "active" as const,
    ticketStatus: "used" as const,
    ticketRevisionId: "revision-current",
    currentRevisionId: "revision-current",
  };

  assert.doesNotThrow(() => assertLiveSession(session, participant, "live", SECRET));

  for (const invalid of [
    { ...participant, claimStatus: "reset" as const },
    { ...participant, ticketStatus: "cancelled" as const },
    { ...participant, currentRevisionId: "revision-new" },
    { ...participant, sessionTokenVersion: 3 },
  ]) {
    assert.throws(
      () => assertLiveSession(session, invalid, "live", SECRET),
      LiveSessionAuthorizationError,
    );
  }

  assert.throws(
    () => assertLiveSession(session, participant, "test", SECRET),
    LiveSessionAuthorizationError,
  );
});
