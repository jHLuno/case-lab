import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { CrmAdminSession } from "../../app/lib/crm-auth.server";

import "./server-only-test-loader";

type TokenHelpers = typeof import("../../app/lib/case-lab-3/tokens.server");
let tokenHelpersPromise: Promise<TokenHelpers> | null = null;

function loadTokenHelpers(): Promise<TokenHelpers> {
  tokenHelpersPromise ??= import("../../app/lib/case-lab-3/tokens.server");
  return tokenHelpersPromise;
}

const TOKEN_SECRET = "check-in-test-secret-012345678901234567890";
const TICKET_ID = "11111111-1111-4111-8111-111111111111";
const REVISION_ID = "22222222-2222-4222-8222-222222222222";
const REVISION_NUMBER = 3;
const TOKEN_VERSION = 7;
const TICKET_NUMBER = "CL3-000123";
const SESSION: CrmAdminSession = { role: "crm_admin", token: "crm-session" };

type CheckInResult = "admitted" | "already_used" | "cancelled" | "invalid";

function request(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request("https://caselab.test/api/admin/case-lab-3/check-ins", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: "https://caselab.test",
      "X-CSRF-Token": "csrf",
      "Idempotency-Key": "check-in-test-key",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function validTicket() {
  return {
    ticketId: TICKET_ID,
    ticketRevisionId: REVISION_ID,
    revisionNumber: REVISION_NUMBER,
    tokenVersion: TOKEN_VERSION,
    status: "valid" as const,
  };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    requireCrmAdmin: async () => SESSION,
    verifyCrmMutation: () => true,
    getEnvironment: () => "test" as const,
    getTokenSecret: () => TOKEN_SECRET,
    lookupTicket: async () => validTicket(),
    checkIn: async () => ({ result: "admitted" as CheckInResult, checked_in_at: "2026-09-24T09:00:00.000Z" }),
    ...overrides,
  };
}

async function loadRoute() {
  return import("../../app/api/admin/case-lab-3/check-ins/route");
}

describe("Case Lab III check-in route", () => {
  it("rejects unauthenticated requests before reading the ticket", async () => {
    const route = await loadRoute();
    let lookedUp = false;

    const response = await route.handlePost(
      request({ mode: "manual", ticketNumber: TICKET_NUMBER, code: "AAAAAAAAAA" }),
      dependencies({
        requireCrmAdmin: async () => null,
        lookupTicket: async () => {
          lookedUp = true;
          return validTicket();
        },
      }),
    );

    assert.equal(response.status, 401);
    assert.equal(lookedUp, false);
  });

  it("admits a valid QR payload through the atomic RPC", async () => {
    const route = await loadRoute();
    const { buildTicketQrPayload } = await loadTokenHelpers();
    const payload = buildTicketQrPayload(TICKET_ID, REVISION_NUMBER, TOKEN_SECRET);
    let rpcInput: unknown;

    const response = await route.handlePost(
      request({ mode: "qr", payload }),
      dependencies({
        checkIn: async (input: unknown) => {
          rpcInput = input;
          return { result: "admitted", checked_in_at: "2026-09-24T09:00:00.000Z" };
        },
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      result: "admitted",
      checkedInAt: "2026-09-24T09:00:00.000Z",
    });
    assert.deepEqual(rpcInput, {
      ticketId: TICKET_ID,
      ticketRevisionId: REVISION_ID,
      tokenVersion: TOKEN_VERSION,
    });
  });

  it("returns invalid for a forged QR without touching the database", async () => {
    const route = await loadRoute();
    let lookedUp = false;

    const response = await route.handlePost(
      request({ mode: "qr", payload: `cl3:${TICKET_ID}:${REVISION_NUMBER}:forged` }),
      dependencies({
        lookupTicket: async () => {
          lookedUp = true;
          return validTicket();
        },
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { result: "invalid", checkedInAt: null });
    assert.equal(lookedUp, false);
  });

  it("rejects a stale QR revision without calling the atomic RPC", async () => {
    const route = await loadRoute();
    const { buildTicketQrPayload } = await loadTokenHelpers();
    let checkedIn = false;
    const payload = buildTicketQrPayload(TICKET_ID, REVISION_NUMBER, TOKEN_SECRET);

    const response = await route.handlePost(
      request({ mode: "qr", payload }),
      dependencies({
        lookupTicket: async () => ({ ...validTicket(), revisionNumber: REVISION_NUMBER + 1 }),
        checkIn: async () => {
          checkedIn = true;
          return { result: "admitted", checked_in_at: null };
        },
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { result: "invalid", checkedInAt: null });
    assert.equal(checkedIn, false);
  });

  it("supports manual ticket number plus derived code", async () => {
    const route = await loadRoute();
    const { deriveManualCheckInCode } = await loadTokenHelpers();
    const code = deriveManualCheckInCode(TOKEN_SECRET, TICKET_ID, REVISION_NUMBER);
    let lookupInput: unknown;

    const response = await route.handlePost(
      request({ mode: "manual", ticketNumber: TICKET_NUMBER, code: ` ${code.slice(0, 5)}-${code.slice(5)} ` }),
      dependencies({
        lookupTicket: async (input: unknown) => {
          lookupInput = input;
          return validTicket();
        },
        checkIn: async () => ({ result: "already_used", checked_in_at: "2026-09-24T09:00:00.000Z" }),
      }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      result: "already_used",
      checkedInAt: "2026-09-24T09:00:00.000Z",
    });
    assert.deepEqual(lookupInput, { mode: "manual", ticketNumber: TICKET_NUMBER });
  });

  it("returns invalid for a wrong manual code without exposing ticket data", async () => {
    const route = await loadRoute();
    let checkedIn = false;

    const response = await route.handlePost(
      request({ mode: "manual", ticketNumber: TICKET_NUMBER, code: "AAAAAAAAAA" }),
      dependencies({
        checkIn: async () => {
          checkedIn = true;
          return { result: "admitted", checked_in_at: null };
        },
      }),
    );

    assert.equal(response.status, 200);
    const body = await response.json() as Record<string, unknown>;
    assert.deepEqual(body, { result: "invalid", checkedInAt: null });
    assert.equal(checkedIn, false);
    assert.equal("email" in body, false);
    assert.equal("name" in body, false);
  });

  it("returns a safe response for cancelled tickets", async () => {
    const route = await loadRoute();
    const { buildTicketQrPayload } = await loadTokenHelpers();
    const payload = buildTicketQrPayload(TICKET_ID, REVISION_NUMBER, TOKEN_SECRET);

    const response = await route.handlePost(
      request({ mode: "qr", payload }),
      dependencies({ checkIn: async () => ({ result: "cancelled", checked_in_at: null }) }),
    );

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { result: "cancelled", checkedInAt: null });
  });

  it("rejects malformed bodies and oversized input", async () => {
    const route = await loadRoute();

    const malformed = await route.handlePost(request({ mode: "manual", ticketNumber: TICKET_NUMBER } ), dependencies());
    assert.equal(malformed.status, 400);
    assert.deepEqual(await malformed.json(), { error: "invalid_request" });

    const oversized = await route.handlePost(
      request({ mode: "qr", payload: "x".repeat(30000) }),
      dependencies(),
    );
    assert.equal(oversized.status, 413);
    assert.deepEqual(await oversized.json(), { error: "request_too_large" });
  });
});
