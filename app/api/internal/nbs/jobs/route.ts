import "server-only";

import { timingSafeEqual } from "node:crypto";

import { noStoreJson, parseJsonBody, readBoundedBody, requireJson, RequestGuardError } from "@/lib/case-lab-3/http.server";
import { getNbsConfig } from "@/lib/nbs/config.server";
import { runNbsWorkerOnce } from "@/lib/nbs/worker.server";
import type { NbsEnvironment } from "@/lib/nbs/contracts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BODY_BYTES = 4096;

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

function isEnvironment(value: unknown): value is NbsEnvironment {
  return value === "test" || value === "live";
}

export async function POST(request: Request): Promise<Response> {
  try {
    requireJson(request);
    const config = getNbsConfig();
    if (!validSecret(config.workerSecret, bearerSecret(request))) {
      return noStoreJson({ error: "unauthorized" }, { status: 401 });
    }
    const body = parseJsonBody<unknown>(await readBoundedBody(request, MAX_BODY_BYTES));
    if (!body || typeof body !== "object" || Array.isArray(body)
        || !("environment" in body) || !isEnvironment(body.environment)
        || body.environment !== config.environment) {
      return noStoreJson({ error: "invalid_request" }, { status: 400 });
    }
    const result = await runNbsWorkerOnce(body.environment);
    return noStoreJson(result);
  } catch (error) {
    if (error instanceof RequestGuardError) {
      return noStoreJson({ error: error.status === 413 ? "request_too_large" : error.status === 415 ? "unsupported_content_type" : "invalid_request" }, { status: error.status });
    }
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}
