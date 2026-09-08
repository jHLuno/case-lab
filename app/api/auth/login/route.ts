import { cookies } from "next/headers";
import { timingSafeEqual } from "node:crypto";

import { createToken } from "../../../lib/jwt";
import { getHashedClientIp, noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "../../../lib/case-lab-3/http.server";
import { getCaseLab3AdminClient, type CaseLab3RateLimitRpcData } from "../../../lib/case-lab-3/supabase-admin.server";

const CRM_LOGIN_MAX_ATTEMPTS = 5;
const CRM_LOGIN_WINDOW_SECONDS = 15 * 60;

function constantTimePasswordEqual(candidate: unknown, expected: string): boolean {
  if (typeof candidate !== "string") return false;
  const actualBytes = Buffer.from(candidate, "utf8");
  const expectedBytes = Buffer.from(expected, "utf8");
  return actualBytes.length === expectedBytes.length && timingSafeEqual(actualBytes, expectedBytes);
}

function readRateLimitData(data: CaseLab3RateLimitRpcData | null): CaseLab3RateLimitRpcData | null {
  const value = data;
  if (!value || typeof value.allowed !== "boolean" || !Number.isSafeInteger(value.remaining) || typeof value.reset_at !== "string") {
    return null;
  }
  return value;
}

function jsonError(error: string, status: 400 | 401 | 415 | 413 | 429 | 503): Response {
  return noStoreJson({ error }, { status });
}

export async function POST(request: Request) {
  try {
    const crmPassword = process.env.CRM_PASSWORD;
    const tokenSecret = process.env.CASE_LAB_3_TOKEN_SECRET;

    if (!crmPassword || !tokenSecret || tokenSecret.length < 32) {
      return jsonError("Service unavailable", 503);
    }

    let hashedClientIp: string;
    try {
      hashedClientIp = getHashedClientIp(request, tokenSecret, "crm-login");
    } catch {
      return jsonError("Invalid request", 400);
    }

    let rateLimitData: CaseLab3RateLimitRpcData | null;
    try {
      const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_consume_rate_limit", {
        p_scope: "crm-login",
        p_purpose_ip_hash: hashedClientIp,
        p_limit_count: CRM_LOGIN_MAX_ATTEMPTS,
        p_bucket_seconds: CRM_LOGIN_WINDOW_SECONDS,
      });
      if (error) return jsonError("Service unavailable", 503);
      rateLimitData = readRateLimitData(data);
    } catch {
      return jsonError("Service unavailable", 503);
    }

    if (!rateLimitData) return jsonError("Service unavailable", 503);
    if (!rateLimitData.allowed) return jsonError("Too many attempts. Try again in 15 minutes.", 429);

    requireJson(request);
    const body = parseJsonBody<unknown>(await readBoundedBody(request, 16 * 1024));
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return jsonError("Invalid request", 400);
    }

    if (!constantTimePasswordEqual("password" in body ? body.password : undefined, crmPassword)) {
      return jsonError("Invalid password", 401);
    }

    const token = await createToken();
    const cookieStore = await cookies();
    cookieStore.set("crm_auth", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 3600, // 1 hour
      path: "/",
    });

    return noStoreJson({ success: true });
  } catch (error) {
    if (error instanceof RequestGuardError) {
      return jsonError("Invalid request", error.status as 400 | 413 | 415);
    }
    return jsonError("Service unavailable", 503);
  }
}
