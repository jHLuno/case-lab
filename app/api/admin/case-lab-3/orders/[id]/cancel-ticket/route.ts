import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getCaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CancelInput = {
  ticketId: string;
  reason: string;
  actorId: string;
};

type CancelResult = {
  kind: "cancelled";
  ticketId: string;
  status: "cancelled";
};

export type CancelTicketRouteDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  parseBody: (request: Request) => Promise<unknown>;
  getTicketId: (orderId: string) => Promise<string | null>;
  cancelTicket: (input: CancelInput) => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCancelResult(value: unknown): value is CancelResult {
  if (!isRecord(value)) return false;
  return value.kind === "cancelled" && typeof value.ticketId === "string" && value.status === "cancelled";
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

async function cancelAtomicTicket(input: CancelInput): Promise<CancelResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_cancel_ticket", {
    p_ticket_id: input.ticketId,
    p_actor_id: input.actorId,
    p_reason: input.reason,
  });
  if (error || !isCancelResult(data)) throw new Error("Admin ticket cancellation unavailable");
  return data;
}

const productionDependencies: CancelTicketRouteDependencies = {
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
  cancelTicket: cancelAtomicTicket,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: Partial<CancelTicketRouteDependencies> = {},
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
    const body = await active.parseBody(request);
    if (!isRecord(body) || typeof body.reason !== "string" || body.reason.trim().length === 0 || body.reason.trim().length > 500 || /[\u0000-\u001f\u007f]/u.test(body.reason)) {
      return noStoreJson({ error: "invalid_request" }, { status: 400 });
    }
    const ticketId = await active.getTicketId(orderId);
    if (!ticketId) return noStoreJson({ error: "not_found" }, { status: 404 });
    const result = await active.cancelTicket({ ticketId, reason: body.reason.trim(), actorId: "crm_admin" });
    return isCancelResult(result) ? noStoreJson(result) : noStoreJson({ error: "service_unavailable" }, { status: 503 });
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
