import { cookies } from "next/headers";

import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getNbsConfig } from "@/lib/nbs/config.server";
import { getNbsAdminClient } from "@/lib/nbs/db.server";
import { loadNbsParticipantState, NbsRepositoryError } from "@/lib/nbs/repository.server";
import { NBS_SESSION_COOKIE, NBS_SESSION_COOKIE_OPTIONS, parseNbsSession, type NbsSession } from "@/lib/nbs/session.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const cookieStore = await cookies();
  try {
    const config = getNbsConfig();
    const cookie = cookieStore.get(NBS_SESSION_COOKIE)?.value;
    const parsed = parseNbsSession(cookie);
    const session: NbsSession | null = parsed ? { ...parsed, environment: config.environment } : null;
    const state = await loadNbsParticipantState(getNbsAdminClient(), config.environment, session, config.tokenSecret);
    return noStoreJson(state);
  } catch (error) {
    if (error instanceof NbsRepositoryError && error.code === "unauthorized") {
      cookieStore.set(NBS_SESSION_COOKIE, "", { ...NBS_SESSION_COOKIE_OPTIONS, maxAge: 0, expires: new Date(0) });
      return noStoreJson({ error: "unauthorized" }, { status: 401 });
    }
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}
