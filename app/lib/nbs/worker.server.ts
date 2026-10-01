import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type {
  NbsClaimedJob,
  NbsEnvironment,
  NbsModelMetadata,
  NbsQuestionNumber,
  NbsQuestionReport,
  NbsQuestionSnapshot,
  NbsValidatedClustering,
} from "./contracts";
import { NBS_QUESTIONS, NBS_QUESTION_SET_VERSION } from "./questions";
import { buildNbsEmptyQuestionReport, clusterNbsQuestion, generateNbsComparison, generateNbsQuestionTexts, sanitizeNbsAnswer } from "./analysis.server";
import { NbsAnalysisError } from "./openrouter.server";
import { buildNbsReport, buildQuestionReport, buildQuestionStats } from "./report";
import { getNbsAdminClient, type NbsAdminClient } from "./db.server";
import { claimNbsJob, completeNbsJob, dispatchNbsJobs, failNbsJob } from "./jobs.server";

type SnapshotRunRow = {
  id: string;
  environment: NbsEnvironment;
  state: string;
  question_set_version: string;
  snapshot_version: number | null;
  snapshot_hash: string | null;
  snapshot_response_count: number | null;
};

type SnapshotResponseRow = {
  id: string;
  participant_id: string;
  question_number: number;
  answer_text: string;
};
type SnapshotParticipantRow = { id: string; first_name: string; last_name: string };

const ZERO_METADATA = (promptVersion: string): NbsModelMetadata => ({
  requestedModels: [],
  servedModel: null,
  generationId: null,
  promptVersion,
  requestHash: "",
  latencyMs: 0,
  promptTokens: 0,
  completionTokens: 0,
  cost: null,
});

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function questionNumber(value: unknown): value is NbsQuestionNumber {
  return value === 1 || value === 2 || value === 3;
}

function snapshotDigest(rows: SnapshotResponseRow[]): string {
  const ordered = [...rows].sort((left, right) => left.question_number - right.question_number
    || (left.participant_id < right.participant_id ? -1 : left.participant_id > right.participant_id ? 1 : 0));
  const material = ordered.map((row) => `${row.question_number}:${row.participant_id}:${row.answer_text}`).join("\n");
  return createHash("sha256").update(material, "utf8").digest("hex");
}

async function loadQuestionSnapshot(
  db: NbsAdminClient,
  job: NbsClaimedJob,
  number: NbsQuestionNumber,
): Promise<NbsQuestionSnapshot> {
  const { data: rawRun, error: runError } = await db.from("nbs_forum_runs").select(
    "id,environment,state,question_set_version,snapshot_version,snapshot_hash,snapshot_response_count",
  ).eq("environment", job.environment).eq("id", job.runId).maybeSingle();
  if (runError || !rawRun) throw new Error("NBS snapshot is unavailable");
  const run = rawRun as unknown as SnapshotRunRow;
  if (run.state !== "analyzing" || run.snapshot_version !== job.snapshotVersion
      || run.question_set_version !== NBS_QUESTION_SET_VERSION || !run.snapshot_hash
      || !Number.isSafeInteger(run.snapshot_response_count) || (run.snapshot_response_count ?? -1) < 0) {
    throw new Error("NBS snapshot version mismatch");
  }

  const rows: SnapshotResponseRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("nbs_forum_responses")
      .select("id,participant_id,question_number,answer_text")
      .eq("environment", job.environment).eq("run_id", job.runId)
      .order("id", { ascending: true }).range(offset, offset + 499);
    if (error || !data) throw new Error("NBS snapshot is unavailable");
    rows.push(...data as unknown as SnapshotResponseRow[]);
    if (data.length < 500) break;
  }
  if (rows.length !== run.snapshot_response_count || snapshotDigest(rows) !== run.snapshot_hash
      || rows.some((row) => !questionNumber(row.question_number) || typeof row.id !== "string"
        || typeof row.participant_id !== "string" || typeof row.answer_text !== "string")) {
    throw new Error("NBS snapshot integrity check failed");
  }

  const participants: SnapshotParticipantRow[] = [];
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await db.from("nbs_forum_participants")
      .select("id,first_name,last_name")
      .eq("environment", job.environment).eq("run_id", job.runId)
      .order("id", { ascending: true }).range(offset, offset + 499);
    if (error || !data) throw new Error("NBS snapshot is unavailable");
    participants.push(...data as unknown as SnapshotParticipantRow[]);
    if (data.length < 500) break;
  }
  const participantsById = new Map(participants.map((participant) => [participant.id, [
    participant.first_name,
    participant.last_name,
    participant.first_name + " " + participant.last_name,
  ]]));

  const question = NBS_QUESTIONS.find((entry) => entry.number === number);
  if (!question) throw new Error("NBS question is unavailable");
  return {
    runId: job.runId,
    environment: job.environment,
    snapshotVersion: job.snapshotVersion,
    questionNumber: number,
    question: question.text,
    shortQuestion: question.shortText,
    answers: rows.filter((row) => row.question_number === number)
      .map((row) => ({ answerId: row.id, text: row.answer_text, redactions: participantsById.get(row.participant_id) ?? [] })),
  };
}

