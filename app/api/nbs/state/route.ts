import { cookies } from "next/headers";

import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getNbsConfig } from "@/lib/nbs/config.server";
import { getNbsAdminClient } from "@/lib/nbs/db.server";
import { loadNbsParticipantState, NbsRepositoryError } from "@/lib/nbs/repository.server";
import { NBS_SESSION_COOKIE, parseNbsSession, type NbsSession } from "@/lib/nbs/session.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const config = getNbsConfig();
    const cookie = (await cookies()).get(NBS_SESSION_COOKIE)?.value;
    const parsed = parseNbsSession(cookie);
    const session: NbsSession | null = parsed ? { ...parsed, environment: config.environment } : null;
    const state = await loadNbsParticipantState(getNbsAdminClient(), config.environment, session, config.tokenSecret);
    return noStoreJson(state);
  } catch (error) {
    if (error instanceof NbsRepositoryError && error.code === "unauthorized") {
      return noStoreJson({ error: "unauthorized" }, { status: 401 });
    }
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}
