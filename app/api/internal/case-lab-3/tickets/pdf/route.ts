import "server-only";

import { timingSafeEqual } from "node:crypto";

import { renderTicketPdf } from "@/lib/case-lab-3/pdf.server";
import { getCaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";
import { buildTicketQrPayload } from "@/lib/case-lab-3/tokens.server";
import type { TicketStatus } from "@/lib/case-lab-3/database.types";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_TICKETS_PER_REQUEST = 10;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type InternalTicketPdf = {
  ticketId: string;
  publicTicketNumber: string;
  status: TicketStatus;
  revisionId: string;
  revisionNumber: number;
  tokenVersion: number;
  firstName: string;
  lastName: string;
};

export type InternalTicketPdfDependencies = {
  getCronSecret: () => string;
  getTokenSecret: () => string;
  getTickets: (orderIds: string[]) => Promise<InternalTicketPdf[]>;
  renderTicketPdf: typeof renderTicketPdf;
};

function authorized(request: Request, secret: string): boolean {
  const supplied = request.headers.get("authorization")?.match(/^Bearer\s+(.+)$/iu)?.[1] ?? "";
  if (!secret || supplied.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(supplied), Buffer.from(secret));
}

function parseOrderIds(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_TICKETS_PER_REQUEST) return null;
  if (value.some((id) => typeof id !== "string" || !UUID_PATTERN.test(id))) return null;
  return [...new Set(value as string[])];
}

function defaultCronSecret(): string {
  const secret = process.env.CASE_LAB_3_CRON_SECRET?.trim() ?? "";
  if (secret.length < 32) throw new Error("Internal route configuration incomplete");
  return secret;
}

function defaultTokenSecret(): string {
  const secret = process.env.CASE_LAB_3_TOKEN_SECRET?.trim() ?? "";
  if (secret.length < 32) throw new Error("Ticket token configuration incomplete");
  return secret;
}

async function loadTickets(orderIds: string[]): Promise<InternalTicketPdf[]> {
  const client = getCaseLab3AdminClient();
  const { data: ticketRows, error: ticketError } = await client
    .from("case_lab_3_tickets")
    .select("id, public_ticket_number, status, current_revision_id, order_id")
    .eq("environment", "live")
    .in("order_id", orderIds);
  if (ticketError) throw new Error("Internal ticket PDF export unavailable");

  const rows = (ticketRows ?? []).filter((ticket) => ticket.current_revision_id && ticket.status !== "cancelled");
  if (rows.length !== orderIds.length) throw new Error("Requested valid tickets were not found");

  const revisionIds = rows.map((ticket) => ticket.current_revision_id as string);
  const { data: revisions, error: revisionError } = await client
    .from("case_lab_3_ticket_revisions")
    .select("id, ticket_id, revision_number, token_version, first_name, last_name")
    .eq("environment", "live")
    .in("id", revisionIds);
  if (revisionError || !revisions || revisions.length !== rows.length) throw new Error("Internal ticket PDF export unavailable");

  const revisionById = new Map(revisions.map((revision) => [revision.id, revision]));
  return rows.map((ticket) => {
    const revision = revisionById.get(ticket.current_revision_id as string);
    if (!revision || revision.ticket_id !== ticket.id) throw new Error("Internal ticket PDF export unavailable");
    return {
      ticketId: ticket.id,
      publicTicketNumber: ticket.public_ticket_number,
      status: ticket.status,
      revisionId: revision.id,
      revisionNumber: revision.revision_number,
      tokenVersion: revision.token_version,
      firstName: revision.first_name,
      lastName: revision.last_name,
    };
  });
}

const productionDependencies: InternalTicketPdfDependencies = {
  getCronSecret: defaultCronSecret,
  getTokenSecret: defaultTokenSecret,
  getTickets: loadTickets,
  renderTicketPdf,
};

export async function handlePost(
  request: Request,
  dependencies: Partial<InternalTicketPdfDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  if (!authorized(request, active.getCronSecret())) return Response.json({ error: "unauthorized" }, { status: 401 });

  try {
    const body = await request.json() as { orderIds?: unknown };
    const orderIds = parseOrderIds(body.orderIds);
    if (!orderIds) return Response.json({ error: "invalid_request" }, { status: 400 });

    const tickets = await active.getTickets(orderIds);
    const secret = active.getTokenSecret();
    const files = await Promise.all(tickets.map(async (ticket) => {
      const pdf = await active.renderTicketPdf({
        ticketId: ticket.ticketId,
        publicTicketNumber: ticket.publicTicketNumber,
        revisionId: ticket.revisionId,
        revisionNumber: ticket.revisionNumber,
        tokenVersion: ticket.tokenVersion,
        status: ticket.status,
        firstName: ticket.firstName,
        lastName: ticket.lastName,
        qrPayload: buildTicketQrPayload(ticket.ticketId, ticket.revisionNumber, secret),
        manualCode: "",
        eventName: "Case Lab III",
        eventDate: "24 сентября 2026",
        eventTime: "10:00–14:00",
        venue: "Narxoz Business School, Алматы, ул. Жандосова 55/10",
        supportEmail: "hello@caselab.kz",
        pdfUrl: "",
      });
      return { ticketNumber: ticket.publicTicketNumber, pdfBase64: pdf.toString("base64") };
    }));

    return Response.json({ files }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
