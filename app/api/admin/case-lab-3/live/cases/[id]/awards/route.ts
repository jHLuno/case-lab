import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import { publishLiveAwards } from "@/lib/case-lab-3/live/operator.server";
import { caseLab3LiveArchivedResponse, isCaseLab3LiveArchived } from "@/lib/case-lab-3/live/archive.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
type Dependencies = { requireCrmAdmin: typeof requireCrmAdmin; verifyCrmMutation: typeof verifyCrmMutation; publishAwards: typeof publishLiveAwards };
const productionDependencies: Dependencies = { requireCrmAdmin, verifyCrmMutation, publishAwards: publishLiveAwards };

export async function handlePost(request: Request, context: { params: Promise<{ id: string }> }, dependencies: Partial<Dependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) return noStoreJson({ error: "forbidden" }, { status: 403 });
    if (isCaseLab3LiveArchived()) return caseLab3LiveArchivedResponse();
    requireJson(request);
    const { id } = await context.params;
    const body = parseJsonBody(await readBoundedBody(request, 4096));
    if (!isRecord(body) || !Number.isSafeInteger(body.expectedVersion) || !Array.isArray(body.awards) || body.awards.length !== 3) return noStoreJson({ error: "invalid_awards" }, { status: 400 });
    const awards = body.awards.map((award) => isRecord(award) && Number.isSafeInteger(award.place) && [1, 2, 3].includes(award.place as number) && typeof award.submissionId === "string" ? { place: award.place as number, submissionId: award.submissionId } : null);
    if (awards.some((award) => award === null) || new Set(awards.map((award) => award?.place)).size !== 3 || new Set(awards.map((award) => award?.submissionId)).size !== 3) return noStoreJson({ error: "invalid_awards" }, { status: 400 });
    const reason = body.reason === undefined || body.reason === null || body.reason === "" ? null : typeof body.reason === "string" && body.reason.trim().length >= 3 && body.reason.length <= 500 ? body.reason.trim() : "__invalid__";
    if (reason === "__invalid__") return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const result = await active.publishAwards({ caseId: id, expectedVersion: body.expectedVersion as number, awards, actorId: session.role, reason });
    if (result.kind !== "published") return noStoreJson({ error: result.kind }, { status: 409 });
    return noStoreJson({ status: "published", stateVersion: result.stateVersion });
  } catch (error) {
    if (error instanceof RequestGuardError) return noStoreJson({ error: "invalid_request" }, { status: error.status });
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> { return handlePost(request, context); }
