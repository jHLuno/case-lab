import "server-only";

import { cookies } from "next/headers";

import type { PaymentEnvironment } from "@/lib/case-lab-3/contracts";
import type { LiveSaveSubmissionRpcResult } from "@/lib/case-lab-3/database.types";
import {
  noStoreJson,
  parseJsonBody,
  readBoundedBody,
  requireJson,
  requireSameOrigin,
  RequestGuardError,
} from "@/lib/case-lab-3/http.server";
import {
  authorizeLiveParticipant,
  saveParticipantSubmission,
  type AuthorizedLiveParticipant,
} from "@/lib/case-lab-3/live/repository.server";
import { LIVE_SESSION_COOKIE, parseLiveSession } from "@/lib/case-lab-3/live/session.server";
import { LiveInputValidationError, parseSubmission } from "@/lib/case-lab-3/live/validation";
import type { LiveSession } from "@/lib/case-lab-3/live/contracts";
import { getPublicPaymentEnvironment } from "@/lib/case-lab-3/orders.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;

type ReadCookieStore = { get(name: string): { value: string } | undefined };

export type LiveSubmissionRouteDependencies = {
  getCookies: () => Promise<ReadCookieStore>;
  getEnvironment: () => PaymentEnvironment;
  authorizeParticipant: (session: LiveSession, environment: PaymentEnvironment) => Promise<AuthorizedLiveParticipant | null>;
  saveSubmission: (input: {
    environment: PaymentEnvironment;
    caseId: string;
    participantId: string;
    answer: string;
  }) => Promise<LiveSaveSubmissionRpcResult>;
};

const productionDependencies: LiveSubmissionRouteDependencies = {
  getCookies: async () => (await cookies()) as unknown as ReadCookieStore,
  getEnvironment: getPublicPaymentEnvironment,
  authorizeParticipant: authorizeLiveParticipant,
  saveSubmission: saveParticipantSubmission,
};

function guardError(error: RequestGuardError): Response {
  const code = error.status === 413
    ? "request_too_large"
    : error.status === 415
      ? "unsupported_content_type"
      : "invalid_request";
  return noStoreJson({ error: code }, { status: error.status });
}

export async function handlePut(
  request: Request,
  context: { params: Promise<{ id: string }> },
  dependencies: Partial<LiveSubmissionRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    requireSameOrigin(request);
    requireJson(request);
    const body = await readBoundedBody(request, MAX_BODY_BYTES);
    const { id } = await context.params;
    if (!UUID_PATTERN.test(id)) return noStoreJson({ error: "invalid_request" }, { status: 400 });

    const session = parseLiveSession((await active.getCookies()).get(LIVE_SESSION_COOKIE)?.value);
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    const environment = active.getEnvironment();
    const participant = await active.authorizeParticipant(session, environment);
    if (!participant) return noStoreJson({ error: "unauthorized" }, { status: 401 });

    const input = parseSubmission(parseJsonBody(body));
    const result = await active.saveSubmission({
      environment,
      caseId: id,
      participantId: participant.id,
      answer: input.answer,
    });
    if (result.kind === "closed") {
      return noStoreJson({ error: "case_closed" }, { status: 409 });
    }
    if (result.kind === "unauthorized") {
      return noStoreJson({ error: "unauthorized" }, { status: 401 });
    }
    return noStoreJson({
      status: "saved",
      contentVersion: result.contentVersion,
      savedAt: result.savedAt,
      participationPoints: result.participationPoints,
    });
  } catch (error) {
    if (error instanceof RequestGuardError) return guardError(error);
    if (error instanceof LiveInputValidationError) {
      return noStoreJson({ error: "invalid_request", issues: error.issues }, { status: 400 });
    }
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handlePut(request, context);
}
