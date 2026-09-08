import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getCaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type TicketContext = {
  orderId: string;
  ticketId: string;
  revisionId: string;
  revisionNumber: number;
};

export type ResendTicketRouteDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  getTicket: (orderId: string) => Promise<TicketContext | null>;
  queueTicketEmail: (ticket: TicketContext, idempotencyKey: string) => Promise<void>;
  auditAction: (ticket: TicketContext) => Promise<void>;
};

async function findTicket(orderId: string): Promise<TicketContext | null> {
  const { data: ticket, error: ticketError } = await getCaseLab3AdminClient()
    .from("case_lab_3_tickets")
    .select("id, order_id, current_revision_id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (ticketError || !ticket?.current_revision_id) return null;
  const { data: revision, error: revisionError } = await getCaseLab3AdminClient()
    .from("case_lab_3_ticket_revisions")
    .select("id, revision_number")
    .eq("id", ticket.current_revision_id)
    .eq("ticket_id", ticket.id)
    .maybeSingle();
  if (revisionError || !revision) return null;
  return { orderId, ticketId: ticket.id, revisionId: revision.id, revisionNumber: revision.revision_number };
}

async function queueTicketEmail(ticket: TicketContext, idempotencyKey: string): Promise<void> {
  const client = getCaseLab3AdminClient();
  const { data: ticketRow, error: ticketError } = await client
    .from("case_lab_3_tickets")
    .select("environment")
    .eq("id", ticket.ticketId)
    .maybeSingle();
  if (ticketError || !ticketRow) throw new Error("Admin ticket email unavailable");
  const { error } = await client.from("case_lab_3_jobs").insert({
    environment: ticketRow.environment,
    job_type: "send_ticket_email",
    logical_key: `ticket-resend:${ticket.orderId}:${ticket.revisionNumber}:${idempotencyKey}`,
    payload_reference: { ...ticket, resend: true },
    order_id: ticket.orderId,
    ticket_id: ticket.ticketId,
    last_error: null,
    leased_until: null,
    lease_token: null,
    result: null,
  });
  if (error) throw new Error("Admin ticket email unavailable");
}

async function auditTicketResend(ticket: TicketContext): Promise<void> {
  const { data: ticketRow, error: ticketError } = await getCaseLab3AdminClient()
    .from("case_lab_3_tickets")
    .select("environment")
    .eq("id", ticket.ticketId)
    .maybeSingle();
  if (ticketError || !ticketRow) throw new Error("Admin audit unavailable");
  const { error } = await getCaseLab3AdminClient().from("case_lab_3_audit_log").insert({
    environment: ticketRow.environment,
    action: "ticket_email_resent",
    target_table: "case_lab_3_tickets",
    target_id: ticket.ticketId,
    before_summary: null,
    after_summary: { orderId: ticket.orderId, revisionNumber: ticket.revisionNumber },
    actor_id: "crm_admin",
    actor_label: "CRM admin",
  });
  if (error) throw new Error("Admin audit unavailable");
}

const productionDependencies: ResendTicketRouteDependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  getTicket: findTicket,
  queueTicketEmail,
  auditAction: auditTicketResend,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: Partial<ResendTicketRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) {
      return noStoreJson({ error: "forbidden" }, { status: 403 });
    }
    const { id } = await params;
    if (!UUID_PATTERN.test(id)) return noStoreJson({ error: "not_found" }, { status: 404 });
    const ticket = await active.getTicket(id);
    if (!ticket) return noStoreJson({ error: "not_found" }, { status: 404 });
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    await active.queueTicketEmail(ticket, idempotencyKey);
    await active.auditAction(ticket);
    return noStoreJson({ kind: "queued", orderId: id, ticketId: ticket.ticketId, revisionNumber: ticket.revisionNumber });
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
