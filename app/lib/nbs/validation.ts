import type { NbsRegistrationInput, NbsRunCommand, NbsSubmissionInput } from "./contracts";
import { answerLength, normalizeAnswer, normalizeParticipantName, participantNameLength } from "./text";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u;
const ANSWER_KEYS = new Set(["1", "2", "3"]);

export type NbsValidationIssue = {
  field: string;
  code: "invalid_type" | "required" | "too_long" | "control_character" | "unknown_field" | "invalid_value";
};

export class NbsInputValidationError extends Error {
  readonly code = "invalid_nbs_input" as const;
  readonly issues: readonly NbsValidationIssue[];

  constructor(issues: readonly NbsValidationIssue[]) {
    super("NBS input is invalid");
    this.name = "NbsInputValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addUnknownFields(record: Record<string, unknown>, allowed: ReadonlySet<string>, issues: NbsValidationIssue[]) {
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) issues.push({ field: key, code: "unknown_field" });
  }
}

function parseRunId(value: unknown, issues: NbsValidationIssue[]): string {
  if (typeof value !== "string") {
    issues.push({ field: "runId", code: value === undefined ? "required" : "invalid_type" });
    return "";
  }
  if (!UUID_PATTERN.test(value)) issues.push({ field: "runId", code: "invalid_value" });
  return value.toLowerCase();
}

function parseName(record: Record<string, unknown>, field: "firstName" | "lastName", issues: NbsValidationIssue[]): string {
  const value = record[field];
  if (typeof value !== "string") {
    issues.push({ field, code: value === undefined ? "required" : "invalid_type" });
    return "";
  }
  if (CONTROL_CHARACTER_PATTERN.test(value)) issues.push({ field, code: "control_character" });
  const normalized = normalizeParticipantName(value);
  const length = participantNameLength(normalized);
  if (length === 0) issues.push({ field, code: "required" });
  else if (length > 100) issues.push({ field, code: "too_long" });
  return normalized;
}

export function parseNbsRegistration(value: unknown): NbsRegistrationInput {
  if (!isRecord(value)) throw new NbsInputValidationError([{ field: "input", code: "invalid_type" }]);
  const issues: NbsValidationIssue[] = [];
  addUnknownFields(value, new Set(["runId", "firstName", "lastName"]), issues);
  const runId = parseRunId(value.runId, issues);
  const firstName = parseName(value, "firstName", issues);
  const lastName = parseName(value, "lastName", issues);
  if (issues.length) throw new NbsInputValidationError(issues);
  return { runId, firstName, lastName };
}

export function parseNbsSubmission(value: unknown): NbsSubmissionInput {
  if (!isRecord(value)) throw new NbsInputValidationError([{ field: "input", code: "invalid_type" }]);
  const issues: NbsValidationIssue[] = [];
  addUnknownFields(value, new Set(["runId", "answers"]), issues);
  const runId = parseRunId(value.runId, issues);

  if (!isRecord(value.answers)) {
    issues.push({ field: "answers", code: value.answers === undefined ? "required" : "invalid_type" });
    throw new NbsInputValidationError(issues);
  }
  addUnknownFields(value.answers, ANSWER_KEYS, issues);

  const answers: Record<"1" | "2" | "3", string> = { "1": "", "2": "", "3": "" };
  let hasNonEmptyAnswer = false;
  for (const key of ["1", "2", "3"] as const) {
    const rawAnswer = value.answers[key];
    if (typeof rawAnswer !== "string") {
      issues.push({ field: `answers.${key}`, code: rawAnswer === undefined ? "required" : "invalid_type" });
      continue;
    }
    const normalized = normalizeAnswer(rawAnswer);
    if (CONTROL_CHARACTER_PATTERN.test(normalized)) issues.push({ field: `answers.${key}`, code: "control_character" });
    if (answerLength(normalized) > 200) issues.push({ field: `answers.${key}`, code: "too_long" });
    answers[key] = normalized;
    if (normalized.trim().length > 0) hasNonEmptyAnswer = true;
  }
  if (!hasNonEmptyAnswer) issues.push({ field: "answers", code: "required" });
  if (issues.length) throw new NbsInputValidationError(issues);
  return { runId, answers: { 1: answers["1"], 2: answers["2"], 3: answers["3"] } };
}

export function parseNbsRunCommand(value: unknown): NbsRunCommand {
  if (!isRecord(value)) throw new NbsInputValidationError([{ field: "input", code: "invalid_type" }]);
  const issues: NbsValidationIssue[] = [];
  addUnknownFields(value, new Set(["runId", "expectedVersion"]), issues);
  const runId = parseRunId(value.runId, issues);
  const expectedVersion = value.expectedVersion;
  if (typeof expectedVersion !== "number" || !Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    issues.push({ field: "expectedVersion", code: expectedVersion === undefined ? "required" : "invalid_value" });
  }
  if (issues.length) throw new NbsInputValidationError(issues);
  return { runId, expectedVersion: expectedVersion as number };
}
