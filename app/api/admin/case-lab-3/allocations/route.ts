import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getCaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";
import type { PaymentEnvironment, TicketTier } from "@/lib/case-lab-3/contracts";

const ALLOCATION_CATEGORIES = new Set(["paid", "invited", "organizer_reserved"]);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type AllocationInput = {
  environment: PaymentEnvironment;
  allocationCategory: "paid" | "invited" | "organizer_reserved";
  quantity: number;
  tier: TicketTier | null;
  countsTowardOnlineLimit: boolean;
  holdsEarlyBirdQuota: boolean;
  reason: string;
  actorId: string;
};

type AllocationResult = {
  kind: "created";
  allocationId: string;
  environment: PaymentEnvironment;
  quantity: number;
};

export type AdminAllocation = {
  id: string;
  environment: PaymentEnvironment;
  allocationCategory: AllocationInput["allocationCategory"];
  quantity: number;
  tier: TicketTier | null;
  countsTowardOnlineLimit: boolean;
  holdsEarlyBirdQuota: boolean;
  ticketId: string | null;
  reason: string;
  actorLabel: string;
  releasedAt: string | null;
  releasedBy: string | null;
  releaseReason: string | null;
  createdAt: string;
};

export type AllocationRouteDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  parseBody: (request: Request) => Promise<unknown>;
  listAllocations: (environment: PaymentEnvironment) => Promise<AdminAllocation[]>;
  createAllocation: (input: AllocationInput) => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnvironment(value: unknown): value is PaymentEnvironment {
  return value === "test" || value === "live";
}

function parseAllocationInput(value: unknown): Omit<AllocationInput, "actorId"> | null {
  if (!isRecord(value) || !isEnvironment(value.environment)) return null;
  if (
    typeof value.allocationCategory !== "string" ||
    !ALLOCATION_CATEGORIES.has(value.allocationCategory) ||
    !Number.isSafeInteger(value.quantity) ||
    (value.quantity as number) < 1 ||
    (value.quantity as number) > 100 ||
    (value.tier !== null && value.tier !== "early_bird" && value.tier !== "standard") ||
    typeof value.countsTowardOnlineLimit !== "boolean" ||
    typeof value.holdsEarlyBirdQuota !== "boolean" ||
    (value.holdsEarlyBirdQuota === true && value.tier !== "early_bird") ||
    typeof value.reason !== "string" ||
    value.reason.trim().length === 0 ||
    value.reason.trim().length > 500 ||
    /[\u0000-\u001f\u007f]/u.test(value.reason)
  ) {
    return null;
  }
  return {
    environment: value.environment,
    allocationCategory: value.allocationCategory as AllocationInput["allocationCategory"],
    quantity: value.quantity as number,
    tier: value.tier as TicketTier | null,
    countsTowardOnlineLimit: value.countsTowardOnlineLimit,
    holdsEarlyBirdQuota: value.holdsEarlyBirdQuota,
    reason: value.reason.trim(),
  };
}

function isAllocationResult(value: unknown): value is AllocationResult {
  if (!isRecord(value)) return false;
  return value.kind === "created" && isEnvironment(value.environment) && typeof value.allocationId === "string" && Number.isSafeInteger(value.quantity);
}

async function readAllocations(environment: PaymentEnvironment): Promise<AdminAllocation[]> {
  const { data, error } = await getCaseLab3AdminClient()
    .from("case_lab_3_inventory_allocations")
    .select("id, environment, allocation_category, quantity, tier, counts_toward_online_limit, holds_early_bird_quota, ticket_id, reason, actor_label, released_at, released_by, release_reason, created_at")
    .eq("environment", environment)
    .order("created_at", { ascending: false });
  if (error) throw new Error("Admin allocations unavailable");
  return (data ?? []).map((row) => ({
    id: row.id,
    environment: row.environment,
    allocationCategory: row.allocation_category,
    quantity: row.quantity,
    tier: row.tier,
    countsTowardOnlineLimit: row.counts_toward_online_limit,
    holdsEarlyBirdQuota: row.holds_early_bird_quota,
    ticketId: row.ticket_id,
    reason: row.reason,
    actorLabel: row.actor_label,
    releasedAt: row.released_at,
    releasedBy: row.released_by,
    releaseReason: row.release_reason,
    createdAt: row.created_at,
  }));
}

async function createAtomicAllocation(input: AllocationInput): Promise<AllocationResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_create_allocation", {
    p_environment: input.environment,
    p_allocation_category: input.allocationCategory,
    p_quantity: input.quantity,
    p_tier: input.tier,
    p_counts_toward_online_limit: input.countsTowardOnlineLimit,
    p_holds_early_bird_quota: input.holdsEarlyBirdQuota,
    p_reason: input.reason,
    p_actor_id: input.actorId,
  });
  if (error || !isAllocationResult(data)) throw new Error("Admin allocation unavailable");
  return data;
}

const productionDependencies: AllocationRouteDependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  parseBody: async (request) => {
    try {
      return await request.json();
    } catch {
      return null;
    }
  },
  listAllocations: readAllocations,
  createAllocation: createAtomicAllocation,
};

export async function handleGet(
  request: Request,
  dependencies: Partial<AllocationRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    const environment = new URL(request.url).searchParams.get("environment");
    if (!isEnvironment(environment)) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    return noStoreJson({ allocations: await active.listAllocations(environment) });
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function handlePost(
  request: Request,
  dependencies: Partial<AllocationRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) {
      return noStoreJson({ error: "forbidden" }, { status: 403 });
    }
    const parsed = parseAllocationInput(await active.parseBody(request));
    if (!parsed) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const result = await active.createAllocation({ ...parsed, actorId: "crm_admin" });
    return isAllocationResult(result)
      ? noStoreJson(result, { status: 201 })
      : noStoreJson({ error: "service_unavailable" }, { status: 503 });
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleGet(request);
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
