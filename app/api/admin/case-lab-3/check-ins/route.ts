import "server-only";

import { timingSafeEqual } from "node:crypto";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { getOrderRequestSecret, getPublicPaymentEnvironment } from "@/lib/case-lab-3/orders.server";
import {
  noStoreJson,
  parseJsonBody,
  readBoundedBody,
  requireJson,
  RequestGuardError,
} from "@/lib/case-lab-3/http.server";
import { deriveManualCheckInCode, parseAndVerifyTicketQrPayload } from "@/lib/case-lab-3/tokens.server";
import { getCaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";
import type { CheckInRpcResult } from "@/lib/case-lab-3/database.types";
import type { PaymentEnvironment } from "@/lib/case-lab-3/contracts";

const MAX_BODY_BYTES = 8 * 1024;
const MAX_QR_PAYLOAD_LENGTH = 128;
const MAX_TICKET_NUMBER_LENGTH = 100;
const MAX_MANUAL_CODE_LENGTH = 32;

type CheckInTicket = {
  ticketId: string;
  ticketRevisionId: string;
  revisionNumber: number;
  tokenVersion: number;
  status: "valid" | "used" | "cancelled";
};

type CheckInRequest =
  | { mode: "qr"; payload: string }
  | { mode: "manual"; ticketNumber: string; code: string };

type CheckInLookup =
  | { mode: "qr"; ticketId: string }
  | { mode: "manual"; ticketNumber: string };

type CheckInRpcInput = {
  ticketId: string;
  ticketRevisionId: string;
  tokenVersion: number;
};

export type CheckInRouteDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  parseBody: (request: Request) => Promise<unknown>;
  getEnvironment: () => PaymentEnvironment;
  getTokenSecret: () => string;
  lookupTicket: (input: CheckInLookup, environment: PaymentEnvironment) => Promise<CheckInTicket | null>;
  checkIn: (input: CheckInRpcInput) => Promise<CheckInRpcResult>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeInput(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && !/[\u0000-\u001f\u007f]/u.test(value);
}

function parseCheckInRequest(value: unknown): CheckInRequest | null {
  if (!isRecord(value) || typeof value.mode !== "string") return null;

  if (value.mode === "qr" && isSafeInput(value.payload, MAX_QR_PAYLOAD_LENGTH)) {
    return { mode: "qr", payload: value.payload };
  }

  if (
    value.mode === "manual" &&
    isSafeInput(value.ticketNumber, MAX_TICKET_NUMBER_LENGTH) &&
    isSafeInput(value.code, MAX_MANUAL_CODE_LENGTH) &&
    !value.ticketNumber.includes("/")
  ) {
    return { mode: "manual", ticketNumber: value.ticketNumber.trim(), code: value.code };
  }

  return null;
}

function isCheckInRpcResult(value: unknown): value is CheckInRpcResult {
  if (!isRecord(value)) return false;
  return (
    (value.result === "admitted" || value.result === "already_used" || value.result === "cancelled" || value.result === "invalid") &&
    (value.checked_in_at === null || typeof value.checked_in_at === "string")
  );
}

function invalidResult(): Response {
  return noStoreJson({ result: "invalid", checkedInAt: null });
}

function sameSecretValue(expected: string, actual: string): boolean {
  const expectedBytes = Buffer.from(expected, "utf8");
  const actualBytes = Buffer.from(actual, "utf8");
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

async function lookupTicket(input: CheckInLookup, environment: PaymentEnvironment): Promise<CheckInTicket | null> {
  const client = getCaseLab3AdminClient();
  let query = client
    .from("case_lab_3_tickets")
    .select("id, current_revision_id, status")
    .eq("environment", environment);

  query = input.mode === "qr"
    ? query.eq("id", input.ticketId)
    : query.eq("public_ticket_number", input.ticketNumber);

  const { data: ticket, error: ticketError } = await query.maybeSingle();
  if (ticketError) throw new Error("Check-in ticket unavailable");
  if (!ticket?.current_revision_id) return null;

  const { data: revision, error: revisionError } = await client
    .from("case_lab_3_ticket_revisions")
    .select("id, revision_number, token_version")
    .eq("id", ticket.current_revision_id)
    .eq("ticket_id", ticket.id)
    .eq("environment", environment)
    .maybeSingle();
  if (revisionError || !revision) return null;

  return {
    ticketId: ticket.id,
    ticketRevisionId: revision.id,
    revisionNumber: revision.revision_number,
    tokenVersion: revision.token_version,
    status: ticket.status,
  };
}

async function checkIn(input: CheckInRpcInput): Promise<CheckInRpcResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_check_in", {
    p_ticket_id: input.ticketId,
    p_ticket_revision_id: input.ticketRevisionId,
    p_token_version: input.tokenVersion,
  });
  if (error || !isCheckInRpcResult(data)) throw new Error("Check-in unavailable");
  return data;
}

const productionDependencies: CheckInRouteDependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  parseBody: async (request) => {
    requireJson(request);
    return parseJsonBody(await readBoundedBody(request, MAX_BODY_BYTES));
  },
  getEnvironment: getPublicPaymentEnvironment,
  getTokenSecret: getOrderRequestSecret,
  lookupTicket,
  checkIn,
};

export async function handlePost(
  request: Request,
  dependencies: Partial<CheckInRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };

  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (session.role !== "crm_admin") return noStoreJson({ error: "forbidden" }, { status: 403 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) {
      return noStoreJson({ error: "forbidden" }, { status: 403 });
    }

    const input = parseCheckInRequest(await active.parseBody(request));
    if (!input) return noStoreJson({ error: "invalid_request" }, { status: 400 });

    const environment = active.getEnvironment();
    const tokenSecret = active.getTokenSecret();
    let ticket: CheckInTicket | null = null;

    if (input.mode === "qr") {
      const verified = parseAndVerifyTicketQrPayload(input.payload, tokenSecret);
      if (!verified) return invalidResult();

      ticket = await active.lookupTicket({ mode: "qr", ticketId: verified.ticketId }, environment);
      if (!ticket || ticket.revisionNumber !== verified.revisionNumber) return invalidResult();
    } else {
      ticket = await active.lookupTicket({ mode: "manual", ticketNumber: input.ticketNumber }, environment);
      if (!ticket) return invalidResult();

      const expectedCode = deriveManualCheckInCode(tokenSecret, ticket.ticketId, ticket.revisionNumber);
      const suppliedCode = input.code.replace(/[\s-]/gu, "").toUpperCase();
      if (!sameSecretValue(expectedCode, suppliedCode)) return invalidResult();
    }

    const result = await active.checkIn({
      ticketId: ticket.ticketId,
      ticketRevisionId: ticket.ticketRevisionId,
      tokenVersion: ticket.tokenVersion,
    });
    if (!isCheckInRpcResult(result)) return noStoreJson({ error: "service_unavailable" }, { status: 503 });

    return noStoreJson({ result: result.result, checkedInAt: result.checked_in_at });
  } catch (error) {
    if (error instanceof RequestGuardError) {
      const response = error.status === 413
        ? { error: "request_too_large" }
        : error.status === 415
          ? { error: "unsupported_content_type" }
          : { error: "invalid_request" };
      return noStoreJson(response, { status: error.status });
    }
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
