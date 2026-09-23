import "server-only";

import {
  noStoreJson,
  parseJsonBody,
  readBoundedBody,
  requireJson,
  requireSameOrigin,
  RequestGuardError,
} from "@/lib/case-lab-3/http.server";
import { selectSpeakerAwards } from "@/lib/case-lab-3/live/operator.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type Dependencies = {
  selectAwards: typeof selectSpeakerAwards;
};

const productionDependencies: Dependencies = { selectAwards: selectSpeakerAwards };

export async function handlePost(request: Request, dependencies: Partial<Dependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    requireSameOrigin(request);
    requireJson(request);
    const body = parseJsonBody(await readBoundedBody(request, 4096));
    if (!isRecord(body) || typeof body.speakerToken !== "string" || !Array.isArray(body.candidateIds) || body.candidateIds.length !== 3) {
      return noStoreJson({ error: "invalid_selection" }, { status: 400 });
    }
    const candidateIds = body.candidateIds.filter((candidateId): candidateId is string => typeof candidateId === "string" && UUID_PATTERN.test(candidateId));
    if (candidateIds.length !== 3 || new Set(candidateIds).size !== 3) return noStoreJson({ error: "invalid_selection" }, { status: 400 });

    const result = await active.selectAwards({ token: body.speakerToken, candidateIds });
    if (result.kind === "unauthorized") return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (result.kind === "invalid_selection") return noStoreJson({ error: "invalid_selection" }, { status: 400 });
    if (result.kind === "conflict") return noStoreJson({ error: "conflict" }, { status: 409 });
    if (result.kind !== "published") return noStoreJson({ error: "service_unavailable" }, { status: 503 });
    return noStoreJson({ status: "published", stateVersion: result.stateVersion });
  } catch (error) {
    if (error instanceof RequestGuardError) return noStoreJson({ error: "invalid_request" }, { status: error.status });
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