function parseStoredClustering(value: unknown): NbsValidatedClustering {
  if (!isRecord(value) || !Array.isArray(value.clusters) || !Array.isArray(value.excluded)) {
    throw new Error("NBS clustering result is invalid");
  }
  const clusters: NbsValidatedClustering["clusters"] = value.clusters.map((item) => {
    if (!isRecord(item) || typeof item.clusterId !== "string" || typeof item.title !== "string"
        || !Array.isArray(item.answerIds) || item.answerIds.some((id) => typeof id !== "string")) {
      throw new Error("NBS clustering result is invalid");
    }
    return { clusterId: item.clusterId, title: item.title, answerIds: item.answerIds as string[] };
  });
  const excluded: NbsValidatedClustering["excluded"] = value.excluded.map((item) => {
    if (!isRecord(item) || typeof item.answerId !== "string"
        || !["nonsense", "spam", "technical", "irrelevant", "unclear"].includes(String(item.reason))) {
      throw new Error("NBS clustering result is invalid");
    }
    return { answerId: item.answerId, reason: item.reason as NbsValidatedClustering["excluded"][number]["reason"] };
  });
  return { clusters, excluded };
}

async function loadCompletedJobResult(
  db: NbsAdminClient,
  job: NbsClaimedJob,
  type: NbsClaimedJob["jobType"],
  number: NbsQuestionNumber | null,
): Promise<unknown> {
  let query = db.from("nbs_forum_jobs").select("result,status")
    .eq("environment", job.environment).eq("run_id", job.runId).eq("snapshot_version", job.snapshotVersion)
    .eq("job_type", type).eq("status", "completed");
  query = number === null ? query.is("question_number", null) : query.eq("question_number", number);
  const { data, error } = await query.maybeSingle();
  if (error || !data || data.status !== "completed" || data.result === null) {
    throw new Error("NBS analysis dependency is unavailable");
  }
  return data.result;
}

function parseQuestionReport(value: unknown, expectedNumber?: NbsQuestionNumber): NbsQuestionReport {
  if (!isRecord(value) || !questionNumber(value.questionNumber)
      || (expectedNumber !== undefined && value.questionNumber !== expectedNumber)
      || typeof value.question !== "string" || typeof value.shortQuestion !== "string"
      || !Number.isSafeInteger(value.total) || !Number.isSafeInteger(value.valid) || !Number.isSafeInteger(value.ignored)
      || Number(value.total) < 0 || Number(value.valid) < 0 || Number(value.ignored) < 0
      || Number(value.valid) + Number(value.ignored) !== Number(value.total)
      || !Array.isArray(value.clusters) || value.clusters.length > 5
      || typeof value.conclusion !== "string" || value.conclusion.length > 600) {
    throw new Error("NBS question report is invalid");
  }
  const clusters = value.clusters.map((entry) => {
    if (!isRecord(entry) || typeof entry.title !== "string" || entry.title.length > 120
        || !Number.isSafeInteger(entry.count) || Number(entry.count) < 1
        || !Number.isSafeInteger(entry.percent) || Number(entry.percent) < 0 || Number(entry.percent) > 100
        || typeof entry.explanation !== "string" || entry.explanation.length > 300) {
      throw new Error("NBS question report is invalid");
    }
    return {
      title: entry.title,
      count: Number(entry.count),
      percent: Number(entry.percent),
      explanation: entry.explanation,
    };
  });
  if (clusters.reduce((sum, cluster) => sum + cluster.count, 0) > Number(value.valid)) {
    throw new Error("NBS question report is invalid");
  }
  return {
    questionNumber: value.questionNumber,
    question: value.question,
    shortQuestion: value.shortQuestion,
    total: Number(value.total),
    valid: Number(value.valid),
    ignored: Number(value.ignored),
    clusters,
    conclusion: value.conclusion,
  };
}

