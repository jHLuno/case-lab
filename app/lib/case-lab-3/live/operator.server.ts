import "server-only";

import { createHash } from "node:crypto";

import type { PaymentEnvironment } from "../contracts";
import type { LiveAiRunInsert, LivePublishAwardsRpcResult, LiveResetTimerRpcResult, LiveTransitionCaseRpcResult } from "../database.types";
import type { Json } from "../database.types";
import { getCaseLab3AdminClient } from "../supabase-admin.server";
import type { LiveCaseState } from "./contracts";
import type { EvaluationRubric, ValidatedShortlist } from "./openrouter.server";
import { issueSpeakerToken, parseSpeakerToken } from "./speaker.server";

export class LiveOperatorRepositoryError extends Error {
  readonly code = "live_operator_service_unavailable" as const;

  constructor() {
    super("Live operator service unavailable");
    this.name = "LiveOperatorRepositoryError";
  }
}

export type OperatorCase = {
  id: string;
  environment: PaymentEnvironment;
  caseNumber: number;
  questionNumber: number;
  speakerLabel: string;
  title: string;
  question: string;
  speakerReferenceAnswer: string;
  context: string | null;
  keyInsight: string | null;
  generatedRubric: unknown;
  approvedRubric: unknown;
  state: LiveCaseState;
  opensAt: string | null;
  closesAt: string | null;
  stateVersion: number;
};

export type OperatorSnapshot = {
  environment: PaymentEnvironment;
  cases: OperatorCase[];
  participants: Array<{
    id: string;
    displayName: string;
    claimStatus: "active" | "reset";
    claimedAt: string;
  }>;
  submissions: Array<{
    id: string;
    caseId: string;
    participantId: string;
    displayName: string;
    answer: string;
    contentVersion: number;
    points: number;
    validityState: "valid" | "invalid";
  }>;
  aiRuns: Array<{
    id: string;
    caseId: string;
    runNumber: number;
    servedModel: string | null;
    status: "running" | "succeeded" | "failed";
    latencyMs: number | null;
    usage: unknown;
    errorCategory: string | null;
  }>;
  shortlist: Array<{
    id: string;
    caseId: string;
    submissionId: string;
    aiOrder: number | null;
    aiScore: number | null;
    aiReason: string | null;
    approachLabel: string | null;
    candidateType: string | null;
    included: boolean;
    finalOrder: number | null;
    operatorReason: string | null;
  }>;
  awards: Array<{
    id: string;
    caseId: string;
    submissionId: string;
    place: number;
    bonusPoints: number;
    active: boolean;
    actorId: string;
    decisionReason: string | null;
  }>;
  tieBreaks: Array<{
    id: string;
    participantId: string;
    resolvedRank: number;
    reason: string;
    active: boolean;
  }>;
  leaderboard: unknown;
};

export type CaseEvaluationInput = {
  question: string;
  referenceAnswer: string;
  context: string | null;
  approvedRubric: unknown;
  submissions: Array<{ submissionId: string; answer: string }>;
};

