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
import { getCaseLab3Config, type CaseLab3Config } from "./config.server";
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
import {
  applyRefund,
  getValidModelTransactionId,
  hasValidModelTransactionId,
  hashTipTopBody,
  reconcileRefund,
  refundPayment,
  type RefundPaymentInput,
  type TipTopApiOptions,
  type TipTopApiResponse,
  type TipTopRefund,
  type TipTopRefundReconciliation,
  type TipTopTransitionResult,
} from "./tiptoppay.server";
import type {
  Json,
  EmailStatus,
  OrderSummaryTicketStatus,
  PaymentStatus,
  RefundStatus,
} from "./database.types";
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
  initiateRefund?: WorkerHandler;
  reconcilePayment?: WorkerHandler;
  sendAnalyticsEvent?: WorkerHandler;
  sendOrganizerAlert?: WorkerHandler;
};

export type ProductionJobHandlers = Partial<Record<CaseLab3JobType, WorkerHandler>>;

export type AnalyticsEventState = {
  id: string;
  environment: PaymentEnvironment;
  eventKey: string;
  eventName: "purchase" | "refund";
  orderId: string;
  refundId: string | null;
  gaClientId: string | null;
  payloadSnapshot: WorkerRecord;
  deliveryStatus: EmailStatus;
};

type AnalyticsConfig = Pick<CaseLab3Config, "ga4">;
type AnalyticsHandlerOverrides = {
  getConfig?: (environment: PaymentEnvironment) => AnalyticsConfig;
  loadEvent?: (environment: PaymentEnvironment, eventKey: string) => Promise<AnalyticsEventState>;
  updateEvent?: (environment: PaymentEnvironment, eventKey: string, values: Record<string, unknown>) => Promise<void>;
  sendEvent?: (event: AnalyticsEventState, config: NonNullable<AnalyticsConfig["ga4"]>, signal: AbortSignal) => Promise<void>;
};

export type InitiateRefundState = {
  environment: PaymentEnvironment;
  orderId: string;
  orderNumber: string;
  paymentStatus: PaymentStatus;
  paidAmountMinor: number;
  ticketStatus: OrderSummaryTicketStatus;
  refundId: string;
  paymentAttemptId: string | null;
  paymentProviderTransactionId: string | null;
  operationKey: string;
  refundType: "full" | "partial";
  amountMinor: number;
  currency: "KZT";
  refundStatus: RefundStatus;
  attemptCount: number;
  uncertainSinceAt: string | null;
};

type RefundStartResult = "claimed" | "already_processing" | "confirmed" | "failed" | "review_required";

export type InitiateRefundHandlerOverrides = {
  loadState?: (job: ClaimedCaseLab3Job, context: WorkerHandlerContext) => Promise<unknown>;
  markProcessing?: (state: InitiateRefundState, job: ClaimedCaseLab3Job, context: WorkerHandlerContext) => Promise<RefundStartResult>;
  markFailed?: (state: InitiateRefundState, job: ClaimedCaseLab3Job, context: WorkerHandlerContext) => Promise<void>;
  markUnknown?: (state: InitiateRefundState, job: ClaimedCaseLab3Job, context: WorkerHandlerContext) => Promise<void>;
  refundPayment?: (
    environment: PaymentEnvironment,
    input: RefundPaymentInput,
    options: TipTopApiOptions & { signal: AbortSignal },
  ) => Promise<TipTopApiResponse>;
};

export type ReconcilePaymentHandlerOverrides = {
  loadState?: (job: ClaimedCaseLab3Job, context: WorkerHandlerContext) => Promise<unknown>;
  reconcileRefund?: (
    environment: PaymentEnvironment,
    input: RefundPaymentInput,
    options: TipTopApiOptions & { signal: AbortSignal },
  ) => Promise<TipTopRefundReconciliation>;
  applyRefund?: typeof applyRefund;
};

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

function payloadInteger(job: ClaimedCaseLab3Job, name: string): number {
  const payload = record(job.payloadReference);
  const value = payload[name];
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new PermanentJobError(`Invalid worker ${name}`);
  }
  return value;
}

function oneOf<T extends string>(value: unknown, name: string, values: readonly T[]): T {
  if (typeof value !== "string" || !values.includes(value as T)) throw new PermanentJobError(`Invalid worker ${name}`);
  return value as T;
}

