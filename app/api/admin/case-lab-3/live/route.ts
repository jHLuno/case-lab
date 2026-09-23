import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import { noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import {
  getLiveSnapshot,
  saveLiveCase,
  type OperatorSnapshot,
  type OperatorCase,
} from "@/lib/case-lab-3/live/operator.server";
import type { PaymentEnvironment } from "@/lib/case-lab-3/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const LIVE_ENVIRONMENT: PaymentEnvironment = "live";

export type LiveDashboardDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  getEnvironment: () => PaymentEnvironment;
  getSnapshot: (environment: PaymentEnvironment) => Promise<OperatorSnapshot>;
  saveCase: (input: {
    id?: string;
    environment: PaymentEnvironment;
    caseNumber: number;
    questionNumber: number;
    speakerLabel: string;
    title: string;
    question: string;
    referenceAnswer: string;
    context: string | null;
    keyInsight: string | null;
    approvedRubric?: unknown;
  }) => Promise<OperatorCase>;
};

const productionDependencies: LiveDashboardDependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  getEnvironment: () => LIVE_ENVIRONMENT,
  getSnapshot: getLiveSnapshot,
  saveCase: saveLiveCase,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(value: unknown, min: number, max: number): value is string {
  return typeof value === "string" && value.trim().length >= min && value.trim().length <= max && !/[\u0000-\u001f\u007f-\u009f]/u.test(value);
}

function parseCaseInput(value: unknown, environment: PaymentEnvironment) {
  if (!isRecord(value) || !Number.isSafeInteger(value.caseNumber) || (value.caseNumber as number) < 1 || (value.caseNumber as number) > 3 || !Number.isSafeInteger(value.questionNumber) || (value.questionNumber as number) < 1 || (value.questionNumber as number) > 3) return null;
  if (!text(value.speakerLabel, 1, 120) || !text(value.title, 1, 200) || !text(value.question, 1, 1000) || !text(value.referenceAnswer, 1, 4000)) return null;
  if (value.id !== undefined && (typeof value.id !== "string" || !UUID_PATTERN.test(value.id))) return null;
  const optional = (field: "context" | "keyInsight", max: number): string | null => {
    if (value[field] === undefined || value[field] === null || value[field] === "") return null;
    return text(value[field], 1, max) ? String(value[field]).trim() : "__invalid__";
  };
  const context = optional("context", 4000);
  const keyInsight = optional("keyInsight", 1000);
  if (context === "__invalid__" || keyInsight === "__invalid__") return null;
  return {
    id: value.id as string | undefined,
    environment,
    caseNumber: value.caseNumber as number,
    questionNumber: value.questionNumber as number,
    speakerLabel: value.speakerLabel.trim(),
    title: value.title.trim(),
    question: value.question.trim(),
    referenceAnswer: value.referenceAnswer.trim(),
    context,
    keyInsight,
    approvedRubric: value.approvedRubric,
  };
}

export async function handleGet(request: Request, dependencies: Partial<LiveDashboardDependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    return noStoreJson(await active.getSnapshot(active.getEnvironment()));
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function handlePut(request: Request, dependencies: Partial<LiveDashboardDependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) return noStoreJson({ error: "forbidden" }, { status: 403 });
    requireJson(request);
    const environment = active.getEnvironment();
    const input = parseCaseInput(parseJsonBody(await readBoundedBody(request, MAX_BODY_BYTES)), environment);
    if (!input) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    return noStoreJson(await active.saveCase(input));
  } catch (error) {
    if (error instanceof RequestGuardError) return noStoreJson({ error: error.status === 413 ? "request_too_large" : "invalid_request" }, { status: error.status });
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function GET(request: Request): Promise<Response> { return handleGet(request); }
export async function PUT(request: Request): Promise<Response> { return handlePut(request); }
