import "server-only";

import { cookies } from "next/headers";

import { getHashedClientIp, noStoreJson, parseJsonBody, readBoundedBody, requireJson, requireSameOrigin } from "@/lib/case-lab-3/http.server";
import {
  createOrder,
  consumeRateLimit,
  getOrderRequestSecret,
  getPublicPaymentEnvironment,
  issueOrderSession,
  ORDER_SESSION_COOKIE,
  PUBLIC_ORDER_CREATE_RATE_LIMIT,
  sanitizeCreateOrderResult,
  type PublicCookieStore,
  publicOrderError,
  serializeOrderSession,
} from "@/lib/case-lab-3/orders.server";
import { parseOrderInput } from "@/lib/case-lab-3/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

function idempotencyKey(request: Request): string | null {
  const value = request.headers.get("idempotency-key")?.trim() ?? "";
  return UUID_PATTERN.test(value) ? value : null;
}

export type OrderRouteDependencies = {
  createOrder: typeof createOrder;
  consumeRateLimit: typeof consumeRateLimit;
  getPublicPaymentEnvironment: typeof getPublicPaymentEnvironment;
  getOrderRequestSecret: typeof getOrderRequestSecret;
  getHashedClientIp: typeof getHashedClientIp;
  issueOrderSession: typeof issueOrderSession;
  getCookies: () => Promise<PublicCookieStore>;
};

const productionDependencies: OrderRouteDependencies = {
  createOrder,
  consumeRateLimit,
  getPublicPaymentEnvironment,
  getOrderRequestSecret,
  getHashedClientIp,
  issueOrderSession,
  getCookies: async () => (await cookies()) as unknown as PublicCookieStore,
};

export async function handlePost(
  request: Request,
  dependencies: OrderRouteDependencies = productionDependencies,
): Promise<Response> {
  try {
    requireSameOrigin(request);
    requireJson(request);

    const key = idempotencyKey(request);
    if (!key) return noStoreJson({ error: "invalid_idempotency_key" }, { status: 400 });

    const orderRequestSecret = dependencies.getOrderRequestSecret();
    const hashedClientIp = dependencies.getHashedClientIp(request, orderRequestSecret, PUBLIC_ORDER_CREATE_RATE_LIMIT.scope);
    await dependencies.consumeRateLimit(
      PUBLIC_ORDER_CREATE_RATE_LIMIT.scope,
      hashedClientIp,
      PUBLIC_ORDER_CREATE_RATE_LIMIT.limitCount,
      PUBLIC_ORDER_CREATE_RATE_LIMIT.bucketSeconds,
    );

    const body = parseJsonBody(await readBoundedBody(request, MAX_BODY_BYTES));
    const input = parseOrderInput(body);
    const environment = dependencies.getPublicPaymentEnvironment();
    const result = sanitizeCreateOrderResult(
      await dependencies.createOrder(input, { environment, idempotencyKey: key, hashedClientIp }),
    );

    if (result.kind === "offer_changed") {
      return noStoreJson({ error: "offer_changed", availability: result.availability }, { status: 409 });
    }
    if (result.kind === "unavailable") {
      return noStoreJson({ error: "unavailable", availability: result.availability }, { status: 409 });
    }

    const session = dependencies.issueOrderSession(result.orderId);
    (await dependencies.getCookies()).set(ORDER_SESSION_COOKIE, serializeOrderSession(session), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return noStoreJson(result, { status: 201 });
  } catch (error) {
    const result = publicOrderError(error);
    return noStoreJson(result.body, { status: result.status });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
