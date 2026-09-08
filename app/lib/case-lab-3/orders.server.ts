import "server-only";

import { derivePurposeToken, verifyPurposeToken } from "./tokens.server";
import { getCaseLab3Config } from "./config.server";
import { getCaseLab3AdminClient, type CaseLab3RateLimitRpcData } from "./supabase-admin.server";
import { buildWidgetParams, type WidgetAttempt } from "./tiptoppay-widget.server";
import { RequestGuardError } from "./http.server";
import { OrderInputValidationError } from "./validation";
import type {
  AvailabilityResponse,
  CreateOrderResult,
  OrderInput,
  OrderStatusResponse,
  PaymentAttemptResponse,
  PaymentEnvironment,
  TipTopWidgetParams,
} from "./contracts";
import type { CreatePaymentAttemptRpcResult } from "./database.types";
import type { OrderSession, TicketSession } from "../crm-auth.server";

export type { OrderSession, TicketSession } from "../crm-auth.server";

export const ORDER_SESSION_COOKIE = "cl3_order_session";
export const TICKET_SESSION_COOKIE = "cl3_ticket_session";

export const PUBLIC_AVAILABILITY_RATE_LIMIT = {
  scope: "case-lab-3-availability",
  limitCount: 60,
  bucketSeconds: 60,
} as const;

export const PUBLIC_ORDER_CREATE_RATE_LIMIT = {
  scope: "case-lab-3-order-create",
  limitCount: 5,
  bucketSeconds: 60,
} as const;

export type PublicCookieOptions = {
  httpOnly: true;
  secure: true;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

export type PublicCookieStore = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: PublicCookieOptions): void;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/u;
const PAYMENT_STATUS_VALUES = new Set<OrderStatusResponse["paymentStatus"]>([
  "pending",
  "processing",
  "paid",
  "failed",
  "refund_pending",
  "partially_refunded",
  "refunded",
  "review_required",
]);
const TICKET_STATUS_VALUES = new Set<OrderStatusResponse["ticketStatus"]>([
  "pending",
  "valid",
  "used",
  "cancelled",
]);
const RECEIPT_STATUS_VALUES = new Set<OrderStatusResponse["receiptStatus"]>([
  "not_requested",
  "queued",
  "issued",
  "error",
  "unknown",
]);
const EMAIL_STATUS_VALUES = new Set<OrderStatusResponse["emailStatus"]>([
  "pending",
  "sent",
  "failed",
  "unknown",
]);

export type OrderRequestContext = {
  environment: PaymentEnvironment;
  idempotencyKey: string;
  hashedClientIp: string;
};

export class OrderAuthorizationError extends Error {
  constructor() {
    super("Order authorization failed");
    this.name = "OrderAuthorizationError";
  }
}

export class OrderServiceError extends Error {
  constructor() {
    super("Order service unavailable");
    this.name = "OrderServiceError";
  }
}

export class RateLimitUnavailableError extends Error {
  constructor() {
    super("Rate limiter unavailable");
    this.name = "RateLimitUnavailableError";
  }
}

export class RateLimitExceededError extends Error {
  constructor() {
    super("Rate limit exceeded");
    this.name = "RateLimitExceededError";
  }
}

export class OfferChangedError extends Error {
  readonly availability: AvailabilityResponse;

  constructor(availability: AvailabilityResponse) {
    super("The ticket offer changed");
    this.name = "OfferChangedError";
    this.availability = availability;
  }
}

type SessionOrder = {
  id: string;
  environment: PaymentEnvironment;
  order_access_token_version: number;
  order_access_revoked_at: string | null;
};

type TicketRevisionSession = {
  revision_number: number;
  token_version: number;
};

export type ParsedTicketSession = TicketSession & { tokenVersion: number };

export type PaymentIncomeReceiptCandidate = {
  id: string;
  policyPurpose: string;
  providerReceiptType: string;
  status: string;
  receiptUrl: string | null;
  createdAt: string;
};

