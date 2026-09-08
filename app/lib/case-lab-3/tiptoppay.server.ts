import "server-only";

import { createHash } from "node:crypto";

import { getCaseLab3Config } from "./config.server";
import { readBoundedBody, requireForm } from "./http.server";
import { minorToMajor } from "./money";
import { verifyProviderHmac } from "./provider-hmac.server";
import { getCaseLab3AdminClient } from "./supabase-admin.server";
import type { PaymentEnvironment } from "./contracts";

export const TIPTOP_BODY_MAX_BYTES = 64 * 1024;
export const TIPTOP_API_TIMEOUT_MS = 10_000;
export const TIPTOP_API_BASE_URL = "https://api.tiptoppay.kz";
export const REFUND_IDEMPOTENCY_WINDOW_MS = 60 * 60 * 1000;

const IDENTIFIER_MAX_LENGTH = 256;
const TEXT_MAX_LENGTH = 2048;
const CHECK_CODES = [10, 11, 12, 13, 20] as const;
const LIST_STATUSES = new Set(["Authorized", "Completed", "Cancelled", "Declined"]);
const DOCUMENTED_FIELDS = new Set([
  "TransactionId",
  "PaymentTransactionId",
  "Amount",
  "Currency",
  "CurrencyCode",
  "DateTime",
  "CardId",
  "CardFirstSix",
  "CardLastFour",
  "CardType",
  "CardExpDate",
  "CardCategory",
  "TestMode",
  "Status",
  "StatusCode",
  "OperationType",
  "InvoiceId",
  "AccountId",
  "SubscriptionId",
  "TokenRecipient",
  "Token",
  "Name",
  "Email",
  "IpAddress",
  "IpCountry",
  "IpCity",
  "IpRegion",
  "IpDistrict",
  "Issuer",
  "IssuerBankCountry",
  "Description",
  "Data",
  "CustomFields",
  "CardHolderMessage",
  "PaymentAmount",
  "PaymentCurrency",
  "IpLatitude",
  "IpLongitude",
  "CardProduct",
  "PaymentMethod",
  "GatewayName",
  "AuthCode",
  "TotalFee",
  "FallBackScenarioDeclinedTransactionId",
  "Reason",
  "ReasonCode",
  "Rrn",
]);

export class TipTopPayloadError extends Error {
  readonly receivedFields: readonly string[];
  readonly rejectedField?: string;

  constructor(details: { receivedFields?: readonly string[]; rejectedField?: string } = {}) {
    super("Invalid TipTop webhook payload");
    this.name = "TipTopPayloadError";
    this.receivedFields = [...new Set(details.receivedFields ?? [])].slice(0, 64);
    this.rejectedField = details.rejectedField;
  }
}

export class TipTopApiError extends Error {
  constructor() {
    super("TipTop API request failed");
    this.name = "TipTopApiError";
  }
}

export class TipTopReconciliationRequiredError extends Error {
  constructor() {
    super("TipTop refund reconciliation required");
    this.name = "TipTopReconciliationRequiredError";
  }
}

export type TipTopFormFields = Readonly<Record<string, string>>;

type CommonTipTopFields = {
  transactionId: string;
  amountMinor: number;
  currency: "KZT";
  invoiceId: string;
  accountId?: string;
  testMode?: boolean;
  status?: string;
  operationType: string;
};

export type TipTopCheck = CommonTipTopFields & {
  status: string;
  name?: string;
};

export type TipTopPay = CommonTipTopFields & { status: string };

export type TipTopFail = CommonTipTopFields & {
  failureCode: string;
  failureReason: string;
  reasonCode: number;
};

export type TipTopRefund = {
  transactionId: string;
  paymentTransactionId: string;
  amountMinor: number;
  currency: "KZT";
  invoiceId?: string;
  operationKey?: string;
  accountId?: string;
  status: string;
  operationType: "Refund";
};

export type TipTopWebhookContext = {
  environment: PaymentEnvironment;
  bodyHash: string;
  providerEventId: string;
};

export type TipTopTransitionResult =
  | { kind: "accepted"; code?: 0; duplicate?: boolean; result?: string }
  | { kind: "rejected"; code: (typeof CHECK_CODES)[number]; result?: string }
  | { kind: "review_required"; result?: string };

