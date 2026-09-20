import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import { resetLiveParticipant } from "@/lib/case-lab-3/live/operator.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
type Dependencies = { requireCrmAdmin: typeof requireCrmAdmin; verifyCrmMutation: typeof verifyCrmMutation; resetParticipant: typeof resetLiveParticipant };
const productionDependencies: Dependencies = { requireCrmAdmin, verifyCrmMutation, resetParticipant: resetLiveParticipant };

export async function handlePost(request: Request, context: { params: Promise<{ id: string }> }, dependencies: Partial<Dependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) return noStoreJson({ error: "forbidden" }, { status: 403 });
    requireJson(request);
    const { id } = await context.params;
    const body = parseJsonBody(await readBoundedBody(request, 4096));
    if (!UUID_PATTERN.test(id) || !isRecord(body) || typeof body.reason !== "string" || body.reason.trim().length < 3 || body.reason.length > 500) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const result = await active.resetParticipant({ participantId: id, actorId: session.role, reason: body.reason.trim() });
    if (result.kind === "not_found") return noStoreJson({ error: "not_found" }, { status: 404 });
    return noStoreJson({ status: "reset" });
  } catch (error) {
    if (error instanceof RequestGuardError) return noStoreJson({ error: "invalid_request" }, { status: error.status });
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> { return handlePost(request, context); }
