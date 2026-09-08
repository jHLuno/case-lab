import "server-only";

import { cookies } from "next/headers";

import { noStoreJson, requireSameOrigin } from "@/lib/case-lab-3/http.server";
import {
  createPaymentAttempt,
  isOrderId,
  parseOrderSession,
  publicOrderError,
  sanitizePaymentAttemptResponse,
  type PublicCookieStore,
} from "@/lib/case-lab-3/orders.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type PaymentAttemptRouteDependencies = {
  createPaymentAttempt: typeof createPaymentAttempt;
  getCookies: () => Promise<PublicCookieStore>;
};

const productionDependencies: PaymentAttemptRouteDependencies = {
  createPaymentAttempt,
  getCookies: async () => (await cookies()) as unknown as PublicCookieStore,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: PaymentAttemptRouteDependencies = productionDependencies,
): Promise<Response> {
  try {
    requireSameOrigin(request);
    const { id } = await params;
    if (!isOrderId(id)) return noStoreJson({ error: "unauthorized" }, { status: 401 });

    const rawSession = (await dependencies.getCookies()).get("cl3_order_session")?.value;
    const parsed = parseOrderSession(rawSession);
    if (!parsed) return noStoreJson({ error: "unauthorized" }, { status: 401 });

    const result = sanitizePaymentAttemptResponse(
      await dependencies.createPaymentAttempt(id, { ...parsed, orderId: id }),
    );
    return noStoreJson(result);
  } catch (error) {
    const result = publicOrderError(error);
    return noStoreJson(result.body, { status: result.status });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
