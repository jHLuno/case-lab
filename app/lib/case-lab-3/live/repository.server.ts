import "server-only";

import type { PaymentEnvironment } from "../contracts";
import type {
  LiveClaimParticipantRpcResult,
  LiveSaveSubmissionRpcResult,
} from "../database.types";
import { getCaseLab3AdminClient } from "../supabase-admin.server";
import type {
  LiveParticipantClaimInput,
  LiveParticipantStateResponse,
  LiveSession,
  PublicLeaderboardEntry,
} from "./contracts";
import { assertLiveSession, LiveSessionAuthorizationError } from "./session.server";

export class LiveRepositoryError extends Error {
  readonly code = "live_service_unavailable" as const;

  constructor() {
    super("Live interaction service unavailable");
    this.name = "LiveRepositoryError";
  }
}

export type AuthorizedLiveParticipant = {
  id: string;
  environment: PaymentEnvironment;
  displayName: string;
};

export type SaveSubmissionInput = {
  environment: PaymentEnvironment;
  caseId: string;
  participantId: string;
  answer: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isClaimResult(value: unknown): value is LiveClaimParticipantRpcResult {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "ambiguous" || value.kind === "not_found" || value.kind === "already_claimed") return true;
  return value.kind === "claimed"
    && typeof value.participantId === "string"
    && Number.isSafeInteger(value.tokenVersion)
    && (value.tokenVersion as number) > 0
    && typeof value.displayName === "string";
}

function isSaveResult(value: unknown): value is LiveSaveSubmissionRpcResult {
  if (!isRecord(value) || typeof value.kind !== "string") return false;
  if (value.kind === "closed" || value.kind === "unauthorized") return true;
  return value.kind === "saved"
    && typeof value.submissionId === "string"
    && Number.isSafeInteger(value.contentVersion)
    && typeof value.savedAt === "string"
    && value.participationPoints === 10;
}

function isLeaderboard(value: unknown): value is PublicLeaderboardEntry[] {
  return Array.isArray(value) && value.every((entry) => isRecord(entry)
    && typeof entry.participantId === "string"
    && typeof entry.displayName === "string"
    && Number.isSafeInteger(entry.points)
    && Number.isSafeInteger(entry.firstPlaces)
    && Number.isSafeInteger(entry.podiums)
    && Number.isSafeInteger(entry.rank));
}

export async function claimLiveParticipant(
  input: LiveParticipantClaimInput,
  environment: PaymentEnvironment,
): Promise<LiveClaimParticipantRpcResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_live_claim_participant", {
    p_environment: environment,
    p_first_name: input.firstName,
    p_last_name: input.lastName,
    p_ticket_number: input.ticketNumber,
  });
  if (error || !isClaimResult(data)) throw new LiveRepositoryError();
  return data;
}

export async function authorizeLiveParticipant(
  session: LiveSession,
  environment: PaymentEnvironment,
): Promise<AuthorizedLiveParticipant | null> {
  try {
    const client = getCaseLab3AdminClient();
    const { data: participant, error: participantError } = await client
      .from("case_lab_3_live_participants")
      .select("id, environment, ticket_id, ticket_revision_id, public_display_name, session_token_version, claim_status")
      .eq("id", session.participantId)
      .eq("environment", environment)
      .maybeSingle();
    if (participantError) throw new LiveRepositoryError();
    if (!participant) return null;

    const { data: ticket, error: ticketError } = await client
      .from("case_lab_3_tickets")
      .select("id, current_revision_id, status")
      .eq("id", participant.ticket_id)
      .eq("environment", environment)
      .maybeSingle();
    if (ticketError) throw new LiveRepositoryError();
    if (!ticket) return null;

    assertLiveSession(session, {
      id: participant.id,
      environment: participant.environment,
      sessionTokenVersion: participant.session_token_version,
      claimStatus: participant.claim_status,
      ticketStatus: ticket.status,
      ticketRevisionId: participant.ticket_revision_id,
      currentRevisionId: ticket.current_revision_id,
    }, environment);

    return {
      id: participant.id,
      environment: participant.environment,
      displayName: participant.public_display_name,
    };
  } catch (error) {
    if (error instanceof LiveSessionAuthorizationError) return null;
    if (error instanceof LiveRepositoryError) throw error;
    throw new LiveRepositoryError();
  }
}

export async function loadParticipantState(
  participant: AuthorizedLiveParticipant,
): Promise<LiveParticipantStateResponse> {
  const client = getCaseLab3AdminClient();
  const leaderboardResult = await client.rpc("case_lab_3_live_get_leaderboard", {
    p_environment: participant.environment,
  });
  if (leaderboardResult.error || !isLeaderboard(leaderboardResult.data)) throw new LiveRepositoryError();
  const leaderboard = leaderboardResult.data;
  const ownScore = leaderboard.find((entry) => entry.participantId === participant.id);

  const { data: activeCase, error: caseError } = await client
    .from("case_lab_3_live_cases")
    .select("id, case_number, speaker_label, question, state, closes_at")
    .eq("environment", participant.environment)
    .in("state", ["open", "analyzing", "shortlist_ready", "awarded"])
    .order("case_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (caseError) throw new LiveRepositoryError();

  let answer: string | null = null;
  if (activeCase) {
    const { data: submission, error: submissionError } = await client
      .from("case_lab_3_live_submissions")
      .select("answer_text")
      .eq("case_id", activeCase.id)
      .eq("participant_id", participant.id)
      .maybeSingle();
    if (submissionError) throw new LiveRepositoryError();
    answer = submission?.answer_text ?? null;
  }

  return {
    participant: {
      displayName: participant.displayName,
      points: ownScore?.points ?? 0,
      rank: ownScore?.rank ?? null,
    },
    activeCase: activeCase ? {
      id: activeCase.id,
      caseNumber: activeCase.case_number,
      speakerLabel: activeCase.speaker_label,
      question: activeCase.question,
      state: activeCase.state,
      closesAt: activeCase.closes_at,
      answer,
    } : null,
    leaderboard,
  };
}

export async function saveParticipantSubmission(
  input: SaveSubmissionInput,
): Promise<LiveSaveSubmissionRpcResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_live_save_submission", {
    p_environment: input.environment,
    p_case_id: input.caseId,
    p_participant_id: input.participantId,
    p_answer_text: input.answer,
  });
  if (error || !isSaveResult(data)) throw new LiveRepositoryError();
  return data;
}