function invalid(rejectedField?: string, receivedFields?: readonly string[]): never {
  throw new TipTopPayloadError({ rejectedField, receivedFields });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeFormComponent(value: string): string {
  if (/%(?![0-9a-f]{2})/iu.test(value)) invalid();
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    invalid();
  }
}

function boundedText(value: string, maxLength = TEXT_MAX_LENGTH): string {
  if (
    value.length === 0 ||
    value.length > maxLength ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    invalid();
  }
  return value;
}

function requiredField(fields: TipTopFormFields, name: string): string {
  const value = fields[name];
  if (value === undefined) invalid(name, Object.keys(fields));
  try {
    return boundedText(value, IDENTIFIER_MAX_LENGTH);
  } catch {
    invalid(name, Object.keys(fields));
  }
}

function identifier(fields: TipTopFormFields, name: string): string {
  const value = requiredField(fields, name);
  if (value.trim() !== value || /\s/u.test(value)) invalid(name, Object.keys(fields));
  return value;
}

function optionalText(fields: TipTopFormFields, name: string): string | undefined {
  const value = fields[name];
  return value === undefined ? undefined : boundedText(value);
}

function assertDocumentedFields(fields: TipTopFormFields): void {
  if (!isRecord(fields)) invalid();
  for (const [name, value] of Object.entries(fields)) {
    if (!DOCUMENTED_FIELDS.has(name) || typeof value !== "string") invalid(name, Object.keys(fields));
  }
}

function parseTransactionId(value: string, field = "TransactionId"): string {
  if (!/^\d+$/u.test(value)) invalid(field);
  const numberValue = Number(value);
  if (!Number.isSafeInteger(numberValue) || numberValue < 1) invalid(field);
  return value;
}

function parseAmount(value: string, field = "Amount"): number {
  if (!/^\d+(?:\.\d{1,2})?$/u.test(value)) invalid(field);
  const [whole, fraction = ""] = value.split(".");
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) invalid(field);
  return amountMinor;
}

function parseCurrency(fields: TipTopFormFields): "KZT" {
  if (requiredField(fields, "Currency") !== "KZT") invalid();
  return "KZT";
}

function parseTestMode(value: string): boolean {
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  invalid("TestMode");
}

function validateOptionalPaymentAmountAndCurrency(
  fields: TipTopFormFields,
  amountMinor: number,
  currency: "KZT",
): void {
  const paymentAmount = fields.PaymentAmount;
  const paymentCurrency = fields.PaymentCurrency;
  if (paymentAmount === undefined && paymentCurrency === undefined) return;
  if (paymentAmount === undefined || paymentCurrency === undefined) invalid();
  if (parseAmount(paymentAmount, "PaymentAmount") !== amountMinor || paymentCurrency !== currency) invalid("PaymentAmount");
}

function parseReasonCode(value: string): number {
  if (!/^\d+$/u.test(value)) invalid("ReasonCode");
  const reasonCode = Number(value);
  if (!Number.isSafeInteger(reasonCode) || reasonCode < 0) invalid("ReasonCode");
  return reasonCode;
}

function commonFields(fields: TipTopFormFields, requireStatus: boolean): CommonTipTopFields {
  const operationType = requiredField(fields, "OperationType");
  if (operationType !== "Payment") invalid("OperationType", Object.keys(fields));
  const transactionId = parseTransactionId(requiredField(fields, "TransactionId"));
  const amountMinor = parseAmount(requiredField(fields, "Amount"));
  const currency = parseCurrency(fields);
  validateOptionalPaymentAmountAndCurrency(fields, amountMinor, currency);
  const invoiceId = fields.InvoiceId === undefined
    ? transactionId
    : identifier(fields, "InvoiceId");
  const accountId = fields.AccountId === undefined ? undefined : identifier(fields, "AccountId");
  const status = fields.Status;
  if (requireStatus && status === undefined) invalid("Status", Object.keys(fields));
  return {
    transactionId,
    amountMinor,
    currency,
    invoiceId,
    ...(accountId === undefined ? {} : { accountId }),
    ...(fields.TestMode === undefined ? {} : { testMode: parseTestMode(fields.TestMode) }),
    ...(status === undefined ? {} : { status: boundedText(status, IDENTIFIER_MAX_LENGTH) }),
    operationType,
  };
}

