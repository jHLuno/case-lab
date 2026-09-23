import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import { updateShortlist } from "@/lib/case-lab-3/live/operator.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Dependencies = { requireCrmAdmin: typeof requireCrmAdmin; verifyCrmMutation: typeof verifyCrmMutation; updateShortlist: typeof updateShortlist };
const productionDependencies: Dependencies = { requireCrmAdmin, verifyCrmMutation, updateShortlist };
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

export async function handlePatch(request: Request, context: { params: Promise<{ id: string }> }, dependencies: Partial<Dependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) return noStoreJson({ error: "forbidden" }, { status: 403 });
    requireJson(request);
    const { id } = await context.params;
    const body = parseJsonBody(await readBoundedBody(request, 16 * 1024));
    if (!isRecord(body) || body.environment !== "live" || !Array.isArray(body.entries) || body.entries.length > 5) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const entries = body.entries.map((entry) => {
      if (!isRecord(entry) || typeof entry.submissionId !== "string" || typeof entry.included !== "boolean" || (entry.finalOrder !== null && !Number.isSafeInteger(entry.finalOrder))) return null;
      const reason = entry.operatorReason === undefined || entry.operatorReason === null || entry.operatorReason === "" ? null : typeof entry.operatorReason === "string" && entry.operatorReason.length <= 500 ? entry.operatorReason : "__invalid__";
      return reason === "__invalid__" ? null : { submissionId: entry.submissionId, included: entry.included, finalOrder: entry.finalOrder as number | null, operatorReason: reason };
    });
    if (entries.some((entry) => entry === null)) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const submissionIds = (entries as Array<{ submissionId: string } | null>).map((entry) => entry?.submissionId);
    if (new Set(submissionIds).size !== submissionIds.length) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    await active.updateShortlist({ caseId: id, environment: "live", entries: entries as Array<{ submissionId: string; included: boolean; finalOrder: number | null; operatorReason: string | null }> });
    return noStoreJson({ status: "updated" });
  } catch (error) {
    if (error instanceof RequestGuardError) return noStoreJson({ error: "invalid_request" }, { status: error.status });
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> { return handlePatch(request, context); }
