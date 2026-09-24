import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import { transitionLiveCase } from "@/lib/case-lab-3/live/operator.server";
import type { LiveCaseState } from "@/lib/case-lab-3/live/contracts";
import { caseLab3LiveArchivedResponse, isCaseLab3LiveArchived } from "@/lib/case-lab-3/live/archive.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
const UUID_PATTERN = /^[0-9a-f-]{36}$/u;
const STATES = new Set<LiveCaseState>(["draft", "ready", "open", "analyzing", "shortlist_ready", "awarded", "closed"]);

export type TransitionDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  transitionCase: typeof transitionLiveCase;
};
const productionDependencies: TransitionDependencies = { requireCrmAdmin, verifyCrmMutation, transitionCase: transitionLiveCase };

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export async function handlePost(request: Request, context: { params: Promise<{ id: string }> }, dependencies: Partial<TransitionDependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) return noStoreJson({ error: "forbidden" }, { status: 403 });
    if (isCaseLab3LiveArchived()) return caseLab3LiveArchivedResponse();
    requireJson(request);
    const { id } = await context.params;
    const body = parseJsonBody(await readBoundedBody(request, 4096));
    if (!UUID_PATTERN.test(id) || !isRecord(body) || !Number.isSafeInteger(body.expectedVersion) || typeof body.state !== "string" || !STATES.has(body.state as LiveCaseState)) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const closesAt = body.closesAt === undefined || body.closesAt === null ? null : typeof body.closesAt === "string" ? body.closesAt : "__invalid__";
    if (closesAt === "__invalid__") return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const result = await active.transitionCase({ caseId: id, expectedVersion: body.expectedVersion as number, state: body.state as LiveCaseState, closesAt, actorId: session.role });
    if (result.kind !== "transitioned") return noStoreJson({ error: result.kind }, { status: 409 });
    return noStoreJson({ status: "transitioned", state: result.state, stateVersion: result.stateVersion, closesAt: result.closesAt });
  } catch (error) {
    if (error instanceof RequestGuardError) return noStoreJson({ error: "invalid_request" }, { status: error.status });
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> { return handlePost(request, context); }
