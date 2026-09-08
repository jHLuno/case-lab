import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

const QR_PREFIX = "cl3";
const QR_TOKEN_LENGTH = 43;
const MAX_QR_PAYLOAD_LENGTH = 128;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export type TicketQrPayload = {
  ticketId: string;
  revisionNumber: number;
};

function assertSecret(secret: string): void {
  if (typeof secret !== "string" || secret.length === 0) {
    throw new TypeError("Token secret must be a non-empty string");
  }
}

function assertVersion(version: number): void {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new RangeError("Token version must be a positive safe integer");
  }
}

function canonicalUuid(ticketId: string): string {
  if (typeof ticketId !== "string") {
    throw new TypeError("Ticket ID must be a UUID");
  }

  if (!UUID_PATTERN.test(ticketId)) {
    throw new TypeError("Ticket ID must be a UUID");
  }

  return ticketId;
}

function hmac(secret: string, input: string): Buffer {
  assertSecret(secret);
  return createHmac("sha256", secret).update(input, "utf8").digest();
}

function encodeBase64Url(value: Buffer): string {
  return value.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeHmacToken(value: string): Buffer | null {
  if (typeof value !== "string" || value.length !== QR_TOKEN_LENGTH || !BASE64URL_PATTERN.test(value)) {
    return null;
  }

  const decoded = Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64");
  return decoded.length === 32 && encodeBase64Url(decoded) === value ? decoded : null;
}

function purposeInput(purpose: string, entityId: string, version: number): string {
  if (typeof purpose !== "string" || purpose.length === 0 || purpose.includes("\0")) {
    throw new TypeError("Token purpose is invalid");
  }
  if (typeof entityId !== "string" || entityId.length === 0 || entityId.includes("\0")) {
    throw new TypeError("Token entity ID is invalid");
  }
  assertVersion(version);

  return `${purpose}\0${entityId}\0${version}`;
}

export function derivePurposeToken(secret: string, purpose: string, entityId: string, version: number): string {
  return encodeBase64Url(hmac(secret, purposeInput(purpose, entityId, version)));
}

export function verifyPurposeToken(
  token: string,
  secret: string,
  purpose: string,
  entityId: string,
  version: number,
): boolean {
  try {
    const actual = decodeHmacToken(token);
    if (!actual) {
      return false;
    }

    const expected = Buffer.from(derivePurposeToken(secret, purpose, entityId, version)
      .replaceAll("-", "+")
      .replaceAll("_", "/"), "base64");
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

export function buildTicketQrPayload(ticketId: string, revisionNumber: number, secret: string): string {
  const canonicalTicketId = canonicalUuid(ticketId);
  assertVersion(revisionNumber);
  const token = encodeBase64Url(
    hmac(secret, `ticket-qr\0${canonicalTicketId}\0${revisionNumber}`),
  );

  return `${QR_PREFIX}:${canonicalTicketId}:${revisionNumber}:${token}`;
}

export function parseAndVerifyTicketQrPayload(payload: string, secret: string): TicketQrPayload | null {
  if (typeof payload !== "string" || payload.length > MAX_QR_PAYLOAD_LENGTH) {
    return null;
  }

  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== QR_PREFIX) {
    return null;
  }

  const [prefix, ticketId, revisionText, token] = parts;
  if (
    prefix !== QR_PREFIX ||
    !ticketId ||
    !UUID_PATTERN.test(ticketId) ||
    !revisionText ||
    !/^[1-9]\d*$/u.test(revisionText)
  ) {
    return null;
  }

  const revisionNumber = Number(revisionText);
  if (!Number.isSafeInteger(revisionNumber) || revisionNumber < 1) {
    return null;
  }

  const actual = decodeHmacToken(token);
  if (!actual) {
    return null;
  }

  try {
    const expected = hmac(secret, `ticket-qr\0${ticketId}\0${revisionNumber}`);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return null;
    }
  } catch {
    return null;
  }

  return { ticketId, revisionNumber };
}

function encodeBase32(value: Buffer): string {
  let buffer = 0;
  let bitsLeft = 0;
  let output = "";

  for (const byte of value) {
    buffer = (buffer << 8) | byte;
    bitsLeft += 8;

    while (bitsLeft >= 5) {
      bitsLeft -= 5;
      output += BASE32_ALPHABET[(buffer >> bitsLeft) & 31];
      buffer &= (1 << bitsLeft) - 1;
    }
  }

  if (bitsLeft > 0) {
    output += BASE32_ALPHABET[(buffer << (5 - bitsLeft)) & 31];
  }

  return output;
}

export function deriveManualCheckInCode(secret: string, ticketId: string, revisionNumber: number): string {
  const canonicalTicketId = canonicalUuid(ticketId);
  assertVersion(revisionNumber);
  const digest = hmac(secret, `ticket-manual-code\0${canonicalTicketId}\0${revisionNumber}`);

  return encodeBase32(digest).slice(0, 10);
}