function optionalUuid(value: unknown, name: string): string | null {
  return value === null || value === undefined ? null : uuid(value, name);
}

function optionalWorkerText(value: unknown, name: string, maxLength = 256): string | null {
  return value === null || value === undefined ? null : text(value, name, maxLength);
}

function refundState(value: unknown): InitiateRefundState {
  const source = record(value);
  return {
    environment: oneOf(source.environment, "environment", ["test", "live"] as const),
    orderId: uuid(source.orderId, "order id"),
    orderNumber: text(source.orderNumber, "order number", 128),
    paymentStatus: oneOf(source.paymentStatus, "payment status", [
      "pending",
      "processing",
      "paid",
      "failed",
      "refund_pending",
      "partially_refunded",
      "refunded",
      "review_required",
    ] as const) as PaymentStatus,
    paidAmountMinor: workerAmount(source.paidAmountMinor, "paid amount"),
    ticketStatus: oneOf(source.ticketStatus, "ticket status", ["pending", "valid", "used", "cancelled"] as const),
    refundId: uuid(source.refundId, "refund id"),
    paymentAttemptId: optionalUuid(source.paymentAttemptId, "payment attempt id"),
    paymentProviderTransactionId: optionalWorkerText(source.paymentProviderTransactionId, "payment provider transaction id"),
    operationKey: text(source.operationKey, "operation key", 200),
    refundType: oneOf(source.refundType, "refund type", ["full", "partial"] as const),
    amountMinor: workerAmount(source.amountMinor, "refund amount"),
    currency: oneOf(source.currency, "currency", ["KZT"] as const),
    refundStatus: oneOf(source.refundStatus, "refund status", [
      "requested",
      "processing",
      "confirmed",
      "failed",
      "unknown",
      "review_required",
    ] as const),
    attemptCount: workerCount(source.attemptCount, "attempt count"),
    uncertainSinceAt: optionalWorkerText(source.uncertainSinceAt, "uncertain since", 128),
  };
}

function workerAmount(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) {
    throw new PermanentJobError(`Invalid worker ${name}`);
  }
  return value;
}

function workerCount(value: unknown, name: string): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new PermanentJobError(`Invalid worker ${name}`);
  }
  return value;
}

function validateRefundJob(job: ClaimedCaseLab3Job, context: WorkerHandlerContext, state: InitiateRefundState): {
  operationKey: string;
  amountMinor: number;
} {
  if (state.environment !== context.environment) throw new PermanentJobError("Refund environment mismatch");
  if (!job.orderId || state.orderId !== job.orderId) throw new PermanentJobError("Refund order mismatch");
  if (!job.refundId || state.refundId !== job.refundId) throw new PermanentJobError("Refund id mismatch");

  const refundId = uuid(payloadText(job, "refundId"), "refund id");
  const operationKey = payloadText(job, "operationKey", 200);
  const amountMinor = payloadInteger(job, "amountMinor");
  if (refundId !== state.refundId || operationKey !== state.operationKey || amountMinor !== state.amountMinor) {
    throw new PermanentJobError("Refund payload does not match durable state");
  }
  if (state.amountMinor > state.paidAmountMinor) throw new PermanentJobError("Refund exceeds paid amount");
  if (state.refundStatus === "requested" && state.paymentStatus !== "paid" && state.paymentStatus !== "refund_pending" && state.paymentStatus !== "partially_refunded") {
    throw new PermanentJobError("Refund order is not refundable");
  }
  if (
    state.refundStatus === "requested" &&
    (!state.paymentProviderTransactionId || !/^\d+$/u.test(state.paymentProviderTransactionId) || !Number.isSafeInteger(Number(state.paymentProviderTransactionId)) || Number(state.paymentProviderTransactionId) < 1)
  ) {
    throw new PermanentJobError("Refund payment transaction is invalid");
  }
  return { operationKey, amountMinor };
}

