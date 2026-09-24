import type { LiveParticipantClaimInput, LiveSubmissionInput } from "./contracts";

const CLAIM_FIELDS = new Set(["firstName", "lastName", "middleName"]);
const SUBMISSION_FIELDS = new Set(["answer", "mode"]);
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f-\u009f]/u;
const WHITESPACE_PATTERN = /\s+/gu;

export type LiveValidationIssue = {
  field: string;
  code:
    | "invalid_type"
    | "required"
    | "too_short"
    | "too_long"
    | "control_character"
    | "unknown_field";
};

export class LiveInputValidationError extends Error {
  readonly code = "invalid_live_input" as const;
  readonly issues: readonly LiveValidationIssue[];

  constructor(issues: readonly LiveValidationIssue[]) {
    super("Live interaction input is invalid");
    this.name = "LiveInputValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizedText(value: string): string {
  return value.normalize("NFC").trim().replace(WHITESPACE_PATTERN, " ");
}

function characterLength(value: string): number {
  return Array.from(value).length;
}

function addUnknownFields(
  record: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  issues: LiveValidationIssue[],
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      issues.push({ field: key, code: "unknown_field" });
    }
  }
}

function parseName(
  record: Record<string, unknown>,
  field: "firstName" | "lastName" | "middleName",
  issues: LiveValidationIssue[],
): string {
  const value = record[field];
  if (typeof value !== "string") {
    issues.push({ field, code: value === undefined ? "required" : "invalid_type" });
    return "";
  }
  if (CONTROL_CHARACTER_PATTERN.test(value)) {
    issues.push({ field, code: "control_character" });
  }

  const normalized = normalizedText(value);
  const length = characterLength(normalized);
  if (length === 0) {
    issues.push({ field, code: "required" });
  } else if (length > 100) {
    issues.push({ field, code: "too_long" });
  }
  return normalized;
}

function parseOptionalName(
  record: Record<string, unknown>,
  field: "middleName",
  issues: LiveValidationIssue[],
): string | undefined {
  if (!Object.prototype.hasOwnProperty.call(record, field)) return undefined;
  return parseName(record, field, issues);
}

export function normalizeParticipantLookupName(value: string): string {
  return normalizedText(value).toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

export function formatPublicDisplayName(firstName: string, lastName: string): string {
  const normalizedFirstName = normalizedText(firstName);
  const normalizedLastName = normalizedText(lastName);
  if (!normalizedFirstName || !normalizedLastName) {
    throw new TypeError("First name and last name are required");
  }
  return `${normalizedFirstName} ${normalizedLastName}`;
}

export function parseParticipantClaim(value: unknown): LiveParticipantClaimInput {
  if (!isRecord(value)) {
    throw new LiveInputValidationError([{ field: "input", code: "invalid_type" }]);
  }

  const issues: LiveValidationIssue[] = [];
  addUnknownFields(value, CLAIM_FIELDS, issues);
  const firstName = parseName(value, "firstName", issues);
  const lastName = parseName(value, "lastName", issues);
  const middleName = parseOptionalName(value, "middleName", issues);

  if (issues.length > 0) {
    throw new LiveInputValidationError(issues);
  }
  return middleName === undefined
    ? { firstName, lastName }
    : { firstName, lastName, middleName };
}

export function parseSubmission(value: unknown): LiveSubmissionInput {
  if (!isRecord(value)) {
    throw new LiveInputValidationError([{ field: "input", code: "invalid_type" }]);
  }

  const issues: LiveValidationIssue[] = [];
  addUnknownFields(value, SUBMISSION_FIELDS, issues);
  const rawAnswer = value.answer;
  if (typeof rawAnswer !== "string") {
    issues.push({ field: "answer", code: rawAnswer === undefined ? "required" : "invalid_type" });
    throw new LiveInputValidationError(issues);
  }
  if (CONTROL_CHARACTER_PATTERN.test(rawAnswer)) {
    issues.push({ field: "answer", code: "control_character" });
  }

  const answer = rawAnswer.normalize("NFC").trim();
  const mode = value.mode === undefined
    ? "manual"
    : value.mode === "timeout" || value.mode === "manual"
      ? value.mode
      : null;
  if (mode === null) issues.push({ field: "mode", code: "invalid_type" });
  const length = characterLength(answer);
  if (mode === "timeout" ? length < 1 : length < 30) {
    issues.push({ field: "answer", code: "too_short" });
  } else if (length > 200) {
    issues.push({ field: "answer", code: "too_long" });
  }

  if (issues.length > 0) {
    throw new LiveInputValidationError(issues);
  }
  return { answer, mode: mode ?? "manual" };
}
