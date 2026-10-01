import { cookies } from "next/headers";

import { noStoreJson, parseJsonBody, readBoundedBody, RequestGuardError, requireJson, requireSameOrigin } from "@/lib/case-lab-3/http.server";
import { getNbsConfig } from "@/lib/nbs/config.server";
import { getNbsAdminClient } from "@/lib/nbs/db.server";
import { consumeNbsRateLimit, getNbsCommandReplay, NbsRepositoryError, registerNbsParticipant } from "@/lib/nbs/repository.server";
import { NBS_SESSION_COOKIE, NBS_SESSION_COOKIE_OPTIONS, issueNbsSession, serializeNbsSession } from "@/lib/nbs/session.server";
import { NbsInputValidationError, parseNbsRegistration } from "@/lib/nbs/validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function failure(error: unknown): Response {
  if (error instanceof NbsInputValidationError) return noStoreJson({ error: error.code, issues: error.issues }, { status: 400 });
  if (error instanceof RequestGuardError) return noStoreJson({ error: error.status === 415 ? "unsupported_content_type" : error.status === 413 ? "request_too_large" : "invalid_request" }, { status: error.status });
  if (error instanceof NbsRepositoryError) {
    const status = error.code === "not_found" ? 404 : error.code === "closed" ? 409 : error.code === "rate_limited" ? 429 : 400;
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
    const input = parseNbsRegistration(parseJsonBody<unknown>(await readBoundedBody(request, 4096)));
    const config = getNbsConfig();
    const db = getNbsAdminClient();
    const replay = await getNbsCommandReplay(db, config.environment, input.runId, "register", idempotencyKey, input, config.tokenSecret);
    const registered = replay
      ? {
          participantId: typeof replay.participantId === "string" ? replay.participantId : "",
          version: typeof replay.version === "number" ? replay.version : 1,
          replayed: true,
        }
      : await (async () => {
          await consumeNbsRateLimit(db, config.environment, idempotencyKey, "registration", config.tokenSecret);
          return registerNbsParticipant(db, config.environment, input, idempotencyKey, config.tokenSecret);
        })();
    if (!registered.participantId) return noStoreJson({ error: "service_unavailable" }, { status: 503 });
    const session = issueNbsSession({
      environment: config.environment,
      runId: input.runId,
      participantId: registered.participantId,
      version: registered.version,
    }, config.tokenSecret);
    (await cookies()).set(NBS_SESSION_COOKIE, serializeNbsSession(session), NBS_SESSION_COOKIE_OPTIONS);
    return noStoreJson({ registered: true, replayed: registered.replayed }, { status: registered.replayed ? 200 : 201 });
  } catch (error) {
    return failure(error);
  }
}
