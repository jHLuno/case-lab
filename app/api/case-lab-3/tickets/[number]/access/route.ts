import "server-only";

import { cookies } from "next/headers";

import {
  exchangeTicketAccessToken,
  getBearerToken,
  isBearerToken,
  serializeTicketSession,
  TICKET_SESSION_COOKIE,
  type PublicCookieStore,
} from "@/lib/case-lab-3/orders.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type TicketAccessRouteDependencies = {
  exchangeTicketAccessToken: typeof exchangeTicketAccessToken;
  getCookies: () => Promise<PublicCookieStore>;
};

const productionDependencies: TicketAccessRouteDependencies = {
  exchangeTicketAccessToken,
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
  { params }: { params: Promise<{ number: string }> },
  dependencies: TicketAccessRouteDependencies = productionDependencies,
): Promise<Response> {
  try {
    const { number } = await params;
    const token = getBearerToken(request);
    if (!number || !isBearerToken(token)) {
      return accessError("unauthorized", 401);
    }

    const exchanged = await dependencies.exchangeTicketAccessToken(number, token);
    if (!exchanged) {
      return accessError("unauthorized", 401);
    }

    (await dependencies.getCookies()).set(TICKET_SESSION_COOKIE, serializeTicketSession(exchanged.session, exchanged.tokenVersion), {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    const destination = new URL(`/case-lab-3/ticket/${encodeURIComponent(number)}/`, request.url);
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
  context: { params: Promise<{ number: string }> },
): Promise<Response> {
  return handleGet(request, context);
}
