import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import { issueSpeakerSelectionLink } from "@/lib/case-lab-3/live/operator.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type Dependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  issueSpeakerLink: typeof issueSpeakerSelectionLink;
};

const productionDependencies: Dependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  issueSpeakerLink: issueSpeakerSelectionLink,
};

export async function handlePost(request: Request, dependencies: Partial<Dependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) return noStoreJson({ error: "forbidden" }, { status: 403 });
    requireJson(request);
    const body = parseJsonBody(await readBoundedBody(request, 4096));
    if (!isRecord(body) || typeof body.caseId !== "string" || !UUID_PATTERN.test(body.caseId) || !Number.isSafeInteger(body.expectedVersion) || (body.expectedVersion as number) < 1) {
      return noStoreJson({ error: "invalid_request" }, { status: 400 });
    }
    const result = await active.issueSpeakerLink({
      caseId: body.caseId,
      expectedVersion: body.expectedVersion as number,
      origin: new URL(request.url).origin,
    });
    if (result.kind === "conflict") return noStoreJson({ error: "conflict" }, { status: 409 });
    return noStoreJson({ url: result.url, expiresAt: result.expiresAt });
  } catch (error) {
    if (error instanceof RequestGuardError) return noStoreJson({ error: "invalid_request" }, { status: error.status });
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