async function loadInitiateRefundState(job: ClaimedCaseLab3Job, context: WorkerHandlerContext): Promise<unknown> {
  if (!job.orderId || !job.refundId) throw new PermanentJobError("Refund job identifiers are missing");
  const refundId = uuid(payloadText(job, "refundId"), "refund id");
  const operationKey = payloadText(job, "operationKey", 200);
  payloadInteger(job, "amountMinor");
  const client = database();
  const order = await selectOne(client, "case_lab_3_orders", "id, order_number, environment, payment_status, paid_amount_minor, ticket_status", [
    ["id", job.orderId],
    ["environment", context.environment],
  ]);
  const refund = await selectOne(client, "case_lab_3_refunds", "id, order_id, payment_attempt_id, payment_provider_transaction_id, environment, operation_key, refund_type, amount_minor, currency, status, attempt_count, uncertain_since_at", [
    ["id", refundId],
    ["order_id", job.orderId],
    ["environment", context.environment],
    ["operation_key", operationKey],
  ]);
  return {
    environment: context.environment,
    orderId: order.id,
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    paidAmountMinor: order.paid_amount_minor,
    ticketStatus: order.ticket_status,
    refundId: refund.id,
    paymentAttemptId: refund.payment_attempt_id,
    paymentProviderTransactionId: refund.payment_provider_transaction_id,
    operationKey: refund.operation_key,
    refundType: refund.refund_type,
    amountMinor: refund.amount_minor,
    currency: refund.currency,
    refundStatus: refund.status,
    attemptCount: refund.attempt_count,
    uncertainSinceAt: refund.uncertain_since_at ?? null,
  };
}

async function refundTransition(name: string, args: Record<string, unknown>): Promise<WorkerRecord> {
  let result: { data: unknown; error: unknown };
  try {
    result = await database().rpc(name, args);
  } catch {
    throw new RetryableJobError("Refund state transition unavailable");
  }
  if (result.error || !result.data) throw new RetryableJobError("Refund state transition unavailable");
  return record(result.data);
}

async function markRefundProcessing(state: InitiateRefundState): Promise<RefundStartResult> {
  const result = await refundTransition("case_lab_3_begin_refund", {
    p_environment: state.environment,
    p_order_id: state.orderId,
    p_refund_id: state.refundId,
    p_operation_key: state.operationKey,
    p_amount_minor: state.amountMinor,
  });
  const kind = result.kind;
  if (kind === "claimed" || kind === "already_processing") return kind;
  if (kind === "terminal" && (result.status === "confirmed" || result.status === "failed")) return result.status;
  if (kind === "review_required") return kind;
  throw new RetryableJobError("Invalid refund state transition");
}

async function markRefundFailed(state: InitiateRefundState): Promise<void> {
  const result = await refundTransition("case_lab_3_fail_refund", {
    p_environment: state.environment,
    p_order_id: state.orderId,
    p_refund_id: state.refundId,
    p_operation_key: state.operationKey,
    p_amount_minor: state.amountMinor,
    p_error: "provider_refused_refund",
  });
  if (result.kind !== "failed" && result.kind !== "terminal" && result.kind !== "review_required") {
    throw new RetryableJobError("Invalid refund failure transition");
  }
}

async function markRefundUnknown(state: InitiateRefundState): Promise<void> {
  const result = await refundTransition("case_lab_3_mark_refund_unknown", {
    p_environment: state.environment,
    p_order_id: state.orderId,
    p_refund_id: state.refundId,
    p_operation_key: state.operationKey,
    p_error: "provider_result_unknown",
  });
  if (result.kind !== "unknown" && result.kind !== "terminal" && result.kind !== "review_required") {
    throw new RetryableJobError("Invalid refund uncertainty transition");
  }
}

function refundStateResult(status: RefundStatus): Json {
  if (status === "confirmed") return { status: "confirmed", providerStatus: "confirmed", failureKind: "none" };
  if (status === "failed") return { status: "failed", providerStatus: "failed", failureKind: "permanent" };
  if (status === "processing") return { status: "processing", providerStatus: "already_processing", failureKind: "none" };
  return { status: "review_required", providerStatus: status, failureKind: "unknown" };
}

function refundStartResult(status: RefundStartResult): Json {
  if (status === "claimed") throw new RetryableJobError("Refund transition did not produce a result");
  if (status === "already_processing") return refundStateResult("processing");
  return refundStateResult(status);
}

