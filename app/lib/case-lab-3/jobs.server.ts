import "server-only";

import { getCaseLab3AdminClient } from "./supabase-admin.server";
import type { Json, JobRow } from "./database.types";
import type { PaymentEnvironment } from "./contracts";

export const MAX_JOBS_PER_INVOCATION = 5;
export const JOB_LEASE_MS = 2 * 60 * 1000;
export const WORKER_EXTERNAL_TIMEOUT_MS = 10 * 1000;
export const WORKER_TIME_BUDGET_MS = 45 * 1000;
export const JOB_IDEMPOTENCY_WINDOW_MS = 60 * 60 * 1000;

export type CaseLab3JobType = JobRow["job_type"];

export type ClaimedCaseLab3Job = {
  jobId: string;
  jobType: CaseLab3JobType;
  logicalKey: string;
  payloadReference: Json;
  orderId: string | null;
  ticketId: string | null;
  refundId: string | null;
  leaseToken: string;
  leasedUntil: string;
  attemptCount?: number;
};

export type JobMutationResult = {
  kind: "completed" | "retried" | "unknown";
  jobId?: string;
  delaySeconds?: number;
};

export type CaseLab3JobStore = {
  claimJobs(environment: PaymentEnvironment, workerId: string): Promise<ClaimedCaseLab3Job[]>;
  completeJob(environment: PaymentEnvironment, jobId: string, leaseToken: string, result: Json): Promise<JobMutationResult>;
  retryJob(environment: PaymentEnvironment, jobId: string, leaseToken: string, error: string, delaySeconds: number): Promise<JobMutationResult>;
  markJobUnknown(environment: PaymentEnvironment, jobId: string, leaseToken: string, error: string): Promise<JobMutationResult>;
  runMaintenance(environment: PaymentEnvironment): Promise<Json>;
  recordWorkerHeartbeat(environment: PaymentEnvironment): Promise<Json>;
  recordIncident?(environment: PaymentEnvironment, job: ClaimedCaseLab3Job, error: string): Promise<Json>;
};

type RpcClient = {
  rpc(name: string, args: Record<string, unknown>): Promise<{ data: unknown; error: unknown }>;
};

function rpcClient(): RpcClient {
  return getCaseLab3AdminClient() as unknown as RpcClient;
}

function environment(value: string): PaymentEnvironment {
  if (value !== "test" && value !== "live") throw new Error("Invalid worker environment");
  return value;
}

function boundedText(value: unknown, maxLength: number): string | null {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && !/[\u0000-\u001f\u007f]/u.test(value)
    ? value
    : null;
}

const JOB_TYPES = new Set<CaseLab3JobType>([
  "issue_fiscal_operation",
  "poll_receipt",
  "send_ticket_email",
  "send_refund_notification",
  "initiate_refund",
  "reconcile_payment",
  "send_analytics_event",
  "send_organizer_alert",
  "daily_provider_reconciliation",
]);

function claimedJob(value: unknown): ClaimedCaseLab3Job | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const jobId = boundedText(record.jobId ?? record.job_id, 128);
  const jobType = record.jobType ?? record.job_type;
  const logicalKey = boundedText(record.logicalKey ?? record.logical_key, 256);
  const leaseToken = boundedText(record.leaseToken ?? record.lease_token, 128);
  const leasedUntil = boundedText(record.leasedUntil ?? record.leased_until, 128);
  if (!jobId || typeof jobType !== "string" || !JOB_TYPES.has(jobType as CaseLab3JobType) || !logicalKey || !leaseToken || !leasedUntil) return null;
  return {
    jobId,
    jobType: jobType as CaseLab3JobType,
    logicalKey,
    payloadReference: (record.payloadReference ?? record.payload_reference ?? {}) as Json,
    orderId: boundedText(record.orderId ?? record.order_id, 128),
    ticketId: boundedText(record.ticketId ?? record.ticket_id, 128),
    refundId: boundedText(record.refundId ?? record.refund_id, 128),
    leaseToken,
    leasedUntil,
    ...(Number.isSafeInteger(record.attemptCount) ? { attemptCount: record.attemptCount as number } : {}),
  };
}

function rpcResult(data: unknown, error: unknown): Json {
  if (error || data === undefined) throw new Error("Worker database operation failed");
  return (data ?? {}) as Json;
}

export async function claimJobs(environmentValue: PaymentEnvironment, workerId: string): Promise<ClaimedCaseLab3Job[]> {
  const result = await rpcClient().rpc("case_lab_3_claim_jobs", {
    p_environment: environment(environmentValue),
    p_worker_id: boundedText(workerId, 128) ?? (() => { throw new Error("Invalid worker id"); })(),
  });
  if (result.error || !Array.isArray(result.data)) throw new Error("Worker database operation failed");
  const jobs = result.data.map(claimedJob);
  if (jobs.some((job) => job === null)) throw new Error("Worker database returned invalid job data");
  return jobs.filter((job): job is ClaimedCaseLab3Job => job !== null).slice(0, MAX_JOBS_PER_INVOCATION);
}

function safeErrorText(error: unknown): string {
  const source = error instanceof Error ? error.message : "Worker job failed";
  return source
    .replace(/[\u0000-\u001f\u007f]/gu, " ")
    .replace(/(?:rawbody|cardnumber|cvv|token|opaque-token|secret|password|authorization)\s*[:=]\s*[^\s,;}]+/giu, "[redacted]")
    .slice(0, 512)
    .trim() || "Worker job failed";
}

export function sanitizeJobError(error: unknown): string {
  return safeErrorText(error);
}

