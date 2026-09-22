import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import { resolveLiveTie } from "@/lib/case-lab-3/live/operator.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const LIVE_ENVIRONMENT = "live" as const;
const UUID_PATTERN = /^[0-9a-f-]{36}$/u;
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
type Dependencies = { requireCrmAdmin: typeof requireCrmAdmin; verifyCrmMutation: typeof verifyCrmMutation; getEnvironment: () => "live" | "test"; resolveTie: typeof resolveLiveTie };
const productionDependencies: Dependencies = { requireCrmAdmin, verifyCrmMutation, getEnvironment: () => LIVE_ENVIRONMENT, resolveTie: resolveLiveTie };

export async function handlePost(request: Request, dependencies: Partial<Dependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) return noStoreJson({ error: "forbidden" }, { status: 403 });
    requireJson(request);
    const body = parseJsonBody(await readBoundedBody(request, 8192));
    if (!isRecord(body) || !Array.isArray(body.decisions) || body.decisions.length < 2 || typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.length > 500) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const decisions = body.decisions.map((decision) => isRecord(decision) && typeof decision.participantId === "string" && UUID_PATTERN.test(decision.participantId) && Number.isSafeInteger(decision.rank) && (decision.rank as number) > 0 ? { participantId: decision.participantId, rank: decision.rank as number } : null);
    if (decisions.some((decision) => decision === null) || new Set(decisions.map((decision) => decision?.participantId)).size !== decisions.length || new Set(decisions.map((decision) => decision?.rank)).size !== decisions.length) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    await active.resolveTie({ environment: active.getEnvironment(), decisions, actorId: session.role, reason: body.reason.trim() });
    return noStoreJson({ status: "resolved" });
  } catch (error) {
    if (error instanceof RequestGuardError) return noStoreJson({ error: "invalid_request" }, { status: error.status });
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> { return handlePost(request); }
