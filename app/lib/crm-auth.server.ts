import "server-only";

import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";

import { requireSameOrigin } from "./case-lab-3/http.server";
import { verifyToken } from "./jwt";

const CRM_MUTATION_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export type CrmAdminSession = {
  role: "crm_admin";
  token: string;
};

export type OrderSession = {
  purpose: "order-session";
  orderId: string;
  version: number;
  token: string;
};

export type TicketSession = {
  purpose: "ticket-session";
  ticketId: string;
  revisionNumber: number;
  token: string;
};

function sessionToken(session: CrmAdminSession | string): string {
  return typeof session === "string" ? session : session.token;
}

function getTokenSecret(): string {
  const secret = process.env.CASE_LAB_3_TOKEN_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("Case Lab III token configuration incomplete");
  }
  return secret;
}

function encodeBase64Url(value: Buffer): string {
  return value.toString("base64").replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}

function decodeBase64Url(value: string): Buffer | null {
  if (!/^[A-Za-z0-9_-]{43}$/u.test(value)) return null;
  const decoded = Buffer.from(value.replaceAll("-", "+").replaceAll("_", "/"), "base64");
  return decoded.length === 32 && encodeBase64Url(decoded) === value ? decoded : null;
}

function deriveCsrfToken(token: string): string {
  return encodeBase64Url(createHmac("sha256", getTokenSecret()).update(`crm-csrf\0${token}`, "utf8").digest());
}

export async function requireCrmAdmin(token?: string): Promise<CrmAdminSession | null> {
  const authToken = token ?? (await cookies()).get("crm_auth")?.value;
  if (!authToken || !(await verifyToken(authToken))) return null;
  return { role: "crm_admin", token: authToken };
}

export function issueCrmCsrfToken(session: CrmAdminSession | string): string {
  return deriveCsrfToken(sessionToken(session));
}

export function verifyCrmMutation(
  request: Request,
  session: CrmAdminSession,
  csrfToken?: string | null,
  options: { requireIdempotencyKey?: boolean } = {},
): boolean {
  if (!CRM_MUTATION_METHODS.has(request.method) || session.role !== "crm_admin" || !session.token) return false;

  try {
    requireSameOrigin(request);
    if (options.requireIdempotencyKey) {
      const idempotencyKey = request.headers.get("idempotency-key")?.trim();
      if (!idempotencyKey || idempotencyKey.length > 200) return false;
    }

    const supplied = csrfToken ?? request.headers.get("x-csrf-token");
    const actual = supplied ? decodeBase64Url(supplied) : null;
    const expected = decodeBase64Url(deriveCsrfToken(session.token));
    return actual !== null && expected !== null && actual.length === expected.length && timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
