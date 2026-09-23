import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import { resetLiveCaseTimer } from "@/lib/case-lab-3/live/operator.server";
import type { LiveResetTimerRpcResult } from "@/lib/case-lab-3/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f-]{36}$/u;

export type ResetTimerDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  resetTimer: typeof resetLiveCaseTimer;
};

const productionDependencies: ResetTimerDependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  resetTimer: resetLiveCaseTimer,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTimerReset(value: LiveResetTimerRpcResult): value is Extract<LiveResetTimerRpcResult, { kind: "timer_reset" }> {
  return value.kind === "timer_reset";
}

export async function handlePost(
  request: Request,
  context: { params: Promise<{ id: string }> },
  dependencies: Partial<ResetTimerDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) return noStoreJson({ error: "forbidden" }, { status: 403 });
    requireJson(request);
    const { id } = await context.params;
    const body = parseJsonBody(await readBoundedBody(request, 4096));
    if (!UUID_PATTERN.test(id) || !isRecord(body) || !Number.isSafeInteger(body.expectedVersion)) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const result = await active.resetTimer({ caseId: id, expectedVersion: body.expectedVersion as number, actorId: session.role });
    if (!isTimerReset(result)) return noStoreJson({ error: result.kind }, { status: 409 });
    return noStoreJson({ status: "timer_reset", state: result.state, stateVersion: result.stateVersion, closesAt: result.closesAt });
  } catch (error) {
    if (error instanceof RequestGuardError) return noStoreJson({ error: "invalid_request" }, { status: error.status });
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> {
  return handlePost(request, context);
}
