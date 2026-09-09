import { notFound } from "next/navigation";
import Link from "next/link";

import { issueCrmCsrfToken, requireCrmAdmin } from "@/lib/crm-auth.server";
import { loadAdminOrderDetail, type AdminOrderDetail } from "@/api/admin/case-lab-3/orders/[id]/route";
import CrmSectionNav from "../../../components/CrmSectionNav";
import OrderActionsClient from "./OrderActionsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function formatAmount(amountMinor: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(amountMinor / 100)} ₸`;
}

function formatDate(value: string | null): string {
  return value ? new Date(value).toLocaleString("ru-RU") : "Не указано";
}

function statusLabel(value: string): string {
  return value.replaceAll("_", " ");
}

function Summary({ detail }: { detail: AdminOrderDetail }): React.ReactElement {
  const fields = [
    ["Оплата", statusLabel(detail.paymentStatus)],
    ["Билет", statusLabel(detail.ticketStatus)],
    ["Чек", statusLabel(detail.receiptStatus)],
    ["Email", statusLabel(detail.emailStatus)],
    ["Сумма", formatAmount(detail.amountMinor)],
    ["Возвращено", formatAmount(detail.refundedAmountMinor)],
    ["К возврату", formatAmount(detail.refundableAmountMinor)],
    ["Создан", formatDate(detail.createdAt)],
  ];
  return (
    <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {fields.map(([label, value]) => (
        <div key={label} className="rounded-xl bg-black/[0.03] p-3">
          <dt className="text-[11px] uppercase tracking-wider text-black/40">{label}</dt>
          <dd className="mt-1 text-sm text-black">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function RowList({ title, children }: { title: string; children: React.ReactNode }): React.ReactElement {
  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-5">
      <h2 className="mb-4 text-base font-semibold text-black" style={{ fontFamily: "var(--font-heading)" }}>{title}</h2>
      {children}
    </section>
  );
}

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await requireCrmAdmin();
  if (!session) {
    return <main className="min-h-screen bg-white p-8 text-sm text-black/60">Требуется вход в CRM. <Link href="/crm/" className="text-[#040082] hover:underline">Войти</Link></main>;
  }

  const { id } = await params;
  const detail = await loadAdminOrderDetail(id);
  if (!detail) notFound();

  return (
    <main className="min-h-screen bg-[#fafafa] px-5 py-7 md:px-10 md:py-10">
      <div className="mx-auto max-w-[1200px]">
        <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
          <CrmSectionNav active="case-lab-3" />
          <Link href="/crm/case-lab-3/" className="text-sm text-black/50 hover:text-black">Назад к заказам</Link>
        </div>
        <header className="mb-6 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.16em] text-black/40">{detail.environment} / заказ</p>
            <h1 className="mt-2 text-3xl font-bold uppercase tracking-[0.02em] text-black" style={{ fontFamily: "var(--font-heading)" }}>{detail.orderNumber}</h1>
          </div>
          <p className="text-sm text-black/45">ID: {detail.id}</p>
        </header>

        <Summary detail={detail} />

        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_340px]">
          <div className="space-y-4">
            <RowList title="Участник и покупатель">
              <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
                <div><dt className="text-xs text-black/40">Участник</dt><dd className="mt-1 text-black">{detail.firstName} {detail.lastName}</dd></div>
                <div><dt className="text-xs text-black/40">Email участника</dt><dd className="mt-1 text-black">{detail.participantEmail}</dd></div>
                <div><dt className="text-xs text-black/40">Телефон</dt><dd className="mt-1 text-black">{detail.phone ?? "Не указан"}</dd></div>
                <div><dt className="text-xs text-black/40">Компания / должность</dt><dd className="mt-1 text-black">{[detail.company, detail.position].filter(Boolean).join(" / ") || "Не указаны"}</dd></div>
                <div><dt className="text-xs text-black/40">Email покупателя</dt><dd className="mt-1 text-black">{detail.purchaserEmail}</dd></div>
                <div><dt className="text-xs text-black/40">Email для чека</dt><dd className="mt-1 text-black">{detail.fiscalEmail}</dd></div>
              </dl>
            </RowList>

            <RowList title="Билет">
              {detail.ticket ? (
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div><span className="text-xs text-black/40">Номер</span><p className="mt-1 text-black">{detail.ticket.publicTicketNumber}</p></div>
                  <div><span className="text-xs text-black/40">Статус</span><p className="mt-1 text-black">{statusLabel(detail.ticket.status)}</p></div>
                  <div><span className="text-xs text-black/40">Ревизия</span><p className="mt-1 text-black">{detail.ticket.currentRevision?.revisionNumber ?? "Не создана"}</p></div>
                  <div><span className="text-xs text-black/40">Версия доступа</span><p className="mt-1 text-black">{detail.ticket.currentRevision?.tokenVersion ?? "Не создана"}</p></div>
                </div>
              ) : <p className="text-sm text-black/45">Билет ещё не создан.</p>}
            </RowList>

            <RowList title="Оплата, чеки и возвраты">
              <div className="space-y-3 text-sm">
                {detail.paymentAttempts.map((attempt) => <div key={attempt.id} className="border-b border-black/[0.06] pb-3"><div className="flex flex-wrap justify-between gap-2"><span>{attempt.externalId} / {statusLabel(attempt.status)}</span><span className="text-black/45">{formatDate(attempt.createdAt)}</span></div><p className="mt-1 text-xs text-black/45">TipTop transaction ID: {attempt.providerTransactionId ?? "Не присвоен"}</p></div>)}
                {detail.fiscalOperations.map((operation) => <div key={operation.id} className="border-b border-black/[0.06] pb-3"><div className="flex flex-wrap justify-between gap-2"><span>{operation.receiptType} / {statusLabel(operation.status)} / {formatAmount(operation.amountMinor)}</span><span className="text-black/45">Kassir ID: {operation.kassirReceiptId ?? "Не присвоен"}</span></div><p className="mt-1 text-xs text-black/45">DocumentNumber: {typeof operation.fiscalFields.fiscalDocumentNumber === "string" ? operation.fiscalFields.fiscalDocumentNumber : "Не присвоен"} · FiscalSign: {typeof operation.fiscalFields.fiscalSign === "string" ? operation.fiscalFields.fiscalSign : "Не присвоен"}</p>{operation.receiptUrl ? <a href={operation.receiptUrl} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-[#040082] hover:underline">Открыть чек / OFD</a> : null}</div>)}
                {detail.refunds.map((refund) => <div key={refund.id} className="flex flex-wrap justify-between gap-2 border-b border-black/[0.06] pb-3"><span>Возврат {formatAmount(refund.amountMinor)} / {statusLabel(refund.status)}</span><span className="text-black/45">{refund.operationKey}</span></div>)}
                {!detail.paymentAttempts.length && !detail.fiscalOperations.length && !detail.refunds.length ? <p className="text-black/45">Операций пока нет.</p> : null}
              </div>
            </RowList>
          </div>

          <div className="space-y-4">
            <OrderActionsClient
              csrfToken={issueCrmCsrfToken(session)}
              orderId={detail.id}
              participant={{ firstName: detail.firstName, lastName: detail.lastName, email: detail.participantEmail, phone: detail.phone, company: detail.company, position: detail.position }}
              hasReceipt={detail.fiscalOperations.some((operation) => Boolean(operation.receiptUrl))}
              ticketStatus={detail.ticketStatus}
            />
            <RowList title="Email-доставки">
              <div className="space-y-3 text-sm">
                {detail.emailDeliveries.map((delivery) => <div key={delivery.id} className="border-b border-black/[0.06] pb-3"><div className="flex justify-between gap-2"><span>{delivery.deliveryKind} / {statusLabel(delivery.status)}</span><span className="text-black/40">{formatDate(delivery.createdAt)}</span></div><p className="mt-1 text-xs text-black/45">{delivery.recipientEmail}</p></div>)}
                {!detail.emailDeliveries.length ? <p className="text-black/45">Доставок пока нет.</p> : null}
              </div>
            </RowList>
            <RowList title="Инциденты и аудит">
              <div className="space-y-3 text-sm">
                {detail.incidents.map((incident) => <div key={incident.id} className="border-b border-black/[0.06] pb-3"><span>{incident.incidentType} / {incident.status}</span><p className="mt-1 text-xs text-black/40">{formatDate(incident.createdAt)}</p></div>)}
                {detail.audit.map((entry) => <div key={entry.id} className="border-b border-black/[0.06] pb-3"><span>{entry.action}</span><p className="mt-1 text-xs text-black/40">{entry.actorLabel ?? entry.actorId} / {formatDate(entry.createdAt)}</p></div>)}
                {!detail.incidents.length && !detail.audit.length ? <p className="text-black/45">Записей пока нет.</p> : null}
              </div>
            </RowList>
          </div>
        </div>
      </div>
    </main>
  );
}