function mapFailureCode(reason: string, reasonCode: number): string {
  const normalized = reason.toLowerCase();
  if (normalized.includes("timeout")) return "timeout";
  if (reasonCode === 5091) return "timeout";
  if (reasonCode === 5092 || reasonCode === 5096 || normalized.includes("network") || normalized.includes("system")) return "indeterminate";
  if (normalized.includes("indeterminate")) return "indeterminate";
  if (normalized.includes("unknown")) return "unknown";
  if (
    normalized.includes("declin") ||
    normalized.includes("fail") ||
    normalized.includes("reject") ||
    normalized.includes("insufficient") ||
    reasonCode === 5051
  ) {
    return "failed";
  }
  return "unknown";
}

export function parseFormPayload(rawBody: Uint8Array | string): TipTopFormFields {
  let body: string;
  try {
    body = typeof rawBody === "string"
      ? rawBody
      : new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
  } catch {
    invalid();
  }

  if (body.length === 0) invalid("body");
  const fields: Record<string, string> = {};
  for (const pair of body.split("&")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) invalid("malformed_field", Object.keys(fields));
    let key: string;
    try {
      key = decodeFormComponent(pair.slice(0, separator));
    } catch {
      invalid("malformed_field_name", Object.keys(fields));
    }
    if (!DOCUMENTED_FIELDS.has(key) || fields[key] !== undefined) invalid(key, [...Object.keys(fields), key]);
    let value: string;
    try {
      value = decodeFormComponent(pair.slice(separator + 1));
    } catch {
      invalid(key, [...Object.keys(fields), key]);
    }
    try {
      fields[key] = boundedText(value);
    } catch {
      invalid(key, [...Object.keys(fields), key]);
    }
  }
  return fields;
}

export function parseCheck(fields: TipTopFormFields): TipTopCheck {
  assertDocumentedFields(fields);
  const dateTime = requiredField(fields, "DateTime");
  if (!dateTime) invalid();
  const common = commonFields(fields, true);
  if (common.status === undefined) invalid();
  const name = optionalText(fields, "Name");
  return name === undefined ? { ...common, status: common.status } : { ...common, status: common.status, name };
}

export function parsePay(fields: TipTopFormFields): TipTopPay {
  assertDocumentedFields(fields);
  const dateTime = requiredField(fields, "DateTime");
  if (!dateTime || requiredField(fields, "Status") !== "Completed") invalid();
  return commonFields(fields, true) as TipTopPay;
}

export function parseFail(fields: TipTopFormFields): TipTopFail {
  assertDocumentedFields(fields);
  if (fields.Status !== undefined) invalid();
  const dateTime = requiredField(fields, "DateTime");
  if (!dateTime) invalid();
  const common = commonFields(fields, false);
  const failureReason = requiredField(fields, "Reason");
  const reasonCode = parseReasonCode(requiredField(fields, "ReasonCode"));
  return {
    ...common,
    failureCode: mapFailureCode(failureReason, reasonCode),
    failureReason,
    reasonCode,
  };
}

function parseRefundOperationKey(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    invalid();
  }
  if (!isRecord(parsed)) return undefined;
  const operationKey = parsed.operationKey ?? parsed.requestId;
  if (operationKey === undefined) return undefined;
  if (typeof operationKey !== "string") invalid();
  const bounded = boundedText(operationKey, IDENTIFIER_MAX_LENGTH);
  if (bounded.trim() !== bounded || /\s/u.test(bounded)) invalid();
  return bounded;
}

function parseRefundStatus(value: string | undefined): string {
  if (value === undefined || value === "Completed" || value === "Confirmed") return "confirmed";
  if (value === "Failed" || value === "Declined" || value === "Error") return "failed";
  if (value === "Unknown" || value === "Indeterminate" || value === "Processing" || value === "Pending") {
    return "indeterminate";
  }
  invalid();
}

