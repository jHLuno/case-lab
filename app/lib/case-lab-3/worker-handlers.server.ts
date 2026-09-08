import "server-only";

import { createHash } from "node:crypto";

import {
  getReceiptDetails,
  getReceiptStatus,
  KassirApiError,
  KASSIR_IDEMPOTENCY_WINDOW_MS,
  queueReceipt,
  type KassirFiscalOperation,
  type KassirFiscalPolicy,
} from "./kassir.server";
import {
  MailDeliveryError,
  sendAdminAlert,
  sendRefundEmail,
  sendTicketEmail,
  type AdminAlertInput,
  type RefundEmailInput,
  type TicketEmailInput,
} from "./mail.server";
import { getCaseLab3Config } from "./config.server";
import { getCaseLab3AdminClient } from "./supabase-admin.server";
import { buildTicketQrPayload, deriveManualCheckInCode, derivePurposeToken } from "./tokens.server";
import { CASE_LAB_3_EVENT } from "./ticket.server";
import { renderTicketPdf } from "./pdf.server";
import {
  PermanentJobError,
  RetryableJobError,
  UnknownJobError,
  sanitizeJobError,
  type ClaimedCaseLab3Job,
  type CaseLab3JobType,
} from "./jobs.server";
import type { Json, EmailStatus } from "./database.types";
import type { PaymentEnvironment } from "./contracts";

export type WorkerHandlerContext = {
  environment: PaymentEnvironment;
  signal: AbortSignal;
  timeoutMs: number;
  now: () => number;
};

export type WorkerHandler = (job: ClaimedCaseLab3Job, context: WorkerHandlerContext) => Promise<Json>;

export type ProductionHandlerOverrides = {
  issueFiscalOperation?: WorkerHandler;
  pollReceipt?: WorkerHandler;
  sendTicketEmail?: WorkerHandler;
  sendRefundNotification?: WorkerHandler;
  sendOrganizerAlert?: WorkerHandler;
};

export type ProductionJobHandlers = Partial<Record<CaseLab3JobType, WorkerHandler>>;

type WorkerQuery = {
  eq(column: string, value: unknown): WorkerQuery;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
};

type WorkerTable = {
  select(columns: string): WorkerQuery;
  update(values: Record<string, unknown>): WorkerQuery;
  upsert(values: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ error: unknown }>;
};

type WorkerRpcClient = {
  from(table: string): WorkerTable;
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};

type WorkerRecord = Record<string, unknown>;

function database(): WorkerRpcClient {
  return getCaseLab3AdminClient() as unknown as WorkerRpcClient;
}

function record(value: unknown): WorkerRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new PermanentJobError("Invalid worker data");
  return value as WorkerRecord;
}

function text(value: unknown, name: string, maxLength = 256): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) {
    throw new PermanentJobError(`Invalid worker ${name}`);
  }
  return value;
}

function uuid(value: unknown, name: string): string {
  const result = text(value, name, 64);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(result)) {
    throw new PermanentJobError(`Invalid worker ${name}`);
  }
  return result;
}

function payloadText(job: ClaimedCaseLab3Job, name: string, maxLength = 256): string {
  const payload = record(job.payloadReference);
  return text(payload[name], name, maxLength);
}

async function selectOne(
  client: WorkerRpcClient,
  table: string,
  columns: string,
  filters: ReadonlyArray<readonly [string, unknown]>,
): Promise<WorkerRecord> {
  let query = client.from(table).select(columns);
  for (const [column, value] of filters) query = query.eq(column, value);
  const result = await query.maybeSingle();
  if (result.error || !result.data) throw new RetryableJobError("Worker data is unavailable");
  return record(result.data);
}

async function selectMaybe(
  client: WorkerRpcClient,
  table: string,
  columns: string,
  filters: ReadonlyArray<readonly [string, unknown]>,
): Promise<WorkerRecord | null> {
  let query = client.from(table).select(columns);
  for (const [column, value] of filters) query = query.eq(column, value);
  const result = await query.maybeSingle();
  if (result.error) throw new RetryableJobError("Worker data is unavailable");
  return result.data ? record(result.data) : null;
}

async function update(
  client: WorkerRpcClient,
  table: string,
  values: Record<string, unknown>,
  filters: ReadonlyArray<readonly [string, unknown]>,
): Promise<void> {
  let query = client.from(table).update(values);
  for (const [column, value] of filters) query = query.eq(column, value);
  const result = await Promise.resolve(query as unknown as Promise<{ error: unknown }>);
  if (result.error) throw new RetryableJobError("Worker data update failed");
}

function jsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function iso(timestamp: number): string {
  return new Date(timestamp).toISOString();
}

function fiscalOperationFromRows(
  environment: PaymentEnvironment,
  operation: WorkerRecord,
  order: WorkerRecord,
): KassirFiscalOperation {
  const providerReceiptType = operation.provider_receipt_type;
  if (providerReceiptType !== "Income" && providerReceiptType !== "IncomeReturn") {
    throw new PermanentJobError("Unsupported fiscal receipt type");
  }
  const amountMinor = operation.amount_minor;
  if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) throw new PermanentJobError("Invalid fiscal amount");
  return {
    environment,
    id: uuid(operation.id, "fiscal operation id"),
    orderId: uuid(operation.order_id, "order id"),
    orderNumber: text(order.order_number, "order number"),
    accountId: uuid(operation.order_id, "account id"),
    invoiceId: text(order.order_number, "invoice id"),
    refundId: typeof operation.refund_id === "string" ? uuid(operation.refund_id, "refund id") : null,
    operationKey: text(operation.operation_key, "operation key", 200),
    providerReceiptType,
    tier: order.tier === "early_bird" || order.tier === "standard" ? order.tier : undefined,
    receiptLabel: typeof order.receipt_label === "string" ? order.receipt_label : null,
    amountMinor,
    email: text(order.fiscal_email ?? order.purchaser_email, "fiscal email", 320),
    kassirReceiptId: typeof operation.kassir_receipt_id === "string" ? operation.kassir_receipt_id : null,
    attemptCount: Number.isSafeInteger(operation.attempt_count) ? operation.attempt_count as number : 0,
    uncertainSinceAt: typeof operation.uncertain_since_at === "string" ? operation.uncertain_since_at : null,
    createdAt: typeof operation.created_at === "string" ? operation.created_at : null,
    payloadSnapshot: jsonObject(operation.payload_snapshot),
  };
}

async function loadFiscalContext(environment: PaymentEnvironment, operationKey: string): Promise<{
  operation: KassirFiscalOperation;
  policy: KassirFiscalPolicy;
}> {
  const client = database();
  const operation = await selectOne(client, "case_lab_3_fiscal_operations", "*", [
    ["environment", environment],
    ["operation_key", operationKey],
  ]);
  const order = await selectOne(client, "case_lab_3_orders", "id, order_number, tier, receipt_label, purchaser_email, fiscal_email", [
    ["id", operation.order_id],
    ["environment", environment],
  ]);
  const policy = await selectOne(client, "case_lab_3_fiscal_policy_versions", "*", [
    ["id", operation.fiscal_policy_version_id],
    ["environment", environment],
  ]);
  const config = getCaseLab3Config(environment);
  return {
    operation: fiscalOperationFromRows(environment, operation, order),
    policy: {
      environment,
      sellerInn: config.seller.inn,
      taxationSystem: 0,
      vatRate: null,
      calculationPlace: "caselab.kz",
      policyDefinition: Array.isArray(policy.policy_definition) ? policy.policy_definition as KassirFiscalPolicy["policyDefinition"] : undefined,
      policyStatus: policy.policy_status === "approved" ? "approved" : "draft",
      isAccountantApproved: policy.is_accountant_approved === true,
    },
  };
}

async function persistQueuedFiscalOperation(
  environment: PaymentEnvironment,
  operation: KassirFiscalOperation,
  receiptId: string,
  now: number,
  incrementAttempt = true,
): Promise<void> {
  const client = database();
  await update(client, "case_lab_3_fiscal_operations", {
    status: "queued",
    kassir_receipt_id: receiptId,
    queued_at: iso(now),
    uncertain_since_at: null,
    next_attempt_at: iso(now + 30_000),
    last_error: null,
    ...(incrementAttempt ? { attempt_count: (operation.attemptCount ?? 0) + 1 } : {}),
  }, [
    ["id", operation.id],
    ["environment", environment],
  ]);
  const result = await client.from("case_lab_3_jobs").upsert({
    environment,
    job_type: "poll_receipt",
    logical_key: `job:poll:${operation.operationKey}:${now}`,
    payload_reference: { operationKey: operation.operationKey, receiptId },
    order_id: operation.orderId,
    refund_id: operation.refundId ?? null,
  }, { onConflict: "environment,logical_key", ignoreDuplicates: true });
  if (result.error) throw new RetryableJobError("Receipt poll could not be scheduled");
}

