import "server-only";

import { createHash } from "node:crypto";

import { getCaseLab3Config } from "./config.server";
import { readBoundedBody, requireForm } from "./http.server";
import { minorToMajor } from "./money";
import { verifyProviderHmac } from "./provider-hmac.server";
import { getCaseLab3AdminClient } from "./supabase-admin.server";
import type { PaymentEnvironment } from "./contracts";

export const KASSIR_API_BASE_URL = "https://api.tiptoppay.kz";
export const KASSIR_API_TIMEOUT_MS = 10_000;
export const KASSIR_IDEMPOTENCY_WINDOW_MS = 60 * 60 * 1000;
export const KASSIR_BODY_MAX_BYTES = 64 * 1024;

const KASSIR_RECEIPT_TYPES = ["Income", "IncomeReturn"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const RECEIPT_FORM_FIELDS = new Set([
  "Id",
  "DocumentNumber",
  "SessionNumber",
  "Number",
  "FiscalSign",
  "DeviceNumber",
  "RegNumber",
  "FiscalNumber",
  "Inn",
  "Type",
  "Ofd",
  "Url",
  "TransactionId",
  "Amount",
  "DateTime",
  "InvoiceId",
  "AccountId",
  "Receipt",
  "CalculationPlace",
  "CashierName",
  "SettlePlace",
]);

export type KassirReceiptType = (typeof KASSIR_RECEIPT_TYPES)[number];

export type KassirFiscalItemSnapshot = {
  name?: string;
  label?: string;
  priceMinor?: number;
  amountMinor?: number;
  quantity?: number;
};

export type KassirPayloadSnapshot = {
  type?: KassirReceiptType;
  invoiceId?: string;
  accountId?: string;
  email?: string;
  phone?: string | null;
  item?: KassirFiscalItemSnapshot;
  tinyUrlRefundTarget?: string | null;
  tiny_url_refund_target?: string | null;
  calculationMethod?: string;
  calculation_method?: string;
  [key: string]: unknown;
};

export type KassirFiscalOperation = {
  environment: PaymentEnvironment;
  id: string;
  orderId: string;
  orderNumber: string;
  accountId?: string | null;
  invoiceId?: string | null;
  refundId?: string | null;
  operationKey: string;
  providerReceiptType: KassirReceiptType;
  tier?: "early_bird" | "standard";
  receiptLabel?: string | null;
  amountMinor: number;
  email: string;
  phone?: string | null;
  kassirReceiptId?: string | null;
  attemptCount?: number;
  uncertainSinceAt?: string | null;
  createdAt?: string | null;
  payloadSnapshot?: KassirPayloadSnapshot;
};

export type KassirFiscalPolicyStage = {
  purpose?: string;
  trigger?: string;
  depends_on_purpose?: string | null;
  dependsOnPurpose?: string | null;
  provider_receipt_type?: string;
  providerReceiptType?: string;
  payload_fields?: Record<string, unknown>;
  payloadFields?: Record<string, unknown>;
  schedule?: string;
};

export type KassirFiscalPolicy = {
  environment?: PaymentEnvironment;
  sellerInn?: string;
  seller_inn?: string;
  taxationSystem?: number;
  taxation_system?: number;
  vatRate?: number | null;
  vat_rate?: number | null;
  calculationPlace?: string;
  calculation_place?: string;
  policyDefinition?: readonly KassirFiscalPolicyStage[];
  policy_definition?: readonly KassirFiscalPolicyStage[];
  policyStatus?: "draft" | "approved" | "retired";
  policy_status?: "draft" | "approved" | "retired";
  isAccountantApproved?: boolean;
  is_accountant_approved?: boolean;
};

export type KassirReceiptItem = {
  Label: string;
  Price: number;
  Quantity: 1;
  Amount: number;
  Vat?: null;
};

export type KassirReceiptRequest = {
  Inn: string;
  Type: KassirReceiptType;
  InvoiceId: string;
  AccountId: string;
  CustomerReceipt: {
    Items: [KassirReceiptItem];
    TaxationSystem: 0;
    Amounts: {
      Electronic: number;
      Cash: 0;
    };
    CalculationPlace: "caselab.kz";
    Email: string;
    TinyUrlRefundTarget?: string;
  };
};

export class KassirFiscalPolicyError extends Error {
  constructor() {
    super("Unsupported fiscal policy");
    this.name = "KassirFiscalPolicyError";
  }
}

export class KassirPayloadError extends Error {
  constructor() {
    super("Invalid Kassir webhook payload");
    this.name = "KassirPayloadError";
  }
}

export class KassirApiError extends Error {
  readonly failureKind: "retryable" | "permanent" | "unknown";
  readonly uncertainSince: number | null;

  constructor(
    failureKind: "retryable" | "permanent" | "unknown",
    uncertainSince: number | null = null,
  ) {
    super("Kassir API request failed");
    this.name = "KassirApiError";
    this.failureKind = failureKind;
    this.uncertainSince = uncertainSince;
  }
}

function invalidPayload(): never {
  throw new KassirPayloadError();
}

function invalidPolicy(): never {
  throw new KassirFiscalPolicyError();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function policyField(fields: Record<string, unknown> | undefined, camel: string, snake: string): unknown {
  return fields?.[camel] ?? fields?.[snake];
}

function validatePolicy(policy: KassirFiscalPolicy, environment: PaymentEnvironment, receiptType: KassirReceiptType): void {
  if (policy.environment !== undefined && policy.environment !== environment) invalidPolicy();
  if (policy.policyStatus !== undefined && policy.policyStatus !== "approved") invalidPolicy();
  if (policy.policy_status !== undefined && policy.policy_status !== "approved") invalidPolicy();
  if (policy.isAccountantApproved !== undefined && policy.isAccountantApproved !== true) invalidPolicy();
  if (policy.is_accountant_approved !== undefined && policy.is_accountant_approved !== true) invalidPolicy();
  const definitions = policy.policyDefinition ?? policy.policy_definition;
  if (definitions !== undefined) {
    if (definitions.length !== 2) invalidPolicy();
    const supportedPurposes = new Set(["payment_income", "refund_income_return"]);
    for (const stage of definitions) {
      if (!stage || typeof stage !== "object" || !supportedPurposes.has(String(stage.purpose))) invalidPolicy();
      const fields = stage.payload_fields ?? stage.payloadFields;
      if (!fields || policyField(fields, "vat", "vat") !== "omitted_or_null") invalidPolicy();
      if (policyField(fields, "taxationSystem", "taxation_system") !== 0) invalidPolicy();
      if (policyField(fields, "calculationPlace", "calculation_place") !== "caselab.kz") invalidPolicy();
      if (policyField(fields, "calculationMethod", "calculation_method") !== "full_payment") invalidPolicy();
      const purpose = String(stage.purpose);
      const expectedType = purpose === "payment_income" ? "Income" : "IncomeReturn";
      if ((stage.provider_receipt_type ?? stage.providerReceiptType) !== expectedType) invalidPolicy();
    }
    const requiredPurpose = receiptType === "Income" ? "payment_income" : "refund_income_return";
    if (!definitions.some((stage) => stage.purpose === requiredPurpose)) invalidPolicy();
  }

  const taxationSystem = policy.taxationSystem ?? policy.taxation_system ?? 0;
  const vatRate = policy.vatRate ?? policy.vat_rate ?? null;
  const calculationPlace = policy.calculationPlace ?? policy.calculation_place ?? "caselab.kz";
  if (taxationSystem !== 0 || vatRate !== null || calculationPlace !== "caselab.kz") invalidPolicy();
}

function policyInn(policy: KassirFiscalPolicy): string {
  const inn = policy.sellerInn ?? policy.seller_inn;
  if (!inn || !/^\d{10,12}$/u.test(inn)) invalidPolicy();
  return inn;
}

function operationText(value: unknown, maxLength = 2048): string {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) {
    invalidPolicy();
  }
  return value;
}

function snapshot(operation: KassirFiscalOperation): KassirPayloadSnapshot {
  return operation.payloadSnapshot ?? {};
}

function operationAmount(operation: KassirFiscalOperation): number {
  if (!Number.isSafeInteger(operation.amountMinor) || operation.amountMinor <= 0) invalidPolicy();
  return minorToMajor(operation.amountMinor);
}

function operationLabel(operation: KassirFiscalOperation): string {
  const item = snapshot(operation).item;
  const label = operation.receiptLabel ?? item?.label ?? item?.name ?? (
    operation.tier === "early_bird"
      ? "Участие в Case Lab III, 24.09.2026, Early Bird"
      : operation.tier === "standard"
        ? "Участие в Case Lab III, 24.09.2026, Стандарт"
        : undefined
  );
  return operationText(label, 128);
}

function operationEmail(operation: KassirFiscalOperation): string {
  const email = snapshot(operation).email ?? operation.email;
  if (typeof email !== "string" || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) invalidPolicy();
  return email;
}

function operationReference(operation: KassirFiscalOperation): { invoiceId: string; accountId: string } {
  const currentSnapshot = snapshot(operation);
  const invoiceId = operation.invoiceId ?? currentSnapshot.invoiceId ?? operation.orderNumber;
  const accountId = operation.accountId ?? currentSnapshot.accountId ?? operation.orderId;
  return {
    invoiceId: operationText(invoiceId, 256),
    accountId: operationText(accountId, 256),
  };
}

function refundTarget(operation: KassirFiscalOperation): string | undefined {
  const target = snapshot(operation).tinyUrlRefundTarget ?? snapshot(operation).tiny_url_refund_target;
  if (target === null || target === undefined) return undefined;
  return operationText(target, 2048);
}

export function buildFiscalPayload(
  operation: KassirFiscalOperation,
  policy: KassirFiscalPolicy,
): KassirReceiptRequest {
  if (operation.environment !== "test" && operation.environment !== "live") invalidPolicy();
  if (!KASSIR_RECEIPT_TYPES.includes(operation.providerReceiptType)) invalidPolicy();
  validatePolicy(policy, operation.environment, operation.providerReceiptType);

  const amount = operationAmount(operation);
  const reference = operationReference(operation);
  const item: KassirReceiptItem = {
    Label: operationLabel(operation),
    Price: amount,
    Quantity: 1,
    Amount: amount,
  };
  const receipt: KassirReceiptRequest["CustomerReceipt"] = {
    Items: [item],
    TaxationSystem: 0,
    Amounts: { Electronic: amount, Cash: 0 },
    CalculationPlace: "caselab.kz",
    Email: operationEmail(operation),
  };
  const target = operation.providerReceiptType === "IncomeReturn" ? refundTarget(operation) : undefined;
  if (target) receipt.TinyUrlRefundTarget = target;

  return {
    Inn: policyInn(policy),
    Type: operation.providerReceiptType,
    InvoiceId: reference.invoiceId,
    AccountId: reference.accountId,
    CustomerReceipt: receipt,
  };
}

export type KassirApiConfig = {
  kassir: {
    publicId: string;
    apiSecret: string;
  };
  seller?: {
    inn?: string;
  };
};

export type KassirApiOptions = {
  fetch?: typeof fetch;
  getConfig?: (environment: PaymentEnvironment) => KassirApiConfig;
  timeoutMs?: number;
  signal?: AbortSignal;
  now?: () => number;
};

export type KassirApiResponse = {
  success: boolean;
  message: string | null;
  model: Record<string, unknown> | string | null;
  httpStatus: number;
};

export type KassirQueuedReceipt = {
  kind: "queued";
  receiptId: string;
  response: KassirApiResponse;
};

export type KassirReceiptStatus = "Processed" | "Queued" | "Error" | "NotFound";

export type KassirReceiptStatusResponse = KassirApiResponse & {
  status: KassirReceiptStatus;
};

export type KassirReceiptDetails = KassirApiResponse & {
  receiptId: string;
  model: Record<string, unknown>;
};

function assertEnvironment(environment: string): asserts environment is PaymentEnvironment {
  if (environment !== "test" && environment !== "live") throw new KassirApiError("permanent");
}

function assertReceiptId(receiptId: string): void {
  if (typeof receiptId !== "string" || receiptId.trim().length === 0 || !/^[^\u0000-\u001f\u007f]{1,256}$/u.test(receiptId)) {
    throw new KassirApiError("permanent");
  }
}

function apiOptions(environment: PaymentEnvironment, options: KassirApiOptions): {
  fetch: typeof fetch;
  config: KassirApiConfig;
  timeoutMs: number;
} {
  const config = (options.getConfig ?? getCaseLab3Config)(environment) as KassirApiConfig;
  if (!config.kassir?.publicId || !config.kassir.apiSecret) throw new KassirApiError("permanent");
  const timeoutMs = options.timeoutMs ?? KASSIR_API_TIMEOUT_MS;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > KASSIR_API_TIMEOUT_MS) {
    throw new KassirApiError("permanent");
  }
  return { fetch: options.fetch ?? fetch, config, timeoutMs };
}

