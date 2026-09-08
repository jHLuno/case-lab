import "server-only";

import { createHmac } from "node:crypto";
import { isIP } from "node:net";

const RATE_LIMIT_IP_PURPOSE = "rate-limit-ip";

export class RequestGuardError extends Error {
  readonly status: 400 | 403 | 413 | 415;

  constructor(message: string, status: 400 | 403 | 413 | 415) {
    super(message);
    this.name = "RequestGuardError";
    this.status = status;
  }
}

function fail(message: string, status: RequestGuardError["status"]): never {
  throw new RequestGuardError(message, status);
}

function headerValue(input: Headers | Request): Headers {
  return input instanceof Request ? input.headers : input;
}

function contentType(input: Headers | Request): string {
  const value = headerValue(input).get("content-type");
  return value?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

export function requireJson(input: Headers | Request): void {
  if (contentType(input) !== "application/json") {
    fail("Unsupported content type", 415);
  }
}

export function requireForm(input: Headers | Request): void {
  if (contentType(input) !== "application/x-www-form-urlencoded") {
    fail("Unsupported content type", 415);
  }
}

export function parseJsonBody<T>(body: Uint8Array): T {
  try {
    return JSON.parse(new TextDecoder().decode(body)) as T;
  } catch {
    throw new RequestGuardError("Invalid request body", 400);
  }
}

export async function readBoundedBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new TypeError("Body limit must be a non-negative safe integer");
  }
  if (request.bodyUsed) {
    fail("Request body unavailable", 400);
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    if (!/^\d+$/u.test(contentLength.trim())) {
      fail("Invalid content length", 400);
    }
    if (Number(contentLength) > maxBytes) {
      fail("Request body too large", 413);
    }
  }

  if (!request.body) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;

  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;

      total += result.value.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // Preserve the size violation even if the underlying stream cannot cancel cleanly.
        }
        fail("Request body too large", 413);
      }
      chunks.push(result.value);
    }
  } catch (error) {
    if (error instanceof RequestGuardError) throw error;
    fail("Request body unavailable", 400);
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

export function requireSameOrigin(request: Request, expectedOrigin?: string): void {
  let requestOrigin: string;
  try {
    requestOrigin = new URL(request.url).origin;
  } catch {
    fail("Invalid request origin", 403);
  }

  const origin = request.headers.get("origin");
  const expected = expectedOrigin ?? requestOrigin;
  if (!origin || origin === "null" || origin !== expected) {
    fail("Cross-origin request", 403);
  }
}

function normalizeIp(value: string): string {
  const trimmed = value.trim();
  const withoutBrackets = trimmed.startsWith("[") && trimmed.endsWith("]")
    ? trimmed.slice(1, -1)
    : trimmed;
  if (!withoutBrackets || isIP(withoutBrackets) === 0) {
    fail("Client IP unavailable", 400);
  }
  return withoutBrackets.toLowerCase();
}

function firstForwardedIp(value: string): string {
  const first = value.split(",", 1)[0]?.trim();
  if (!first) fail("Client IP unavailable", 400);
  return normalizeIp(first);
}

export function getHashedClientIp(
  input: Headers | Request,
  secret: string,
  scope: string,
): string {
  if (typeof secret !== "string" || secret.length < 32 || !/^[a-z0-9][a-z0-9-]{0,63}$/iu.test(scope)) {
    throw new Error("Client IP hashing configuration incomplete");
  }

  const headers = headerValue(input);
  const vercelForwarded = headers.get("x-vercel-forwarded-for");
  // Vercel owns this normalized header. Public fallback headers are never trusted.
  if (!vercelForwarded) fail("Client IP unavailable", 400);
  const platformIp = firstForwardedIp(vercelForwarded);

  return createHmac("sha256", secret)
    .update(`${RATE_LIMIT_IP_PURPOSE}\0${scope}\0${platformIp}`, "utf8")
    .digest("hex");
}

export function noStoreJson<T>(body: T, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(body, { ...init, headers });
}
