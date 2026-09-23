import type { LiveParticipantClaimInput, LiveSubmissionInput } from "./contracts";

const CLAIM_FIELDS = new Set(["firstName", "lastName", "ticketNumber"]);
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
  field: "firstName" | "lastName",
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

export function normalizeParticipantLookupName(value: string): string {
  return normalizedText(value).toLocaleLowerCase("ru-RU").replaceAll("ё", "е");
}

export function formatPublicDisplayName(firstName: string, lastName: string): string {
  const normalizedFirstName = normalizedText(firstName);
  const normalizedLastName = normalizedText(lastName);
  const initial = Array.from(normalizedLastName)[0];
  if (!normalizedFirstName || !initial) {
    throw new TypeError("First name and last name are required");
  }
  return `${normalizedFirstName} ${initial.toLocaleUpperCase("ru-RU")}.`;
}

export function parseParticipantClaim(value: unknown): LiveParticipantClaimInput {
  if (!isRecord(value)) {
    throw new LiveInputValidationError([{ field: "input", code: "invalid_type" }]);
  }

  const issues: LiveValidationIssue[] = [];
  addUnknownFields(value, CLAIM_FIELDS, issues);
  const firstName = parseName(value, "firstName", issues);
  const lastName = parseName(value, "lastName", issues);
  let ticketNumber: string | null = null;

  if (value.ticketNumber !== undefined && value.ticketNumber !== null && value.ticketNumber !== "") {
    if (typeof value.ticketNumber !== "string") {
      issues.push({ field: "ticketNumber", code: "invalid_type" });
    } else {
      if (CONTROL_CHARACTER_PATTERN.test(value.ticketNumber)) {
        issues.push({ field: "ticketNumber", code: "control_character" });
      }
      ticketNumber = normalizedText(value.ticketNumber);
      const length = characterLength(ticketNumber);
      if (length === 0) {
        ticketNumber = null;
      } else if (length > 100) {
        issues.push({ field: "ticketNumber", code: "too_long" });
      }
    }
  }

  if (issues.length > 0) {
    throw new LiveInputValidationError(issues);
  }
  return { firstName, lastName, ticketNumber };
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
  } else if (length > 350) {
    issues.push({ field: "answer", code: "too_long" });
  }

  if (issues.length > 0) {
    throw new LiveInputValidationError(issues);
  }
  return { answer, mode: mode ?? "manual" };
}