export function parseRefund(fields: TipTopFormFields): TipTopRefund {
  assertDocumentedFields(fields);
  const dateTime = requiredField(fields, "DateTime");
  if (!dateTime || requiredField(fields, "OperationType") !== "Refund") invalid();
  const currency = fields.Currency === undefined ? "KZT" : parseCurrency(fields);
  if (fields.TestMode !== undefined) invalid();
  const invoiceId = fields.InvoiceId === undefined ? undefined : identifier(fields, "InvoiceId");
  const accountId = fields.AccountId === undefined ? undefined : identifier(fields, "AccountId");
  const operationKey = parseRefundOperationKey(fields.Data);
  return {
    transactionId: parseTransactionId(requiredField(fields, "TransactionId")),
    paymentTransactionId: parseTransactionId(requiredField(fields, "PaymentTransactionId")),
    amountMinor: parseAmount(requiredField(fields, "Amount")),
    currency,
    ...(invoiceId === undefined ? {} : { invoiceId }),
    ...(operationKey === undefined ? {} : { operationKey }),
    ...(accountId === undefined ? {} : { accountId }),
    status: parseRefundStatus(fields.Status),
    operationType: "Refund",
  };
}

export function hashTipTopBody(rawBody: Uint8Array): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

type TipTopEventType = "Check" | "Pay" | "Fail" | "Refund";

export function providerEventId(eventType: TipTopEventType, transactionId: string): string {
  return `${eventType}:${transactionId}`;
}

function sanitizedFields(payload: TipTopCheck | TipTopPay | TipTopFail | TipTopRefund): Record<string, string | number | boolean> {
  const fields: Record<string, string | number | boolean> = {
    transactionId: payload.transactionId,
    amountMinor: payload.amountMinor,
    currency: payload.currency,
    operationType: payload.operationType,
  };
  if (payload.invoiceId !== undefined) fields.invoiceId = payload.invoiceId;
  if (payload.status !== undefined) fields.status = payload.status;
  if (payload.accountId !== undefined) fields.accountId = payload.accountId;
  if ("operationKey" in payload && payload.operationKey !== undefined) fields.operationKey = payload.operationKey;
  if ("testMode" in payload && payload.testMode !== undefined) fields.testMode = payload.testMode;
  if ("paymentTransactionId" in payload) {
    fields.paymentTransactionId = payload.paymentTransactionId;
    fields.refundTransactionId = payload.transactionId;
  }
  if ("failureCode" in payload) fields.failureCode = payload.failureCode;
  return fields;
}

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};

function rpcClient(): RpcClient {
  return getCaseLab3AdminClient() as unknown as RpcClient;
}

function transitionResult(value: unknown): TipTopTransitionResult {
  if (!isRecord(value) || typeof value.kind !== "string") throw new TipTopApiError();
  const result = typeof value.result === "string" && /^[a-z][a-z0-9_]{0,127}$/u.test(value.result)
    ? value.result
    : undefined;
  if (value.kind === "accepted") {
    if (value.code !== undefined && value.code !== 0) throw new TipTopApiError();
    return {
      kind: "accepted",
      ...(value.code === undefined ? {} : { code: 0 }),
      ...(typeof value.duplicate === "boolean" ? { duplicate: value.duplicate } : {}),
      ...(result === undefined ? {} : { result }),
    };
  }
  if (value.kind === "rejected" && CHECK_CODES.includes(value.code as (typeof CHECK_CODES)[number])) {
    return {
      kind: "rejected",
      code: value.code as (typeof CHECK_CODES)[number],
      ...(result === undefined ? {} : { result }),
    };
  }
  if (value.kind === "review_required") {
    return {
      kind: "review_required",
      ...(result === undefined ? {} : { result }),
    };
  }
  throw new TipTopApiError();
}

async function callTransition(name: string, args: Record<string, unknown>): Promise<TipTopTransitionResult> {
  let result: { data: unknown; error: unknown };
  try {
    result = await rpcClient().rpc(name, args);
  } catch {
    throw new TipTopApiError();
  }
  if (result.error) throw new TipTopApiError();
  return transitionResult(result.data);
}

export async function applyCheck(
  environment: PaymentEnvironment,
  payload: TipTopCheck,
  context: TipTopWebhookContext,
): Promise<TipTopTransitionResult> {
  return callTransition("case_lab_3_apply_check", {
    p_environment: environment,
    p_provider: "tiptoppay",
    p_provider_event_id: context.providerEventId,
    p_body_hash: context.bodyHash,
    p_external_id: payload.invoiceId,
    p_amount_minor: payload.amountMinor,
    p_currency: payload.currency,
    p_sanitized_fields: sanitizedFields(payload),
  });
}

