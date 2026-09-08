import "server-only";

import { timingSafeEqual } from "node:crypto";

import { noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import { runCaseLab3Worker, type WorkerRunResult } from "@/lib/case-lab-3/worker.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 16 * 1024;

export type WorkerRouteDependencies = {
  getCronSecret: () => string;
  runWorker: (options: { environment: "test" | "live" }) => Promise<WorkerRunResult>;
};

const productionDependencies: WorkerRouteDependencies = {
  getCronSecret: () => {
    const value = process.env.CASE_LAB_3_CRON_SECRET?.trim();
    if (!value) throw new Error("Worker configuration incomplete");
    return value;
  },
  runWorker: runCaseLab3Worker,
};

function validSecret(expected: string, supplied: string | null): boolean {
  if (!supplied || expected.length === 0 || supplied.length !== expected.length) return false;
  const expectedBytes = Buffer.from(expected, "utf8");
  const suppliedBytes = Buffer.from(supplied, "utf8");
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function bearerSecret(request: Request): string | null {
  const value = request.headers.get("authorization");
  return value?.match(/^Bearer (.+)$/u)?.[1] ?? null;
}

function environment(value: unknown): value is "test" | "live" {
  return value === "test" || value === "live";
}

export async function handlePost(
  request: Request,
  dependencies: WorkerRouteDependencies = productionDependencies,
): Promise<Response> {
  try {
    requireJson(request);
    const expected = dependencies.getCronSecret();
    if (!validSecret(expected, bearerSecret(request))) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    const body = parseJsonBody(await readBoundedBody(request, MAX_BODY_BYTES));
    if (!body || typeof body !== "object" || Array.isArray(body)) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const selectedEnvironment = (body as Record<string, unknown>).environment;
    if (!environment(selectedEnvironment)) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const result = await dependencies.runWorker({ environment: selectedEnvironment });
    return noStoreJson(result);
  } catch (error) {
    if (error instanceof RequestGuardError) {
      return noStoreJson({ error: error.status === 413 ? "request_too_large" : error.status === 415 ? "unsupported_content_type" : "invalid_request" }, { status: error.status });
    }
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}
