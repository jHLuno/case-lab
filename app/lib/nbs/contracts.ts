export type NbsEnvironment = "test" | "live";
export type NbsQuestionNumber = 1 | 2 | 3;
export type NbsRunState = "ready" | "open" | "analyzing" | "analysis_failed" | "published";
export type NbsAnswerSet = Record<NbsQuestionNumber, string>;
export type NbsRegistrationInput = { runId: string; firstName: string; lastName: string };
export type NbsSubmissionInput = { runId: string; answers: NbsAnswerSet };
export type NbsRunCommand = { runId: string; expectedVersion: number };

export type NbsSnapshotAnswer = { answerId: string; text: string; redactions?: string[] };
export type NbsQuestionSnapshot = {
  runId: string;
  environment: NbsEnvironment;
  snapshotVersion: number;
  questionNumber: NbsQuestionNumber;
  question: string;
  shortQuestion: string;
  answers: NbsSnapshotAnswer[];
};

export type NbsExclusionReason = "nonsense" | "spam" | "technical" | "irrelevant" | "unclear";
export type NbsValidatedClustering = {
  clusters: Array<{ clusterId: string; title: string; answerIds: string[] }>;
  excluded: Array<{ answerId: string; reason: NbsExclusionReason }>;
};
export type NbsQuestionStats = {
  questionNumber: NbsQuestionNumber;
  question: string;
  shortQuestion: string;
  total: number;
  valid: number;
  ignored: number;
  topClusters: Array<{
    clusterId: string;
    title: string;
    count: number;
    percent: number;
    memberIds: string[];
  }>;
};
export type NbsQuestionTexts = {
  explanations: Array<{ clusterId: string; explanation: string }>;
  conclusion: string;
};
export type NbsQuestionReport = {
  questionNumber: NbsQuestionNumber;
  question: string;
  shortQuestion: string;
  total: number;
  valid: number;
  ignored: number;
  clusters: Array<{ title: string; count: number; percent: number; explanation: string }>;
  conclusion: string;
};
export type NbsReport = {
  reportId: string;
  reportVersion: number;
  publishedAt: string;
  questions: [NbsQuestionReport, NbsQuestionReport, NbsQuestionReport];
  comparison: string;
};
export type NbsScreenReport = {
  reportId: string;
  reportVersion: number;
  questions: Array<{
    questionNumber: NbsQuestionNumber;
    shortQuestion: string;
    clusters: Array<{ title: string; percent: number }>;
    insufficientClusters: boolean;
  }>;
};
export type NbsParticipantState = {
  runId: string;
  state: NbsRunState;
  questions: Array<{ number: NbsQuestionNumber; text: string }>;
  participant: null | { displayName: string; submitted: boolean; answers: NbsAnswerSet | null };
};
export type NbsResultsResponse =
  | { status: "published"; view: "screen"; report: NbsScreenReport }
  | { status: "published"; view: "full"; report: NbsReport }
  | { status: Exclude<NbsRunState, "published">; report: null };

export type NbsJobType = "question_cluster" | "question_report" | "forum_summary";
export type NbsClaimedJob = {
  jobId: string;
  runId: string;
  environment: NbsEnvironment;
  snapshotVersion: number;
  jobType: NbsJobType;
  questionNumber: NbsQuestionNumber | null;
  attemptCount: number;
  leaseToken: string;
  leasedUntil: string;
};
export type NbsModelMetadata = {
  requestedModels: string[];
  servedModel: string | null;
  generationId: string | null;
  promptVersion: string;
  requestHash: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
  cost: number | null;
};
