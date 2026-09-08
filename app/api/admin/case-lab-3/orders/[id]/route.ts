import "server-only";

import { requireCrmAdmin } from "@/lib/crm-auth.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getCaseLab3AdminClient, type CaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";
import type { PaymentEnvironment } from "@/lib/case-lab-3/contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type AdminOrderDetail = {
  id: string;
  orderNumber: string;
  environment: PaymentEnvironment;
  firstName: string;
  lastName: string;
  participantEmail: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  purchaserEmail: string;
  fiscalEmail: string;
  tier: "early_bird" | "standard";
  amountMinor: number;
  currency: "KZT";
  paymentStatus: string;
  ticketStatus: string;
  receiptStatus: string;
  emailStatus: string;
  paidAmountMinor: number;
  refundedAmountMinor: number;
  refundableAmountMinor: number;
  reservationExpiresAt: string | null;
  paidAt: string | null;
  refundedAt: string | null;
  createdAt: string;
  updatedAt: string;
  ticket: {
    id: string;
    publicTicketNumber: string;
    status: string;
    currentRevision: {
      id: string;
      revisionNumber: number;
      firstName: string;
      lastName: string;
      participantEmail: string;
      phone: string | null;
      company: string | null;
      position: string | null;
      tokenVersion: number;
    } | null;
  } | null;
  paymentAttempts: Array<{
    id: string;
    externalId: string;
    providerTransactionId: string | null;
    status: string;
    failureCode: string | null;
    createdAt: string;
    completedAt: string | null;
  }>;
  fiscalOperations: Array<{
    id: string;
    purpose: string;
    receiptType: string;
    amountMinor: number;
    status: string;
    kassirReceiptId: string | null;
    receiptUrl: string | null;
    issuedAt: string | null;
  }>;
  refunds: Array<{
    id: string;
    operationKey: string;
    amountMinor: number;
    status: string;
    providerTransactionId: string | null;
    createdAt: string;
    confirmedAt: string | null;
  }>;
  emailDeliveries: Array<{
    id: string;
    operationKey: string;
    deliveryKind: string;
    recipientEmail: string;
    status: string;
    transportMessageId: string | null;
    createdAt: string;
    sentAt: string | null;
  }>;
  incidents: Array<{
    id: string;
    incidentType: string;
    status: string;
    summary: Record<string, unknown>;
    createdAt: string;
  }>;
  audit: Array<{
    id: string;
    action: string;
    actorId: string;
    actorLabel: string | null;
    createdAt: string;
  }>;
};

type CurrentTicketRevision = NonNullable<NonNullable<AdminOrderDetail["ticket"]>["currentRevision"]>;

export type OrderDetailRouteDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  getOrderDetail: (orderId: string) => Promise<AdminOrderDetail | null>;
};