export async function applyPay(
  environment: PaymentEnvironment,
  payload: TipTopPay,
  context: TipTopWebhookContext,
): Promise<TipTopTransitionResult> {
  return callTransition("case_lab_3_apply_pay", {
    p_environment: environment,
    p_provider: "tiptoppay",
    p_provider_event_id: context.providerEventId,
    p_body_hash: context.bodyHash,
    p_external_id: payload.invoiceId,
    p_provider_transaction_id: payload.transactionId,
    p_amount_minor: payload.amountMinor,
    p_currency: payload.currency,
    p_sanitized_fields: sanitizedFields(payload),
  });
}

export async function applyFail(
  environment: PaymentEnvironment,
  payload: TipTopFail,
  context: TipTopWebhookContext,
): Promise<TipTopTransitionResult> {
  return callTransition("case_lab_3_apply_fail", {
    p_environment: environment,
    p_provider: "tiptoppay",
    p_provider_event_id: context.providerEventId,
    p_body_hash: context.bodyHash,
    p_external_id: payload.invoiceId,
    p_failure_code: payload.failureCode,
    p_failure_reason: payload.failureReason,
    p_sanitized_fields: sanitizedFields(payload),
  });
}

export async function applyRefund(
  environment: PaymentEnvironment,
  payload: TipTopRefund,
  context: TipTopWebhookContext,
): Promise<TipTopTransitionResult> {
  return callTransition("case_lab_3_apply_refund", {
    p_environment: environment,
    p_provider: "tiptoppay",
    p_provider_event_id: context.providerEventId,
    p_body_hash: context.bodyHash,
    p_operation_key: payload.operationKey ?? `provider-refund:${payload.transactionId}`,
    p_payment_provider_transaction_id: payload.paymentTransactionId,
    p_provider_transaction_id: payload.transactionId,
    p_amount_minor: payload.amountMinor,
    p_currency: payload.currency,
    p_provider_status: payload.status,
    p_sanitized_fields: sanitizedFields(payload),
  });
}

export function tipTopSecret(environment: PaymentEnvironment): string {
  return getCaseLab3Config(environment).tiptop.apiSecret;
}

export type TipTopWebhookDependencies<T> = {
  getSecret: (environment: PaymentEnvironment) => string;
  parse: (fields: TipTopFormFields) => T;
  apply: (payload: T, context: TipTopWebhookContext) => Promise<TipTopTransitionResult>;
  eventType?: TipTopEventType;
};

function logWebhookRejection(
  environment: string,
  eventType: TipTopEventType | undefined,
  stage: string,
  error?: unknown,
  details?: Readonly<Record<string, boolean | number | string | readonly string[] | undefined>>,
): void {
  console.warn("Case Lab III TipTop webhook rejected", {
    environment,
    eventType: eventType ?? "unknown",
    stage,
    ...(error === undefined ? {} : { errorType: error instanceof Error ? error.name : "unknown_error" }),
    ...details,
  });
}

function responseCode(result: TipTopTransitionResult): number {
  return result.kind === "accepted" ? 0 : result.kind === "rejected" ? result.code : 20;
}

