import "server-only";

import { requireCrmAdmin } from "@/lib/crm-auth.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getCaseLab3AdminClient, type CaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";
import type { PaymentEnvironment } from "@/lib/case-lab-3/contracts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MAX_PAGE_SIZE = 100;
const EXPORT_PAGE_SIZE = 5000;

const PAYMENT_STATUSES = new Set([
  "pending",
  "processing",
  "paid",
  "failed",
  "refund_pending",
  "partially_refunded",
  "refunded",
  "review_required",
]);
const TICKET_STATUSES = new Set(["pending", "valid", "used", "cancelled"]);
const RECEIPT_STATUSES = new Set(["not_requested", "queued", "issued", "error", "unknown"]);
const EMAIL_STATUSES = new Set(["pending", "sent", "failed", "unknown"]);
const REFUND_STATUSES = new Set(["requested", "processing", "confirmed", "failed", "unknown", "review_required"]);
const INCIDENT_STATUSES = new Set(["open", "investigating", "resolved", "ignored"]);

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ORDER_SUMMARY_SELECT = [
  "id",
  "order_number",
  "environment",
  "first_name",
  "last_name",
  "participant_email",
  "phone",
  "company",
  "position",
  "tier",
  "amount_minor",
  "currency",
  "payment_status",
  "ticket_status",
  "receipt_status",
  "email_status",
  "paid_amount_minor",
  "refunded_amount_minor",
  "refundable_amount_minor",
  "created_at",
  "updated_at",
].join(",");

export type AdminOrderFilters = {
  environment: PaymentEnvironment;
  search: string;
  paymentStatus: string | null;
  ticketStatus: string | null;
  receiptStatus: string | null;
  emailStatus: string | null;
  refundStatus: string | null;
  incidentStatus: string | null;
  page: number;
  pageSize: number;
};

