import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getCaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReceiptContext = {
  orderId: string;
  environment: "test" | "live";
  receiptUrl: string;
};

export type ReceiptLinkRouteDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  getReceipt: (orderId: string) => Promise<ReceiptContext | null>;
  queueReceiptLink: (receipt: ReceiptContext, idempotencyKey: string) => Promise<void>;
  auditAction: (receipt: ReceiptContext) => Promise<void>;
};

async function findIssuedReceipt(orderId: string): Promise<ReceiptContext | null> {
  const client = getCaseLab3AdminClient();
  const { data: order, error: orderError } = await client
    .from("case_lab_3_orders")
    .select("id, environment")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order) return null;
  const { data: receipt, error: receiptError } = await client
    .from("case_lab_3_fiscal_operations")
    .select("receipt_url")
    .eq("order_id", order.id)
    .eq("environment", order.environment)
    .eq("status", "issued")
    .not("receipt_url", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (receiptError || !receipt?.receipt_url) return null;
  return { orderId, environment: order.environment, receiptUrl: receipt.receipt_url };
}

async function queueIssuedReceiptLink(receipt: ReceiptContext, idempotencyKey: string): Promise<void> {
  const { error } = await getCaseLab3AdminClient().from("case_lab_3_jobs").insert({
    environment: receipt.environment,
    job_type: "send_ticket_email",
    logical_key: `receipt-link:${receipt.orderId}:${idempotencyKey}`,
    payload_reference: { orderId: receipt.orderId, receiptUrl: receipt.receiptUrl, receiptLinkOnly: true },
    order_id: receipt.orderId,
    last_error: null,
    leased_until: null,
    lease_token: null,
    result: null,
  });
  if (error) throw new Error("Admin receipt link unavailable");
}

async function auditReceiptLink(receipt: ReceiptContext): Promise<void> {
  const { error } = await getCaseLab3AdminClient().from("case_lab_3_audit_log").insert({
    environment: receipt.environment,
    action: "receipt_link_sent",
    target_table: "case_lab_3_orders",
    target_id: receipt.orderId,
    before_summary: null,
    after_summary: { receiptLink: true },
    actor_id: "crm_admin",
    actor_label: "CRM admin",
  });
  if (error) throw new Error("Admin audit unavailable");
}

const productionDependencies: ReceiptLinkRouteDependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  getReceipt: findIssuedReceipt,
  queueReceiptLink: queueIssuedReceiptLink,
  auditAction: auditReceiptLink,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: Partial<ReceiptLinkRouteDependencies> = {},
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
    const receipt = await active.getReceipt(id);
    if (!receipt) return noStoreJson({ error: "receipt_unavailable" }, { status: 409 });
    const idempotencyKey = request.headers.get("idempotency-key")?.trim() ?? "";
    await active.queueReceiptLink(receipt, idempotencyKey);
    await active.auditAction(receipt);
    return noStoreJson({ kind: "queued", orderId: id });
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
