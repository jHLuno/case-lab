import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

const SPEAKER_TOKEN_PURPOSE = "case-lab-3-live-speaker-selection";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const MAX_TTL_MS = 60 * 60 * 1000;

export type SpeakerTokenPayload = {
  caseId: string;
  stateVersion: number;
  expiresAt: number;
};

function tokenSecret(): string {
  const value = process.env.CASE_LAB_3_TOKEN_SECRET?.trim();
  if (!value || value.length < 32) throw new Error("CASE_LAB_3_TOKEN_SECRET is required");
  return value;
}

function encode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decode(value: string): string | null {
  try {
    const decoded = Buffer.from(value, "base64url").toString("utf8");
    return decoded && encode(decoded) === value ? decoded : null;
  } catch {
    return null;
  }
}

function signature(payload: string, secret: string): Buffer {
  return createHmac("sha256", secret).update(`${SPEAKER_TOKEN_PURPOSE}\0${payload}`, "utf8").digest();
}

export function issueSpeakerToken(
  caseId: string,
  stateVersion: number,
  ttlMs = DEFAULT_TTL_MS,
  secret = tokenSecret(),
  now = Date.now(),
): string {
  if (!UUID_PATTERN.test(caseId) || !Number.isSafeInteger(stateVersion) || stateVersion < 1) {
    throw new TypeError("Speaker selection identity is invalid");
  }
  if (!Number.isSafeInteger(ttlMs) || ttlMs < 1 || ttlMs > MAX_TTL_MS) {
    throw new RangeError("Speaker selection expiry is invalid");
  }
  const expiresAt = now + ttlMs;
  const payload = encode(JSON.stringify({ caseId, stateVersion, expiresAt, nonce: randomUUID() }));
  return `${payload}.${signature(payload, secret).toString("base64url")}`;
}

export function parseSpeakerToken(
  value: string | null | undefined,
  secret = tokenSecret(),
  now = Date.now(),
  expectedCaseId?: string,
  expectedStateVersion?: number,
): SpeakerTokenPayload | null {
  if (typeof value !== "string" || value.length > 512 || !TOKEN_PATTERN.test(value)) return null;
  const [payload, encodedSignature] = value.split(".");
  const decodedPayload = decode(payload);
  if (!decodedPayload || !encodedSignature) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedPayload);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const caseId = record.caseId;
  const stateVersion = record.stateVersion;
  const expiresAt = record.expiresAt;
  const nonce = record.nonce;
  if (
    typeof caseId !== "string"
    || !UUID_PATTERN.test(caseId)
    || !Number.isSafeInteger(stateVersion)
    || (stateVersion as number) < 1
    || !Number.isSafeInteger(expiresAt)
    || (expiresAt as number) <= now
    || typeof nonce !== "string"
    || !UUID_PATTERN.test(nonce)
    || (expectedCaseId !== undefined && expectedCaseId !== caseId)
    || (expectedStateVersion !== undefined && expectedStateVersion !== stateVersion)
  ) return null;

  try {
    const actual = Buffer.from(encodedSignature, "base64url");
    const expected = signature(payload, secret);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return null;
  } catch {
    return null;
  }

  return { caseId, stateVersion: stateVersion as number, expiresAt: expiresAt as number };
}