type OrderRecord = {
  id: string;
  order_number: string;
  environment: PaymentEnvironment;
  first_name: string;
  last_name: string;
  participant_email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  purchaser_email: string;
  fiscal_email: string;
  tier: "early_bird" | "standard";
  amount_minor: number;
  currency: "KZT";
  payment_status: string;
  ticket_status: string;
  receipt_status: string;
  email_status: string;
  paid_amount_minor: number;
  refunded_amount_minor: number;
  refundable_amount_minor: number;
  reservation_expires_at: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export async function loadAdminOrderDetail(
  orderId: string,
  client: CaseLab3AdminClient = getCaseLab3AdminClient(),
): Promise<AdminOrderDetail | null> {
  if (!isUuid(orderId)) return null;

  const { data: order, error: orderError } = await client
    .from("case_lab_3_orders")
    .select([
      "id", "order_number", "environment", "first_name", "last_name", "participant_email", "phone", "company", "position",
      "purchaser_email", "fiscal_email", "tier", "amount_minor", "currency", "payment_status", "ticket_status", "receipt_status",
      "email_status", "paid_amount_minor", "refunded_amount_minor", "refundable_amount_minor", "reservation_expires_at", "paid_at",
      "refunded_at", "created_at", "updated_at",
    ].join(","))
    .eq("id", orderId)
    .maybeSingle();
  if (orderError || !order) return null;

  const typedOrder = order as unknown as OrderRecord;
  const [ticketResult, attemptsResult, fiscalResult, refundsResult, emailsResult, incidentsResult, auditResult] = await Promise.all([
    client
      .from("case_lab_3_tickets")
      .select("id, public_ticket_number, status, current_revision_id")
      .eq("order_id", typedOrder.id)
      .maybeSingle(),
    client
      .from("case_lab_3_payment_attempts")
      .select("id, external_id, provider_transaction_id, status, failure_code, created_at, completed_at")
      .eq("order_id", typedOrder.id)
      .order("created_at", { ascending: false }),
    client
      .from("case_lab_3_fiscal_operations")
      .select("id, policy_purpose, provider_receipt_type, amount_minor, status, kassir_receipt_id, receipt_url, issued_at")
      .eq("order_id", typedOrder.id)
      .order("created_at", { ascending: false }),
    client
      .from("case_lab_3_refunds")
      .select("id, operation_key, amount_minor, status, provider_transaction_id, created_at, confirmed_at")
      .eq("order_id", typedOrder.id)
      .order("created_at", { ascending: false }),
    client
      .from("case_lab_3_email_deliveries")
      .select("id, operation_key, delivery_kind, recipient_email, status, transport_message_id, created_at, sent_at")
      .eq("order_id", typedOrder.id)
      .order("created_at", { ascending: false }),
    client
      .from("case_lab_3_incidents")
      .select("id, incident_type, status, summary, created_at")
      .eq("order_id", typedOrder.id)
      .order("created_at", { ascending: false }),
    client
      .from("case_lab_3_audit_log")
      .select("id, action, actor_id, actor_label, created_at")
      .eq("target_id", typedOrder.id)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  if ([ticketResult, attemptsResult, fiscalResult, refundsResult, emailsResult, incidentsResult, auditResult].some((result) => result.error)) {
    throw new Error("Admin order detail unavailable");
  }

  const ticket = ticketResult.data;
  let currentRevision: CurrentTicketRevision | null = null;
  if (ticket?.current_revision_id) {
    const { data: revision, error: revisionError } = await client
      .from("case_lab_3_ticket_revisions")
      .select("id, revision_number, first_name, last_name, participant_email, phone, company, position, token_version")
      .eq("id", ticket.current_revision_id)
      .eq("ticket_id", ticket.id)
      .maybeSingle();
    if (revisionError) throw new Error("Admin ticket detail unavailable");
    if (revision) {
      currentRevision = {
        id: revision.id,
        revisionNumber: revision.revision_number,
        firstName: revision.first_name,
        lastName: revision.last_name,
        participantEmail: revision.participant_email,
        phone: revision.phone,
        company: revision.company,
        position: revision.position,
        tokenVersion: revision.token_version,
      };
    }
  }

  return {
    id: typedOrder.id,
    orderNumber: typedOrder.order_number,
    environment: typedOrder.environment,
    firstName: typedOrder.first_name,
    lastName: typedOrder.last_name,
    participantEmail: typedOrder.participant_email,
    phone: typedOrder.phone,
    company: typedOrder.company,
    position: typedOrder.position,
    purchaserEmail: typedOrder.purchaser_email,
    fiscalEmail: typedOrder.fiscal_email,
    tier: typedOrder.tier,
    amountMinor: typedOrder.amount_minor,
    currency: typedOrder.currency,
    paymentStatus: typedOrder.payment_status,
    ticketStatus: typedOrder.ticket_status,
    receiptStatus: typedOrder.receipt_status,
    emailStatus: typedOrder.email_status,
    paidAmountMinor: typedOrder.paid_amount_minor,
    refundedAmountMinor: typedOrder.refunded_amount_minor,
    refundableAmountMinor: typedOrder.refundable_amount_minor,
    reservationExpiresAt: typedOrder.reservation_expires_at,
    paidAt: typedOrder.paid_at,
    refundedAt: typedOrder.refunded_at,
    createdAt: typedOrder.created_at,
    updatedAt: typedOrder.updated_at,
    ticket: ticket
      ? { id: ticket.id, publicTicketNumber: ticket.public_ticket_number, status: ticket.status, currentRevision }
      : null,
    paymentAttempts: (attemptsResult.data ?? []).map((row) => ({
      id: row.id,
      externalId: row.external_id,
      providerTransactionId: row.provider_transaction_id,
      status: row.status,
      failureCode: row.failure_code,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    })),
    fiscalOperations: (fiscalResult.data ?? []).map((row) => ({
      id: row.id,
      purpose: row.policy_purpose,
      receiptType: row.provider_receipt_type,
      amountMinor: row.amount_minor,
      status: row.status,
      kassirReceiptId: row.kassir_receipt_id,
      receiptUrl: row.receipt_url,
      issuedAt: row.issued_at,
    })),
    refunds: (refundsResult.data ?? []).map((row) => ({
      id: row.id,
      operationKey: row.operation_key,
      amountMinor: row.amount_minor,
      status: row.status,
      providerTransactionId: row.provider_transaction_id,
      createdAt: row.created_at,
      confirmedAt: row.confirmed_at,
    })),
    emailDeliveries: (emailsResult.data ?? []).map((row) => ({
      id: row.id,
      operationKey: row.operation_key,
      deliveryKind: row.delivery_kind,
      recipientEmail: row.recipient_email,
      status: row.status,
      transportMessageId: row.transport_message_id,
      createdAt: row.created_at,
      sentAt: row.sent_at,
    })),
    incidents: (incidentsResult.data ?? []).map((row) => ({
      id: row.id,
      incidentType: row.incident_type,
      status: row.status,
      summary: (row.summary ?? {}) as Record<string, unknown>,
      createdAt: row.created_at,
    })),
    audit: (auditResult.data ?? []).map((row) => ({
      id: row.id,
      action: row.action,
      actorId: row.actor_id,
      actorLabel: row.actor_label,
      createdAt: row.created_at,
    })),
  };
}

const productionDependencies: OrderDetailRouteDependencies = {
  requireCrmAdmin,
  getOrderDetail: loadAdminOrderDetail,
};

export async function handleGet(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: Partial<OrderDetailRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    const { id } = await params;
    if (!isUuid(id)) return noStoreJson({ error: "not_found" }, { status: 404 });
    const detail = await active.getOrderDetail(id);
    return detail ? noStoreJson(detail) : noStoreJson({ error: "not_found" }, { status: 404 });
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handleGet(request, context);
}