export type SaveAiRunInput = {
  caseId: string;
  environment: PaymentEnvironment;
  requestedModels: string[];
  shortlist: ValidatedShortlist;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapCase(row: {
  id: string;
  environment: PaymentEnvironment;
  case_number: number;
  question_number: number;
  speaker_label: string;
  title: string;
  question: string;
  speaker_reference_answer: string;
  context: string | null;
  key_insight: string | null;
  generated_rubric: unknown;
  approved_rubric: unknown;
  state: LiveCaseState;
  opens_at: string | null;
  closes_at: string | null;
  state_version: number;
}): OperatorCase {
  return {
    id: row.id,
    environment: row.environment,
    caseNumber: row.case_number,
    questionNumber: row.question_number,
    speakerLabel: row.speaker_label,
    title: row.title,
    question: row.question,
    speakerReferenceAnswer: row.speaker_reference_answer,
    context: row.context,
    keyInsight: row.key_insight,
    generatedRubric: row.generated_rubric,
    approvedRubric: row.approved_rubric,
    state: row.state,
    opensAt: row.opens_at,
    closesAt: row.closes_at,
    stateVersion: row.state_version,
  };
}

export async function getLiveSnapshot(environment: PaymentEnvironment): Promise<OperatorSnapshot> {
  const client = getCaseLab3AdminClient();
  const [casesResult, participantsResult, submissionsResult, runsResult, shortlistResult, awardsResult, tieBreaksResult, leaderboardResult] = await Promise.all([
    client.from("case_lab_3_live_cases").select("*").eq("environment", environment).order("case_number"),
    client.from("case_lab_3_live_participants").select("id, public_display_name, claim_status, claimed_at").eq("environment", environment).order("claimed_at"),
    client.from("case_lab_3_live_submissions").select("id, case_id, participant_id, answer_text, content_version, participation_points, validity_state").eq("environment", environment).order("created_at"),
    client.from("case_lab_3_live_ai_runs").select("id, case_id, run_number, served_model, status, latency_ms, usage_payload, error_category").eq("environment", environment).order("created_at", { ascending: false }),
    client.from("case_lab_3_live_shortlist_entries").select("id, case_id, submission_id, ai_order, ai_score, ai_reason, approach_label, candidate_type, included, final_order, operator_reason").eq("environment", environment).order("final_order"),
    client.from("case_lab_3_live_awards").select("id, case_id, submission_id, place, bonus_points, active, actor_id, decision_reason").eq("environment", environment).order("place"),
    client.from("case_lab_3_live_tie_breaks").select("id, participant_id, resolved_rank, reason, active").eq("environment", environment).order("resolved_rank"),
    client.rpc("case_lab_3_live_get_leaderboard", { p_environment: environment }),
  ]);
  if ([casesResult, participantsResult, submissionsResult, runsResult, shortlistResult, awardsResult, tieBreaksResult].some((result) => result.error) || leaderboardResult.error) {
    throw new LiveOperatorRepositoryError();
  }

  const participants = participantsResult.data ?? [];
  const participantDisplayNames = new Map(participants.map((participant) => [participant.id, participant.public_display_name]));

  return {
    environment,
    cases: (casesResult.data ?? []).map(mapCase),
    participants: participants.map((participant) => {
      return {
        id: participant.id,
        displayName: participant.public_display_name,
        claimStatus: participant.claim_status,
        claimedAt: participant.claimed_at,
      };
    }),
    submissions: (submissionsResult.data ?? []).map((submission) => ({
      id: submission.id,
      caseId: submission.case_id,
      participantId: submission.participant_id,
      displayName: participantDisplayNames.get(submission.participant_id) ?? "Участник",
      answer: submission.answer_text,
      contentVersion: submission.content_version,
      points: submission.participation_points,
      validityState: submission.validity_state,
    })),
    aiRuns: (runsResult.data ?? []).map((run) => ({
      id: run.id,
      caseId: run.case_id,
      runNumber: run.run_number,
      servedModel: run.served_model,
      status: run.status,
      latencyMs: run.latency_ms,
      usage: run.usage_payload,
      errorCategory: run.error_category,
    })),
    shortlist: (shortlistResult.data ?? []).map((entry) => ({
      id: entry.id,
      caseId: entry.case_id,
      submissionId: entry.submission_id,
      aiOrder: entry.ai_order,
      aiScore: entry.ai_score,
      aiReason: entry.ai_reason,
      approachLabel: entry.approach_label,
      candidateType: entry.candidate_type,
      included: entry.included,
      finalOrder: entry.final_order,
      operatorReason: entry.operator_reason,
    })),
    awards: (awardsResult.data ?? []).map((award) => ({
      id: award.id,
      caseId: award.case_id,
      submissionId: award.submission_id,
      place: award.place,
      bonusPoints: award.bonus_points,
      active: award.active,
      actorId: award.actor_id,
      decisionReason: award.decision_reason,
    })),
    tieBreaks: (tieBreaksResult.data ?? []).map((tieBreak) => ({
      id: tieBreak.id,
      participantId: tieBreak.participant_id,
      resolvedRank: tieBreak.resolved_rank,
      reason: tieBreak.reason,
      active: tieBreak.active,
    })),
    leaderboard: leaderboardResult.data,
  };
}

export async function saveLiveCase(input: {
  id?: string;
  environment: PaymentEnvironment;
  caseNumber: number;
  questionNumber: number;
  speakerLabel: string;
  title: string;
  question: string;
  referenceAnswer: string;
  context: string | null;
  keyInsight: string | null;
  approvedRubric?: unknown;
}): Promise<OperatorCase> {
  const client = getCaseLab3AdminClient();
  if (input.id) {
    const { data: current, error: currentError } = await client.from("case_lab_3_live_cases").select("state").eq("id", input.id).maybeSingle();
    if (currentError || (current && current.state !== "draft" && current.state !== "ready")) throw new LiveOperatorRepositoryError();
  }
  const { data, error } = await client.from("case_lab_3_live_cases").upsert({
    ...(input.id ? { id: input.id } : {}),
    environment: input.environment,
    case_number: input.caseNumber,
    question_number: input.questionNumber,
    speaker_label: input.speakerLabel,
    title: input.title,
    question: input.question,
    speaker_reference_answer: input.referenceAnswer,
    context: input.context,
    key_insight: input.keyInsight,
    ...(input.approvedRubric === undefined ? {} : { approved_rubric: input.approvedRubric as Json }),
  }, { onConflict: "environment,case_number,question_number" }).select("*").single();
  if (error || !data) throw new LiveOperatorRepositoryError();
  return mapCase(data);
}

export async function getCaseForRubric(caseId: string): Promise<{
  id: string;
  state: LiveCaseState;
  question: string;
  referenceAnswer: string;
  context: string | null;
  keyInsight: string | null;
}> {
  const { data, error } = await getCaseLab3AdminClient().from("case_lab_3_live_cases")
    .select("id, state, question, speaker_reference_answer, context, key_insight")
    .eq("id", caseId)
    .maybeSingle();
  if (error || !data) throw new LiveOperatorRepositoryError();
  return {
    id: data.id,
    state: data.state,
    question: data.question,
    referenceAnswer: data.speaker_reference_answer,
    context: data.context,
    keyInsight: data.key_insight,
  };
}

export async function saveGeneratedRubric(caseId: string, rubric: EvaluationRubric): Promise<void> {
  const { error } = await getCaseLab3AdminClient().from("case_lab_3_live_cases")
    .update({ generated_rubric: rubric })
    .eq("id", caseId);
  if (error) throw new LiveOperatorRepositoryError();
}

export async function transitionLiveCase(input: {
  caseId: string;
  expectedVersion: number;
  state: LiveCaseState;
  closesAt: string | null;
  actorId: string;
}): Promise<LiveTransitionCaseRpcResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_live_transition_case", {
    p_case_id: input.caseId,
    p_expected_version: input.expectedVersion,
    p_new_state: input.state,
    p_closes_at: input.closesAt,
    p_actor_id: input.actorId,
  });
  if (error || !isRecord(data) || typeof data.kind !== "string") throw new LiveOperatorRepositoryError();
  return data as LiveTransitionCaseRpcResult;
}