type PaymentAttemptRpcResult = CreatePaymentAttemptRpcResult;

function tokenSecret(): string {
  const value = process.env.CASE_LAB_3_TOKEN_SECRET?.trim();
  if (!value || value.length < 32) {
    throw new OrderServiceError();
  }
  return value;
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isToken(value: string): boolean {
  return TOKEN_PATTERN.test(value);
}

function isEnvironment(value: unknown): value is PaymentEnvironment {
  return value === "test" || value === "live";
}

function isSafePublicString(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !/[\u0000-\u001f\u007f]/u.test(value)
  );
}

function isTimestamp(value: unknown): value is string {
  return isSafePublicString(value, 64) && ISO_TIMESTAMP_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function isMajorAmount(value: unknown): value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return false;
  const roundedMinor = Math.round(value * 100);
  return Number.isSafeInteger(roundedMinor) && value === roundedMinor / 100;
}

function isPaymentStatus(value: unknown): value is OrderStatusResponse["paymentStatus"] {
  return typeof value === "string" && PAYMENT_STATUS_VALUES.has(value as OrderStatusResponse["paymentStatus"]);
}

function isTicketStatus(value: unknown): value is OrderStatusResponse["ticketStatus"] {
  return typeof value === "string" && TICKET_STATUS_VALUES.has(value as OrderStatusResponse["ticketStatus"]);
}

function isReceiptStatus(value: unknown): value is OrderStatusResponse["receiptStatus"] {
  return typeof value === "string" && RECEIPT_STATUS_VALUES.has(value as OrderStatusResponse["receiptStatus"]);
}

function isEmailStatus(value: unknown): value is OrderStatusResponse["emailStatus"] {
  return typeof value === "string" && EMAIL_STATUS_VALUES.has(value as OrderStatusResponse["emailStatus"]);
}

function isReceiptUrl(value: unknown): value is string | null {
  return value === null || isSafePublicString(value, 2048);
}

function isRateLimitData(value: unknown): value is CaseLab3RateLimitRpcData {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<CaseLab3RateLimitRpcData>;
  return (
    typeof result.allowed === "boolean" &&
    typeof result.remaining === "number" &&
    Number.isSafeInteger(result.remaining) &&
    result.remaining >= 0 &&
    typeof result.reset_at === "string" &&
    result.reset_at.length > 0
  );
}

function configuredEnvironment(): PaymentEnvironment {
  const value = process.env.CASE_LAB_3_PAYMENT_MODE?.trim();
  if (!isEnvironment(value)) {
    throw new OrderServiceError();
  }
  return value;
}

function isAvailability(value: unknown): value is AvailabilityResponse {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<AvailabilityResponse>;
  const amountMinor = result.amountMinor;
  const salesLimit = result.salesLimit;
  return (
    typeof result.available === "boolean" &&
    (result.reason === "available" ||
      result.reason === "early_bird_temporarily_reserved" ||
      result.reason === "sold_out" ||
      result.reason === "sales_closed" ||
      result.reason === "configuration_incomplete") &&
    (result.tier === null || result.tier === "early_bird" || result.tier === "standard") &&
    (amountMinor === null || (typeof amountMinor === "number" && Number.isSafeInteger(amountMinor) && amountMinor >= 0)) &&
    result.currency === "KZT" &&
    typeof salesLimit === "number" &&
    Number.isSafeInteger(salesLimit) &&
    salesLimit >= 0
  );
}

function sanitizedAvailability(value: unknown): AvailabilityResponse | null {
  if (!isAvailability(value)) return null;
  return {
    available: value.available,
    reason: value.reason,
    tier: value.tier,
    amountMinor: value.amountMinor,
    currency: value.currency,
    salesLimit: value.salesLimit,
  };
}

export function sanitizeAvailabilityResponse(value: unknown): AvailabilityResponse {
  const result = sanitizedAvailability(value);
  if (!result) throw new OrderServiceError();
  return result;
}

