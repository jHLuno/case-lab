import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import { generateShortlist } from "@/lib/case-lab-3/live/openrouter.server";
import {
  getCaseAndSubmissions,
  saveAiRun,
  saveFailedAiRun,
  transitionLiveCase,
} from "@/lib/case-lab-3/live/operator.server";
import type { LiveTransitionCaseRpcResult } from "@/lib/case-lab-3/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;
const LIVE_ENVIRONMENT = "live" as const;

export type AnalyzeDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  getEnvironment: () => "live" | "test";
  transitionCase: typeof transitionLiveCase;
  getCaseAndSubmissions: typeof getCaseAndSubmissions;
  generateShortlist: typeof generateShortlist;
  saveAiRun: typeof saveAiRun;
  saveFailedAiRun: typeof saveFailedAiRun;
};
const productionDependencies: AnalyzeDependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  getEnvironment: () => LIVE_ENVIRONMENT,
  transitionCase: transitionLiveCase,
  getCaseAndSubmissions,
  generateShortlist,
  saveAiRun,
  saveFailedAiRun,
};

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }

function isTransitioned(value: LiveTransitionCaseRpcResult): value is Extract<LiveTransitionCaseRpcResult, { kind: "transitioned" }> { return value.kind === "transitioned"; }

export async function handlePost(request: Request, context: { params: Promise<{ id: string }> }, dependencies: Partial<AnalyzeDependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) return noStoreJson({ error: "forbidden" }, { status: 403 });
    requireJson(request);
    const body = parseJsonBody(await readBoundedBody(request, 4096));
    const { id } = await context.params;
    if (!isRecord(body) || !Number.isSafeInteger(body.expectedVersion)) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const environment = active.getEnvironment();
    const frozen = await active.transitionCase({ caseId: id, expectedVersion: body.expectedVersion as number, state: "analyzing", closesAt: null, actorId: session.role });
    if (!isTransitioned(frozen)) return noStoreJson({ error: frozen.kind }, { status: 409 });

    const models = [process.env.OPENROUTER_MODEL?.trim() || "google/gemini-3-flash-preview", process.env.OPENROUTER_FALLBACK_MODEL?.trim() || "openai/gpt-5-mini"];
    try {
      const input = await active.getCaseAndSubmissions(id);
      const shortlist = await active.generateShortlist(input);
      await active.saveAiRun({ caseId: id, environment, requestedModels: models, shortlist });
      const ready = await active.transitionCase({ caseId: id, expectedVersion: frozen.stateVersion, state: "shortlist_ready", closesAt: null, actorId: session.role });
      if (!isTransitioned(ready)) return noStoreJson({ error: ready.kind }, { status: 409 });
      return noStoreJson({ status: "shortlist_ready", model: shortlist.model, candidateCount: shortlist.candidates.length, stateVersion: ready.stateVersion });
    } catch {
      try {
        await active.saveFailedAiRun({ caseId: id, environment, requestedModels: models, errorCategory: "provider_unavailable" });
      } catch {
        // Preserve the manual mode response even when the audit row cannot be written.
      }
      return noStoreJson({ status: "manual_mode", reason: "ai_unavailable" });
    }
  } catch (error) {
    if (error instanceof RequestGuardError) return noStoreJson({ error: "invalid_request" }, { status: error.status });
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }): Promise<Response> { return handlePost(request, context); }
