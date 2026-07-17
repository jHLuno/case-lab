export type CrmSource = "main" | "evp-pro";

const TABLE_BY_SOURCE: Record<CrmSource, string> = {
  main: "leads",
  "evp-pro": "evp_pro_leads",
};

export function resolveCrmTable(source: string | null): string | null {
  if (source === "main" || source === "evp-pro") {
    return TABLE_BY_SOURCE[source];
  }
  return null;
}
