import "server-only";

import { cookies } from "next/headers";

import { noStoreJson } from "@/lib/case-lab-3/http.server";
import {
  getOrderStatus,
  isOrderId,
  parseOrderSession,
  publicOrderError,
  sanitizeOrderStatusResponse,
  type PublicCookieStore,
} from "@/lib/case-lab-3/orders.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function protectedJson<T>(body: T, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("X-Robots-Tag", "noindex, nofollow");
  return noStoreJson(body, { ...init, headers });
}

export type StatusRouteDependencies = {
  getOrderStatus: typeof getOrderStatus;
  getCookies: () => Promise<PublicCookieStore>;
};

const productionDependencies: StatusRouteDependencies = {
  getOrderStatus,
  getCookies: async () => (await cookies()) as unknown as PublicCookieStore,
};

export async function handleGet(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: StatusRouteDependencies = productionDependencies,
): Promise<Response> {
  try {
    const { id } = await params;
    if (!isOrderId(id)) return protectedJson({ error: "unauthorized" }, { status: 401 });

    const rawSession = (await dependencies.getCookies()).get("cl3_order_session")?.value;
    const parsed = parseOrderSession(rawSession);
    if (!parsed) return protectedJson({ error: "unauthorized" }, { status: 401 });

    const result = sanitizeOrderStatusResponse(
      await dependencies.getOrderStatus(id, { ...parsed, orderId: id }),
    );
    return protectedJson(result);
  } catch (error) {
    const result = publicOrderError(error);
    return protectedJson(result.body, { status: result.status === 503 ? 500 : result.status });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleGet(request, context);
}
