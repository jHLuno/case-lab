import "server-only";

import type { PaymentEnvironment } from "../contracts";
import type { LiveCaseState } from "./contracts";
import { getCaseLab3AdminClient } from "../supabase-admin.server";

export type PublicAnswerCard = {
  displayName: string;
  answer: string;
};

export type PublicQuestionAnswers = {
  id: string;
  caseNumber: number;
  questionNumber: number;
  question: string;
  state: LiveCaseState;
  answers: PublicAnswerCard[];
};

export type PublicLeaderboardData = {
  entries: Array<{ participantId: string; displayName: string; points: number; rank: number; firstPlaces: number; podiums: number }>;
  activeCase: { caseNumber: number; questionNumber: number; state: "open" | "analyzing" | "shortlist_ready" | "awarded" | "closed" } | null;
  podiumAnswers: Array<{ place: number; displayName: string; answer: string; submissionId: string }>;
  questionAnswers: PublicQuestionAnswers[];
};

type PublicCaseState = PublicLeaderboardData["activeCase"] extends infer T
  ? Exclude<T, null> extends { state: infer S } ? S : never
  : never;

function publicCaseState(value: LiveCaseState): PublicCaseState | null {
  return value === "open" || value === "analyzing" || value === "shortlist_ready" || value === "awarded" || value === "closed" ? value : null;
}

