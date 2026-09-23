import type { PaymentEnvironment } from "../contracts";

export type LiveCaseState =
  | "draft"
  | "ready"
  | "open"
  | "analyzing"
  | "shortlist_ready"
  | "awarded"
  | "closed";

export type LiveParticipantClaimInput = {
  firstName: string;
  lastName: string;
};

export type LiveSubmissionInput = {
  answer: string;
  mode: "manual" | "timeout";
};

export type LeaderboardScore = {
  participantId: string;
  displayName: string;
  points: number;
  firstPlaces: number;
  podiums: number;
};

export type PublicLeaderboardEntry = LeaderboardScore & {
  rank: number;
};

export type LiveParticipantStateResponse = {
  participant: {
    displayName: string;
    points: number;
    rank: number | null;
  };
  activeCase: null | {
    id: string;
    caseNumber: number;
    questionNumber: number;
    speakerLabel: string;
    question: string;
    state: LiveCaseState;
    closesAt: string | null;
    answer: string | null;
    answerLocked: boolean;
  };
  leaderboard: PublicLeaderboardEntry[];
};

export type LiveSession = {
  participantId: string;
  version: number;
  token: string;
};

export type LiveSessionParticipant = {
  id: string;
  environment: PaymentEnvironment;
  sessionTokenVersion: number;
  claimStatus: "active" | "reset";
};
