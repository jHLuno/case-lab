export type CrmSource = "main" | "evp-pro" | "hr-intensive";

const TABLE_BY_SOURCE: Record<CrmSource, string> = {
  main: "leads",
  "evp-pro": "evp_pro_leads",
  "hr-intensive": "hr_intensive_leads",
};

export function resolveCrmTable(source: string | null): string | null {
  if (source && Object.prototype.hasOwnProperty.call(TABLE_BY_SOURCE, source)) {
    return TABLE_BY_SOURCE[source as CrmSource];
  }
  return null;
}
