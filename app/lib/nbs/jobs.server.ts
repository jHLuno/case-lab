import "server-only";

import { randomUUID } from "node:crypto";

import type { Json } from "@/lib/case-lab-3/database.types";
import type { NbsClaimedJob, NbsEnvironment, NbsModelMetadata } from "./contracts";
import type { NbsAdminClient } from "./db.server";

const JOB_TYPES = new Set<NbsClaimedJob["jobType"]>(["question_cluster", "question_report", "forum_summary"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rpcData(data: unknown, error: unknown): unknown {
  if (error || data === undefined) throw new Error("NBS worker database operation failed");
  return data;
}

function parseClaimedJob(value: unknown, environment: NbsEnvironment): NbsClaimedJob | null {
  if (value === null) return null;
  if (!isRecord(value)) throw new Error("NBS worker database returned invalid job data");
  const questionNumber = value.questionNumber;
  const jobType = value.jobType;
  if (typeof value.jobId !== "string" || !UUID_PATTERN.test(value.jobId)
      || typeof value.runId !== "string" || !UUID_PATTERN.test(value.runId)
      || value.environment !== environment || !Number.isSafeInteger(value.snapshotVersion) || Number(value.snapshotVersion) < 1
      || typeof jobType !== "string" || !JOB_TYPES.has(jobType as NbsClaimedJob["jobType"])
      || (questionNumber !== null && questionNumber !== 1 && questionNumber !== 2 && questionNumber !== 3)
      || (jobType === "forum_summary" ? questionNumber !== null : questionNumber === null)
      || !Number.isSafeInteger(value.attemptCount) || Number(value.attemptCount) < 1 || Number(value.attemptCount) > 3
      || typeof value.leaseToken !== "string" || !UUID_PATTERN.test(value.leaseToken)
      || typeof value.leasedUntil !== "string" || !Number.isFinite(Date.parse(value.leasedUntil))) {
    throw new Error("NBS worker database returned invalid job data");
  }
  return {
    jobId: value.jobId,
    runId: value.runId,
    environment,
    snapshotVersion: Number(value.snapshotVersion),
    jobType: jobType as NbsClaimedJob["jobType"],
    questionNumber: questionNumber as NbsClaimedJob["questionNumber"],
    attemptCount: Number(value.attemptCount),
    leaseToken: value.leaseToken,
    leasedUntil: value.leasedUntil,
  };
}

export async function claimNbsJob(
  db: NbsAdminClient,
  environment: NbsEnvironment,
): Promise<NbsClaimedJob | null> {
  const { data, error } = await db.rpc("nbs_forum_claim_job", {
    p_environment: environment,
    p_worker_id: "nbs-worker-" + randomUUID(),
  });
  return parseClaimedJob(rpcData(data, error), environment);
}

function mutationKind(value: unknown): "completed" | "retried" | "failed" | "lease_lost" {
  if (!isRecord(value)) throw new Error("NBS worker database returned invalid mutation");
  if (value.kind === "completed") return "completed";
  if (value.kind === "retried") return "retried";
  if (value.kind === "failed") return "failed";
  if (value.kind === "unknown") return "lease_lost";
  throw new Error("NBS worker database returned invalid mutation");
}

export async function completeNbsJob(
  db: NbsAdminClient,
  job: NbsClaimedJob,
  result: unknown,
  metadata: NbsModelMetadata,
): Promise<"completed" | "lease_lost"> {
  const { data, error } = await db.rpc("nbs_forum_complete_job", {
    p_environment: job.environment,
    p_job_id: job.jobId,
    p_lease_token: job.leaseToken,
    p_result: result as Json,
    p_model_metadata: metadata as unknown as Json,
  });
  const kind = mutationKind(rpcData(data, error));
  if (kind === "completed" || kind === "lease_lost") return kind;
  throw new Error("NBS worker database returned invalid completion");
}

export async function failNbsJob(
  db: NbsAdminClient,
  job: NbsClaimedJob,
  errorCategory: string,
): Promise<"retried" | "failed" | "lease_lost"> {
  const category = /^[a-z_]{1,64}$/u.test(errorCategory) ? errorCategory : "worker_error";
  const { data, error } = await db.rpc("nbs_forum_fail_job", {
    p_environment: job.environment,
    p_job_id: job.jobId,
    p_lease_token: job.leaseToken,
    p_error_category: category,
  });
  const kind = mutationKind(rpcData(data, error));
  if (kind === "retried" || kind === "failed" || kind === "lease_lost") return kind;
  throw new Error("NBS worker database returned invalid failure state");
}

export async function dispatchNbsJobs(db: NbsAdminClient, environment: NbsEnvironment): Promise<number> {
  const { data, error } = await db.rpc("nbs_forum_dispatch_jobs", { p_environment: environment });
  const value = rpcData(data, error);
  if (!isRecord(value) || !Number.isSafeInteger(value.dispatched) || Number(value.dispatched) < 0) {
    throw new Error("NBS worker database returned invalid dispatch state");
  }
  return Number(value.dispatched);
}