async function persistFiscalUncertainty(
  environment: PaymentEnvironment,
  operation: KassirFiscalOperation,
  error: unknown,
  uncertainSince: number,
): Promise<void> {
  await update(database(), "case_lab_3_fiscal_operations", {
    status: "unknown",
    uncertain_since_at: iso(uncertainSince),
    next_attempt_at: null,
    last_error: sanitizeJobError(error),
  }, [
    ["id", operation.id],
    ["environment", environment],
  ]);
}

async function queueFiscalOperation(job: ClaimedCaseLab3Job, context: WorkerHandlerContext): Promise<Json> {
  const operationKey = payloadText(job, "operationKey", 200);
  const { operation, policy } = await loadFiscalContext(context.environment, operationKey);
  if (operation.uncertainSinceAt) {
    const uncertainSince = Date.parse(operation.uncertainSinceAt);
    if (Number.isFinite(uncertainSince) && context.now() - uncertainSince >= KASSIR_IDEMPOTENCY_WINDOW_MS) {
      throw new UnknownJobError("Kassir receipt request requires reconciliation", uncertainSince);
    }
  }
  try {
    const queued = await queueReceipt(context.environment, operation, policy, {
      signal: context.signal,
      now: context.now,
      getConfig: (environment) => {
        const config = getCaseLab3Config(environment);
        return { kassir: config.kassir, seller: config.seller };
      },
    });
    await persistQueuedFiscalOperation(context.environment, operation, queued.receiptId, context.now());
    return { status: "queued", receiptId: queued.receiptId };
  } catch (error) {
    if (error instanceof KassirApiError && error.failureKind === "unknown" && error.uncertainSince !== null) {
      await persistFiscalUncertainty(context.environment, operation, error, error.uncertainSince);
    }
    throw error;
  }
}

function receiptUrl(model: WorkerRecord): string | null {
  const value = model.Url ?? model.url;
  return typeof value === "string" && value.length > 0 && value.length <= 2048 && /^https:\/\//u.test(value) ? value : null;
}

async function applyPolledReceipt(
  environment: PaymentEnvironment,
  operation: KassirFiscalOperation,
  receiptId: string,
  model: WorkerRecord,
): Promise<void> {
  const url = receiptUrl(model);
  const sanitizedFields = {
    receiptId,
    kassirReceiptId: receiptId,
    receiptStatus: "issued",
    status: "Processed",
    type: operation.providerReceiptType,
    amountMinor: operation.amountMinor,
    ...(url ? { receiptUrl: url } : {}),
  };
  const bodyHash = createHash("sha256")
    .update(`${operation.operationKey}\0${receiptId}\0Processed\0${operation.amountMinor}`, "utf8")
    .digest("hex");
  const result = await database().rpc("case_lab_3_apply_receipt", {
    p_environment: environment,
    p_provider: "kassir",
    p_provider_event_id: `poll:${operation.id}:${receiptId}`,
    p_body_hash: bodyHash,
    p_kassir_receipt_id: receiptId,
    p_operation_key: operation.operationKey,
    p_order_id: operation.orderId,
    p_refund_id: operation.refundId ?? null,
    p_receipt_type: operation.providerReceiptType,
    p_receipt_status: "Processed",
    p_amount_minor: operation.amountMinor,
    p_receipt_url: url,
    p_fiscal_fields: {},
    p_sanitized_fields: sanitizedFields,
  });
  const applied = result.error ? null : result.data === undefined ? null : record(result.data);
  if (result.error || !applied || !["accepted", "review_required"].includes(applied.kind as string)) {
    throw new RetryableJobError("Polled receipt could not be persisted");
  }
}

async function pollReceipt(job: ClaimedCaseLab3Job, context: WorkerHandlerContext): Promise<Json> {
  const operationKey = payloadText(job, "operationKey", 200);
  const receiptId = payloadText(job, "receiptId", 256);
  const { operation } = await loadFiscalContext(context.environment, operationKey);
  const status = await getReceiptStatus(context.environment, receiptId, {
    signal: context.signal,
    now: context.now,
    getConfig: (environment) => {
      const config = getCaseLab3Config(environment);
      return { kassir: config.kassir, seller: config.seller };
    },
  });
  if (status.status === "Queued") {
    await persistQueuedFiscalOperation(context.environment, operation, receiptId, context.now(), false);
    return { status: "queued", receiptId };
  }
  if (status.status === "NotFound") {
    const uncertainSince = operation.uncertainSinceAt ? Date.parse(operation.uncertainSinceAt) : context.now();
    const persistedSince = Number.isFinite(uncertainSince) ? uncertainSince : context.now();
    await persistFiscalUncertainty(context.environment, operation, new Error("Kassir receipt not found"), persistedSince);
    throw new UnknownJobError("Kassir receipt not found", persistedSince);
  }
  if (status.status === "Error") {
    await update(database(), "case_lab_3_fiscal_operations", { status: "error", last_error: "Kassir receipt processing failed", next_attempt_at: null }, [
      ["id", operation.id],
      ["environment", context.environment],
    ]);
    return { status: "error", receiptId };
  }
  const details = await getReceiptDetails(context.environment, receiptId, {
    signal: context.signal,
    now: context.now,
    getConfig: (environment) => {
      const config = getCaseLab3Config(environment);
      return { kassir: config.kassir, seller: config.seller };
    },
  });
  await applyPolledReceipt(context.environment, operation, receiptId, details.model);
  return { status: "issued", receiptId };
}