export async function getPublicLeaderboardData(environment: PaymentEnvironment): Promise<PublicLeaderboardData> {
  const client = getCaseLab3AdminClient();
  const [leaderboardResult, activeCaseResult, awardedCaseResult, casesResult] = await Promise.all([
    client.rpc("case_lab_3_live_get_leaderboard", { p_environment: environment }),
    client.from("case_lab_3_live_cases").select("case_number, question_number, state").eq("environment", environment).in("state", ["open", "analyzing", "shortlist_ready", "awarded"]).order("case_number", { ascending: false }).order("question_number", { ascending: false }).limit(1).maybeSingle(),
    client.from("case_lab_3_live_cases").select("id, case_number, question_number, state").eq("environment", environment).in("state", ["awarded", "closed"]).order("case_number", { ascending: false }).order("question_number", { ascending: false }).limit(1).maybeSingle(),
    client.from("case_lab_3_live_cases").select("id, case_number, question_number, question, state, state_version").eq("environment", environment).in("state", ["open", "analyzing", "shortlist_ready", "awarded", "closed"]).order("case_number").order("question_number"),
  ]);
  if (leaderboardResult.error || activeCaseResult.error || awardedCaseResult.error || casesResult.error) throw new Error("Public leaderboard unavailable");

  const entries = (leaderboardResult.data ?? []).slice(0, 10);
  const cases = casesResult.data ?? [];
  const caseIds = cases.map((liveCase) => liveCase.id);
  const shortlistResult = caseIds.length === 0
    ? { data: [], error: null }
    : await client.from("case_lab_3_live_shortlist_entries")
      .select("case_id, submission_id, ai_order, final_order, created_at, included")
      .eq("environment", environment)
      .eq("included", true)
      .in("case_id", caseIds);
  if (shortlistResult.error) throw new Error("Public leaderboard unavailable");
  const shortlisted = (shortlistResult.data ?? []).sort((left, right) => (
    (left.final_order ?? left.ai_order ?? Number.MAX_SAFE_INTEGER) - (right.final_order ?? right.ai_order ?? Number.MAX_SAFE_INTEGER)
      || left.created_at.localeCompare(right.created_at)
      || left.submission_id.localeCompare(right.submission_id)
  ));
  const submissionIds = [...new Set(shortlisted.map((entry) => entry.submission_id))];
  const submissionsResult = submissionIds.length === 0
    ? { data: [], error: null }
    : await client.from("case_lab_3_live_submissions").select("id, case_id, participant_id, answer_text").in("id", submissionIds).eq("environment", environment).eq("validity_state", "valid");
  if (submissionsResult.error) throw new Error("Public leaderboard unavailable");
  const submissions = submissionsResult.data ?? [];
  const participantIds = [...new Set(submissions.map((submission) => submission.participant_id))];
  const participantsResult = participantIds.length === 0
    ? { data: [], error: null }
    : await client.from("case_lab_3_live_participants").select("id, public_display_name").in("id", participantIds).eq("environment", environment);
  if (participantsResult.error) throw new Error("Public leaderboard unavailable");
  const submissionById = new Map(submissions.map((submission) => [submission.id, submission]));
  const participantById = new Map((participantsResult.data ?? []).map((participant) => [participant.id, participant.public_display_name]));
  const questionAnswers = cases.map((liveCase) => {
    const answers = shortlisted
      .filter((entry) => entry.case_id === liveCase.id)
      .map((entry) => {
        const submission = submissionById.get(entry.submission_id);
        const displayName = submission ? participantById.get(submission.participant_id) : null;
        if (!submission || !displayName) return null;
        return {
          displayName,
          answer: submission.answer_text,
        };
      })
      .filter((answer): answer is PublicAnswerCard => answer !== null)
      .slice(0, 5);
    return {
      id: liveCase.id,
      caseNumber: liveCase.case_number,
      questionNumber: liveCase.question_number,
      question: liveCase.question,
      state: liveCase.state,
      answers,
    };
  });
  const awardedCase = awardedCaseResult.data;
  if (!awardedCase) {
    return {
      entries,
      activeCase: activeCaseResult.data ? { caseNumber: activeCaseResult.data.case_number, questionNumber: activeCaseResult.data.question_number, state: publicCaseState(activeCaseResult.data.state) as PublicCaseState } : null,
      podiumAnswers: [],
      questionAnswers,
    };
  }

  const { data: awards, error: awardsError } = await client.from("case_lab_3_live_awards")
    .select("place, submission_id")
    .eq("environment", environment)
    .eq("case_id", awardedCase.id)
    .eq("active", true)
    .order("place");
  if (awardsError) throw new Error("Public leaderboard unavailable");
  const awardedSubmissionIds = (awards ?? []).map((award) => award.submission_id);
  const { data: awardedSubmissions, error: submissionsError } = awardedSubmissionIds.length === 0
    ? { data: [], error: null }
    : await client.from("case_lab_3_live_submissions").select("id, participant_id, answer_text").in("id", awardedSubmissionIds).eq("case_id", awardedCase.id);
  if (submissionsError) throw new Error("Public leaderboard unavailable");
  const awardedParticipantIds = (awardedSubmissions ?? []).map((submission) => submission.participant_id);
  const { data: awardedParticipants, error: participantsError } = awardedParticipantIds.length === 0
    ? { data: [], error: null }
    : await client.from("case_lab_3_live_participants").select("id, public_display_name").in("id", awardedParticipantIds).eq("environment", environment);
  if (participantsError) throw new Error("Public leaderboard unavailable");
  const awardedSubmissionById = new Map((awardedSubmissions ?? []).map((submission) => [submission.id, submission]));
  const awardedParticipantById = new Map((awardedParticipants ?? []).map((participant) => [participant.id, participant.public_display_name]));

  return {
    entries,
    activeCase: activeCaseResult.data ? { caseNumber: activeCaseResult.data.case_number, questionNumber: activeCaseResult.data.question_number, state: publicCaseState(activeCaseResult.data.state) as PublicCaseState } : null,
    podiumAnswers: (awards ?? []).flatMap((award) => {
      const submission = awardedSubmissionById.get(award.submission_id);
      const displayName = submission ? awardedParticipantById.get(submission.participant_id) : null;
      return submission && displayName ? [{ place: award.place, displayName, answer: submission.answer_text, submissionId: submission.id }] : [];
    }),
    questionAnswers,
  };
}