function mutation(value: unknown, expected: JobMutationResult["kind"]): JobMutationResult {
  if (!value || typeof value !== "object") throw new Error("Worker database returned invalid mutation");
  const record = value as Record<string, unknown>;
  if (record.kind !== expected) throw new Error("Worker database returned invalid mutation");
  return {
    kind: expected,
    ...(typeof record.jobId === "string" ? { jobId: record.jobId } : {}),
    ...(Number.isSafeInteger(record.delaySeconds) ? { delaySeconds: record.delaySeconds as number } : {}),
  };
}

export async function completeJob(environmentValue: PaymentEnvironment, jobId: string, leaseToken: string, result: Json): Promise<JobMutationResult> {
  const response = await rpcClient().rpc("case_lab_3_complete_job", {
    p_environment: environment(environmentValue),
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_result: result,
  });
  return mutation(rpcResult(response.data, response.error), "completed");
}

export async function retryJob(environmentValue: PaymentEnvironment, jobId: string, leaseToken: string, error: string, delaySeconds: number): Promise<JobMutationResult> {
  const response = await rpcClient().rpc("case_lab_3_retry_job", {
    p_environment: environment(environmentValue),
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_error: safeErrorText(error),
    p_delay_seconds: Math.max(0, Math.min(86400, Math.trunc(delaySeconds))),
  });
  return mutation(rpcResult(response.data, response.error), "retried");
}

export async function markJobUnknown(environmentValue: PaymentEnvironment, jobId: string, leaseToken: string, error: string): Promise<JobMutationResult> {
  const response = await rpcClient().rpc("case_lab_3_mark_job_unknown", {
    p_environment: environment(environmentValue),
    p_job_id: jobId,
    p_lease_token: leaseToken,
    p_error: safeErrorText(error),
  });
  return mutation(rpcResult(response.data, response.error), "unknown");
}

export async function runMaintenance(environmentValue: PaymentEnvironment): Promise<Json> {
  const response = await rpcClient().rpc("case_lab_3_run_maintenance", { p_environment: environment(environmentValue) });
  return rpcResult(response.data, response.error);
}

export async function recordWorkerHeartbeat(environmentValue: PaymentEnvironment): Promise<Json> {
  const response = await rpcClient().rpc("case_lab_3_record_worker_heartbeat", { p_environment: environment(environmentValue) });
  return rpcResult(response.data, response.error);
}

export type JobIncidentType = "overdue_receipt" | "overdue_email" | "reconciliation_mismatch" | "unknown_provider_result";

export function incidentTypeForJob(jobType: CaseLab3JobType): JobIncidentType | null {
  if (jobType === "issue_fiscal_operation" || jobType === "poll_receipt") return "overdue_receipt";
  if (jobType === "send_ticket_email" || jobType === "send_refund_notification" || jobType === "send_organizer_alert") return "overdue_email";
  if (jobType === "reconcile_payment" || jobType === "daily_provider_reconciliation") return "reconciliation_mismatch";
  if (jobType === "send_analytics_event") return null;
  return "unknown_provider_result";
}

export async function recordJobIncident(
  environmentValue: PaymentEnvironment,
  job: ClaimedCaseLab3Job,
  error: string,
): Promise<Json> {
  const type = incidentTypeForJob(job.jobType);
  if (!type) return {};

  const response = await rpcClient().rpc("case_lab_3_record_provider_conflict", {
    p_environment: environment(environmentValue),
    p_incident_type: type,
    p_order_id: job.orderId,
    p_payment_attempt_id: null,
    p_refund_id: job.refundId,
    p_summary: {
      reason: "job_unknown",
      jobId: job.jobId,
      logicalKey: job.logicalKey,
      error: safeErrorText(error),
    },
  });
  return rpcResult(response.data, response.error);
}

export class RetryableJobError extends Error {
  readonly kind = "retryable";

  constructor(message = "Temporary worker failure") {
    super(message);
    this.name = "RetryableJobError";
  }
}

export class UnknownJobError extends Error {
  readonly kind = "unknown";
  readonly uncertainSince: number | null;

  constructor(message = "Worker result is unknown", uncertainSince: number | null = null) {
    super(message);
    this.name = "UnknownJobError";
    this.uncertainSince = uncertainSince;
  }
}

export class PermanentJobError extends Error {
  readonly kind = "permanent";

  constructor(message = "Worker job cannot be completed") {
    super(message);
    this.name = "PermanentJobError";
  }
}

export type JobFailureDecision = "retry" | "unknown";

export function classifyJobError(error: unknown, now = Date.now()): JobFailureDecision {
  if (error instanceof RetryableJobError) return "retry";
  if (error instanceof UnknownJobError) {
    return error.uncertainSince !== null && now - error.uncertainSince < JOB_IDEMPOTENCY_WINDOW_MS ? "retry" : "unknown";
  }
  const failureKind = (error as { failureKind?: unknown } | null)?.failureKind;
  if (failureKind === "retryable") return "retry";
  if (failureKind === "unknown") {
    const uncertainSince = (error as { uncertainSince?: unknown }).uncertainSince;
    return typeof uncertainSince === "number" && now - uncertainSince < JOB_IDEMPOTENCY_WINDOW_MS ? "retry" : "unknown";
  }
  return "unknown";
}

export function retryDelaySeconds(attemptCount: number): number {
  const attempt = Number.isSafeInteger(attemptCount) && attemptCount > 0 ? attemptCount : 1;
  return Math.min(3600, 60 * (2 ** Math.min(attempt - 1, 6)));
}

export function createCaseLab3JobStore(): CaseLab3JobStore {
  return { claimJobs, completeJob, retryJob, markJobUnknown, runMaintenance, recordWorkerHeartbeat, recordIncident: recordJobIncident };
}