function parseApiResponse(value: unknown, status: number): KassirApiResponse {
  if (!isRecord(value)) throw new KassirApiError(status >= 500 ? "retryable" : "permanent");
  const success = value.Success ?? value.success;
  const message = value.Message ?? value.message;
  const model = value.Model ?? value.model;
  if (typeof success !== "boolean") throw new KassirApiError(status >= 500 ? "retryable" : "permanent");
  if (message !== undefined && message !== null && typeof message !== "string") throw new KassirApiError("permanent");
  if (model !== undefined && model !== null && typeof model !== "string" && !isRecord(model)) throw new KassirApiError("permanent");
  return {
    success,
    message: message === undefined || message === null ? null : message,
    model: model === undefined || model === null ? null : model,
    httpStatus: status,
  };
}

async function kassirApiRequest(
  environment: PaymentEnvironment,
  path: string,
  body: Record<string, unknown>,
  options: KassirApiOptions,
  requestId?: string,
  mutating = false,
): Promise<KassirApiResponse> {
  const { fetch: fetcher, config, timeoutMs } = apiOptions(environment, options);
  const controller = new AbortController();
  const parentAbort = () => controller.abort();
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else options.signal.addEventListener("abort", parentAbort, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const headers = new Headers({
    Accept: "application/json",
    "Content-Type": "application/json; charset=utf-8",
    Authorization: `Basic ${Buffer.from(`${config.kassir.publicId}:${config.kassir.apiSecret}`, "utf8").toString("base64")}`,
  });
  if (requestId !== undefined) headers.set("X-Request-ID", operationRequestId(requestId));

  try {
    const response = await fetcher(`${KASSIR_API_BASE_URL}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store",
    });
    let json: unknown;
    try {
      json = await response.json();
    } catch {
      throw new KassirApiError(response.status >= 500 ? "retryable" : "permanent");
    }
    const parsed = parseApiResponse(json, response.status);
    if (!response.ok) throw new KassirApiError(response.status >= 500 || response.status === 429 ? "retryable" : "permanent");
    return parsed;
  } catch (error) {
    if (error instanceof KassirApiError) throw error;
    const uncertainSince = options.now?.() ?? Date.now();
    throw new KassirApiError(mutating ? "unknown" : "retryable", mutating ? uncertainSince : null);
  } finally {
    clearTimeout(timeout);
    options.signal?.removeEventListener("abort", parentAbort);
  }
}

function operationRequestId(value: string): string {
  if (value.trim().length === 0 || !/^[^\u0000-\u001f\u007f]{1,200}$/u.test(value)) throw new KassirApiError("permanent");
  return value;
}

function responseReceiptId(response: KassirApiResponse): string {
  if (!response.success || response.message !== "Queued" || !isRecord(response.model)) throw new KassirApiError("permanent");
  const id = response.model.Id ?? response.model.id;
  if (typeof id !== "string" || id.trim().length === 0 || id.length > 256 || /[\u0000-\u001f\u007f]/u.test(id)) {
    throw new KassirApiError("permanent");
  }
  return id;
}

export async function queueReceipt(
  environment: PaymentEnvironment,
  operation: KassirFiscalOperation,
  policy: KassirFiscalPolicy,
  options: KassirApiOptions = {},
): Promise<KassirQueuedReceipt> {
  assertEnvironment(environment);
  if (operation.environment !== environment) throw new KassirApiError("permanent");
  const payload = buildFiscalPayload(operation, policy);
  const response = await kassirApiRequest(environment, "/kkt/receipt", payload as unknown as Record<string, unknown>, options, operation.operationKey, true);
  return { kind: "queued", receiptId: responseReceiptId(response), response };
}

function statusFromModel(model: KassirApiResponse["model"]): KassirReceiptStatus {
  if (typeof model !== "string") throw new KassirApiError("permanent");
  const status = model.trim().toLowerCase();
  if (status === "processed") return "Processed";
  if (status === "queued") return "Queued";
  if (status === "error") return "Error";
  if (status === "notfound" || status === "not_found") return "NotFound";
  throw new KassirApiError("permanent");
}

export async function getReceiptStatus(
  environment: PaymentEnvironment,
  receiptId: string,
  options: KassirApiOptions = {},
): Promise<KassirReceiptStatusResponse> {
  assertEnvironment(environment);
  assertReceiptId(receiptId);
  const response = await kassirApiRequest(environment, "/kkt/receipt/status/get", { Id: receiptId }, options);
  if (!response.success) throw new KassirApiError(response.httpStatus >= 500 ? "retryable" : "permanent");
  return { ...response, status: statusFromModel(response.model) };
}

export async function getReceiptDetails(
  environment: PaymentEnvironment,
  receiptId: string,
  options: KassirApiOptions = {},
): Promise<KassirReceiptDetails> {
  assertEnvironment(environment);
  assertReceiptId(receiptId);
  const response = await kassirApiRequest(environment, "/kkt/receipt/get", { Id: receiptId }, options);
  if (!response.success || !isRecord(response.model)) throw new KassirApiError(response.httpStatus >= 500 ? "retryable" : "permanent");
  return { ...response, receiptId, model: response.model };
}

type KassirFormFields = Readonly<Record<string, string>>;

function decodeFormComponent(value: string): string {
  if (/%(?![0-9a-f]{2})/iu.test(value)) invalidPayload();
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    invalidPayload();
  }
}

function parseFormFields(rawBody: Uint8Array | string): KassirFormFields {
  let body: string;
  try {
    body = typeof rawBody === "string" ? rawBody : new TextDecoder("utf-8", { fatal: true }).decode(rawBody);
  } catch {
    invalidPayload();
  }
  if (body.length === 0) invalidPayload();
  const fields: Record<string, string> = {};
  for (const pair of body.split("&")) {
    const separator = pair.indexOf("=");
    if (separator <= 0) invalidPayload();
    const key = decodeFormComponent(pair.slice(0, separator));
    if (!RECEIPT_FORM_FIELDS.has(key) || fields[key] !== undefined) invalidPayload();
    fields[key] = decodeFormComponent(pair.slice(separator + 1));
  }
  return fields;
}

function requiredFormField(fields: KassirFormFields, name: string, maxLength = 2048): string {
  const value = fields[name];
  if (value === undefined || value.length === 0 || value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) invalidPayload();
  return value;
}

function optionalFormField(fields: KassirFormFields, name: string, maxLength = 2048): string | undefined {
  const value = fields[name];
  if (value === undefined) return undefined;
  if (value.length === 0 || value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) invalidPayload();
  return value;
}

function nullableFormField(fields: KassirFormFields, name: string, maxLength = 2048): string | null | undefined {
  const value = fields[name];
  if (value === undefined) return undefined;
  if (value.length > maxLength || /[\u0000-\u001f\u007f]/u.test(value)) invalidPayload();
  return value === "" ? null : value;
}

function receiptAmount(value: string): number {
  if (!/^\d+(?:\.\d{1,2})?$/u.test(value)) invalidPayload();
  const [whole, fraction = ""] = value.split(".");
  const amountMinor = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) invalidPayload();
  return amountMinor;
}

function receiptInteger(value: string): string {
  if (!/^\d+$/u.test(value) || !Number.isSafeInteger(Number(value))) invalidPayload();
  return value;
}

function receiptJson(value: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!isRecord(parsed)) invalidPayload();
    return parsed;
  } catch {
    invalidPayload();
  }
}

export type KassirReceiptPayload = {
  id: string;
  documentNumber: string;
  type: KassirReceiptType;
  amountMinor: number;
  dateTime: string;
  invoiceId?: string;
  accountId?: string;
  url: string;
  transactionId?: string;
  receipt: Record<string, unknown>;
  fiscalFields: Record<string, string | null>;
  sanitizedFields: Record<string, string | number>;
};

export function parseReceiptForm(rawBody: Uint8Array | string): KassirReceiptPayload {
  const fields = parseFormFields(rawBody);
  const id = requiredFormField(fields, "Id", 256);
  const type = requiredFormField(fields, "Type", 32);
  if (!KASSIR_RECEIPT_TYPES.includes(type as KassirReceiptType)) invalidPayload();
  const documentNumber = receiptInteger(requiredFormField(fields, "DocumentNumber", 64));
  requiredFormField(fields, "SessionNumber", 64);
  requiredFormField(fields, "Number", 64);
  requiredFormField(fields, "FiscalSign", 256);
  requiredFormField(fields, "DeviceNumber", 256);
  requiredFormField(fields, "RegNumber", 256);
  const fiscalNumber = nullableFormField(fields, "FiscalNumber", 256);
  requiredFormField(fields, "Inn", 32);
  requiredFormField(fields, "Ofd", 256);
  const url = requiredFormField(fields, "Url", 2048);
  const amountMinor = receiptAmount(requiredFormField(fields, "Amount", 64));
  const dateTime = requiredFormField(fields, "DateTime", 128);
  const invoiceId = optionalFormField(fields, "InvoiceId", 256);
  const accountId = optionalFormField(fields, "AccountId", 256);
  const transactionIdValue = optionalFormField(fields, "TransactionId", 64);
  const transactionId = transactionIdValue === undefined ? undefined : receiptInteger(transactionIdValue);
  const receipt = receiptJson(requiredFormField(fields, "Receipt", 64 * 1024));
  const receiptUrl = typeof receipt.OfdUrl === "string"
    ? receipt.OfdUrl
    : typeof receipt.OFDUrl === "string"
      ? receipt.OFDUrl
      : typeof receipt.Url === "string"
        ? receipt.Url
        : null;
  const qrUrl = typeof receipt.QrUrl === "string"
    ? receipt.QrUrl
    : typeof receipt.QRUrl === "string"
      ? receipt.QRUrl
      : typeof receipt.QRCodeUrl === "string"
        ? receipt.QRCodeUrl
        : null;
  const fiscalSign = fields.FiscalSign ?? null;
  const ofd = fields.Ofd ?? null;

  return {
    id,
    documentNumber,
    type: type as KassirReceiptType,
    amountMinor,
    dateTime,
    ...(invoiceId === undefined ? {} : { invoiceId }),
    ...(accountId === undefined ? {} : { accountId }),
    url,
    ...(transactionId === undefined ? {} : { transactionId }),
    receipt,
    fiscalFields: {
      fiscalDocumentNumber: documentNumber,
      fiscalSign,
      fiscalNumber: fiscalNumber ?? null,
      ofd,
      ofdUrl: receiptUrl,
      qrUrl,
    },
    sanitizedFields: {
      receiptId: id,
      kassirReceiptId: id,
      receiptStatus: "issued",
      status: "Processed",
      type,
      amountMinor,
      receiptUrl: url,
      fiscalDocumentNumber: documentNumber,
    },
  };
}

export const parseReceipt = parseReceiptForm;

export function hashKassirBody(rawBody: Uint8Array): string {
  return createHash("sha256").update(rawBody).digest("hex");
}

export type KassirWebhookContext = {
  environment: PaymentEnvironment;
  bodyHash: string;
  providerEventId: string;
};

export type KassirTransitionResult =
  | { kind: "accepted"; duplicate?: boolean; pendingMatch?: boolean; status?: string }
  | { kind: "review_required" };

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};

type QueryBuilder = {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string | number): QueryBuilder;
  maybeSingle(): Promise<{ data: unknown; error: unknown }>;
};

type KassirDatabase = {
  from(table: string): QueryBuilder;
};

function uuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function operationRecord(value: unknown): { orderId: string; refundId: string | null; operationKey: string } | null {
  if (!isRecord(value) || !uuid(value.order_id) || (value.refund_id !== null && !uuid(value.refund_id)) || typeof value.operation_key !== "string") {
    return null;
  }
  return { orderId: value.order_id, refundId: value.refund_id, operationKey: value.operation_key };
}

async function findReceiptOperation(
  environment: PaymentEnvironment,
  payload: KassirReceiptPayload,
  orderId: string,
): Promise<{ orderId: string; refundId: string | null; operationKey: string } | null> {
  const client = getCaseLab3AdminClient() as unknown as KassirDatabase;
  const base = client
    .from("case_lab_3_fiscal_operations")
    .select("order_id, refund_id, operation_key")
    .eq("environment", environment)
    .eq("order_id", orderId)
    .eq("provider_receipt_type", payload.type)
    .eq("amount_minor", payload.amountMinor);
  const byReceipt = await base.eq("kassir_receipt_id", payload.id).maybeSingle();
  if (!byReceipt.error) {
    const found = operationRecord(byReceipt.data);
    if (found) return found;
  }
  if (payload.invoiceId?.startsWith("fiscal:")) {
    const byKey = await client
      .from("case_lab_3_fiscal_operations")
      .select("order_id, refund_id, operation_key")
      .eq("environment", environment)
      .eq("operation_key", payload.invoiceId)
      .maybeSingle();
    if (!byKey.error) return operationRecord(byKey.data);
  }
  return null;
}

export async function applyReceipt(
  environment: PaymentEnvironment,
  payload: KassirReceiptPayload,
  context: KassirWebhookContext,
): Promise<KassirTransitionResult> {
  let orderId = uuid(payload.accountId) ? payload.accountId : null;
  const client = getCaseLab3AdminClient() as unknown as KassirDatabase;
  if (!orderId && payload.invoiceId) {
    const order = await client
      .from("case_lab_3_orders")
      .select("id")
      .eq("environment", environment)
      .eq("order_number", payload.invoiceId)
      .maybeSingle();
    if (!order.error && isRecord(order.data) && uuid(order.data.id)) orderId = order.data.id;
  }
  if (!orderId) throw new KassirApiError("permanent");

  const operation = await findReceiptOperation(environment, payload, orderId);
  if (payload.type === "IncomeReturn" && !operation?.refundId) throw new KassirApiError("permanent");
  const rpc = client as unknown as RpcClient;
  const result = await rpc.rpc("case_lab_3_apply_receipt", {
    p_environment: environment,
    p_provider: "kassir",
    p_provider_event_id: context.providerEventId,
    p_body_hash: context.bodyHash,
    p_kassir_receipt_id: payload.id,
    p_operation_key: operation?.operationKey ?? null,
    p_order_id: operation?.orderId ?? orderId,
    p_refund_id: operation?.refundId ?? null,
    p_receipt_type: payload.type,
    p_receipt_status: "Processed",
    p_amount_minor: payload.amountMinor,
    p_receipt_url: payload.url,
    p_fiscal_fields: payload.fiscalFields,
    p_sanitized_fields: payload.sanitizedFields,
  });
  if (result.error || !isRecord(result.data) || (result.data.kind !== "accepted" && result.data.kind !== "review_required")) {
    throw new KassirApiError("retryable");
  }
  return result.data.kind === "accepted"
    ? { kind: "accepted", ...(typeof result.data.duplicate === "boolean" ? { duplicate: result.data.duplicate } : {}) }
    : { kind: "review_required" };
}

export function kassirSecret(environment: PaymentEnvironment): string {
  return getCaseLab3Config(environment).kassir.apiSecret;
}

export type KassirWebhookDependencies = {
  getSecret: (environment: PaymentEnvironment) => string;
  applyReceipt: (environment: PaymentEnvironment, payload: KassirReceiptPayload, context: KassirWebhookContext) => Promise<KassirTransitionResult>;
};

export async function handleSignedKassirReceipt(
  request: Request,
  environmentValue: string,
  dependencies: KassirWebhookDependencies,
): Promise<Response> {
  try {
    if (environmentValue !== "test" && environmentValue !== "live") return Response.json({ code: 20 });
    requireForm(request);
    const rawBody = await readBoundedBody(request, KASSIR_BODY_MAX_BYTES);
    const secret = dependencies.getSecret(environmentValue);
    if (!verifyProviderHmac(rawBody, request.headers, secret, "raw-body")) return Response.json({ code: 20 });
    const payload = parseReceiptForm(rawBody);
    const result = await dependencies.applyReceipt(environmentValue, payload, {
      environment: environmentValue,
      bodyHash: hashKassirBody(rawBody),
      providerEventId: `Receipt:${payload.id}`,
    });
    return result.kind === "accepted" || result.kind === "review_required"
      ? Response.json({ code: 0 })
      : Response.json({ code: 20 });
  } catch {
    return Response.json({ code: 20 });
  }
}
