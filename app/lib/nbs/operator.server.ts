import "server-only";

import type { NbsEnvironment, NbsRunCommand, NbsRunOperation } from "./contracts";
import type { NbsAdminClient } from "./db.server";
import { hashNbsRequest, loadNbsOperatorSnapshot, NbsRepositoryError } from "./repository.server";

export { loadNbsOperatorSnapshot };

export async function executeNbsRunCommand(
  db: NbsAdminClient,
  environment: NbsEnvironment,
  operation: NbsRunOperation,
  command: NbsRunCommand,
  idempotencyKey: string,
  tokenSecret: string,
): Promise<Record<string, unknown>> {
  const requestHash = hashNbsRequest(command, tokenSecret);
  const result = operation === "start"
    ? await db.rpc("nbs_forum_start", {
        p_environment: environment,
        p_run_id: command.runId,
        p_expected_version: command.expectedVersion,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
      })
    : operation === "finish"
    ? await db.rpc("nbs_forum_finish", {
        p_environment: environment,
        p_run_id: command.runId,
        p_expected_version: command.expectedVersion,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
      })
    : operation === "reset"
    ? await db.rpc("nbs_forum_reset", {
        p_environment: environment,
        p_run_id: command.runId,
        p_expected_version: command.expectedVersion,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
      })
    : await db.rpc("nbs_forum_retry_failed_jobs", {
        p_environment: environment,
        p_run_id: command.runId,
        p_expected_version: command.expectedVersion,
        p_idempotency_key: idempotencyKey,
        p_request_hash: requestHash,
      });
  if (result.error) {
    if (result.error.message === "nbs_conflict") throw new NbsRepositoryError("conflict");
    if (result.error.message === "nbs_not_found") throw new NbsRepositoryError("not_found");
    throw new Error("NBS operator command failed");
  }
  if (!result.data || typeof result.data !== "object" || Array.isArray(result.data)) {
    throw new Error("NBS operator command result is invalid");
  }
  return result.data as Record<string, unknown>;
}