async function ticketEmailInput(job: ClaimedCaseLab3Job, environment: PaymentEnvironment): Promise<TicketEmailInput> {
  const ticketId = payloadText(job, "ticketId");
  const operationKey = payloadText(job, "operationKey", 200);
  const client = database();
  const ticket = await selectOne(client, "case_lab_3_tickets", "*", [["id", ticketId], ["environment", environment]]);
  const revision = await selectOne(client, "case_lab_3_ticket_revisions", "*", [
    ["id", ticket.current_revision_id],
    ["ticket_id", ticketId],
    ["environment", environment],
  ]);
  const order = await selectOne(client, "case_lab_3_orders", "*", [["id", ticket.order_id], ["environment", environment]]);
  const secret = getCaseLab3Config(environment).tokenSecret;
  const qrPayload = buildTicketQrPayload(ticketId, Number(revision.revision_number), secret);
  const manualCode = deriveManualCheckInCode(secret, ticketId, Number(revision.revision_number));
  const ticketNumber = text(ticket.public_ticket_number, "ticket number", 100);
  const ticketToken = derivePurposeToken(secret, "ticket-session", ticketId, Number(revision.token_version));
  const participantUrl = `https://caselab.kz/api/case-lab-3/tickets/${encodeURIComponent(ticketNumber)}/access?token=${encodeURIComponent(ticketToken)}`;
  const pdf = await renderTicketPdf({
    ticketId,
    publicTicketNumber: ticketNumber,
    revisionId: uuid(revision.id, "ticket revision id"),
    revisionNumber: Number(revision.revision_number),
    tokenVersion: Number(revision.token_version),
    status: ticket.status === "valid" || ticket.status === "used" || ticket.status === "cancelled" ? ticket.status : "valid",
    firstName: text(revision.first_name, "first name", 200),
    lastName: text(revision.last_name, "last name", 200),
    qrPayload,
    manualCode,
    eventName: CASE_LAB_3_EVENT.name,
    eventDate: CASE_LAB_3_EVENT.date,
    eventTime: CASE_LAB_3_EVENT.time,
    venue: CASE_LAB_3_EVENT.venue,
    supportEmail: CASE_LAB_3_EVENT.supportEmail,
  });
  return {
    environment,
    operationKey,
    recipientEmail: text(order.participant_email, "participant email", 320),
    participant: {
      firstName: text(revision.first_name, "first name", 200),
      lastName: text(revision.last_name, "last name", 200),
    },
    ticket: {
      publicTicketNumber: ticketNumber,
      participantUrl,
    },
    pdf,
  };
}

async function markEmail(
  environment: PaymentEnvironment,
  operationKey: string,
  orderId: string | null,
  status: EmailStatus,
  messageId: string | null,
  error: string | null,
): Promise<void> {
  const client = database();
  await update(client, "case_lab_3_email_deliveries", {
    status,
    transport_message_id: messageId,
    sent_at: status === "sent" ? new Date().toISOString() : null,
    last_error: error,
  }, [["environment", environment], ["operation_key", operationKey]]);
  if (orderId) {
    await update(client, "case_lab_3_orders", { email_status: status }, [["id", orderId], ["environment", environment]]);
  }
}

async function sendEmail(
  job: ClaimedCaseLab3Job,
  context: WorkerHandlerContext,
  send: () => Promise<{ status: string; messageId: string }>,
  operationKey = payloadText(job, "operationKey", 200),
  updateOrderStatus = true,
): Promise<Json> {
  try {
    const result = await send();
    if (result.status === "rejected") throw new PermanentJobError("Email was rejected");
    await markEmail(context.environment, operationKey, updateOrderStatus ? job.orderId : null, "sent", result.messageId, null);
    return result as unknown as Json;
  } catch (error) {
    const status = error instanceof MailDeliveryError && error.status === "unknown" ? "unknown" : "failed";
    await markEmail(context.environment, operationKey, updateOrderStatus ? job.orderId : null, status, null, sanitizeJobError(error));
    if (status === "unknown") throw new UnknownJobError("Mail delivery result is unknown", context.now());
    throw error;
  }
}