function isCreateOrderResult(value: unknown): value is CreateOrderResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Partial<CreateOrderResult>;
  if (result.kind === "offer_changed" || result.kind === "unavailable") {
    return isAvailability(result.availability);
  }
  const created = result as Partial<Extract<CreateOrderResult, { kind: "created" }>>;
  const amountMinor = created.amountMinor;
  return (
    result.kind === "created" &&
    isUuid(result.orderId) &&
    isSafePublicString(result.orderNumber, 100) &&
    (result.tier === "early_bird" || result.tier === "standard") &&
    typeof amountMinor === "number" &&
    Number.isSafeInteger(amountMinor) &&
    amountMinor >= 0 &&
    isTimestamp(result.reservationExpiresAt)
  );
}

export function sanitizeCreateOrderResult(value: unknown): CreateOrderResult {
  if (!isCreateOrderResult(value)) throw new OrderServiceError();
  if (value.kind === "offer_changed" || value.kind === "unavailable") {
    return { kind: value.kind, availability: sanitizeAvailabilityResponse(value.availability) };
  }
  return {
    kind: "created",
    orderId: value.orderId,
    orderNumber: value.orderNumber,
    tier: value.tier,
    amountMinor: value.amountMinor,
    reservationExpiresAt: value.reservationExpiresAt,
  };
}

function isPaymentAttemptRpcResult(value: unknown): value is PaymentAttemptRpcResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  if (result.kind === "offer_changed") return isAvailability(result.availability);
  if ("kind" in result) return false;
  return (
    typeof result.attempt_id === "string" &&
    isUuid(result.attempt_id) &&
    isSafePublicString(result.external_id, 256) &&
    isTimestamp(result.reservation_expires_at)
  );
}

function sanitizedWidgetParams(value: unknown): TipTopWidgetParams | null {
  if (!value || typeof value !== "object") return null;
  const widget = value as Record<string, unknown>;
  if (
    !isSafePublicString(widget.publicTerminalId, 256) ||
    !isMajorAmount(widget.amount) ||
    widget.currency !== "KZT" ||
    widget.paymentSchema !== "Single" ||
    !isSafePublicString(widget.externalId, 256) ||
    !isSafePublicString(widget.receiptEmail, 320) ||
    widget.emailBehavior !== "Hidden" ||
    widget.tokenize !== false ||
    widget.retryPayment !== false
  ) {
    return null;
  }

  if (!widget.userInfo || typeof widget.userInfo !== "object") return null;
  const userInfo = widget.userInfo as Record<string, unknown>;
  if (
    !isSafePublicString(userInfo.accountId, 256) ||
    !isSafePublicString(userInfo.firstName, 200) ||
    !isSafePublicString(userInfo.lastName, 200) ||
    !isSafePublicString(userInfo.email, 320)
  ) {
    return null;
  }

  const sanitizedUserInfo: TipTopWidgetParams["userInfo"] = {
    accountId: userInfo.accountId,
    firstName: userInfo.firstName,
    lastName: userInfo.lastName,
    email: userInfo.email,
  };
  if (userInfo.phone !== undefined) {
    if (!isSafePublicString(userInfo.phone, 32)) return null;
    sanitizedUserInfo.phone = userInfo.phone;
  }

  return {
    publicTerminalId: widget.publicTerminalId,
    amount: widget.amount,
    currency: "KZT",
    paymentSchema: "Single",
    externalId: widget.externalId,
    receiptEmail: widget.receiptEmail,
    emailBehavior: "Hidden",
    tokenize: false,
    retryPayment: false,
    userInfo: sanitizedUserInfo,
  };
}

