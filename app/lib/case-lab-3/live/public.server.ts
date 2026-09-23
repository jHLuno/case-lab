import "server-only";

import type { PaymentEnvironment } from "../contracts";
import type { LiveCaseState } from "./contracts";
import { getCaseLab3AdminClient } from "../supabase-admin.server";

export type PublicLeaderboardData = {
  entries: Array<{ participantId: string; displayName: string; points: number; rank: number; firstPlaces: number; podiums: number }>;
  activeCase: { caseNumber: number; state: "open" | "analyzing" | "shortlist_ready" | "awarded" | "closed" } | null;
  podiumAnswers: Array<{ place: number; displayName: string; answer: string; submissionId: string }>;
};

type PublicCaseState = PublicLeaderboardData["activeCase"] extends infer T
  ? Exclude<T, null> extends { state: infer S } ? S : never
  : never;

function publicCaseState(value: LiveCaseState): PublicCaseState | null {
  return value === "open" || value === "analyzing" || value === "shortlist_ready" || value === "awarded" || value === "closed" ? value : null;
}

export async function getPublicLeaderboardData(environment: PaymentEnvironment): Promise<PublicLeaderboardData> {
  const client = getCaseLab3AdminClient();
  const [leaderboardResult, activeCaseResult, awardedCaseResult] = await Promise.all([
    client.rpc("case_lab_3_live_get_leaderboard", { p_environment: environment }),
    client.from("case_lab_3_live_cases").select("case_number, question_number, state").eq("environment", environment).in("state", ["open", "analyzing", "shortlist_ready", "awarded"]).order("case_number", { ascending: false }).order("question_number", { ascending: false }).limit(1).maybeSingle(),
    client.from("case_lab_3_live_cases").select("id, case_number, question_number, state").eq("environment", environment).in("state", ["awarded", "closed"]).order("case_number", { ascending: false }).order("question_number", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (leaderboardResult.error || activeCaseResult.error || awardedCaseResult.error) throw new Error("Public leaderboard unavailable");

  const entries = (leaderboardResult.data ?? []).slice(0, 10);
  const awardedCase = awardedCaseResult.data;
  if (!awardedCase) {
    return {
      entries,
      activeCase: activeCaseResult.data ? { caseNumber: activeCaseResult.data.case_number, state: publicCaseState(activeCaseResult.data.state) as PublicCaseState } : null,
      podiumAnswers: [],
    };
  }

  const { data: awards, error: awardsError } = await client.from("case_lab_3_live_awards")
    .select("place, submission_id")
    .eq("environment", environment)
    .eq("case_id", awardedCase.id)
    .eq("active", true)
    .order("place");
  if (awardsError) throw new Error("Public leaderboard unavailable");
  const submissionIds = (awards ?? []).map((award) => award.submission_id);
  const { data: submissions, error: submissionsError } = submissionIds.length === 0
    ? { data: [], error: null }
    : await client.from("case_lab_3_live_submissions").select("id, participant_id, answer_text").in("id", submissionIds).eq("case_id", awardedCase.id);
  if (submissionsError) throw new Error("Public leaderboard unavailable");
  const participantIds = (submissions ?? []).map((submission) => submission.participant_id);
  const { data: participants, error: participantsError } = participantIds.length === 0
    ? { data: [], error: null }
    : await client.from("case_lab_3_live_participants").select("id, public_display_name").in("id", participantIds).eq("environment", environment);
  if (participantsError) throw new Error("Public leaderboard unavailable");
  const submissionById = new Map((submissions ?? []).map((submission) => [submission.id, submission]));
  const participantById = new Map((participants ?? []).map((participant) => [participant.id, participant.public_display_name]));

  return {
    entries,
    activeCase: activeCaseResult.data ? { caseNumber: activeCaseResult.data.case_number, state: publicCaseState(activeCaseResult.data.state) as PublicCaseState } : null,
    podiumAnswers: (awards ?? []).flatMap((award) => {
      const submission = submissionById.get(award.submission_id);
      const displayName = submission ? participantById.get(submission.participant_id) : null;
      return submission && displayName ? [{ place: award.place, displayName, answer: submission.answer_text, submissionId: submission.id }] : [];
    }),
  };
}