export type AdminOrderSummary = {
  id: string;
  orderNumber: string;
  environment: PaymentEnvironment;
  firstName: string;
  lastName: string;
  participantEmail: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  tier: "early_bird" | "standard";
  amountMinor: number;
  currency: "KZT";
  paymentStatus: string;
  ticketStatus: string;
  receiptStatus: string;
  emailStatus: string;
  paidAmountMinor: number;
  refundedAmountMinor: number;
  refundableAmountMinor: number;
  ticketNumber: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AdminOrderList = {
  orders: AdminOrderSummary[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

export type AdminOrderListDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  listOrders: (filters: AdminOrderFilters) => Promise<unknown>;
};

type OrderRow = {
  id: string;
  order_number: string;
  environment: PaymentEnvironment;
  first_name: string;
  last_name: string;
  participant_email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  tier: "early_bird" | "standard";
  amount_minor: number;
  currency: "KZT";
  payment_status: string;
  ticket_status: string;
  receipt_status: string;
  email_status: string;
  paid_amount_minor: number;
  refunded_amount_minor: number;
  refundable_amount_minor: number;
  created_at: string;
  updated_at: string;
};

function isEnvironment(value: string | null): value is PaymentEnvironment {
  return value === "test" || value === "live";
}

function optionalEnum(value: string | null, values: ReadonlySet<string>): string | null {
  if (value === null || value === "") return null;
  return values.has(value) ? value : null;
}

function positiveInteger(value: string | null, fallback: number, maximum: number): number | null {
  if (value === null || value === "") return fallback;
  if (!/^\d+$/u.test(value)) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 1 && parsed <= maximum ? parsed : null;
}

export function parseAdminOrderFilters(request: Request): AdminOrderFilters | null {
  const params = new URL(request.url).searchParams;
  const page = positiveInteger(params.get("page"), 1, 100000);
  const pageSize = positiveInteger(params.get("pageSize"), 25, MAX_PAGE_SIZE);
  const search = params.get("search")?.trim() ?? "";
  if (
    !page ||
    !pageSize ||
    search.length > 320 ||
    (params.has("environment") && !isEnvironment(params.get("environment")))
  ) {
    return null;
  }

  const filters = {
    environment: (params.get("environment") ?? "test") as PaymentEnvironment,
    search,
    paymentStatus: optionalEnum(params.get("paymentStatus"), PAYMENT_STATUSES),
    ticketStatus: optionalEnum(params.get("ticketStatus"), TICKET_STATUSES),
    receiptStatus: optionalEnum(params.get("receiptStatus"), RECEIPT_STATUSES),
    emailStatus: optionalEnum(params.get("emailStatus"), EMAIL_STATUSES),
    refundStatus: optionalEnum(params.get("refundStatus"), REFUND_STATUSES),
    incidentStatus: optionalEnum(params.get("incidentStatus"), INCIDENT_STATUSES),
    page,
    pageSize,
  };

  return [
    ["paymentStatus", PAYMENT_STATUSES],
    ["ticketStatus", TICKET_STATUSES],
    ["receiptStatus", RECEIPT_STATUSES],
    ["emailStatus", EMAIL_STATUSES],
    ["refundStatus", REFUND_STATUSES],
    ["incidentStatus", INCIDENT_STATUSES],
  ].every(([key, values]) => {
    const value = params.get(key as string);
    return value === null || value === "" || (values as ReadonlySet<string>).has(value);
  })
    ? filters
    : null;
}

function applyOrderFilters(query: ReturnType<CaseLab3AdminClient["from"]>, filters: AdminOrderFilters) {
  let scoped = query.eq("environment", filters.environment);
  if (filters.paymentStatus) scoped = scoped.eq("payment_status", filters.paymentStatus);
  if (filters.ticketStatus) scoped = scoped.eq("ticket_status", filters.ticketStatus);
  if (filters.receiptStatus) scoped = scoped.eq("receipt_status", filters.receiptStatus);
  if (filters.emailStatus) scoped = scoped.eq("email_status", filters.emailStatus);
  return scoped;
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

async function orderIdsWithRelatedStatus(
  client: CaseLab3AdminClient,
  filters: AdminOrderFilters,
  table: "case_lab_3_refunds" | "case_lab_3_incidents",
  status: string,
): Promise<string[]> {
  const query = client.from(table) as any;
  const { data, error } = await query
    .select("order_id")
    .eq("environment", filters.environment)
    .eq("status", status)
    .limit(EXPORT_PAGE_SIZE);
  if (error) throw new Error("Admin order query failed");
  return (data ?? [])
    .map((row: { order_id: string | null }) => row.order_id)
    .filter((orderId: string | null): orderId is string => typeof orderId === "string");
}

function mapOrder(row: OrderRow, ticketNumber: string | null): AdminOrderSummary {
  return {
    id: row.id,
    orderNumber: row.order_number,
    environment: row.environment,
    firstName: row.first_name,
    lastName: row.last_name,
    participantEmail: row.participant_email,
    phone: row.phone,
    company: row.company,
    position: row.position,
    tier: row.tier,
    amountMinor: row.amount_minor,
    currency: row.currency,
    paymentStatus: row.payment_status,
    ticketStatus: row.ticket_status,
    receiptStatus: row.receipt_status,
    emailStatus: row.email_status,
    paidAmountMinor: row.paid_amount_minor,
    refundedAmountMinor: row.refunded_amount_minor,
    refundableAmountMinor: row.refundable_amount_minor,
    ticketNumber,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ticketNumbersForOrders(client: CaseLab3AdminClient, orderIds: readonly string[]): Promise<Map<string, string>> {
  if (orderIds.length === 0) return new Map();
  const { data, error } = await client
    .from("case_lab_3_tickets")
    .select("order_id, public_ticket_number")
    .in("order_id", [...orderIds]);
  if (error) throw new Error("Admin order query failed");
  return new Map((data ?? []).map((row: { order_id: string; public_ticket_number: string }) => [row.order_id, row.public_ticket_number]));
}

export async function loadAdminOrderRows(
  filters: AdminOrderFilters,
  client: CaseLab3AdminClient = getCaseLab3AdminClient(),
): Promise<{ rows: AdminOrderSummary[]; total: number }> {
  const search = filters.search;
  const base = () => applyOrderFilters(client.from("case_lab_3_orders").select(ORDER_SUMMARY_SELECT, { count: "exact" }), filters);
  let query = base();

  let relatedOrderIds: Set<string> | null = null;
  for (const [table, status] of [
    ["case_lab_3_refunds", filters.refundStatus],
    ["case_lab_3_incidents", filters.incidentStatus],
  ] as const) {
    if (!status) continue;
    const ids = new Set(await orderIdsWithRelatedStatus(client, filters, table, status));
    const existingOrderIds: Set<string> | null = relatedOrderIds;
    relatedOrderIds = existingOrderIds ? new Set<string>([...existingOrderIds].filter((id: string) => ids.has(id))) : ids;
  }
  if (relatedOrderIds && relatedOrderIds.size === 0) return { rows: [], total: 0 };

  if (search) {
    if (search.includes("@")) {
      const email = search.toLowerCase();
      const [participantResult, purchaserResult] = await Promise.all([
        query.eq("participant_email", email).limit(EXPORT_PAGE_SIZE),
        base().eq("purchaser_email", email).limit(EXPORT_PAGE_SIZE),
      ]);
      if (participantResult.error || purchaserResult.error) throw new Error("Admin order query failed");
      const matches = new Map<string, OrderRow>();
      for (const row of [...(participantResult.data ?? []), ...(purchaserResult.data ?? [])] as unknown as OrderRow[]) {
        if (!relatedOrderIds || relatedOrderIds.has(row.id)) matches.set(row.id, row);
      }
      const allRows = [...matches.values()].sort((left, right) => right.created_at.localeCompare(left.created_at));
      const from = (filters.page - 1) * filters.pageSize;
      const pageRows = allRows.slice(from, from + filters.pageSize);
      const ticketNumbers = await ticketNumbersForOrders(client, pageRows.map((row) => row.id));
      return { rows: pageRows.map((row) => mapOrder(row, ticketNumbers.get(row.id) ?? null)), total: allRows.length };
    } else {
      const [{ data: orderMatches, error: orderError }, { data: ticketMatches, error: ticketError }] = await Promise.all([
        applyOrderFilters(client.from("case_lab_3_orders").select("id"), filters)
          .ilike("order_number", `%${escapeLike(search)}%`)
          .limit(EXPORT_PAGE_SIZE),
        client
          .from("case_lab_3_tickets")
          .select("order_id")
          .eq("environment", filters.environment)
          .ilike("public_ticket_number", `%${escapeLike(search)}%`)
          .limit(EXPORT_PAGE_SIZE),
      ]);
      if (orderError || ticketError) throw new Error("Admin order query failed");
      const ids = [...new Set([
        ...((orderMatches ?? []) as unknown as { id: string }[]).map((row) => row.id),
        ...((ticketMatches ?? []) as unknown as { order_id: string }[]).map((row) => row.order_id),
      ])];
      if (ids.length === 0) return { rows: [], total: 0 };
      const existingOrderIds = relatedOrderIds;
      relatedOrderIds = existingOrderIds ? new Set(ids.filter((id) => existingOrderIds.has(id))) : new Set(ids);
      if (relatedOrderIds.size === 0) return { rows: [], total: 0 };
      query = query.in("id", [...relatedOrderIds]);
    }
  }

  if (relatedOrderIds) query = query.in("id", [...relatedOrderIds]);

  const from = (filters.page - 1) * filters.pageSize;
  const { data, error, count } = await query.order("created_at", { ascending: false }).range(from, from + filters.pageSize - 1);
  if (error) throw new Error("Admin order query failed");
  const rows = (data ?? []) as unknown as OrderRow[];
  const ticketNumbers = await ticketNumbersForOrders(client, rows.map((row) => row.id));
  return {
    rows: rows.map((row) => mapOrder(row, ticketNumbers.get(row.id) ?? null)),
    total: count ?? rows.length,
  };
}

export async function listAdminOrders(filters: AdminOrderFilters): Promise<AdminOrderList> {
  const result = await loadAdminOrderRows(filters);
  return {
    orders: result.rows,
    pagination: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: result.total,
      totalPages: Math.ceil(result.total / filters.pageSize),
    },
  };
}

const productionDependencies: AdminOrderListDependencies = {
  requireCrmAdmin,
  listOrders: listAdminOrders,
};

export async function handleGet(
  request: Request,
  dependencies: Partial<AdminOrderListDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    const filters = parseAdminOrderFilters(request);
    if (!filters) return noStoreJson({ error: "invalid_request" }, { status: 400 });
    const result = await active.listOrders(filters);
    if (!result || typeof result !== "object") return noStoreJson({ error: "service_unavailable" }, { status: 503 });
    return noStoreJson(result);
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleGet(request);
}