function logRefundWorkerDiagnostic(
  context: WorkerHandlerContext,
  stage: "processing_transition_start" | "processing_transition_result" | "provider_request" | "provider_response" | "provider_result_unknown",
  details: Readonly<Record<string, boolean | number | string>> = {},
): void {
  try {
    console.info("Case Lab III refund worker", {
      environment: context.environment,
      stage,
      ...details,
    });
  } catch {
    // Diagnostics must never alter refund state handling.
  }
}

function refundProviderOptions(context: WorkerHandlerContext): TipTopApiOptions & { signal: AbortSignal } {
  return {
    signal: context.signal,
    timeoutMs: context.timeoutMs,
    now: context.now,
    getConfig: (environment) => ({ tiptop: getCaseLab3Config(environment).tiptop }),
  };
}

async function initiateRefund(job: ClaimedCaseLab3Job, context: WorkerHandlerContext, overrides: InitiateRefundHandlerOverrides): Promise<Json> {
  const state = refundState(await (overrides.loadState ?? loadInitiateRefundState)(job, context));
  const { operationKey, amountMinor } = validateRefundJob(job, context, state);

  if (state.refundStatus !== "requested") return refundStateResult(state.refundStatus);

  const markProcessing = overrides.markProcessing ?? markRefundProcessing;
  logRefundWorkerDiagnostic(context, "processing_transition_start");
  const start = await markProcessing(state, job, context);
  logRefundWorkerDiagnostic(context, "processing_transition_result", { outcome: start });
  if (start !== "claimed") {
    return refundStartResult(start);
  }
  const paymentTransactionId = state.paymentProviderTransactionId;
  if (!paymentTransactionId) throw new PermanentJobError("Refund payment transaction is missing");
  const provider = overrides.refundPayment ?? refundPayment;
  let response: TipTopApiResponse;
  try {
    logRefundWorkerDiagnostic(context, "provider_request");
    response = await provider(context.environment, {
      paymentTransactionId,
      amountMinor,
      operationKey,
      invoiceId: state.orderNumber,
    }, refundProviderOptions(context));
  } catch {
    logRefundWorkerDiagnostic(context, "provider_result_unknown");
    await (overrides.markUnknown ?? markRefundUnknown)(state, job, context);
    throw new UnknownJobError("TipTop refund result is unknown", context.now());
  }

  logRefundWorkerDiagnostic(context, "provider_response", {
    httpStatus: response.status,
    success: response.success,
    modelPresent: response.model !== null,
    modelTransactionIdPresent: hasValidModelTransactionId(response.model),
  });
  if (response.success) {
    if (hasValidModelTransactionId(response.model)) {
      return { status: "processing", providerStatus: "accepted", failureKind: "none" };
    }
    logRefundWorkerDiagnostic(context, "provider_result_unknown", { reason: "missing_refund_transaction_id" });
    await (overrides.markUnknown ?? markRefundUnknown)(state, job, context);
    throw new UnknownJobError("TipTop refund result is unknown", context.now());
  }

  await (overrides.markFailed ?? markRefundFailed)(state, job, context);
  return { status: "failed", providerStatus: `http_${response.status}`, failureKind: "permanent" };
}

type RefundReconciliationState = {
  environment: PaymentEnvironment;
  orderId: string;
  orderNumber: string;
  refundId: string;
  paymentProviderTransactionId: string | null;
  operationKey: string;
  amountMinor: number;
  currency: "KZT";
  refundStatus: RefundStatus;
};

