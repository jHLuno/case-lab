import "server-only";

import { cookies } from "next/headers";

import { renderTicketPdf } from "@/lib/case-lab-3/pdf.server";
import {
  isOrderId,
  ORDER_SESSION_COOKIE,
  parseOrderSession,
  parseTicketSession,
  TICKET_SESSION_COOKIE,
} from "@/lib/case-lab-3/orders.server";
import {
  getPurchaserOrderView,
  getTicketRevisionForPdf,
  TicketAuthorizationError,
  TicketServiceError,
  type TicketPresentation,
} from "@/lib/case-lab-3/ticket.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

type CookieStore = { get(name: string): { value: string } | undefined };

export type TicketPdfRouteDependencies = {
  getPurchaserOrderView: typeof getPurchaserOrderView;
  getTicketRevisionForPdf: typeof getTicketRevisionForPdf;
  renderTicketPdf: typeof renderTicketPdf;
  getCookies: () => Promise<CookieStore>;
};

const productionDependencies: TicketPdfRouteDependencies = {
  getPurchaserOrderView,
  getTicketRevisionForPdf,
  renderTicketPdf,
  getCookies: async () => (await cookies()) as unknown as CookieStore,
};

function protectedJson(error: "unauthorized" | "service_unavailable", status: 401 | 500): Response {
  return Response.json({ error }, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function pdfResponse(pdf: Buffer, ticket: TicketPresentation): Response {
  const safeNumber = ticket.publicTicketNumber.replace(/[^A-Za-z0-9_-]/gu, "-");
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="case-lab-3-ticket-${safeNumber}.pdf"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function handleGet(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: TicketPdfRouteDependencies = productionDependencies,
): Promise<Response> {
  try {
    const { id } = await params;
    if (!isOrderId(id)) return protectedJson("unauthorized", 401);
    const cookieStore = await dependencies.getCookies();
    let serviceFailure = false;
    const rawOrderSession = cookieStore.get(ORDER_SESSION_COOKIE)?.value;
    const orderSession = parseOrderSession(rawOrderSession);
    if (orderSession) {
      try {
        const view = await dependencies.getPurchaserOrderView(orderSession, id);
        if (!view.ticket) return protectedJson("unauthorized", 401);
        return pdfResponse(await dependencies.renderTicketPdf(view.ticket), view.ticket);
      } catch (error) {
        if (!(error instanceof TicketAuthorizationError)) serviceFailure = true;
      }
    }

    const rawTicketSession = cookieStore.get(TICKET_SESSION_COOKIE)?.value;
    const ticketSession = parseTicketSession(rawTicketSession);
    if (ticketSession) {
      try {
        const ticket = await dependencies.getTicketRevisionForPdf(ticketSession, id);
        return pdfResponse(await dependencies.renderTicketPdf(ticket), ticket);
      } catch (error) {
        if (!(error instanceof TicketAuthorizationError)) serviceFailure = true;
      }
    }
    return protectedJson(serviceFailure ? "service_unavailable" : "unauthorized", serviceFailure ? 500 : 401);
  } catch (error) {
    if (error instanceof TicketAuthorizationError) return protectedJson("unauthorized", 401);
    if (error instanceof TicketServiceError) return protectedJson("service_unavailable", 500);
    return protectedJson("service_unavailable", 500);
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleGet(request, context);
}
