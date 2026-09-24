import "server-only";

import { cookies } from "next/headers";

import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { caseLab3LiveArchivedResponse, isCaseLab3LiveArchived } from "@/lib/case-lab-3/live/archive.server";
import { getPublicPaymentEnvironment } from "@/lib/case-lab-3/orders.server";
import type { PaymentEnvironment } from "@/lib/case-lab-3/contracts";
import type { LiveParticipantStateResponse, LiveSession } from "@/lib/case-lab-3/live/contracts";
import {
  authorizeLiveParticipant,
  loadParticipantState,
  type AuthorizedLiveParticipant,
} from "@/lib/case-lab-3/live/repository.server";
import { LIVE_SESSION_COOKIE, parseLiveSession } from "@/lib/case-lab-3/live/session.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReadCookieStore = { get(name: string): { value: string } | undefined };

export type LiveStateRouteDependencies = {
  getCookies: () => Promise<ReadCookieStore>;
  getEnvironment: () => PaymentEnvironment;
  authorizeParticipant: (session: LiveSession, environment: PaymentEnvironment) => Promise<AuthorizedLiveParticipant | null>;
  loadState: (participant: AuthorizedLiveParticipant) => Promise<LiveParticipantStateResponse>;
};

const productionDependencies: LiveStateRouteDependencies = {
  getCookies: async () => (await cookies()) as unknown as ReadCookieStore,
  getEnvironment: getPublicPaymentEnvironment,
  authorizeParticipant: authorizeLiveParticipant,
  loadState: loadParticipantState,
};

export async function handleGet(
  _request: Request,
  dependencies: Partial<LiveStateRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const rawSession = (await active.getCookies()).get(LIVE_SESSION_COOKIE)?.value;
    const session = parseLiveSession(rawSession);
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });

    const environment = active.getEnvironment();
    if (isCaseLab3LiveArchived(environment)) return caseLab3LiveArchivedResponse();

    const participant = await active.authorizeParticipant(session, environment);
    if (!participant) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    return noStoreJson(await active.loadState(participant));
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleGet(request);
}