async function loadRefundReconciliationState(job: ClaimedCaseLab3Job, context: WorkerHandlerContext): Promise<RefundReconciliationState> {
  if (!job.orderId || !job.refundId) throw new PermanentJobError("Refund reconciliation identifiers are missing");
  const payload = record(job.payloadReference);
  const payloadRefundId = uuid(payload.refundId, "refund id");
  if (payloadRefundId !== job.refundId) throw new PermanentJobError("Refund reconciliation payload does not match the job");

  const client = database();
  const order = await selectOne(client, "case_lab_3_orders", "id, order_number, environment", [
    ["id", job.orderId],
    ["environment", context.environment],
  ]);
  const refund = await selectOne(client, "case_lab_3_refunds", "id, order_id, environment, operation_key, payment_provider_transaction_id, amount_minor, currency, status", [
    ["id", job.refundId],
    ["order_id", job.orderId],
    ["environment", context.environment],
  ]);
  if (order.environment !== context.environment || refund.environment !== context.environment) {
    throw new PermanentJobError("Refund reconciliation environment mismatch");
  }
  const orderId = uuid(order.id, "order id");
  const refundId = uuid(refund.id, "refund id");

  const amountMinor = refund.amount_minor;
  if (typeof amountMinor !== "number" || !Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
    throw new PermanentJobError("Refund reconciliation amount is invalid");
  }
  if (refund.currency !== "KZT") throw new PermanentJobError("Refund reconciliation currency is invalid");
  const refundStatus = refund.status;
  if (refundStatus !== "unknown" && refundStatus !== "review_required" && refundStatus !== "confirmed" && refundStatus !== "failed") {
    throw new PermanentJobError("Refund reconciliation status is invalid");
  }

  return {
    environment: context.environment,
    orderId,
    orderNumber: text(order.order_number, "order number"),
    refundId,
    paymentProviderTransactionId: typeof refund.payment_provider_transaction_id === "string" ? refund.payment_provider_transaction_id : null,
    operationKey: text(refund.operation_key, "refund operation key", 200),
    amountMinor,
    currency: "KZT",
    refundStatus,
  };
}

function reconciliationBody(state: RefundReconciliationState, refundTransactionId: string): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({
    type: "refund_reconciliation",
    refundId: state.refundId,
    paymentTransactionId: state.paymentProviderTransactionId,
    refundTransactionId,
    amountMinor: state.amountMinor,
  }));
}