export async function handleSignedTipTopWebhook<T>(
  request: Request,
  environmentValue: string,
  dependencies: TipTopWebhookDependencies<T>,
): Promise<Response> {
  let stage = "environment";
  try {
    if (environmentValue !== "test" && environmentValue !== "live") {
      logWebhookRejection(environmentValue, dependencies.eventType, "unexpected_error", new Error("invalid_environment"));
      return Response.json({ code: 20 });
    }
    stage = "content_type";
    requireForm(request);
    stage = "body";
    const rawBody = await readBoundedBody(request, TIPTOP_BODY_MAX_BYTES);
    stage = "hmac";
    const secret = dependencies.getSecret(environmentValue);
    if (!verifyProviderHmac(rawBody, request.headers, secret, "raw-body")) {
      logWebhookRejection(environmentValue, dependencies.eventType, "invalid_hmac", undefined, {
        contentHmacPresent: request.headers.has("content-hmac"),
        xContentHmacPresent: request.headers.has("x-content-hmac"),
      });
      return Response.json({ code: 20 });
    }
    stage = "parse";
    let fields: TipTopFormFields;
    let payload: T;
    try {
      fields = parseFormPayload(rawBody);
      payload = dependencies.parse(fields);
    } catch (error) {
      if (error instanceof TipTopPayloadError) {
        logWebhookRejection(environmentValue, dependencies.eventType, "invalid_payload", undefined, {
          receivedFields: error.receivedFields,
          rejectedField: error.rejectedField,
        });
        return Response.json({ code: 20 });
      }
      throw error;
    }
    const testMode = (payload as T & { testMode?: unknown }).testMode;
    if (typeof testMode === "boolean" && testMode !== (environmentValue === "test")) {
      logWebhookRejection(environmentValue, dependencies.eventType, "mode_mismatch", undefined, { field: "TestMode" });
      return Response.json({ code: 20 });
    }
    const transactionId = (payload as T & { transactionId?: unknown }).transactionId;
    if (typeof transactionId !== "string") {
      logWebhookRejection(environmentValue, dependencies.eventType, "invalid_payload", undefined, {
        receivedFields: Object.keys(fields),
        rejectedField: "TransactionId",
      });
      return Response.json({ code: 20 });
    }
    stage = "transition";
    const context: TipTopWebhookContext = {
      environment: environmentValue,
      bodyHash: hashTipTopBody(rawBody),
      providerEventId: providerEventId(
        dependencies.eventType ?? ((payload as T & { operationType?: unknown }).operationType === "Refund" ? "Refund" : "Pay"),
        transactionId,
      ),
    };
    const transition = await dependencies.apply(payload, context);
    if (transition.kind === "rejected" || transition.kind === "review_required") {
      const rpcReason = transition.result;
      logWebhookRejection(
        environmentValue,
        dependencies.eventType,
        rpcReason === "rejected_provider_metadata" ? "metadata_mismatch" : "rpc_rejection",
        undefined,
        {
          ...(transition.kind === "rejected" ? { rpcCode: transition.code } : {}),
          ...(rpcReason === undefined ? {} : { rpcReason }),
        },
      );
    }
    return Response.json({ code: responseCode(transition) });
  } catch (error) {
    logWebhookRejection(environmentValue, dependencies.eventType, "unexpected_error", error, { failedStage: stage });
    return Response.json({ code: 20 });
  }
}

export type TipTopApiConfig = {
  tiptop: {
    publicId: string;
    apiSecret: string;
  };
};

export type TipTopApiOptions = {
  fetch?: typeof fetch;
  getConfig?: (environment: PaymentEnvironment) => TipTopApiConfig;
  timeoutMs?: number;
  now?: () => number;
};

function validateApiEnvironment(environment: string): asserts environment is PaymentEnvironment {
  if (environment !== "test" && environment !== "live") throw new TipTopApiError();
}

function apiOptions(environment: PaymentEnvironment, options: TipTopApiOptions): {
  fetch: typeof fetch;
  config: TipTopApiConfig;
  timeoutMs: number;
} {
  validateApiEnvironment(environment);
  const config = (options.getConfig ?? getCaseLab3Config)(environment) as TipTopApiConfig;
  if (!config.tiptop?.publicId || !config.tiptop.apiSecret) throw new TipTopApiError();
  const timeoutMs = options.timeoutMs ?? TIPTOP_API_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > TIPTOP_API_TIMEOUT_MS) throw new TipTopApiError();
  return { fetch: options.fetch ?? fetch, config, timeoutMs };
}

function apiTransactionId(value: string | number): number {
  const text = typeof value === "number" ? String(value) : value;
  if (!/^\d+$/u.test(text)) throw new TipTopApiError();
  const transactionId = Number(text);
  if (!Number.isSafeInteger(transactionId) || transactionId < 1) throw new TipTopApiError();
  return transactionId;
}

function requestId(value: string): string {
  if (!value || value.length > 200 || /[\u0000-\u001f\u007f]/u.test(value)) throw new TipTopApiError();
  return value;
}