export function sanitizePaymentAttemptResponse(value: unknown): PaymentAttemptResponse {
  if (!value || typeof value !== "object") throw new OrderServiceError();
  const result = value as Record<string, unknown>;
  const widget = sanitizedWidgetParams(result.widget);
  if (
    !isUuid(result.attemptId) ||
    !isSafePublicString(result.externalId, 256) ||
    !isTimestamp(result.reservationExpiresAt) ||
    !widget ||
    widget.externalId !== result.externalId
  ) {
    throw new OrderServiceError();
  }

  return {
    attemptId: result.attemptId,
    externalId: result.externalId,
    reservationExpiresAt: result.reservationExpiresAt,
    widget,
  };
}

export function sanitizeOrderStatusResponse(value: unknown): OrderStatusResponse {
  if (!value || typeof value !== "object") throw new OrderServiceError();
  const result = value as Record<string, unknown>;
  if (
    !isSafePublicString(result.orderNumber, 100) ||
    !isPaymentStatus(result.paymentStatus) ||
    !isTicketStatus(result.ticketStatus) ||
    !isReceiptStatus(result.receiptStatus) ||
    !isEmailStatus(result.emailStatus) ||
    !isReceiptUrl(result.receiptUrl)
  ) {
    throw new OrderServiceError();
  }

  return {
    orderNumber: result.orderNumber,
    paymentStatus: result.paymentStatus,
    ticketStatus: result.ticketStatus,
    receiptStatus: result.receiptStatus,
    emailStatus: result.emailStatus,
    receiptUrl: result.receiptUrl,
  };
}

function assertUuid(value: string): void {
  if (!isUuid(value)) throw new OrderServiceError();
}

export function assertOrderSession(session: OrderSession, order: SessionOrder, secret = tokenSecret()): void {
  if (
    session.purpose !== "order-session" ||
    session.orderId !== order.id ||
    order.environment !== configuredEnvironment() ||
    !Number.isSafeInteger(session.version) ||
    session.version !== order.order_access_token_version ||
    order.order_access_revoked_at !== null ||
    !isToken(session.token) ||
    !verifyPurposeToken(session.token, secret, "order-session", order.id, order.order_access_token_version)
  ) {
    throw new OrderAuthorizationError();
  }
}

type TicketAccessRecord = {
  id: string;
  status: "valid" | "used" | "cancelled";
  revisionNumber: number;
  tokenVersion: number;
};

export function authorizeTicketAccessToken(
  token: string,
  ticket: TicketAccessRecord,
  secret = tokenSecret(),
): TicketSession | null {
  if (
    ticket.status === "cancelled" ||
    !isToken(token) ||
    !Number.isSafeInteger(ticket.revisionNumber) ||
    ticket.revisionNumber < 1 ||
    !Number.isSafeInteger(ticket.tokenVersion) ||
    ticket.tokenVersion < 1 ||
    !verifyPurposeToken(token, secret, "ticket-session", ticket.id, ticket.tokenVersion)
  ) {
    return null;
  }
  return {
    purpose: "ticket-session",
    ticketId: ticket.id,
    revisionNumber: ticket.revisionNumber,
    token,
  };
}

function serializeSession(version: number, token: string): string {
  return `${version}.${token}`;
}

export function issueOrderSession(orderId: string, version = 1): OrderSession {
  assertUuid(orderId);
  const token = derivePurposeToken(tokenSecret(), "order-session", orderId, version);
  return { purpose: "order-session", orderId, version, token };
}

export function issueTicketSession(ticketId: string, revisionNumber: number, tokenVersion: number): TicketSession {
  assertUuid(ticketId);
  if (!Number.isSafeInteger(revisionNumber) || revisionNumber < 1) throw new OrderServiceError();
  const token = derivePurposeToken(tokenSecret(), "ticket-session", ticketId, tokenVersion);
  return { purpose: "ticket-session", ticketId, revisionNumber, token };
}

export function serializeOrderSession(session: OrderSession): string {
  return serializeSession(session.version, session.token);
}

