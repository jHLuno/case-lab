import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getCaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";
import type { PaymentEnvironment } from "@/lib/case-lab-3/contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReleaseInput = {
  environment: PaymentEnvironment;
  allocationId: string;
  reason: string;
  actorId: string;
};

type ReleaseResult = {
  kind: "released";
  allocationId: string;
  environment: PaymentEnvironment;
};

export type ReleaseAllocationRouteDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  parseBody: (request: Request) => Promise<unknown>;
  releaseAllocation: (input: ReleaseInput) => Promise<ReleaseResult>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnvironment(value: unknown): value is PaymentEnvironment {
  return value === "test" || value === "live";
}

function parseInput(value: unknown, allocationId: string): Omit<ReleaseInput, "actorId"> | null {
  if (
    !UUID_PATTERN.test(allocationId) ||
    !isRecord(value) ||
    !isEnvironment(value.environment) ||
    typeof value.reason !== "string" ||
    value.reason.trim().length === 0 ||
    value.reason.trim().length > 500 ||
    /[\u0000-\u001f\u007f]/u.test(value.reason)
  ) {
    return null;
  }
  return { environment: value.environment, allocationId, reason: value.reason.trim() };
}

function isReleaseResult(value: unknown): value is ReleaseResult {
  if (!isRecord(value)) return false;
  return value.kind === "released" && typeof value.allocationId === "string" && isEnvironment(value.environment);
}

async function releaseAtomicAllocation(input: ReleaseInput): Promise<ReleaseResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_release_allocation", {
    p_environment: input.environment,
    p_allocation_id: input.allocationId,
    p_actor_id: input.actorId,
    p_reason: input.reason,
  });
  if (error || !isReleaseResult(data)) throw new Error("Admin allocation release unavailable");
  return data;
}

const productionDependencies: ReleaseAllocationRouteDependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  parseBody: async (request) => {
    try {
      return await request.json();
    } catch {
      return null;
    }
  },
  releaseAllocation: releaseAtomicAllocation,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: Partial<ReleaseAllocationRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) {
      return noStoreJson({ error: "forbidden" }, { status: 403 });
    }
    const { id } = await params;
    const input = parseInput(await active.parseBody(request), id);
    if (!input) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const result = await active.releaseAllocation({ ...input, actorId: "crm_admin" });
    return isReleaseResult(result) ? noStoreJson(result) : noStoreJson({ error: "service_unavailable" }, { status: 503 });
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
