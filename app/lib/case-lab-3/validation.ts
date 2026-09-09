import type { OrderInput, TicketTier } from "./contracts";

const MAX_LENGTHS = {
  firstName: 100,
  lastName: 100,
  email: 254,
  phone: 32,
  company: 200,
  position: 200,
  offerVersionId: 100,
  privacyVersionId: 100,
  attributionValue: 512,
  gaClientId: 128,
} as const;

const ORDER_FIELDS = new Set([
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
  "position",
  "expectedTier",
  "expectedAmountMinor",
  "offerVersionId",
  "privacyVersionId",
  "acceptedTerms",
  "marketingConsent",
  "attribution",
]);

const ATTRIBUTION_FIELDS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "referrer",
  "ga_client_id",
]);

const TICKET_TIERS = new Set<TicketTier>(["early_bird", "standard"]);

export type ValidationIssue = {
  field: string;
  code: "invalid_type" | "required" | "must_accept" | "too_long" | "invalid_email" | "invalid_phone" | "invalid_enum" | "invalid_money" | "invalid_version_id" | "invalid_ga_client_id" | "unknown_field";
};

export class OrderInputValidationError extends Error {
  readonly code = "invalid_order_input" as const;
  readonly issues: readonly ValidationIssue[];

  constructor(issues: readonly ValidationIssue[]) {
    super("Order input is invalid");
    this.name = "OrderInputValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addUnknownFields(record: Record<string, unknown>, allowed: ReadonlySet<string>, issues: ValidationIssue[], prefix = ""): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      issues.push({ field: prefix ? `${prefix}.${key}` : key, code: "unknown_field" });
    }
  }
}

function parseRequiredText(
  record: Record<string, unknown>,
  field: "firstName" | "lastName" | "email",
  maxLength: number,
  issues: ValidationIssue[],
): string {
  const value = record[field];
  if (typeof value !== "string") {
    issues.push({ field, code: value === undefined ? "required" : "invalid_type" });
    return "";
  }

  const normalized = value.trim();
  if (normalized.length === 0) {
    issues.push({ field, code: "required" });
  } else if (normalized.length > maxLength) {
    issues.push({ field, code: "too_long" });
  }

  return normalized;
}

function parseOptionalText(
  record: Record<string, unknown>,
  field: "company" | "position",
  maxLength: number,
  issues: ValidationIssue[],
): string | null {
  const value = record[field];
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    issues.push({ field, code: "invalid_type" });
    return null;
  }

  const normalized = value.trim();
  if (normalized.length > maxLength) {
    issues.push({ field, code: "too_long" });
  }

  return normalized || null;
}

function parseEmail(record: Record<string, unknown>, issues: ValidationIssue[]): string {
  const email = parseRequiredText(record, "email", MAX_LENGTHS.email, issues).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) {
    issues.push({ field: "email", code: "invalid_email" });
  }
  return email;
}

function parsePhone(record: Record<string, unknown>, issues: ValidationIssue[]): string | null {
  const value = record.phone;
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string") {
    issues.push({ field: "phone", code: "invalid_type" });
    return null;
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    return null;
  }
  if (trimmed.length > MAX_LENGTHS.phone || !/^\+?[0-9\s().-]+$/u.test(trimmed)) {
    issues.push({ field: "phone", code: trimmed.length > MAX_LENGTHS.phone ? "too_long" : "invalid_phone" });
    return null;
  }

  const digits = trimmed.replace(/[\s().-]/gu, "");
  if (!/^\+?\d+$/u.test(digits)) {
    issues.push({ field: "phone", code: "invalid_phone" });
    return null;
  }

  const hasPlusPrefix = digits.startsWith("+");
  const withoutPlus = digits.startsWith("+") ? digits.slice(1) : digits;
  if (withoutPlus.length === 10 && !hasPlusPrefix) {
    return `+7${withoutPlus}`;
  }
  if (
    withoutPlus.length === 11 &&
    (withoutPlus.startsWith("7") || (withoutPlus.startsWith("8") && !hasPlusPrefix))
  ) {
    return `+7${withoutPlus.slice(1)}`;
  }

  issues.push({ field: "phone", code: "invalid_phone" });
  return null;
}

