import "server-only";

import { derivePurposeToken, verifyPurposeToken } from "@/lib/case-lab-3/tokens.server";

import type { NbsEnvironment } from "./contracts";

const SESSION_PURPOSE = "nbs-participant-session";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;

export const NBS_SESSION_COOKIE = "nbs_forum_session";
export const NBS_SESSION_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/nbs/",
  maxAge: 172800,
} as const;

export type NbsSession = {
  environment: NbsEnvironment;
  runId: string;
  participantId: string;
  version: number;
  token: string;
};

function sessionPurpose(environment: NbsEnvironment, runId: string): string {
  return SESSION_PURPOSE + ":" + environment + ":" + runId;
}

export function issueNbsSession(input: Omit<NbsSession, "token">, secret: string): NbsSession {
  if (!UUID_PATTERN.test(input.runId) || !UUID_PATTERN.test(input.participantId)
      || !Number.isSafeInteger(input.version) || input.version < 1) {
    throw new TypeError("NBS participant session identity is invalid");
  }
  return {
    ...input,
    token: derivePurposeToken(secret, sessionPurpose(input.environment, input.runId), input.participantId, input.version),
  };
}

export function serializeNbsSession(session: NbsSession): string {
  if (!UUID_PATTERN.test(session.runId) || !UUID_PATTERN.test(session.participantId)
      || !Number.isSafeInteger(session.version) || session.version < 1 || !TOKEN_PATTERN.test(session.token)) {
    throw new TypeError("NBS participant session is invalid");
  }
  return session.runId + "." + session.participantId + "." + session.version + "." + session.token;
}

export function parseNbsSession(value: string | null | undefined): Omit<NbsSession, "environment"> & { token: string } | null {
  if (typeof value !== "string" || value.length > 180) return null;
  const [runId, participantId, versionText, token, extra] = value.split(".");
  if (extra !== undefined || !runId || !UUID_PATTERN.test(runId) || !participantId || !UUID_PATTERN.test(participantId)
      || !versionText || !/^[1-9]\d*$/u.test(versionText) || !token || !TOKEN_PATTERN.test(token)) return null;
  const version = Number(versionText);
  if (!Number.isSafeInteger(version)) return null;
  return { runId, participantId, version, token };
}

export function verifyNbsSession(
  session: Omit<NbsSession, "environment"> & { token: string },
  environment: NbsEnvironment,
  participant: { id: string; run_id: string; environment: NbsEnvironment; session_token_version: number },
  secret: string,
): boolean {
  return session.participantId === participant.id
    && session.runId === participant.run_id
    && participant.environment === environment
    && session.version === participant.session_token_version
    && verifyPurposeToken(session.token, secret, sessionPurpose(environment, session.runId), session.participantId, session.version);
}