async function runQuestionCluster(
  db: NbsAdminClient,
  job: NbsClaimedJob,
): Promise<{ result: unknown; metadata: NbsModelMetadata }> {
  if (!questionNumber(job.questionNumber)) throw new Error("NBS cluster job has no question number");
  const snapshot = await loadQuestionSnapshot(db, job, job.questionNumber);
  const { clustering, metadata } = await clusterNbsQuestion(snapshot, { attemptCount: job.attemptCount });
  buildQuestionStats(snapshot, clustering);
  return { result: clustering, metadata };
}

async function runQuestionReport(
  db: NbsAdminClient,
  job: NbsClaimedJob,
): Promise<{ result: NbsQuestionReport; metadata: NbsModelMetadata }> {
  if (!questionNumber(job.questionNumber)) throw new Error("NBS report job has no question number");
  const snapshot = await loadQuestionSnapshot(db, job, job.questionNumber);
  const clustering = parseStoredClustering(await loadCompletedJobResult(db, job, "question_cluster", job.questionNumber));
  const stats = buildQuestionStats(snapshot, clustering);
  if (stats.valid === 0) {
    return { result: buildNbsEmptyQuestionReport(stats), metadata: ZERO_METADATA("nbs-report-text-v1") };
  }

  const answersById = new Map(snapshot.answers.map((answer) => [answer.answerId, answer]));
  const examples = stats.topClusters.map((cluster) => ({
    clusterId: cluster.clusterId,
    answers: cluster.memberIds.slice(0, 3).map((id) => {
      const answer = answersById.get(id);
      return answer ? sanitizeNbsAnswer(answer.text, answer.redactions) : undefined;
    }).filter((answer): answer is string => answer !== undefined),
  }));
  const { texts, metadata } = await generateNbsQuestionTexts(stats, examples, { attemptCount: job.attemptCount });
  return { result: buildQuestionReport(stats, texts), metadata };
}

async function runForumSummary(
  db: NbsAdminClient,
  job: NbsClaimedJob,
): Promise<{ result: { questions: NbsQuestionReport[]; comparison: string }; metadata: NbsModelMetadata }> {
  const questions = await Promise.all(([1, 2, 3] as const).map(async (number) =>
    parseQuestionReport(await loadCompletedJobResult(db, job, "question_report", number), number)));
  let comparison: string;
  let metadata: NbsModelMetadata;
  if (questions.every((question) => question.valid === 0)) {
    comparison = "По трём вопросам нет валидных ответов, на которых можно построить сравнение.";
    metadata = ZERO_METADATA("nbs-report-text-v1");
  } else {
    const generated = await generateNbsComparison(questions, { attemptCount: job.attemptCount });
    comparison = generated.comparison;
    metadata = generated.metadata;
  }
  const report = buildNbsReport({ reportId: randomUUID(), reportVersion: job.snapshotVersion, publishedAt: new Date().toISOString() }, questions, comparison);
  return { result: { questions: report.questions, comparison: report.comparison }, metadata };
}

async function processJob(db: NbsAdminClient, job: NbsClaimedJob): Promise<{ result: unknown; metadata: NbsModelMetadata }> {
  if (job.jobType === "question_cluster") return runQuestionCluster(db, job);
  if (job.jobType === "question_report") return runQuestionReport(db, job);
  return runForumSummary(db, job);
}

export type NbsWorkerResult = {
  kind: "idle" | "completed" | "retried" | "failed" | "lease_lost";
};

export async function runNbsWorkerOnce(
  environment: NbsEnvironment,
  db: NbsAdminClient = getNbsAdminClient(),
): Promise<NbsWorkerResult> {
  const job = await claimNbsJob(db, environment);
  if (!job) return { kind: "idle" };

  let outcome: NbsWorkerResult["kind"];
  try {
    const processed = await processJob(db, job);
    outcome = await completeNbsJob(db, job, processed.result, processed.metadata);
  } catch (error) {
    const category = error instanceof NbsAnalysisError ? error.code : "worker_error";
    outcome = await failNbsJob(db, job, category);
  }

  try {
    await dispatchNbsJobs(db, environment);
  } catch {
    // Durable pending jobs are picked up by the scheduled dispatcher.
  }
  return { kind: outcome };
}