export async function resetLiveCaseTimer(input: {
  caseId: string;
  expectedVersion: number;
  actorId: string;
}): Promise<LiveResetTimerRpcResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_live_reset_timer", {
    p_case_id: input.caseId,
    p_expected_version: input.expectedVersion,
    p_actor_id: input.actorId,
  });
  if (error || !isRecord(data) || typeof data.kind !== "string") throw new LiveOperatorRepositoryError();
  return data as LiveResetTimerRpcResult;
}

export async function issueSpeakerSelectionLink(input: {
  caseId: string;
  expectedVersion: number;
  origin: string;
}): Promise<{ kind: "issued"; url: string; expiresAt: string } | { kind: "conflict" }> {
  const { data: liveCase, error } = await getCaseLab3AdminClient()
    .from("case_lab_3_live_cases")
    .select("id, state, state_version")
    .eq("id", input.caseId)
    .eq("environment", "live")
    .maybeSingle();
  if (error) throw new LiveOperatorRepositoryError();
  if (!liveCase || liveCase.state !== "shortlist_ready" || liveCase.state_version !== input.expectedVersion) {
    return { kind: "conflict" };
  }

  const now = Date.now();
  const expiresAtMs = now + 15 * 60 * 1000;
  const token = issueSpeakerToken(liveCase.id, liveCase.state_version, undefined, undefined, now);
  const url = new URL("/case-lab-3/live/leaderboard", input.origin);
  url.hash = `speakerToken=${encodeURIComponent(token)}`;
  return { kind: "issued", url: url.toString(), expiresAt: new Date(expiresAtMs).toISOString() };
}

