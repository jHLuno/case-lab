import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import test from "node:test";

type TokenModule = typeof import("../../app/lib/case-lab-3/tokens.server");

const requireModule = createRequire(__filename);
const moduleLoader = requireModule("node:module") as {
  _load: (request: string, parent: unknown, isMain?: boolean) => unknown;
};
const originalModuleLoad = moduleLoader._load;
moduleLoader._load = (request, parent, isMain) =>
  request === "server-only" ? {} : originalModuleLoad(request, parent, isMain);

let tokenModule: TokenModule;
try {
  tokenModule = requireModule("../../app/lib/case-lab-3/tokens.server") as TokenModule;
} finally {
  moduleLoader._load = originalModuleLoad;
}

const {
  buildTicketQrPayload,
  deriveManualCheckInCode,
  derivePurposeToken,
  parseAndVerifyTicketQrPayload,
  verifyPurposeToken,
} = tokenModule;

const secret = "s".repeat(32);
const ticketId = "018f4c5e-7e75-7a12-a123-123456789abc";
const base64UrlAlphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

function mutateFinalPadBits(token: string): string {
  const finalCharacter = token.at(-1);
  assert.ok(finalCharacter);
  const finalIndex = base64UrlAlphabet.indexOf(finalCharacter);
  assert.notEqual(finalIndex, -1);
  return `${token.slice(0, -1)}${base64UrlAlphabet[finalIndex + 1]}`;
}

test("token module explicitly declares its server-only boundary", async () => {
  const source = await readFile("app/lib/case-lab-3/tokens.server.ts", "utf8");

  assert.match(source, /^import "server-only";$/mu);
});

test("purpose and version separate ticket credentials", () => {
  const first = derivePurposeToken(secret, "ticket-access", "ticket-1", 1);
  const rotated = derivePurposeToken(secret, "ticket-access", "ticket-1", 2);
  const qr = derivePurposeToken(secret, "ticket-qr", "ticket-1", 1);

  assert.notEqual(first, rotated);
  assert.notEqual(first, qr);
  assert.equal(verifyPurposeToken(first, secret, "ticket-access", "ticket-1", 1), true);
  assert.equal(verifyPurposeToken(first, secret, "ticket-access", "ticket-1", 2), false);
  assert.equal(verifyPurposeToken(first, "x".repeat(32), "ticket-access", "ticket-1", 1), false);
});

test("QR payload carries the indexed ticket ID and current revision", () => {
  const payload = buildTicketQrPayload(ticketId, 2, secret);

  assert.match(payload, /^cl3:[0-9a-f-]{36}:2:[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(parseAndVerifyTicketQrPayload(payload, secret), {
    ticketId,
    revisionNumber: 2,
  });
});

test("QR verification rejects altered, non-canonical, and stale-shaped payloads", () => {
  const payload = buildTicketQrPayload(ticketId, 2, secret);
  const token = payload.split(":").at(-1);

  assert.equal(parseAndVerifyTicketQrPayload(`${payload.slice(0, -1)}${token === "A" ? "B" : "A"}`, secret), null);
  assert.equal(parseAndVerifyTicketQrPayload(payload.replace(":2:", ":02:"), secret), null);
  assert.equal(parseAndVerifyTicketQrPayload(payload.replace("cl3:", "cl2:"), secret), null);
  assert.equal(parseAndVerifyTicketQrPayload(`${payload}:extra`, secret), null);
});

test("rejects non-canonical base64url pad bits for purpose and QR tokens", () => {
  const purposeToken = derivePurposeToken(secret, "ticket-access", "ticket-1", 1);
  const qrPayload = buildTicketQrPayload(ticketId, 2, secret);
  const qrToken = qrPayload.split(":").at(-1);
  assert.ok(qrToken);

  assert.equal(verifyPurposeToken(purposeToken, secret, "ticket-access", "ticket-1", 1), true);
  assert.equal(
    verifyPurposeToken(mutateFinalPadBits(purposeToken), secret, "ticket-access", "ticket-1", 1),
    false,
  );
  assert.deepEqual(parseAndVerifyTicketQrPayload(qrPayload, secret), {
    ticketId,
    revisionNumber: 2,
  });
  assert.equal(
    parseAndVerifyTicketQrPayload(`${qrPayload.slice(0, -1)}${mutateFinalPadBits(qrToken).at(-1)}`, secret),
    null,
  );
});

test("manual check-in codes are ten uppercase RFC 4648 base32 characters", () => {
  const first = deriveManualCheckInCode(secret, ticketId, 1);
  const rotated = deriveManualCheckInCode(secret, ticketId, 2);

  assert.match(first, /^[A-Z2-7]{10}$/);
  assert.notEqual(first, rotated);
});
