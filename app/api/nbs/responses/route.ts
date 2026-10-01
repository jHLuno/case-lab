import { cookies } from "next/headers";

import { noStoreJson, parseJsonBody, readBoundedBody, RequestGuardError, requireJson, requireSameOrigin } from "@/lib/case-lab-3/http.server";
import { getNbsConfig } from "@/lib/nbs/config.server";
import { getNbsAdminClient } from "@/lib/nbs/db.server";
import {
  consumeNbsRateLimit,
  getNbsCommandReplay,
  getNbsParticipant,
  NbsRepositoryError,
  submitNbsResponses,
} from "@/lib/nbs/repository.server";
import { NBS_SESSION_COOKIE, parseNbsSession, type NbsSession, verifyNbsSession } from "@/lib/nbs/session.server";
import { NbsInputValidationError, parseNbsSubmission } from "@/lib/nbs/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function failure(error: unknown): Response {
  if (error instanceof NbsInputValidationError) return noStoreJson({ error: error.code, issues: error.issues }, { status: 400 });
  if (error instanceof RequestGuardError) return noStoreJson({ error: error.status === 415 ? "unsupported_content_type" : error.status === 413 ? "request_too_large" : "invalid_request" }, { status: error.status });
  if (error instanceof NbsRepositoryError) {
    const status = error.code === "unauthorized" ? 401 : error.code === "not_found" ? 404 : error.code === "closed" || error.code === "conflict" ? 409 : error.code === "rate_limited" ? 429 : 400;
    return noStoreJson({ error: error.code }, { status });
  }
  return noStoreJson({ error: "service_unavailable" }, { status: 503 });
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireSameOrigin(request);
    requireJson(request);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey || idempotencyKey.length > 200) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const input = parseNbsSubmission(parseJsonBody<unknown>(await readBoundedBody(request, 16 * 1024)));
    const config = getNbsConfig();
    const sessionValue = (await cookies()).get(NBS_SESSION_COOKIE)?.value;
    const parsed = parseNbsSession(sessionValue);
    if (!parsed || parsed.runId !== input.runId) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    const session: NbsSession = { ...parsed, environment: config.environment };
    const db = getNbsAdminClient();
    const participant = await getNbsParticipant(db, config.environment, session.runId, session.participantId);
    if (!verifyNbsSession(session, config.environment, participant, config.tokenSecret)) {
      return noStoreJson({ error: "unauthorized" }, { status: 401 });
    }
    const replay = await getNbsCommandReplay(
      db, config.environment, session.runId, "submit", idempotencyKey,
      { runId: session.runId, answers: input.answers }, config.tokenSecret,
    );
    if (replay) return noStoreJson({ submitted: true, replayed: true }, { status: 200 });
    await consumeNbsRateLimit(db, config.environment, session.participantId, "submission", config.tokenSecret);
    const result = await submitNbsResponses(db, config.environment, session, input.answers, idempotencyKey, config.tokenSecret);
    return noStoreJson({ submitted: true, replayed: result.replayed }, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return failure(error);
  }
}