export async function selectSpeakerAwards(input: {
  token: string;
  candidateIds: string[];
}): Promise<{ kind: "published"; stateVersion: number } | { kind: "unauthorized" | "conflict" | "invalid_selection" }> {
  const token = (() => {
    try {
      return parseSpeakerToken(input.token);
    } catch {
      return null;
    }
  })();
  if (!token) return { kind: "unauthorized" };

  const client = getCaseLab3AdminClient();
  const { data: liveCase, error: caseError } = await client
    .from("case_lab_3_live_cases")
    .select("id, state, state_version")
    .eq("id", token.caseId)
    .eq("environment", "live")
    .maybeSingle();
  if (caseError) throw new LiveOperatorRepositoryError();
  if (!liveCase || liveCase.state !== "shortlist_ready" || liveCase.state_version !== token.stateVersion) return { kind: "conflict" };

  const { data: entries, error: entriesError } = await client
    .from("case_lab_3_live_shortlist_entries")
    .select("submission_id")
    .eq("environment", "live")
    .eq("case_id", liveCase.id)
    .eq("included", true)
    .in("submission_id", input.candidateIds);
  if (entriesError) throw new LiveOperatorRepositoryError();
  if ((entries ?? []).length !== 3 || new Set(entries?.map((entry) => entry.submission_id)).size !== 3) return { kind: "invalid_selection" };

  const result = await publishLiveAwards({
    caseId: liveCase.id,
    expectedVersion: liveCase.state_version,
    awards: input.candidateIds.map((submissionId, index) => ({ place: index + 1, submissionId })),
    actorId: "speaker-mode",
    reason: "Выбор спикера на live-экране",
  });
  return result.kind === "published"
    ? { kind: "published", stateVersion: result.stateVersion }
    : { kind: "conflict" };
}

export async function getCaseAndSubmissions(caseId: string): Promise<CaseEvaluationInput> {
  const client = getCaseLab3AdminClient();
  const [{ data: liveCase, error: caseError }, { data: submissions, error: submissionsError }] = await Promise.all([
    client.from("case_lab_3_live_cases").select("question, speaker_reference_answer, context, approved_rubric").eq("id", caseId).maybeSingle(),
    client.from("case_lab_3_live_submissions").select("id, answer_text").eq("case_id", caseId).eq("validity_state", "valid").order("created_at"),
  ]);
  if (caseError || submissionsError || !liveCase) throw new LiveOperatorRepositoryError();
  return {
    question: liveCase.question,
    referenceAnswer: liveCase.speaker_reference_answer,
    context: liveCase.context,
    approvedRubric: liveCase.approved_rubric,
    submissions: (submissions ?? []).map((submission) => ({ submissionId: submission.id, answer: submission.answer_text })),
  };
}