function parseTier(record: Record<string, unknown>, issues: ValidationIssue[]): TicketTier {
  const value = record.expectedTier;
  if (typeof value !== "string" || !TICKET_TIERS.has(value as TicketTier)) {
    issues.push({ field: "expectedTier", code: typeof value === "string" ? "invalid_enum" : "invalid_type" });
    return "early_bird";
  }
  return value as TicketTier;
}

function parseMoney(record: Record<string, unknown>, issues: ValidationIssue[]): number {
  const value = record.expectedAmountMinor;
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    issues.push({ field: "expectedAmountMinor", code: "invalid_money" });
    return 0;
  }
  return value as number;
}

function parseVersionId(
  record: Record<string, unknown>,
  field: "offerVersionId" | "privacyVersionId",
  issues: ValidationIssue[],
): string {
  const value = record[field];
  const prefix = field === "offerVersionId" ? "offer" : "privacy";
  if (typeof value !== "string") {
    issues.push({ field, code: "invalid_version_id" });
    return "";
  }

  const normalized = value.trim();
  const pattern = new RegExp(`^${prefix}-[a-z0-9]+(?:-[a-z0-9]+)*$`, "u");
  if (normalized.length > MAX_LENGTHS[field] || !pattern.test(normalized)) {
    issues.push({ field, code: "invalid_version_id" });
  }
  return normalized;
}

function parseAttribution(record: Record<string, unknown>, issues: ValidationIssue[]): Record<string, string> {
  const value = record.attribution;
  if (!isRecord(value)) {
    issues.push({ field: "attribution", code: value === undefined ? "required" : "invalid_type" });
    return {};
  }

  addUnknownFields(value, ATTRIBUTION_FIELDS, issues, "attribution");
  const attribution: Record<string, string> = {};
  for (const key of Object.keys(value)) {
    if (!ATTRIBUTION_FIELDS.has(key)) {
      continue;
    }
    const item = value[key];
    if (typeof item !== "string") {
      issues.push({ field: `attribution.${key}`, code: "invalid_type" });
      continue;
    }
    const normalized = item.trim();
    if (normalized.length > MAX_LENGTHS.attributionValue) {
      issues.push({ field: `attribution.${key}`, code: "too_long" });
    }
    if (key === "ga_client_id" && (normalized.length > MAX_LENGTHS.gaClientId || !/^\d+\.\d+$/u.test(normalized))) {
      issues.push({ field: "attribution.ga_client_id", code: "invalid_ga_client_id" });
    }
    attribution[key] = normalized;
  }

  return attribution;
}

export function parseOrderInput(value: unknown): OrderInput {
  if (!isRecord(value)) {
    throw new OrderInputValidationError([{ field: "input", code: "invalid_type" }]);
  }

  const issues: ValidationIssue[] = [];
  addUnknownFields(value, ORDER_FIELDS, issues);

  const firstName = parseRequiredText(value, "firstName", MAX_LENGTHS.firstName, issues);
  const lastName = parseRequiredText(value, "lastName", MAX_LENGTHS.lastName, issues);
  const email = parseEmail(value, issues);
  const phone = parsePhone(value, issues);
  const company = parseOptionalText(value, "company", MAX_LENGTHS.company, issues);
  const position = parseOptionalText(value, "position", MAX_LENGTHS.position, issues);
  const expectedTier = parseTier(value, issues);
  const expectedAmountMinor = parseMoney(value, issues);
  const offerVersionId = parseVersionId(value, "offerVersionId", issues);
  const privacyVersionId = parseVersionId(value, "privacyVersionId", issues);
  const acceptedTerms = value.acceptedTerms;
  if (acceptedTerms !== true) {
    issues.push({
      field: "acceptedTerms",
      code: acceptedTerms === undefined ? "required" : acceptedTerms === false ? "must_accept" : "invalid_type",
    });
  }
  const marketingConsent = value.marketingConsent;
  if (typeof marketingConsent !== "boolean") {
    issues.push({ field: "marketingConsent", code: marketingConsent === undefined ? "required" : "invalid_type" });
  }
  const attribution = parseAttribution(value, issues);

  if (issues.length > 0) {
    throw new OrderInputValidationError(issues);
  }

  return {
    firstName,
    lastName,
    email,
    phone,
    company,
    position,
    expectedTier,
    expectedAmountMinor,
    offerVersionId,
    privacyVersionId,
    acceptedTerms: true,
    marketingConsent: marketingConsent as boolean,
    attribution,
  };
}
