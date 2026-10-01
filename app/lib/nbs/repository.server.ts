import "server-only";

import { createHmac } from "node:crypto";

import type { NbsAnswerSet, NbsEnvironment, NbsParticipantState, NbsReport, NbsRunState, NbsScreenReport } from "./contracts";
import { NBS_QUESTIONS } from "./questions";
import type { NbsAdminClient } from "./db.server";
import { toFullReport, toScreenReport } from "./report";
import { verifyNbsSession, type NbsSession } from "./session.server";

type NbsRunRow = {
  id: string;
  environment: NbsEnvironment;
  forum_name: string;
  question_set_version: string;
  questions: unknown;
  state: NbsRunState;
  state_version: number;
  started_at: string | null;
  closed_at: string | null;
  snapshot_version: number | null;
  snapshot_hash: string | null;
  snapshot_response_count: number | null;
  published_report_id: string | null;
  created_at: string;
};
type NbsParticipantRow = {
  id: string;
  environment: NbsEnvironment;
  run_id: string;
  first_name: string;
  last_name: string;
  session_token_version: number;
  registered_at: string;
  submitted_at: string | null;
};

export class NbsRepositoryError extends Error {
  constructor(readonly code: "not_found" | "conflict" | "closed" | "unauthorized" | "invalid_input" | "rate_limited") {
    super(code);
    this.name = "NbsRepositoryError";
  }
}

function raiseRpcError(error: { code?: string; message?: string }): never {
  if (error.code === "23505" || error.message === "nbs_conflict") throw new NbsRepositoryError("conflict");
  if (error.message === "nbs_not_found") throw new NbsRepositoryError("not_found");
  if (error.message === "nbs_closed") throw new NbsRepositoryError("closed");
  if (error.message === "nbs_unauthorized") throw new NbsRepositoryError("unauthorized");
  if (error.message === "nbs_invalid_input" || error.code === "22023") throw new NbsRepositoryError("invalid_input");
  throw new Error("NBS database operation failed");
}

export function hashNbsRequest(value: unknown, secret: string): string {
  return createHmac("sha256", secret)
    .update(JSON.stringify(value), "utf8")
    .digest("hex");
}

export function hashNbsRateLimitSubject(environment: NbsEnvironment, key: string, secret: string): string {
  return createHmac("sha256", secret).update("nbs-rate-limit\0" + environment + "\0" + key, "utf8").digest("hex");
}

export async function getNbsCommandReplay(
  db: NbsAdminClient,
  environment: NbsEnvironment,
  runId: string,
  operation: "register" | "submit",
  idempotencyKey: string,
  requestBody: unknown,
  tokenSecret: string,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db.from("nbs_forum_commands").select("request_hash,result")
    .eq("environment", environment).eq("run_id", runId).eq("operation", operation)
    .eq("idempotency_key", idempotencyKey).maybeSingle();
  if (error) raiseRpcError(error);
  if (!data) return null;
  if (data.request_hash !== hashNbsRequest(requestBody, tokenSecret)) throw new NbsRepositoryError("conflict");
  if (!data.result || typeof data.result !== "object" || Array.isArray(data.result)) throw new Error("NBS replay record is invalid");
  return data.result as Record<string, unknown>;
}

export async function consumeNbsRateLimit(
  db: NbsAdminClient,
  environment: NbsEnvironment,
  key: string,
  purpose: "registration" | "submission",
  secret: string,
): Promise<void> {
  const { data, error } = await db.rpc("case_lab_3_consume_rate_limit", {
    p_scope: "nbs-" + purpose + "-" + environment,
    p_purpose_ip_hash: hashNbsRateLimitSubject(environment, key, secret),
    p_limit_count: 10,
    p_bucket_seconds: 60,
  });
  if (error) raiseRpcError(error);
  if (!data || typeof data !== "object" || Array.isArray(data) || !("allowed" in data) || data.allowed !== true) {
    throw new NbsRepositoryError("rate_limited");
  }
}

export async function getNbsRun(db: NbsAdminClient, environment: NbsEnvironment, runId?: string): Promise<NbsRunRow> {
  let query = db.from("nbs_forum_runs").select("*").eq("environment", environment);
  if (runId) query = query.eq("id", runId);
  const { data, error } = await query.maybeSingle();
  if (error) raiseRpcError(error);
  if (!data) throw new NbsRepositoryError("not_found");
  return data as NbsRunRow;
}

export async function getNbsParticipant(
  db: NbsAdminClient,
  environment: NbsEnvironment,
  runId: string,
  participantId: string,
): Promise<NbsParticipantRow> {
  const { data, error } = await db.from("nbs_forum_participants")
    .select("id,environment,run_id,first_name,last_name,session_token_version,registered_at,submitted_at")
    .eq("environment", environment).eq("run_id", runId).eq("id", participantId).maybeSingle();
  if (error) raiseRpcError(error);
  if (!data) throw new NbsRepositoryError("unauthorized");
  return data as NbsParticipantRow;
}