export async function saveAiRun(input: SaveAiRunInput): Promise<void> {
  const client = getCaseLab3AdminClient();
  const { data: lastRun, error: lastRunError } = await client.from("case_lab_3_live_ai_runs")
    .select("run_number")
    .eq("case_id", input.caseId)
    .order("run_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastRunError) throw new LiveOperatorRepositoryError();
  const responsePayload = { candidates: input.shortlist.candidates };
  const requestHash = createHash("sha256").update(JSON.stringify({ caseId: input.caseId, candidates: input.shortlist.candidates })).digest("hex");
  const aiRun: LiveAiRunInsert = {
    environment: input.environment,
    case_id: input.caseId,
    run_number: (lastRun?.run_number ?? 0) + 1,
    requested_models: input.requestedModels,
    served_model: input.shortlist.model,
    request_hash: requestHash,
    response_payload: responsePayload,
    usage_payload: input.shortlist.usage,
    latency_ms: input.shortlist.latencyMs,
    status: "succeeded",
    error_category: null,
    completed_at: new Date().toISOString(),
  };
  const { data: run, error: runError } = await client.from("case_lab_3_live_ai_runs").insert(aiRun).select("id").single();
  if (runError || !run) throw new LiveOperatorRepositoryError();
  const { error: shortlistError } = await client.from("case_lab_3_live_shortlist_entries").insert(input.shortlist.candidates.map((candidate, index) => ({
    environment: input.environment,
    case_id: input.caseId,
    ai_run_id: run.id,
    submission_id: candidate.submissionId,
    ai_order: index + 1,
    ai_score: candidate.score,
    ai_reason: candidate.reason,
    approach_label: candidate.approach,
    candidate_type: candidate.candidateType,
    final_order: index + 1,
  })));
  if (shortlistError) throw new LiveOperatorRepositoryError();
}

export async function saveFailedAiRun(input: {
  caseId: string;
  environment: PaymentEnvironment;
  requestedModels: string[];
  errorCategory: string;
}): Promise<void> {
  const client = getCaseLab3AdminClient();
  const { data: lastRun, error: lastRunError } = await client.from("case_lab_3_live_ai_runs")
    .select("run_number")
    .eq("case_id", input.caseId)
    .order("run_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastRunError) throw new LiveOperatorRepositoryError();
  const { error } = await client.from("case_lab_3_live_ai_runs").insert({
    environment: input.environment,
    case_id: input.caseId,
    run_number: (lastRun?.run_number ?? 0) + 1,
    requested_models: input.requestedModels,
    request_hash: createHash("sha256").update(`${input.caseId}:${input.errorCategory}:${Date.now()}`).digest("hex"),
    status: "failed",
    served_model: null,
    response_payload: null,
    latency_ms: null,
    error_category: input.errorCategory,
    completed_at: new Date().toISOString(),
  });
  if (error) throw new LiveOperatorRepositoryError();
}

export async function publishLiveAwards(input: {
  caseId: string;
  expectedVersion: number;
  awards: unknown;
  actorId: string;
  reason: string | null;
}): Promise<LivePublishAwardsRpcResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_live_publish_awards", {
    p_case_id: input.caseId,
    p_expected_version: input.expectedVersion,
    p_awards: input.awards as never,
    p_actor_id: input.actorId,
    p_reason: input.reason,
  });
  if (error || !isRecord(data) || typeof data.kind !== "string") throw new LiveOperatorRepositoryError();
  return data as LivePublishAwardsRpcResult;
}

export async function updateShortlist(input: {
  caseId: string;
  environment: PaymentEnvironment;
  entries: Array<{ submissionId: string; included: boolean; finalOrder: number | null; operatorReason: string | null }>;
}): Promise<void> {
  const client = getCaseLab3AdminClient();
  const { data: currentEntries, error: currentEntriesError } = await client.from("case_lab_3_live_shortlist_entries")
    .select("submission_id, included")
    .eq("environment", input.environment)
    .eq("case_id", input.caseId);
  if (currentEntriesError) throw new LiveOperatorRepositoryError();
  const includedBySubmission = new Map((currentEntries ?? []).map((entry) => [entry.submission_id, entry.included]));
  for (const entry of input.entries) includedBySubmission.set(entry.submissionId, entry.included);
  if ([...includedBySubmission.values()].filter(Boolean).length > 5) throw new LiveOperatorRepositoryError();
  for (const entry of input.entries) {
    const { error } = await client.from("case_lab_3_live_shortlist_entries").upsert({
      environment: input.environment,
      case_id: input.caseId,
      submission_id: entry.submissionId,
      included: entry.included,
      final_order: entry.finalOrder,
      operator_reason: entry.operatorReason,
      candidate_type: "manual",
    }, { onConflict: "case_id,submission_id" });
    if (error) throw new LiveOperatorRepositoryError();
  }
}

export async function resetLiveParticipant(input: { participantId: string; actorId: string; reason: string }) {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_live_reset_participant", {
    p_participant_id: input.participantId,
    p_actor_id: input.actorId,
    p_reason: input.reason,
  });
  if (error || !isRecord(data) || (data.kind !== "reset" && data.kind !== "not_found")) throw new LiveOperatorRepositoryError();
  return data as { kind: "reset" | "not_found" };
}

export async function resolveLiveTie(input: {
  environment: PaymentEnvironment;
  decisions: unknown;
  actorId: string;
  reason: string;
}) {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_live_resolve_tie", {
    p_environment: input.environment,
    p_decisions: input.decisions as never,
    p_actor_id: input.actorId,
    p_reason: input.reason,
  });
  if (error || !isRecord(data) || data.kind !== "resolved") throw new LiveOperatorRepositoryError();
  return { kind: "resolved" as const };
}
