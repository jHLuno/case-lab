import { getNbsConfig } from "@/lib/nbs/config.server";
import { getNbsAdminClient } from "@/lib/nbs/db.server";
import { loadNbsPublicResults } from "@/lib/nbs/repository.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const view = new URL(request.url).searchParams.get("view");
  if (view !== "screen" && view !== "full") return noStoreJson({ error: "invalid_request" }, { status: 400 });
  try {
    const config = getNbsConfig();
    return noStoreJson(await loadNbsPublicResults(getNbsAdminClient(), config.environment, view));
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}
