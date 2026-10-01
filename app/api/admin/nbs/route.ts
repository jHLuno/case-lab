import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { getNbsConfig } from "@/lib/nbs/config.server";
import { getNbsAdminClient } from "@/lib/nbs/db.server";
import { loadNbsOperatorSnapshot } from "@/lib/nbs/operator.server";
import { executeNbsRunCommand } from "@/lib/nbs/operator.server";
import { dispatchNbsJobs } from "@/lib/nbs/jobs.server";
import { NbsRepositoryError } from "@/lib/nbs/repository.server";
import { NbsInputValidationError, parseNbsRunCommand } from "@/lib/nbs/validation";
import { noStoreJson, parseJsonBody, readBoundedBody, RequestGuardError, requireJson } from "@/lib/case-lab-3/http.server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function errorResponse(error: unknown): Response {
  if (error instanceof NbsInputValidationError) {
    return noStoreJson({ error: error.code, issues: error.issues }, { status: 400 });
  }
  if (error instanceof RequestGuardError) {
    return noStoreJson({ error: error.status === 413 ? "request_too_large" : error.status === 415 ? "unsupported_content_type" : "invalid_request" }, { status: error.status });
  }
  if (error instanceof NbsRepositoryError) {
    const status = error.code === "unauthorized" ? 401 : error.code === "not_found" ? 404
      : error.code === "rate_limited" ? 429 : error.code === "invalid_input" ? 400 : 409;
    return noStoreJson({ error: error.code }, { status });
  }
  return noStoreJson({ error: "service_unavailable" }, { status: 503 });
}

export async function GET(): Promise<Response> {
  const session = await requireCrmAdmin();
  if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
  try {
    const config = getNbsConfig();
    return noStoreJson(await loadNbsOperatorSnapshot(getNbsAdminClient(), config.environment));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await requireCrmAdmin();
  if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
  if (!verifyCrmMutation(request, session, null, { requireIdempotencyKey: true })) {
    return noStoreJson({ error: "forbidden" }, { status: 403 });
  }
  try {
    requireJson(request);
    const body = parseJsonBody<unknown>(await readBoundedBody(request, 4096));
    if (body === null || typeof body !== "object" || Array.isArray(body)
        || !("operation" in body) || (body.operation !== "start" && body.operation !== "finish" && body.operation !== "retry")
        || !("command" in body)) {
      return noStoreJson({ error: "invalid_request" }, { status: 400 });
    }
    const command = parseNbsRunCommand(body.command);
    const idempotencyKey = request.headers.get("idempotency-key")?.trim();
    if (!idempotencyKey) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const config = getNbsConfig();
    const result = await executeNbsRunCommand(
      getNbsAdminClient(),
      config.environment,
      body.operation,
      command,
      idempotencyKey,
      config.tokenSecret,
    );
    if (body.operation === "finish" || body.operation === "retry") {
      try {
        await dispatchNbsJobs(getNbsAdminClient(), config.environment);
      } catch {
        // The durable queue is picked up by its scheduled dispatcher.
      }
    }
    return noStoreJson(result, { status: body.operation === "start" ? 200 : 202 });
  } catch (error) {
    return errorResponse(error);
  }
}
