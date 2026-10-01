import type { Json } from "@/lib/case-lab-3/database.types";

type Table<Row, Insert = Partial<Row>, Update = Partial<Row>> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

type RunRow = {
  id: string;
  environment: "test" | "live";
  forum_name: string;
  question_set_version: string;
  questions: Json;
  state: "ready" | "open" | "analyzing" | "analysis_failed" | "published";
  state_version: number;
  started_at: string | null;
  closed_at: string | null;
  snapshot_version: number | null;
  snapshot_hash: string | null;
  snapshot_response_count: number | null;
  published_report_id: string | null;
  created_at: string;
};
type ParticipantRow = {
  id: string;
  environment: "test" | "live";
  run_id: string;
  first_name: string;
  last_name: string;
  session_token_version: number;
  registered_at: string;
  submitted_at: string | null;
};
type ResponseRow = {
  id: string;
  environment: "test" | "live";
  run_id: string;
  participant_id: string;
  question_number: number;
  answer_text: string;
  created_at: string;
};
type CommandRow = {
  id: string;
  environment: "test" | "live";
  run_id: string;
  operation: "register" | "submit" | "start" | "finish" | "retry";
  idempotency_key: string;
  request_hash: string;
  result: Json;
  created_at: string;
};
type JobRow = {
  id: string;
  environment: "test" | "live";
  run_id: string;
  snapshot_version: number;
  job_type: "question_cluster" | "question_report" | "forum_summary";
  question_number: number | null;
  status: "pending" | "leased" | "completed" | "failed";
  attempt_count: number;
  available_at: string;
  lease_token: string | null;
  leased_until: string | null;
  result: Json | null;
  model_metadata: Json | null;
  error_category: string | null;
  created_at: string;
  completed_at: string | null;
};
type ReportRow = {
  id: string;
  environment: "test" | "live";
  run_id: string;
  snapshot_version: number;
  prompt_version: string;
  report: Json;
  published_at: string;
};

export type NbsDatabase = {
  public: {
    Tables: {
      nbs_forum_runs: Table<RunRow>;
      nbs_forum_participants: Table<ParticipantRow>;
      nbs_forum_responses: Table<ResponseRow>;
      nbs_forum_commands: Table<CommandRow>;
      nbs_forum_jobs: Table<JobRow>;
      nbs_forum_reports: Table<ReportRow>;
    };
    Views: Record<never, never>;
    Functions: {
      case_lab_3_consume_rate_limit: {
        Args: { p_scope: string; p_purpose_ip_hash: string; p_limit_count: number; p_bucket_seconds: number };
        Returns: Json;
      };
      nbs_forum_register_participant: {
        Args: {
          p_environment: string;
          p_run_id: string;
          p_first_name: string;
          p_last_name: string;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      nbs_forum_submit_responses: {
        Args: {
          p_environment: string;
          p_run_id: string;
          p_participant_id: string;
          p_answers: Json;
          p_idempotency_key: string;
          p_request_hash: string;
        };
        Returns: Json;
      };
      nbs_forum_start: {
        Args: { p_environment: string; p_run_id: string; p_expected_version: number; p_idempotency_key: string; p_request_hash: string };
        Returns: Json;
      };
      nbs_forum_finish: {
        Args: { p_environment: string; p_run_id: string; p_expected_version: number; p_idempotency_key: string; p_request_hash: string };
        Returns: Json;
      };
      nbs_forum_claim_job: {
        Args: { p_environment: string; p_worker_id: string };
        Returns: Json;
      };
      nbs_forum_complete_job: {
        Args: { p_environment: string; p_job_id: string; p_lease_token: string; p_result: Json; p_model_metadata?: Json | null };
        Returns: Json;
      };
      nbs_forum_fail_job: {
        Args: { p_environment: string; p_job_id: string; p_lease_token: string; p_error_category: string };
        Returns: Json;
      };
      nbs_forum_retry_failed_jobs: {
        Args: { p_environment: string; p_run_id: string; p_expected_version: number; p_idempotency_key: string; p_request_hash: string };
        Returns: Json;
      };
      nbs_forum_dispatch_jobs: {
        Args: { p_environment: string };
        Returns: Json;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
