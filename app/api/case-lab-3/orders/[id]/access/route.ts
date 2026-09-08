import "server-only";

import { cookies } from "next/headers";

import {
  exchangeOrderAccessToken,
  getBearerToken,
  isBearerToken,
  isOrderId,
  ORDER_SESSION_COOKIE,
  serializeOrderSession,
  type PublicCookieStore,
} from "@/lib/case-lab-3/orders.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type OrderAccessRouteDependencies = {
  exchangeOrderAccessToken: typeof exchangeOrderAccessToken;
  getCookies: () => Promise<PublicCookieStore>;
};

const productionDependencies: OrderAccessRouteDependencies = {
  exchangeOrderAccessToken,
  getCookies: async () => (await cookies()) as unknown as PublicCookieStore,
};

function accessError(error: "unauthorized" | "service_unavailable", status: 401 | 500): Response {
  return Response.json(
    { error },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
}

export async function handleGet(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: OrderAccessRouteDependencies = productionDependencies,
): Promise<Response> {
  try {
    const { id } = await params;
    const token = getBearerToken(request);
    if (!isOrderId(id) || !isBearerToken(token)) {
      return accessError("unauthorized", 401);
    }

    const session = await dependencies.exchangeOrderAccessToken(id, token);
    if (!session) {
      return accessError("unauthorized", 401);
    }

    (await dependencies.getCookies()).set(ORDER_SESSION_COOKIE, serializeOrderSession(session), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    const destination = new URL(`/case-lab-3/order/${encodeURIComponent(id)}/`, request.url);
    return new Response(null, {
      status: 303,
      headers: {
        Location: destination.toString(),
        "Cache-Control": "no-store",
        "X-Robots-Tag": "noindex, nofollow",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch {
    return accessError("service_unavailable", 500);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleGet(request, context);
}
