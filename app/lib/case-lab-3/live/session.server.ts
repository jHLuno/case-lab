import "server-only";

import type { PaymentEnvironment } from "../contracts";
import { derivePurposeToken, verifyPurposeToken } from "../tokens.server";
import type { LiveSession, LiveSessionParticipant } from "./contracts";

const LIVE_SESSION_PURPOSE = "live-participant-session";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export const LIVE_SESSION_COOKIE = "cl3_live_session";
export const LIVE_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/case-lab-3/live",
  maxAge: 172800,
} as const;

export class LiveSessionAuthorizationError extends Error {
  readonly code = "live_session_unauthorized" as const;

  constructor() {
    super("Live participant session is not authorized");
    this.name = "LiveSessionAuthorizationError";
  }
}

function tokenSecret(): string {
  const value = process.env.CASE_LAB_3_TOKEN_SECRET?.trim();
  if (!value) {
    throw new Error("CASE_LAB_3_TOKEN_SECRET is required");
  }
  return value;
}

function validVersion(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

export function issueLiveSession(
  participantId: string,
  version: number,
  secret = tokenSecret(),
): LiveSession {
  if (!UUID_PATTERN.test(participantId) || !validVersion(version)) {
    throw new TypeError("Live participant session identity is invalid");
  }
  return {
    participantId,
    version,
    token: derivePurposeToken(secret, LIVE_SESSION_PURPOSE, participantId, version),
  };
}

export function serializeLiveSession(session: LiveSession): string {
  if (
    !UUID_PATTERN.test(session.participantId)
    || !validVersion(session.version)
    || !TOKEN_PATTERN.test(session.token)
  ) {
    throw new TypeError("Live participant session is invalid");
  }
  return `${session.participantId}.${session.version}.${session.token}`;
}

export function parseLiveSession(value: string | null | undefined): LiveSession | null {
  if (typeof value !== "string" || value.length > 100) {
    return null;
  }
  const [participantId, versionText, token, extra] = value.split(".");
  if (
    extra !== undefined
    || !participantId
    || !UUID_PATTERN.test(participantId)
    || !versionText
    || !/^[1-9]\d*$/u.test(versionText)
    || !token
    || !TOKEN_PATTERN.test(token)
  ) {
    return null;
  }
  const version = Number(versionText);
  return validVersion(version) ? { participantId, version, token } : null;
}

export function assertLiveSession(
  session: LiveSession,
  participant: LiveSessionParticipant,
  expectedEnvironment: PaymentEnvironment,
  secret = tokenSecret(),
): void {
  if (
    session.participantId !== participant.id
    || session.version !== participant.sessionTokenVersion
    || participant.environment !== expectedEnvironment
    || participant.claimStatus !== "active"
    || participant.ticketStatus !== "used"
    || participant.ticketRevisionId !== participant.currentRevisionId
    || !verifyPurposeToken(
      session.token,
      secret,
      LIVE_SESSION_PURPOSE,
      participant.id,
      participant.sessionTokenVersion,
    )
  ) {
    throw new LiveSessionAuthorizationError();
  }
}