export function serializeTicketSession(session: TicketSession, tokenVersion: number): string {
  if (
    session.purpose !== "ticket-session" ||
    !isToken(session.token) ||
    !Number.isSafeInteger(session.revisionNumber) ||
    session.revisionNumber < 1 ||
    !Number.isSafeInteger(tokenVersion) ||
    tokenVersion < 1
  ) {
    throw new OrderServiceError();
  }
  return `${session.revisionNumber}.${tokenVersion}.${session.token}`;
}

export function parseOrderSession(value: string | undefined): OrderSession | null {
  const parts = value?.split(".") ?? [];
  if (parts.length !== 2) return null;
  const [versionText, token] = parts;
  const version = Number(versionText);
  if (!Number.isSafeInteger(version) || version < 1 || !token || !isToken(token)) return null;
  return { purpose: "order-session", orderId: "", version, token };
}

export function parseTicketSession(value: string | undefined): ParsedTicketSession | null {
  const parts = value?.split(".") ?? [];
  if (parts.length !== 3) return null;
  const [revisionText, tokenVersionText, token] = parts;
  const revisionNumber = Number(revisionText);
  const tokenVersion = Number(tokenVersionText);
  if (
    !Number.isSafeInteger(revisionNumber) ||
    revisionNumber < 1 ||
    !Number.isSafeInteger(tokenVersion) ||
    tokenVersion < 1 ||
    !token ||
    !isToken(token)
  ) return null;
  return { purpose: "ticket-session", ticketId: "", revisionNumber, tokenVersion, token };
}

export async function consumeRateLimit(
  scope: string,
  purposeIpHash: string,
  limitCount: number,
  bucketSeconds: number,
): Promise<void> {
  if (
    !/^[a-z][a-z0-9_-]{0,63}$/u.test(scope) ||
    !/^[0-9a-f]{64}$/u.test(purposeIpHash) ||
    !Number.isSafeInteger(limitCount) ||
    limitCount < 1 ||
    limitCount > 100 ||
    !Number.isSafeInteger(bucketSeconds) ||
    bucketSeconds < 1 ||
    bucketSeconds > 86400
  ) {
    throw new RateLimitUnavailableError();
  }

  let data: CaseLab3RateLimitRpcData | null = null;
  let error: unknown = null;
  try {
    const result = await getCaseLab3AdminClient().rpc("case_lab_3_consume_rate_limit", {
      p_scope: scope,
      p_purpose_ip_hash: purposeIpHash,
      p_limit_count: limitCount,
      p_bucket_seconds: bucketSeconds,
    });
    data = result.data;
    error = result.error;
  } catch {
    throw new RateLimitUnavailableError();
  }

  if (error || !isRateLimitData(data)) throw new RateLimitUnavailableError();
  if (!data.allowed) throw new RateLimitExceededError();
}

export function selectOriginalPaymentIncomeReceipt(
  receipts: readonly PaymentIncomeReceiptCandidate[],
): PaymentIncomeReceiptCandidate | null {
  return receipts
    .filter((receipt) =>
      receipt.policyPurpose === "payment_income" &&
      receipt.providerReceiptType === "Income" &&
      receipt.status === "issued",
    )
    .toSorted((left, right) => {
      const createdAtOrder = left.createdAt.localeCompare(right.createdAt);
      return createdAtOrder === 0 ? left.id.localeCompare(right.id) : createdAtOrder;
    })[0] ?? null;
}

export async function getAvailability(environment: PaymentEnvironment): Promise<AvailabilityResponse> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_get_availability", {
    p_environment: environment,
  });
  if (error) throw new OrderServiceError();
  return sanitizeAvailabilityResponse(data);
}

export async function createOrder(input: OrderInput, context: OrderRequestContext): Promise<CreateOrderResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_create_order", {
    p_environment: context.environment,
    p_input: input,
    p_idempotency_key: context.idempotencyKey,
    p_hashed_client_ip: context.hashedClientIp,
  });
  if (error) throw new OrderServiceError();
  return sanitizeCreateOrderResult(data);
}