async function reconcilePayment(
  job: ClaimedCaseLab3Job,
  context: WorkerHandlerContext,
  overrides: ReconcilePaymentHandlerOverrides = {},
): Promise<Json> {
  const jobPayload = record(job.payloadReference);
  if (!job.refundId || jobPayload.refundId === undefined) {
    throw new PermanentJobError("Payment reconciliation requires a dedicated payment handler");
  }
  const state = await (overrides.loadState ?? loadRefundReconciliationState)(job, context);
  const reconciliationState = state as RefundReconciliationState;
  if (reconciliationState.refundStatus === "confirmed") return refundStateResult("confirmed");
  if (reconciliationState.refundStatus === "failed") return refundStateResult("failed");
  if (!reconciliationState.paymentProviderTransactionId) throw new PermanentJobError("Refund reconciliation payment transaction is missing");

  const input: RefundPaymentInput = {
    paymentTransactionId: reconciliationState.paymentProviderTransactionId,
    amountMinor: reconciliationState.amountMinor,
    operationKey: reconciliationState.operationKey,
    invoiceId: reconciliationState.orderNumber,
  };
  let result: TipTopRefundReconciliation;
  try {
    result = await (overrides.reconcileRefund ?? reconcileRefund)(context.environment, input, refundProviderOptions(context));
  } catch {
    throw new RetryableJobError("Refund reconciliation lookup unavailable");
  }
  if (result.kind === "not_found") return { status: "review_required", providerStatus: "not_found", failureKind: "unknown" };
  if (result.kind !== "confirmed") throw new UnknownJobError("Refund reconciliation is inconclusive", context.now());

  const refundTransactionId = getValidModelTransactionId(result.model);
  if (!refundTransactionId) throw new UnknownJobError("Refund reconciliation transaction is invalid", context.now());
  const payload: TipTopRefund = {
    transactionId: refundTransactionId,
    paymentTransactionId: reconciliationState.paymentProviderTransactionId,
    amountMinor: reconciliationState.amountMinor,
    currency: reconciliationState.currency,
    invoiceId: reconciliationState.orderNumber,
    operationKey: reconciliationState.operationKey,
    status: "Completed",
    operationType: "Refund",
  };
  let transition: TipTopTransitionResult;
  try {
    transition = await (overrides.applyRefund ?? applyRefund)(context.environment, payload, {
      environment: context.environment,
      bodyHash: hashTipTopBody(reconciliationBody(reconciliationState, refundTransactionId)),
      providerEventId: `Reconciliation:Refund:${refundTransactionId}`,
    });
  } catch {
    throw new RetryableJobError("Refund reconciliation transition unavailable");
  }
  if (transition.kind === "accepted" && transition.result === "confirmed") {
    return { status: "confirmed", providerStatus: "reconciled", failureKind: "none" };
  }
  if (transition.kind === "accepted" && transition.duplicate === true) {
    let currentState: RefundReconciliationState;
    try {
      currentState = (await (overrides.loadState ?? loadRefundReconciliationState)(job, context)) as RefundReconciliationState;
    } catch {
      throw new RetryableJobError("Refund reconciliation state unavailable");
    }
    if (currentState.refundStatus === "confirmed") {
      return { status: "confirmed", providerStatus: "reconciled", failureKind: "none" };
    }
  }
  return { status: "review_required", providerStatus: "reconciliation_mismatch", failureKind: "unknown" };
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

function analyticsEventState(value: unknown): AnalyticsEventState {
  const source = record(value);
  return {
    id: uuid(source.id, "analytics event id"),
    environment: oneOf(source.environment, "analytics environment", ["test", "live"] as const),
    eventKey: text(source.eventKey ?? source.event_key, "analytics event key", 200),
    eventName: oneOf(source.eventName ?? source.event_name, "analytics event name", ["purchase", "refund"] as const),
    orderId: uuid(source.orderId ?? source.order_id, "analytics order id"),
    refundId: optionalUuid(source.refundId ?? source.refund_id, "analytics refund id"),
    gaClientId: source.gaClientId === null || source.gaClientId === undefined
      ? source.ga_client_id === null || source.ga_client_id === undefined
        ? null
        : text(source.ga_client_id, "GA client id", 256)
      : text(source.gaClientId, "GA client id", 256),
    payloadSnapshot: jsonObject(source.payloadSnapshot ?? source.payload_snapshot),
    deliveryStatus: oneOf(source.deliveryStatus ?? source.delivery_status, "analytics delivery status", [
      "pending",
      "sent",
      "failed",
      "unknown",
    ] as const),
  };
}

async function loadAnalyticsEvent(environment: PaymentEnvironment, eventKey: string): Promise<AnalyticsEventState> {
  const event = await selectOne(database(), "case_lab_3_analytics_events", "*", [
    ["environment", environment],
    ["event_key", eventKey],
  ]);
  return analyticsEventState(event);
}

async function updateAnalyticsEvent(
  environment: PaymentEnvironment,
  eventKey: string,
  values: Record<string, unknown>,
): Promise<void> {
  await update(database(), "case_lab_3_analytics_events", values, [
    ["environment", environment],
    ["event_key", eventKey],
  ]);
}

function analyticsParams(event: AnalyticsEventState): Record<string, string | number> {
  const transactionId = text(event.payloadSnapshot.transactionId, "analytics transaction id", 128);
  const valueMinor = event.payloadSnapshot.valueMinor;
  if (typeof valueMinor !== "number" || !Number.isSafeInteger(valueMinor) || valueMinor <= 0) {
    throw new PermanentJobError("Invalid analytics value");
  }
  const params: Record<string, string | number> = {
    transaction_id: transactionId,
    value: valueMinor / 100,
    currency: oneOf(event.payloadSnapshot.currency, "analytics currency", ["KZT"] as const),
  };
  if (event.eventName === "refund") {
    params.refund_operation_id = text(event.payloadSnapshot.refundOperationId, "refund operation id", 128);
  }
  return params;
}

function analyticsClientId(event: AnalyticsEventState): string {
  return event.gaClientId ?? createHash("sha256")
    .update(`case-lab-3-ga4\0${event.orderId}`, "utf8")
    .digest("hex");
}

async function sendGa4Event(
  event: AnalyticsEventState,
  config: NonNullable<AnalyticsConfig["ga4"]>,
  signal: AbortSignal,
): Promise<void> {
  const endpoint = new URL("https://www.google-analytics.com/mp/collect");
  endpoint.searchParams.set("measurement_id", config.measurementId);
  endpoint.searchParams.set("api_secret", config.apiSecret);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        client_id: analyticsClientId(event),
        events: [{ name: event.eventName, params: analyticsParams(event) }],
      }),
      signal,
    });
  } catch {
    throw new RetryableJobError("GA4 analytics request failed");
  }
  if (response.status === 408 || response.status === 429 || response.status >= 500) {
    throw new RetryableJobError("GA4 analytics request failed");
  }
  if (!response.ok) throw new PermanentJobError("GA4 analytics request was rejected");
}

