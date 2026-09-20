import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import { generateEvaluationRubric, type EvaluationRubric } from "@/lib/case-lab-3/live/openrouter.server";
import { getCaseForRubric, saveGeneratedRubric } from "@/lib/case-lab-3/live/operator.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type RubricDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  getCase: typeof getCaseForRubric;
  generateRubric: typeof generateEvaluationRubric;
  saveRubric: (caseId: string, rubric: EvaluationRubric) => Promise<void>;
};
const productionDependencies: RubricDependencies = { requireCrmAdmin, verifyCrmMutation, getCase: getCaseForRubric, generateRubric: generateEvaluationRubric, saveRubric: saveGeneratedRubric };

export async function handlePost(request: Request, context: { params: Promise<{ id: string }> }, dependencies: Partial<RubricDependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) return noStoreJson({ error: "forbidden" }, { status: 403 });
    requireJson(request);
    await readBoundedBody(request, 2048);
    const { id } = await context.params;
    const liveCase = await active.getCase(id);
    if (liveCase.state !== "draft" && liveCase.state !== "ready") return noStoreJson({ error: "case_locked" }, { status: 409 });
    const rubric = await active.generateRubric({ question: liveCase.question, referenceAnswer: liveCase.referenceAnswer, context: liveCase.context, keyInsight: liveCase.keyInsight });
    await active.saveRubric(id, rubric);
    return noStoreJson({ status: "generated", rubric });
  } catch (error) {
    if (error instanceof RequestGuardError) return noStoreJson({ error: "invalid_request" }, { status: error.status });
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> { return handlePost(request, context); }
