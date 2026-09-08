import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getCaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ParticipantInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
};

type TransferInput = {
  ticketId: string;
  participant: ParticipantInput;
  reason: string;
  actorId: string;
};

type TransferResult = {
  kind: "transferred";
  ticketId: string;
  revisionId: string;
  revisionNumber: number;
  tokenVersion: number;
};

type TicketEmailInput = {
  orderId: string;
  ticketId: string;
  revisionId: string;
  revisionNumber: number;
  deliveryKind: "ticket";
};

export type TransferRouteDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  parseBody: (request: Request) => Promise<unknown>;
  getTicketId: (orderId: string) => Promise<string | null>;
  transferParticipant: (input: TransferInput) => Promise<unknown>;
  queueTicketEmail: (input: TicketEmailInput) => Promise<void>;
  auditAction: (input: { orderId: string; ticketId: string; action: string; revisionNumber: number }) => Promise<void>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedOptionalText(value: unknown, maxLength: number): string | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || value.trim().length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) return undefined;
  return value.trim() || null;
}

function isValidPhone(value: string | null): boolean {
  if (value === null) return true;
  const digits = value.replace(/[\s().-]/gu, "").replace(/^\+/u, "");
  return /^\+?[0-9\s().-]+$/u.test(value) && digits.length >= 7;
}

function parseParticipant(value: unknown): { participant: ParticipantInput; reason: string } | null {
  if (!isRecord(value)) return null;
  const firstName = typeof value.firstName === "string" ? value.firstName.trim() : "";
  const lastName = typeof value.lastName === "string" ? value.lastName.trim() : "";
  const email = typeof value.email === "string" ? value.email.trim().toLowerCase() : "";
  const phone = boundedOptionalText(value.phone, 32);
  const company = boundedOptionalText(value.company, 200);
  const position = boundedOptionalText(value.position, 200);
  const reason = typeof value.reason === "string" ? value.reason.trim() : "";
  if (
    !firstName ||
    firstName.length > 200 ||
    /[\u0000-\u001f\u007f]/u.test(firstName) ||
    !lastName ||
    lastName.length > 200 ||
    /[\u0000-\u001f\u007f]/u.test(lastName) ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email) ||
    phone === undefined ||
    company === undefined ||
    position === undefined ||
    !isValidPhone(phone) ||
    !reason ||
    reason.length > 500 ||
    /[\u0000-\u001f\u007f]/u.test(reason)
  ) {
    return null;
  }
  return { participant: { firstName, lastName, email, phone, company, position }, reason };
}

function isTransferResult(value: unknown): value is TransferResult {
  if (!isRecord(value)) return false;
  return (
    value.kind === "transferred" &&
    typeof value.ticketId === "string" &&
    typeof value.revisionId === "string" &&
    Number.isSafeInteger(value.revisionNumber) &&
    (value.revisionNumber as number) > 0 &&
    Number.isSafeInteger(value.tokenVersion) &&
    (value.tokenVersion as number) > 0
  );
}

async function findTicketId(orderId: string): Promise<string | null> {
  const { data, error } = await getCaseLab3AdminClient()
    .from("case_lab_3_tickets")
    .select("id")
    .eq("order_id", orderId)
    .maybeSingle();
  if (error) throw new Error("Admin ticket unavailable");
  return data?.id ?? null;
}

async function transferAtomicParticipant(input: TransferInput): Promise<TransferResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_transfer_participant", {
    p_ticket_id: input.ticketId,
    p_input: input.participant,
    p_actor_id: input.actorId,
    p_reason: input.reason,
  });
  if (error || !isTransferResult(data)) throw new Error("Admin participant transfer unavailable");
  return data;
}

async function queueRevisedTicketEmail(input: TicketEmailInput): Promise<void> {
  const client = getCaseLab3AdminClient();
  const { data: ticket, error: ticketError } = await client
    .from("case_lab_3_tickets")
    .select("environment")
    .eq("id", input.ticketId)
    .maybeSingle();
  if (ticketError || !ticket) throw new Error("Admin ticket email unavailable");
  const { error } = await client.from("case_lab_3_jobs").insert({
    environment: ticket.environment,
    job_type: "send_ticket_email",
    logical_key: `ticket-email:${input.ticketId}:${input.revisionNumber}`,
    payload_reference: {
      orderId: input.orderId,
      ticketId: input.ticketId,
      ticketRevisionId: input.revisionId,
      revisionNumber: input.revisionNumber,
      deliveryKind: input.deliveryKind,
    },
    order_id: input.orderId,
    ticket_id: input.ticketId,
    last_error: null,
    leased_until: null,
    lease_token: null,
    result: null,
  });
  if (error) throw new Error("Admin ticket email unavailable");
}

async function auditTransferEmail(input: { orderId: string; ticketId: string; action: string; revisionNumber: number }): Promise<void> {
  const client = getCaseLab3AdminClient();
  const { data: ticket, error: ticketError } = await client
    .from("case_lab_3_tickets")
    .select("environment")
    .eq("id", input.ticketId)
    .maybeSingle();
  if (ticketError || !ticket) throw new Error("Admin audit unavailable");
  const { error } = await client.from("case_lab_3_audit_log").insert({
    environment: ticket.environment,
    action: input.action,
    target_table: "case_lab_3_tickets",
    target_id: input.ticketId,
    before_summary: null,
    after_summary: { orderId: input.orderId, revisionNumber: input.revisionNumber },
    actor_id: "crm_admin",
    actor_label: "CRM admin",
  });
  if (error) throw new Error("Admin audit unavailable");
}

const productionDependencies: TransferRouteDependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  parseBody: async (request) => {
    try {
      return await request.json();
    } catch {
      return null;
    }
  },
  getTicketId: findTicketId,
  transferParticipant: transferAtomicParticipant,
  queueTicketEmail: queueRevisedTicketEmail,
  auditAction: auditTransferEmail,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: Partial<TransferRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) {
      return noStoreJson({ error: "forbidden" }, { status: 403 });
    }
    const { id: orderId } = await params;
    if (!UUID_PATTERN.test(orderId)) return noStoreJson({ error: "not_found" }, { status: 404 });
    const ticketId = await active.getTicketId(orderId);
    if (!ticketId) return noStoreJson({ error: "not_found" }, { status: 404 });
    const parsed = parseParticipant(await active.parseBody(request));
    if (!parsed) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const result = await active.transferParticipant({ ...parsed, ticketId, actorId: "crm_admin" });
    if (!isTransferResult(result)) return noStoreJson({ error: "service_unavailable" }, { status: 503 });
    await active.queueTicketEmail({
      orderId,
      ticketId: result.ticketId,
      revisionId: result.revisionId,
      revisionNumber: result.revisionNumber,
      deliveryKind: "ticket",
    });
    await active.auditAction({ orderId, ticketId: result.ticketId, action: "participant_transfer_email_queued", revisionNumber: result.revisionNumber });
    return noStoreJson(result);
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
