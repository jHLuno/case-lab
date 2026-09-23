import "server-only";

import { cookies } from "next/headers";

import {
  getHashedClientIp,
  noStoreJson,
  parseJsonBody,
  readBoundedBody,
  requireJson,
  requireSameOrigin,
  RequestGuardError,
} from "@/lib/case-lab-3/http.server";
import {
  consumeRateLimit,
  getOrderRequestSecret,
  getPublicPaymentEnvironment,
  RateLimitExceededError,
} from "@/lib/case-lab-3/orders.server";
import { claimLiveParticipant } from "@/lib/case-lab-3/live/repository.server";
import {
  issueLiveSession,
  LIVE_SESSION_COOKIE,
  LIVE_SESSION_COOKIE_OPTIONS,
  serializeLiveSession,
} from "@/lib/case-lab-3/live/session.server";
import { LiveInputValidationError, parseParticipantClaim } from "@/lib/case-lab-3/live/validation";
import type { PaymentEnvironment } from "@/lib/case-lab-3/contracts";
import type { LiveClaimParticipantRpcResult } from "@/lib/case-lab-3/database.types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 2048;
const CLAIM_RATE_LIMIT = { scope: "case-lab-3-live-claim", limitCount: 10, bucketSeconds: 60 } as const;

type LiveCookieStore = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: Record<string, unknown>): void;
};

export type LiveSessionRouteDependencies = {
  consumeClaimRateLimit: (request: Request) => Promise<void>;
  getEnvironment: () => PaymentEnvironment;
  claimParticipant: (input: ReturnType<typeof parseParticipantClaim>, environment: PaymentEnvironment) => Promise<LiveClaimParticipantRpcResult>;
  issueSession: (participantId: string, version: number) => string;
  getCookies: () => Promise<LiveCookieStore>;
};

const productionDependencies: LiveSessionRouteDependencies = {
  consumeClaimRateLimit: async (request) => {
    const hashedIp = getHashedClientIp(request, getOrderRequestSecret(), CLAIM_RATE_LIMIT.scope);
    await consumeRateLimit(
      CLAIM_RATE_LIMIT.scope,
      hashedIp,
      CLAIM_RATE_LIMIT.limitCount,
      CLAIM_RATE_LIMIT.bucketSeconds,
    );
  },
  getEnvironment: getPublicPaymentEnvironment,
  claimParticipant: claimLiveParticipant,
  issueSession: (participantId, version) => serializeLiveSession(issueLiveSession(participantId, version)),
  getCookies: async () => (await cookies()) as unknown as LiveCookieStore,
};

function guardError(error: RequestGuardError): Response {
  const code = error.status === 413
    ? "request_too_large"
    : error.status === 415
      ? "unsupported_content_type"
      : "invalid_request";
  return noStoreJson({ error: code }, { status: error.status });
}

export async function handlePost(
  request: Request,
  dependencies: Partial<LiveSessionRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    requireSameOrigin(request);
    requireJson(request);
    await active.consumeClaimRateLimit(request);
    const input = parseParticipantClaim(parseJsonBody(await readBoundedBody(request, MAX_BODY_BYTES)));
    const result = await active.claimParticipant(input, active.getEnvironment());

    if (result.kind !== "claimed") {
      return noStoreJson({ status: "not_available" });
    }

    (await active.getCookies()).set(
      LIVE_SESSION_COOKIE,
      active.issueSession(result.participantId, result.tokenVersion),
      LIVE_SESSION_COOKIE_OPTIONS,
    );
    return noStoreJson({ status: "claimed", displayName: result.displayName });
  } catch (error) {
    if (error instanceof RateLimitExceededError) {
      return noStoreJson({ error: "rate_limited" }, { status: 429 });
    }
    if (error instanceof RequestGuardError) return guardError(error);
    if (error instanceof LiveInputValidationError) {
      return noStoreJson({ error: "invalid_request", issues: error.issues }, { status: 400 });
    }
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function handleDelete(
  request: Request,
  dependencies: Partial<LiveSessionRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    requireSameOrigin(request);
    (await active.getCookies()).set(LIVE_SESSION_COOKIE, "", {
      ...LIVE_SESSION_COOKIE_OPTIONS,
      maxAge: 0,
    });
    return noStoreJson({ status: "signed_out" });
  } catch (error) {
    if (error instanceof RequestGuardError) return guardError(error);
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  return handlePost(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleDelete(request);
}