async function loadOrderSession(orderId: string): Promise<SessionOrder> {
  assertUuid(orderId);
  const environment = configuredEnvironment();
  const { data, error } = await getCaseLab3AdminClient()
    .from("case_lab_3_orders")
    .select("id, environment, order_access_token_version, order_access_revoked_at")
    .eq("id", orderId)
    .eq("environment", environment)
    .maybeSingle();
  if (error || !data || !isEnvironment(data.environment)) throw new OrderAuthorizationError();
  return data;
}

async function loadOrderForAttempt(orderId: string, session: OrderSession) {
  const environment = configuredEnvironment();
  const { data, error } = await getCaseLab3AdminClient()
    .from("case_lab_3_orders")
    .select("id, environment, amount_minor, participant_email, first_name, last_name, phone, order_access_token_version, order_access_revoked_at")
    .eq("id", orderId)
    .eq("environment", environment)
    .maybeSingle();
  if (error || !data || !isEnvironment(data.environment)) throw new OrderAuthorizationError();
  assertOrderSession(session, data);
  return data;
}

export async function createPaymentAttempt(orderId: string, session: OrderSession): Promise<PaymentAttemptResponse> {
  const order = await loadOrderForAttempt(orderId, session);
  const config = getCaseLab3Config(order.environment);
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_create_payment_attempt", {
    p_order_id: order.id,
  });
  if (error || !isPaymentAttemptRpcResult(data)) {
    throw new OrderServiceError();
  }

  const rpcResult = data;
  if ("kind" in rpcResult) {
    throw new OfferChangedError(rpcResult.availability);
  }

  const attempt: WidgetAttempt = {
    amountMinor: order.amount_minor,
    externalId: rpcResult.external_id,
    receiptEmail: order.participant_email,
    orderOpaqueId: order.id,
    firstName: order.first_name,
    lastName: order.last_name,
    phone: order.phone,
  };

  return sanitizePaymentAttemptResponse({
    attemptId: rpcResult.attempt_id,
    externalId: rpcResult.external_id,
    reservationExpiresAt: rpcResult.reservation_expires_at,
    widget: buildWidgetParams(attempt, config.widget.terminalId),
  });
}

export async function getOrderStatus(orderId: string, session: OrderSession): Promise<OrderStatusResponse> {
  const environment = configuredEnvironment();
  const { data: order, error } = await getCaseLab3AdminClient()
    .from("case_lab_3_orders")
    .select("id, order_number, environment, payment_status, ticket_status, receipt_status, email_status, order_access_token_version, order_access_revoked_at")
    .eq("id", orderId)
    .eq("environment", environment)
    .maybeSingle();
  if (error || !order || !isEnvironment(order.environment)) throw new OrderAuthorizationError();
  assertOrderSession(session, order);

  const { data: receipts, error: receiptError } = await getCaseLab3AdminClient()
    .from("case_lab_3_fiscal_operations")
    .select("id, policy_purpose, provider_receipt_type, status, receipt_url, created_at")
    .eq("order_id", order.id)
    .eq("environment", environment)
    .eq("policy_purpose", "payment_income")
    .eq("provider_receipt_type", "Income")
    .eq("status", "issued")
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })
    .limit(10);
  if (receiptError) throw new OrderServiceError();
  const receipt = selectOriginalPaymentIncomeReceipt(
    (receipts ?? []).map((row) => ({
      id: row.id,
      policyPurpose: row.policy_purpose,
      providerReceiptType: row.provider_receipt_type,
      status: row.status,
      receiptUrl: row.receipt_url,
      createdAt: row.created_at,
    })),
  );

  return sanitizeOrderStatusResponse({
    orderNumber: order.order_number,
    paymentStatus: order.payment_status,
    ticketStatus: order.ticket_status,
    receiptStatus: order.receipt_status,
    emailStatus: order.email_status,
    receiptUrl: receipt?.receiptUrl ?? null,
  });
}