async function sendAnalyticsEvent(
  job: ClaimedCaseLab3Job,
  context: WorkerHandlerContext,
  overrides: AnalyticsHandlerOverrides = {},
): Promise<Json> {
  const payload = record(job.payloadReference);
  const eventKey = text(payload.eventKey, "analytics event key", 200);
  const eventName = oneOf(payload.eventName, "analytics event name", ["purchase", "refund"] as const);
  const event = await (overrides.loadEvent ?? loadAnalyticsEvent)(context.environment, eventKey);
  if (
    event.environment !== context.environment
    || event.eventKey !== eventKey
    || event.eventName !== eventName
    || event.orderId !== job.orderId
    || event.refundId !== (job.refundId ?? null)
  ) {
    throw new PermanentJobError("Analytics event does not match its job");
  }
  if (event.deliveryStatus === "sent") return { status: "sent", duplicate: true };

  const config = (overrides.getConfig ?? ((environment) => getCaseLab3Config(environment)))(context.environment);
  const updateEvent = overrides.updateEvent ?? updateAnalyticsEvent;
  if (config.ga4 === null) {
    await updateEvent(context.environment, eventKey, {
      delivery_status: "failed",
      next_attempt_at: null,
      last_error: "GA4 is not configured",
      sent_at: null,
    });
    return { status: "skipped", reason: "ga4_not_configured" };
  }

  try {
    await (overrides.sendEvent ?? sendGa4Event)(event, config.ga4, context.signal);
    await updateEvent(context.environment, eventKey, {
      delivery_status: "sent",
      next_attempt_at: null,
      last_error: null,
      sent_at: iso(context.now()),
    });
    return { status: "sent" };
  } catch (error) {
    await updateEvent(context.environment, eventKey, {
      delivery_status: "failed",
      next_attempt_at: null,
      last_error: "GA4 delivery failed",
      sent_at: null,
    });
    if (error instanceof PermanentJobError) return { status: "failed", reason: "invalid_or_rejected_event" };
    throw error;
  }
}

function defaultHandlers(): ProductionJobHandlers {
  return {
    issue_fiscal_operation: queueFiscalOperation,
    poll_receipt: pollReceipt,
    send_ticket_email: sendTicket,
    send_refund_notification: sendRefund,
    initiate_refund: createInitiateRefundHandler(),
    reconcile_payment: createReconcilePaymentHandler(),
    send_analytics_event: createSendAnalyticsEventHandler(),
    send_organizer_alert: sendAlert,
  };
}

export function createInitiateRefundHandler(overrides: InitiateRefundHandlerOverrides = {}): WorkerHandler {
  return (job, context) => initiateRefund(job, context, overrides);
}

export function createReconcilePaymentHandler(overrides: ReconcilePaymentHandlerOverrides = {}): WorkerHandler {
  return (job, context) => reconcilePayment(job, context, overrides);
}

export function createSendAnalyticsEventHandler(overrides: AnalyticsHandlerOverrides = {}): WorkerHandler {
  return (job, context) => sendAnalyticsEvent(job, context, overrides);
}

export function createProductionCaseLab3JobHandlers(overrides: ProductionHandlerOverrides = {}): ProductionJobHandlers {
  const handlers = defaultHandlers();
  if (overrides.issueFiscalOperation) handlers.issue_fiscal_operation = overrides.issueFiscalOperation;
  if (overrides.pollReceipt) handlers.poll_receipt = overrides.pollReceipt;
  if (overrides.sendTicketEmail) handlers.send_ticket_email = overrides.sendTicketEmail;
  if (overrides.sendRefundNotification) handlers.send_refund_notification = overrides.sendRefundNotification;
  if (overrides.initiateRefund) handlers.initiate_refund = overrides.initiateRefund;
  if (overrides.reconcilePayment) handlers.reconcile_payment = overrides.reconcilePayment;
  if (overrides.sendAnalyticsEvent) handlers.send_analytics_event = overrides.sendAnalyticsEvent;
  if (overrides.sendOrganizerAlert) handlers.send_organizer_alert = overrides.sendOrganizerAlert;
  return handlers;
}