function parseApiResponse(value: unknown, status: number): TipTopApiResponse {
  if (!isRecord(value)) throw new TipTopApiError();
  const success = value.Success ?? value.success;
  const message = value.Message ?? value.message;
  const model = value.Model ?? value.model;
  if (typeof success !== "boolean") throw new TipTopApiError();
  if (message !== undefined && message !== null && typeof message !== "string") throw new TipTopApiError();
  if (
    model !== undefined &&
    model !== null &&
    !(isRecord(model) || (Array.isArray(model) && model.every(isRecord)))
  ) {
    throw new TipTopApiError();
  }
  return {
    success,
    message: message === undefined || message === null ? null : message,
    model: model === undefined || model === null ? null : model as TipTopJsonObject | TipTopJsonObject[],
    status,
  };
}

export type TipTopJsonObject = Record<string, unknown>;

export type TipTopApiResponse = {
  success: boolean;
  message: string | null;
  model: TipTopJsonObject | TipTopJsonObject[] | null;
  status: number;
  reconciled?: boolean;
};

async function tipTopApiRequest(
  environment: PaymentEnvironment,
  path: string,
  body: TipTopJsonObject,
  options: TipTopApiOptions,
  idempotencyKey?: string,
): Promise<TipTopApiResponse> {
  const { fetch: fetcher, config, timeoutMs } = apiOptions(environment, options);
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    Authorization: `Basic ${Buffer.from(`${config.tiptop.publicId}:${config.tiptop.apiSecret}`, "utf8").toString("base64")}`,
  });
  if (idempotencyKey !== undefined) headers.set("X-Request-ID", requestId(idempotencyKey));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(`${TIPTOP_API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    if (!response.ok) throw new TipTopApiError();
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new TipTopApiError();
    }
    return parseApiResponse(json, response.status);
  } catch (error) {
    if (error instanceof TipTopApiError) throw error;
    throw new TipTopApiError();
  } finally {
    clearTimeout(timeout);
  }
}

export type RefundPaymentInput = {
  paymentTransactionId: string | number;
  amountMinor: number;
  operationKey: string;
  invoiceId: string;
  uncertainSince?: Date | string | number;
};

function refundAmount(amountMinor: number): number {
  try {
    return minorToMajor(amountMinor);
  } catch {
    throw new TipTopApiError();
  }
}

function uncertainTimestamp(value: Date | string | number): number {
  const timestamp = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new TipTopApiError();
  return timestamp;
}

function modelItems(model: TipTopApiResponse["model"]): TipTopJsonObject[] | null {
  if (Array.isArray(model)) return model;
  if (model && typeof model === "object") return [model];
  return null;
}

function field(record: TipTopJsonObject, ...names: string[]): unknown {
  for (const name of names) {
    if (name in record) return record[name];
  }
  return undefined;
}

function normalizedApiId(value: unknown): string | null {
  return typeof value === "number" && Number.isSafeInteger(value) ? String(value) : typeof value === "string" && /^\d+$/u.test(value) ? value : null;
}

function confirmedRefundFound(
  model: TipTopApiResponse["model"],
  paymentTransactionId: string,
  amountMinor: number,
): TipTopJsonObject | null {
  for (const item of modelItems(model) ?? []) {
    const operationType = field(item, "OperationType", "operationType");
    const transactionType = field(item, "Type", "type");
    const status = field(item, "Status", "status");
    const originalId = normalizedApiId(field(item, "PaymentTransactionId", "paymentTransactionId", "OriginalTransactionId", "originalTransactionId"));
    const amount = field(item, "Amount", "amount");
    const parsedAmount = typeof amount === "number" ? Math.round(amount * 100) : typeof amount === "string" && /^\d+(?:\.\d{1,2})?$/u.test(amount) ? parseAmount(amount) : null;
    if (
      ((typeof operationType === "string" && operationType.toLowerCase() === "refund") || transactionType === 1 || transactionType === "Refund") &&
      typeof status === "string" && ["completed", "confirmed", "processed"].includes(status.toLowerCase()) &&
      originalId === paymentTransactionId && parsedAmount === amountMinor
    ) {
      return item;
    }
  }
  return null;
}

async function reconcileRefund(
  environment: PaymentEnvironment,
  input: RefundPaymentInput,
  options: TipTopApiOptions,
): Promise<{ kind: "confirmed"; model: TipTopJsonObject } | { kind: "not_found" } | { kind: "uncertain" }> {
  const transaction = await getTransaction(environment, input.paymentTransactionId, options);
  const operations = await findInvoiceOperations(environment, input.invoiceId, options);
  const confirmed = confirmedRefundFound(operations.model, String(apiTransactionId(input.paymentTransactionId)), input.amountMinor);
  if (confirmed) return { kind: "confirmed", model: confirmed };
  if (transaction.success && !operations.success && operations.message?.toLowerCase() === "not found") return { kind: "not_found" };
  return { kind: "uncertain" };
}

export async function refundPayment(
  environment: PaymentEnvironment,
  input: RefundPaymentInput,
  options: TipTopApiOptions = {},
): Promise<TipTopApiResponse> {
  const transactionId = apiTransactionId(input.paymentTransactionId);
  const amount = refundAmount(input.amountMinor);
  if (input.uncertainSince !== undefined) {
    const now = options.now?.() ?? Date.now();
    if (now - uncertainTimestamp(input.uncertainSince) >= REFUND_IDEMPOTENCY_WINDOW_MS) {
      const reconciliation = await reconcileRefund(environment, input, options);
      if (reconciliation.kind === "confirmed") {
        return { success: true, message: "Reconciled", model: reconciliation.model, status: 200, reconciled: true };
      }
      if (reconciliation.kind === "uncertain") throw new TipTopReconciliationRequiredError();
    }
  }
  return tipTopApiRequest(
    environment,
    "/payments/refund",
    { TransactionId: transactionId, Amount: amount, JsonData: { operationKey: input.operationKey } },
    options,
    input.operationKey,
  );
}

export async function getTransaction(
  environment: PaymentEnvironment,
  transactionId: string | number,
  options: TipTopApiOptions = {},
): Promise<TipTopApiResponse> {
  return tipTopApiRequest(environment, "/payments/get", { TransactionId: apiTransactionId(transactionId) }, options);
}

export async function findInvoiceOperations(
  environment: PaymentEnvironment,
  invoiceId: string,
  options: TipTopApiOptions = {},
): Promise<TipTopApiResponse> {
  return tipTopApiRequest(environment, "/payments/find", { InvoiceId: identifier({ InvoiceId: invoiceId }, "InvoiceId") }, options);
}

export type TipTopListRequest = {
  createdDateGte: string;
  createdDateLte: string;
  pageNumber: number;
  timeZone?: string;
  statuses?: readonly string[];
};

function listRequest(input: TipTopListRequest): TipTopJsonObject {
  for (const date of [input.createdDateGte, input.createdDateLte]) {
    if (typeof date !== "string" || date.length > 64 || !Number.isFinite(Date.parse(date))) throw new TipTopApiError();
  }
  if (!Number.isSafeInteger(input.pageNumber) || input.pageNumber < 1) throw new TipTopApiError();
  const body: TipTopJsonObject = {
    CreatedDateGte: input.createdDateGte,
    CreatedDateLte: input.createdDateLte,
    PageNumber: input.pageNumber,
  };
  if (input.timeZone !== undefined) body.TimeZone = boundedText(input.timeZone, 64);
  if (input.statuses !== undefined) {
    if (input.statuses.length === 0 || input.statuses.some((status) => !LIST_STATUSES.has(status))) throw new TipTopApiError();
    body.Statuses = [...input.statuses];
  }
  return body;
}

export async function listTransactionsPage(
  environment: PaymentEnvironment,
  input: TipTopListRequest,
  options: TipTopApiOptions = {},
): Promise<TipTopApiResponse> {
  return tipTopApiRequest(environment, "/v2/payments/list", listRequest(input), options);
}

export const listPaymentTransactions = listTransactionsPage;
export const listPaymentsPage = listTransactionsPage;

export async function* paginateTransactions(
  environment: PaymentEnvironment,
  input: Omit<TipTopListRequest, "pageNumber">,
  options: TipTopApiOptions = {},
): AsyncGenerator<TipTopApiResponse, void, undefined> {
  let page = 1;
  while (true) {
    const result = await listTransactionsPage(environment, { ...input, pageNumber: page }, options);
    yield result;
    if (!result.success || !Array.isArray(result.model) || result.model.length < 100) return;
    page += 1;
  }
}