export async function exchangeOrderAccessToken(orderId: string, token: string): Promise<OrderSession | null> {
  if (!isToken(token)) return null;
  const order = await loadOrderSession(orderId).catch(() => null);
  if (!order || order.order_access_revoked_at !== null) return null;
  return verifyPurposeToken(token, tokenSecret(), "order-session", order.id, order.order_access_token_version)
    ? { purpose: "order-session", orderId: order.id, version: order.order_access_token_version, token }
    : null;
}

export async function exchangeTicketAccessToken(ticketNumber: string, token: string): Promise<{ session: TicketSession; tokenVersion: number } | null> {
  if (!ticketNumber || ticketNumber.length > 100 || ticketNumber.includes("/") || !isToken(token)) return null;
  const environment = configuredEnvironment();
  const client = getCaseLab3AdminClient();
  const { data: ticket, error: ticketError } = await client
    .from("case_lab_3_tickets")
    .select("id, public_ticket_number, current_revision_id, status")
    .eq("public_ticket_number", ticketNumber)
    .eq("environment", environment)
    .maybeSingle();
  if (ticketError || !ticket || ticket.status === "cancelled" || !ticket.current_revision_id) return null;

  const { data: revision, error: revisionError } = await client
    .from("case_lab_3_ticket_revisions")
    .select("revision_number, token_version")
    .eq("id", ticket.current_revision_id)
    .eq("ticket_id", ticket.id)
    .eq("environment", environment)
    .maybeSingle();
  if (revisionError || !revision) return null;

  const typedRevision = revision as TicketRevisionSession;
  const session = authorizeTicketAccessToken(token, {
    id: ticket.id,
    status: ticket.status,
    revisionNumber: typedRevision.revision_number,
    tokenVersion: typedRevision.token_version,
  });
  if (!session) return null;
  return {
    session,
    tokenVersion: typedRevision.token_version,
  };
}

export function getPublicPaymentEnvironment(): PaymentEnvironment {
  return configuredEnvironment();
}

export function getOrderRequestSecret(): string {
  return tokenSecret();
}

export function isOrderId(value: string): boolean {
  return isUuid(value);
}

export function isBearerToken(value: string | null): value is string {
  return value !== null && isToken(value);
}

export function getBearerToken(request: Request): string | null {
  const queryToken = new URL(request.url).searchParams.get("token");
  const authorization = request.headers.get("authorization");
  const headerToken = authorization?.match(/^Bearer ([A-Za-z0-9_-]{43})$/u)?.[1] ?? null;
  if (queryToken && headerToken && queryToken !== headerToken) return null;
  return queryToken ?? headerToken;
}

export function publicOrderError(error: unknown): { status: number; body: { error: string; availability?: AvailabilityResponse } } {
  if (error instanceof RequestGuardError) {
    const errorCode = error.status === 413 ? "request_too_large" : error.status === 415 ? "unsupported_content_type" : "invalid_request";
    return { status: error.status, body: { error: errorCode } };
  }
  if (error instanceof OrderInputValidationError) {
    return { status: 400, body: { error: "invalid_request" } };
  }
  if (error instanceof OrderAuthorizationError) {
    return { status: 401, body: { error: "unauthorized" } };
  }
  if (error instanceof RateLimitExceededError) {
    return { status: 429, body: { error: "rate_limited" } };
  }
  if (error instanceof RateLimitUnavailableError) {
    return { status: 503, body: { error: "service_unavailable" } };
  }
  if (error instanceof OfferChangedError) {
    const availability = sanitizedAvailability(error.availability);
    if (availability) return { status: 409, body: { error: "offer_changed", availability } };
    return { status: 503, body: { error: "service_unavailable" } };
  }
  return { status: 503, body: { error: "service_unavailable" } };
}
