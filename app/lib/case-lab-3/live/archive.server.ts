import "server-only";

import { noStoreJson } from "@/lib/case-lab-3/http.server";

export function isCaseLab3LiveArchived(environment = "live"): boolean {
  return process.env.NODE_ENV === "production" && environment === "live";
}

export function caseLab3LiveArchivedResponse(): Response {
  return noStoreJson({ error: "event_ended" }, { status: 410 });
}
