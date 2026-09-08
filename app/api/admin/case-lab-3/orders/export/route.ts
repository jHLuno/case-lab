import "server-only";

import { requireCrmAdmin } from "@/lib/crm-auth.server";
import { buildCsv, type CsvColumn } from "@/lib/case-lab-3/csv.server";
import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getCaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";
import {
  loadAdminOrderRows,
  parseAdminOrderFilters,
  type AdminOrderFilters,
} from "../route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ExportRow = Record<string, unknown>;

export type AdminExportResult = {
  filename: string;
  csv: string;
  rowCount: number;
};

export type ExportRouteDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  exportOrders: (filters: AdminOrderFilters) => Promise<AdminExportResult>;
  auditExport: (entry: { actorId: string; action: string; rowCount: number; environment: string }) => Promise<void>;
};

const CSV_COLUMNS: readonly CsvColumn<ExportRow>[] = [
  { key: "orderNumber", label: "Номер заказа" },
  { key: "ticketNumber", label: "Номер билета" },
  { key: "firstName", label: "Имя участника" },
  { key: "lastName", label: "Фамилия участника" },
  { key: "participantEmail", label: "Email участника" },
  { key: "phone", label: "Телефон участника" },
  { key: "company", label: "Компания" },
  { key: "position", label: "Должность" },
  { key: "tier", label: "Тариф" },
  { key: "amountMinor", label: "Сумма в тиынах" },
  { key: "currency", label: "Валюта" },
  { key: "paymentStatus", label: "Статус оплаты" },
  { key: "ticketStatus", label: "Статус билета" },
  { key: "createdAt", label: "Создан" },
];

export async function exportAdminOrders(filters: AdminOrderFilters): Promise<AdminExportResult> {
  const result = await loadAdminOrderRows({ ...filters, page: 1, pageSize: 5000 });
  const rows: ExportRow[] = result.rows.map((order) => ({
    orderNumber: order.orderNumber,
    ticketNumber: order.ticketNumber,
    firstName: order.firstName,
    lastName: order.lastName,
    participantEmail: order.participantEmail,
    phone: order.phone,
    company: order.company,
    position: order.position,
    tier: order.tier,
    amountMinor: order.amountMinor,
    currency: order.currency,
    paymentStatus: order.paymentStatus,
    ticketStatus: order.ticketStatus,
    createdAt: order.createdAt,
  }));

  return {
    filename: "case-lab-3-orders.csv",
    csv: buildCsv(rows, CSV_COLUMNS),
    rowCount: rows.length,
  };
}

async function auditAdminExport(
  entry: { actorId: string; action: string; rowCount: number; environment: string },
): Promise<void> {
  const { error } = await getCaseLab3AdminClient().from("case_lab_3_audit_log").insert({
    environment: entry.environment as "test" | "live",
    action: entry.action,
    target_table: "case_lab_3_orders",
    target_id: null,
    before_summary: null,
    after_summary: { rowCount: entry.rowCount, export: "participant_orders" },
    actor_id: entry.actorId,
    actor_label: "CRM admin",
  });
  if (error) throw new Error("Admin audit unavailable");
}

const productionDependencies: ExportRouteDependencies = {
  requireCrmAdmin,
  exportOrders: exportAdminOrders,
  auditExport: auditAdminExport,
};

export async function handleGet(
  request: Request,
  dependencies: Partial<ExportRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    const filters = parseAdminOrderFilters(request);
    if (!filters) return noStoreJson({ error: "invalid_request" }, { status: 400 });

    const result = await active.exportOrders(filters);
    await active.auditExport({
      actorId: "crm_admin",
      action: "orders_exported",
      rowCount: result.rowCount,
      environment: filters.environment,
    });

    return new Response(result.csv, {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${result.filename}"`,
      },
    });
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleGet(request);
}