export async function registerNbsParticipant(
  db: NbsAdminClient,
  environment: NbsEnvironment,
  input: { runId: string; firstName: string; lastName: string },
  idempotencyKey: string,
  tokenSecret: string,
): Promise<{ participantId: string; version: number; replayed: boolean }> {
  const requestHash = hashNbsRequest(input, tokenSecret);
  const { data, error } = await db.rpc("nbs_forum_register_participant", {
    p_environment: environment,
    p_run_id: input.runId,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
  });
  if (error) raiseRpcError(error);
  if (!data || typeof data !== "object" || Array.isArray(data) || !("participantId" in data) || typeof data.participantId !== "string") {
    throw new Error("NBS participant registration result is invalid");
  }
  return {
    participantId: data.participantId,
    version: "version" in data && typeof data.version === "number" ? data.version : 1,
    replayed: "replayed" in data && data.replayed === true,
  };
}

export async function submitNbsResponses(
  db: NbsAdminClient,
  environment: NbsEnvironment,
  session: NbsSession,
  answers: NbsAnswerSet,
  idempotencyKey: string,
  tokenSecret: string,
): Promise<{ replayed: boolean }> {
  const requestHash = hashNbsRequest({ runId: session.runId, answers }, tokenSecret);
  const { data, error } = await db.rpc("nbs_forum_submit_responses", {
    p_environment: environment,
    p_run_id: session.runId,
    p_participant_id: session.participantId,
    p_answers: { "1": answers[1], "2": answers[2], "3": answers[3] },
    p_idempotency_key: idempotencyKey,
    p_request_hash: requestHash,
  });
  if (error) raiseRpcError(error);
  return { replayed: !!data && typeof data === "object" && !Array.isArray(data) && "replayed" in data && data.replayed === true };
}

export async function loadNbsParticipantState(
  db: NbsAdminClient,
  environment: NbsEnvironment,
  session: NbsSession | null,
  tokenSecret: string,
): Promise<NbsParticipantState> {
  const run = await getNbsRun(db, environment, session?.runId);
  const participant = session ? await getNbsParticipant(db, environment, run.id, session.participantId) : null;
  if (session && participant && !verifyNbsSession(session, environment, participant, tokenSecret)) {
    throw new NbsRepositoryError("unauthorized");
  }
  const answers: NbsAnswerSet = { 1: "", 2: "", 3: "" };
  if (participant?.submitted_at) {
    const { data, error } = await db.from("nbs_forum_responses")
      .select("question_number,answer_text")
      .eq("environment", environment).eq("run_id", run.id).eq("participant_id", participant.id);
    if (error) raiseRpcError(error);
    for (const row of data ?? []) {
      if (row.question_number === 1 || row.question_number === 2 || row.question_number === 3) {
        answers[row.question_number] = row.answer_text;
      }
    }
  }
  const displayName = participant ? participant.first_name + " " + participant.last_name : "";
  return {
    runId: run.id,
    state: run.state,
    questions: NBS_QUESTIONS.map((question) => ({ number: question.number, text: question.text })),
    participant: participant ? { displayName, submitted: participant.submitted_at !== null, answers } : null,
  };
}

export async function loadNbsOperatorSnapshot(
  db: NbsAdminClient,
  environment: NbsEnvironment,
): Promise<Record<string, unknown>> {
  const run = await getNbsRun(db, environment);
  const [participantCount, submissionCount, responseCounts, jobs] = await Promise.all([
    db.from("nbs_forum_participants").select("id", { count: "exact", head: true }).eq("environment", environment).eq("run_id", run.id),
    db.from("nbs_forum_participants").select("id", { count: "exact", head: true }).eq("environment", environment).eq("run_id", run.id).not("submitted_at", "is", null),
    db.from("nbs_forum_responses").select("question_number,answer_text").eq("environment", environment).eq("run_id", run.id),
    db.from("nbs_forum_jobs").select("job_type,question_number,status,error_category").eq("environment", environment).eq("run_id", run.id),
  ]);
  for (const result of [participantCount, submissionCount, responseCounts, jobs]) if (result.error) raiseRpcError(result.error);
  const nonempty = [1, 2, 3].map((question) => ({
    questionNumber: question,
    count: (responseCounts.data ?? []).filter((row) => row.question_number === question && row.answer_text.trim().length > 0).length,
  }));
  return {
    runId: run.id,
    state: run.state,
    stateVersion: run.state_version,
    startedAt: run.started_at,
    closedAt: run.closed_at,
    participants: participantCount.count ?? 0,
    submissions: submissionCount.count ?? 0,
    nonemptyAnswers: nonempty,
    jobs: jobs.data ?? [],
    publishedReportId: run.published_report_id,
  };
}

export async function loadNbsPublicResults(
  db: NbsAdminClient,
  environment: NbsEnvironment,
  view: "screen" | "full",
): Promise<{ status: NbsRunState; view: "screen" | "full"; report: NbsScreenReport | NbsReport | null }> {
  const run = await getNbsRun(db, environment);
  if (run.state !== "published" || !run.published_report_id) return { status: run.state, view, report: null };
  const { data, error } = await db.from("nbs_forum_reports").select("report")
    .eq("environment", environment).eq("id", run.published_report_id).eq("run_id", run.id).maybeSingle();
  if (error) raiseRpcError(error);
  if (!data || !data.report || typeof data.report !== "object" || Array.isArray(data.report)) {
    throw new Error("NBS report is unavailable");
  }
  const report = data.report as unknown as NbsReport;
  return { status: "published", view, report: view === "screen" ? toScreenReport(report) : toFullReport(report) };
}
