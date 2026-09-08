import "server-only";

import { requireCrmAdmin } from "@/lib/crm-auth.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getCaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";
import type { PaymentEnvironment } from "@/lib/case-lab-3/contracts";
import { verifyCrmMutation } from "@/lib/crm-auth.server";

const LIMIT_MIN = 70;
const LIMIT_MAX = 100;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type SettingsInput = {
  environment: PaymentEnvironment;
  onlineSalesLimit: number | null;
  salesEnabled: boolean | null;
  actorId: string;
};

type SettingsResult = {
  kind: "updated";
  environment: PaymentEnvironment;
  onlineSalesLimit: number;
  salesEnabled: boolean;
  configurationVersion: number;
};

export type AdminSettings = {
  environment: PaymentEnvironment;
  onlineSalesLimit: number;
  venueCapacity: number;
  salesEnabled: boolean;
  configurationVersion: number;
  latestWorkerHeartbeatAt: string | null;
  availability: unknown;
};

export type SettingsRouteDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  parseBody: (request: Request) => Promise<unknown>;
  getSettings: (environment: PaymentEnvironment) => Promise<AdminSettings>;
  updateSettings: (input: SettingsInput) => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseEnvironment(value: unknown): value is PaymentEnvironment {
  return value === "test" || value === "live";
}

function parseSettingsInput(value: unknown): Omit<SettingsInput, "actorId"> | null {
  if (!isRecord(value) || !parseEnvironment(value.environment)) return null;
  const limit = value.onlineSalesLimit;
  const enabled = value.salesEnabled;
  if (
    limit !== null &&
    limit !== undefined &&
    (!Number.isSafeInteger(limit) || (limit as number) < LIMIT_MIN || (limit as number) > LIMIT_MAX)
  ) {
    return null;
  }
  if (enabled !== null && enabled !== undefined && typeof enabled !== "boolean") return null;
  if (limit === undefined && enabled === undefined) return null;
  return {
    environment: value.environment,
    onlineSalesLimit: limit === undefined ? null : (limit as number | null),
    salesEnabled: enabled === undefined ? null : (enabled as boolean | null),
  };
}

function isSettingsResult(value: unknown): value is SettingsResult {
  if (!isRecord(value)) return false;
  return (
    value.kind === "updated" &&
    parseEnvironment(value.environment) &&
    Number.isSafeInteger(value.onlineSalesLimit) &&
    (value.onlineSalesLimit as number) >= LIMIT_MIN &&
    (value.onlineSalesLimit as number) <= LIMIT_MAX &&
    typeof value.salesEnabled === "boolean" &&
    Number.isSafeInteger(value.configurationVersion) &&
    (value.configurationVersion as number) > 0
  );
}

async function readSettings(environment: PaymentEnvironment): Promise<AdminSettings> {
  const client = getCaseLab3AdminClient();
  const [{ data: settings, error: settingsError }, { data: availability, error: availabilityError }] = await Promise.all([
    client
      .from("case_lab_3_event_settings")
      .select("environment, online_sales_limit, venue_capacity, sales_enabled, configuration_version, latest_worker_heartbeat_at")
      .eq("environment", environment)
      .maybeSingle(),
    client.rpc("case_lab_3_get_availability", { p_environment: environment }),
  ]);
  if (settingsError || availabilityError || !settings) throw new Error("Admin settings unavailable");
  return {
    environment: settings.environment,
    onlineSalesLimit: settings.online_sales_limit,
    venueCapacity: settings.venue_capacity,
    salesEnabled: settings.sales_enabled,
    configurationVersion: settings.configuration_version,
    latestWorkerHeartbeatAt: settings.latest_worker_heartbeat_at,
    availability,
  };
}

async function applySettings(input: SettingsInput): Promise<SettingsResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_update_settings", {
    p_environment: input.environment,
    p_online_sales_limit: input.onlineSalesLimit,
    p_sales_enabled: input.salesEnabled,
    p_actor_id: input.actorId,
  });
  if (error || !isSettingsResult(data)) throw new Error("Admin settings update unavailable");
  return data;
}

const productionDependencies: SettingsRouteDependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  parseBody: async (request) => {
    try {
      return await request.json();
    } catch {
      return null;
    }
  },
  getSettings: readSettings,
  updateSettings: applySettings,
};

export async function handleGet(
  request: Request,
  dependencies: Partial<SettingsRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    const environment = new URL(request.url).searchParams.get("environment");
    if (!parseEnvironment(environment)) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    return noStoreJson(await active.getSettings(environment));
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function handlePost(
  request: Request,
  dependencies: Partial<SettingsRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) {
      return noStoreJson({ error: "forbidden" }, { status: 403 });
    }
    const parsed = parseSettingsInput(await active.parseBody(request));
    if (!parsed) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const result = await active.updateSettings({ ...parsed, actorId: "crm_admin" });
    if (!isSettingsResult(result)) return noStoreJson({ error: "service_unavailable" }, { status: 503 });
    return noStoreJson(result);
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