async function sendTicket(job: ClaimedCaseLab3Job, context: WorkerHandlerContext): Promise<Json> {
  const input = await ticketEmailInput(job, context.environment);
  return sendEmail(job, context, async () => {
    const result = await sendTicketEmail(input, { signal: context.signal, attemptCount: job.attemptCount ?? 0 });
    return { status: result.status, messageId: result.transportMessageId ?? result.messageId };
  });
}

async function sendRefund(job: ClaimedCaseLab3Job, context: WorkerHandlerContext): Promise<Json> {
  const refundId = payloadText(job, "refundId");
  const operationKey = payloadText(job, "operationKey", 200);
  const client = database();
  const order = await selectOne(client, "case_lab_3_orders", "id, purchaser_email", [["id", job.orderId], ["environment", context.environment]]);
  const ticket = await selectOne(client, "case_lab_3_tickets", "public_ticket_number", [["order_id", job.orderId], ["environment", context.environment]]);
  const receipt = await selectMaybe(client, "case_lab_3_fiscal_operations", "receipt_url", [
    ["refund_id", refundId],
    ["environment", context.environment],
    ["status", "issued"],
  ]);
  const input: RefundEmailInput = {
    environment: context.environment,
    operationKey,
    recipientEmail: text(order.purchaser_email, "purchaser email", 320),
    ticketNumber: text(ticket.public_ticket_number, "ticket number", 100),
    refundReceiptUrl: typeof receipt?.receipt_url === "string" ? receipt.receipt_url : null,
  };
  return sendEmail(job, context, async () => {
    const result = await sendRefundEmail(input, { signal: context.signal, attemptCount: job.attemptCount ?? 0 });
    return { status: result.status, messageId: result.transportMessageId ?? result.messageId };
  });
}

async function sendAlert(job: ClaimedCaseLab3Job, context: WorkerHandlerContext): Promise<Json> {
  const payload = record(job.payloadReference);
  const incidentId = payloadText(job, "incidentId");
  const incident = await selectOne(database(), "case_lab_3_incidents", "incident_type, summary", [
    ["id", incidentId],
    ["environment", context.environment],
  ]);
  const operationKey = `email:organizer_alert:${incidentId}`;
  const config = getCaseLab3Config(context.environment);
  const delivery = await database().from("case_lab_3_email_deliveries").upsert({
    environment: context.environment,
    operation_key: operationKey,
    delivery_kind: "organizer_alert",
    order_id: job.orderId,
    recipient_email: config.alertEmail,
    status: "pending",
  }, { onConflict: "environment,operation_key", ignoreDuplicates: true });
  if (delivery.error) throw new RetryableJobError("Alert delivery could not be recorded");
  const input: AdminAlertInput = {
    environment: context.environment,
    operationKey,
    subject: typeof payload.subject === "string" ? text(payload.subject, "alert subject", 200) : `Case Lab III: ${text(incident.incident_type, "incident type", 80)}`,
    text: typeof payload.text === "string" ? text(payload.text, "alert text", 4000) : JSON.stringify(incident.summary ?? {}),
  };
  return sendEmail(job, context, async () => {
    const result = await sendAdminAlert(input, { signal: context.signal, attemptCount: job.attemptCount ?? 0 });
    return { status: result.status, messageId: result.transportMessageId ?? result.messageId };
  }, operationKey, false);
}

function defaultHandlers(): ProductionJobHandlers {
  return {
    issue_fiscal_operation: queueFiscalOperation,
    poll_receipt: pollReceipt,
    send_ticket_email: sendTicket,
    send_refund_notification: sendRefund,
    send_organizer_alert: sendAlert,
  };
}

export function createProductionCaseLab3JobHandlers(overrides: ProductionHandlerOverrides = {}): ProductionJobHandlers {
  const handlers = defaultHandlers();
  if (overrides.issueFiscalOperation) handlers.issue_fiscal_operation = overrides.issueFiscalOperation;
  if (overrides.pollReceipt) handlers.poll_receipt = overrides.pollReceipt;
  if (overrides.sendTicketEmail) handlers.send_ticket_email = overrides.sendTicketEmail;
  if (overrides.sendRefundNotification) handlers.send_refund_notification = overrides.sendRefundNotification;
  if (overrides.sendOrganizerAlert) handlers.send_organizer_alert = overrides.sendOrganizerAlert;
  return handlers;
}
