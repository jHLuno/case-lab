"use client";

import Link from "next/link";
import { useDeferredValue, useEffect, useState } from "react";

type Environment = "test" | "live";

type Order = {
  id: string;
  orderNumber: string;
  environment: Environment;
  firstName: string;
  lastName: string;
  participantEmail: string;
  company: string | null;
  position: string | null;
  tier: "early_bird" | "standard";
  amountMinor: number;
  currency: "KZT";
  paymentStatus: string;
  ticketStatus: string;
  receiptStatus: string;
  emailStatus: string;
  ticketNumber: string | null;
  createdAt: string;
};

type OrderList = {
  orders: Order[];
  pagination: { page: number; pageSize: number; total: number; totalPages: number };
};

type Allocation = {
  id: string;
  allocationCategory: "paid" | "invited" | "organizer_reserved";
  quantity: number;
  tier: "early_bird" | "standard" | null;
  releasedAt: string | null;
  reason: string;
};

type OrdersClientProps = {
  csrfToken: string;
  initialData: OrderList;
};

const initialSettings = { onlineSalesLimit: 70, salesEnabled: false };

function labelStatus(value: string): string {
  return value.replaceAll("_", " ");
}

function formatAmount(amountMinor: number): string {
  return `${new Intl.NumberFormat("ru-RU").format(amountMinor / 100)} ₸`;
}

export default function OrdersClient({ csrfToken, initialData }: OrdersClientProps): React.ReactElement {
  const [environment, setEnvironment] = useState<Environment>("test");
  const [search, setSearch] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [ticketStatus, setTicketStatus] = useState("");
  const [orders, setOrders] = useState(initialData.orders);
  const [pagination, setPagination] = useState(initialData.pagination);
  const [settings, setSettings] = useState(initialSettings);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allocationReason, setAllocationReason] = useState("");
  const [allocationQuantity, setAllocationQuantity] = useState("1");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ environment, page: "1", pageSize: "25" });
    if (deferredSearch.trim()) params.set("search", deferredSearch.trim());
    if (paymentStatus) params.set("paymentStatus", paymentStatus);
    if (ticketStatus) params.set("ticketStatus", ticketStatus);

    setLoading(true);
    fetch(`/api/admin/case-lab-3/orders?${params.toString()}`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("orders");
        return response.json() as Promise<OrderList>;
      })
      .then((data) => {
        setOrders(data.orders);
        setPagination(data.pagination);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("Не удалось загрузить заказы.");
      })
      .finally(() => setLoading(false));

    return () => controller.abort();
  }, [deferredSearch, environment, paymentStatus, ticketStatus]);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetch(`/api/admin/case-lab-3/settings?environment=${environment}`, { cache: "no-store", signal: controller.signal }),
      fetch(`/api/admin/case-lab-3/allocations?environment=${environment}`, { cache: "no-store", signal: controller.signal }),
    ])
      .then(async ([settingsResponse, allocationsResponse]) => {
        if (!settingsResponse.ok || !allocationsResponse.ok) throw new Error("inventory");
        const [settingsData, allocationsData] = await Promise.all([settingsResponse.json(), allocationsResponse.json()]);
        setSettings({ onlineSalesLimit: settingsData.onlineSalesLimit, salesEnabled: settingsData.salesEnabled });
        setAllocations(allocationsData.allocations);
      })
      .catch((error: unknown) => {
        if (!(error instanceof DOMException && error.name === "AbortError")) setMessage("Не удалось загрузить настройки вместимости.");
      });
    return () => controller.abort();
  }, [environment]);

  async function mutate(path: string, body: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("mutation");
      return true;
    } catch {
      setMessage("Операция не выполнена.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveSettings(): Promise<void> {
    if (await mutate("/api/admin/case-lab-3/settings", { environment, ...settings, onlineSalesLimit: Number(settings.onlineSalesLimit) })) {
      setMessage("Настройки сохранены.");
    }
  }

  async function createAllocation(): Promise<void> {
    if (!allocationReason.trim()) {
      setMessage("Укажите причину выделения.");
      return;
    }
    if (await mutate("/api/admin/case-lab-3/allocations", {
      environment,
      allocationCategory: "invited",
      quantity: Number(allocationQuantity),
      tier: "standard",
      countsTowardOnlineLimit: false,
      holdsEarlyBirdQuota: false,
      reason: allocationReason.trim(),
    })) {
      setAllocationReason("");
      setMessage("Места выделены.");
      const response = await fetch(`/api/admin/case-lab-3/allocations?environment=${environment}`, { cache: "no-store" });
      if (response.ok) setAllocations((await response.json()).allocations);
    }
  }

  async function releaseAllocation(id: string): Promise<void> {
    const releaseReason = window.prompt("Причина освобождения мест:");
    if (!releaseReason?.trim()) return;
    if (await mutate(`/api/admin/case-lab-3/allocations/${id}/release`, { environment, reason: releaseReason.trim() })) {
      setAllocations((current) => current.map((allocation) => allocation.id === id ? { ...allocation, releasedAt: new Date().toISOString() } : allocation));
      setMessage("Места освобождены.");
    }
  }

  const exportParams = new URLSearchParams({ environment });
  if (search.trim()) exportParams.set("search", search.trim());
  if (paymentStatus) exportParams.set("paymentStatus", paymentStatus);
  if (ticketStatus) exportParams.set("ticketStatus", ticketStatus);

  return (
    <div>
      <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-black/40" style={{ fontFamily: "var(--font-body)" }}>
            Case Lab III / CRM
          </p>
          <h1 className="text-3xl font-bold uppercase tracking-[0.02em] text-black" style={{ fontFamily: "var(--font-heading)" }}>
            Заказы
          </h1>
          <p className="mt-2 text-sm text-black/45" style={{ fontFamily: "var(--font-body)" }}>
            {pagination.total} заказов в выбранной среде
          </p>
        </div>
        <a
          href={`/api/admin/case-lab-3/orders/export?${exportParams.toString()}`}
          className="inline-flex w-fit rounded-full bg-black px-5 py-2.5 text-sm text-white hover:bg-[#040082]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Скачать CSV
        </a>
      </header>

      <section className="mb-6 grid gap-3 rounded-2xl border border-black/[0.08] bg-white p-4 md:grid-cols-[140px_minmax(220px,1fr)_170px_170px]">
        <label className="text-xs text-black/50" style={{ fontFamily: "var(--font-body)" }}>
          Среда
          <select value={environment} onChange={(event) => setEnvironment(event.target.value as Environment)} className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-black">
            <option value="test">Тест</option>
            <option value="live">Live</option>
          </select>
        </label>
        <label className="text-xs text-black/50" style={{ fontFamily: "var(--font-body)" }}>
          Заказ, билет или точный email
          <input value={search} onChange={(event) => setSearch(event.target.value)} className="mt-1.5 w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-black" placeholder="CL3-... или name@example.com" />
        </label>
        <label className="text-xs text-black/50" style={{ fontFamily: "var(--font-body)" }}>
          Оплата
          <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-black">
            <option value="">Все статусы</option>
            <option value="paid">Оплачено</option>
            <option value="failed">Ошибка</option>
            <option value="review_required">Проверка</option>
            <option value="refunded">Возврат</option>
          </select>
        </label>
        <label className="text-xs text-black/50" style={{ fontFamily: "var(--font-body)" }}>
          Билет
          <select value={ticketStatus} onChange={(event) => setTicketStatus(event.target.value)} className="mt-1.5 w-full rounded-lg border border-black/10 bg-white px-3 py-2 text-sm text-black">
            <option value="">Все статусы</option>
            <option value="pending">Ожидает</option>
            <option value="valid">Действителен</option>
            <option value="used">Использован</option>
            <option value="cancelled">Отменён</option>
          </select>
        </label>
      </section>

      <section className="mb-6 overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-left" style={{ fontFamily: "var(--font-body)" }}>
            <thead className="border-b border-black/[0.08] text-[11px] uppercase tracking-wider text-black/40">
              <tr>
                <th className="px-4 py-3 font-normal">Заказ</th>
                <th className="px-4 py-3 font-normal">Участник</th>
                <th className="px-4 py-3 font-normal">Тариф</th>
                <th className="px-4 py-3 font-normal">Сумма</th>
                <th className="px-4 py-3 font-normal">Оплата</th>
                <th className="px-4 py-3 font-normal">Билет</th>
                <th className="px-4 py-3 font-normal">Дата</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-black/40">Загрузка...</td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-black/40">Заказы не найдены.</td></tr>
              ) : orders.map((order) => (
                <tr key={order.id} className="border-b border-black/[0.05] align-top hover:bg-black/[0.02]">
                  <td className="px-4 py-3"><Link href={`/crm/case-lab-3/orders/${order.id}/`} className="text-sm font-medium text-[#040082] hover:underline">{order.orderNumber}</Link><div className="mt-1 text-xs text-black/35">{order.ticketNumber ?? "Билет ещё не создан"}</div></td>
                  <td className="px-4 py-3"><div className="text-sm text-black">{order.firstName} {order.lastName}</div><div className="mt-1 text-xs text-black/45">{order.participantEmail}</div></td>
                  <td className="px-4 py-3 text-sm text-black/65">{order.tier === "early_bird" ? "Early Bird" : "Стандарт"}</td>
                  <td className="px-4 py-3 text-sm text-black/65">{formatAmount(order.amountMinor)}</td>
                  <td className="px-4 py-3"><span className="rounded-full bg-black/[0.05] px-2 py-1 text-xs text-black/65">{labelStatus(order.paymentStatus)}</span></td>
                  <td className="px-4 py-3"><span className="rounded-full bg-black/[0.05] px-2 py-1 text-xs text-black/65">{labelStatus(order.ticketStatus)}</span></td>
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-black/40">{new Date(order.createdAt).toLocaleDateString("ru-RU")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <form className="rounded-2xl border border-black/[0.08] bg-white p-5" onSubmit={(event) => { event.preventDefault(); void saveSettings(); }}>
          <h2 className="text-base font-semibold text-black" style={{ fontFamily: "var(--font-heading)" }}>Продажи и лимит</h2>
          <p className="mt-1 text-xs text-black/45" style={{ fontFamily: "var(--font-body)" }}>Ограничение действует только на новые заказы.</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs text-black/50">Лимит<input type="number" min={70} max={100} value={settings.onlineSalesLimit} onChange={(event) => setSettings((current) => ({ ...current, onlineSalesLimit: Number(event.target.value) }))} className="mt-1 block w-24 rounded-lg border border-black/10 px-3 py-2 text-sm text-black" /></label>
            <label className="flex items-center gap-2 pb-2 text-sm text-black"><input type="checkbox" checked={settings.salesEnabled} onChange={(event) => setSettings((current) => ({ ...current, salesEnabled: event.target.checked }))} /> Продажи включены</label>
            <button type="submit" disabled={saving} className="rounded-full bg-[#040082] px-4 py-2 text-sm text-white disabled:opacity-50">Сохранить</button>
          </div>
        </form>
        <form className="rounded-2xl border border-black/[0.08] bg-white p-5" onSubmit={(event) => { event.preventDefault(); void createAllocation(); }}>
          <h2 className="text-base font-semibold text-black" style={{ fontFamily: "var(--font-heading)" }}>Ручное выделение мест</h2>
          <p className="mt-1 text-xs text-black/45" style={{ fontFamily: "var(--font-body)" }}>Атомарная проверка физической и онлайн-вместимости.</p>
          <div className="mt-4 flex flex-wrap items-end gap-3">
            <label className="text-xs text-black/50">Количество<input type="number" min={1} max={100} value={allocationQuantity} onChange={(event) => setAllocationQuantity(event.target.value)} className="mt-1 block w-24 rounded-lg border border-black/10 px-3 py-2 text-sm text-black" /></label>
            <label className="min-w-[220px] flex-1 text-xs text-black/50">Причина<input value={allocationReason} onChange={(event) => setAllocationReason(event.target.value)} className="mt-1 block w-full rounded-lg border border-black/10 px-3 py-2 text-sm text-black" /></label>
            <button type="submit" disabled={saving} className="rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-50">Выделить</button>
          </div>
        </form>
      </section>

      <section className="mt-4 rounded-2xl border border-black/[0.08] bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-black" style={{ fontFamily: "var(--font-heading)" }}>Ручные выделения</h2>
            <p className="mt-1 text-xs text-black/45" style={{ fontFamily: "var(--font-body)" }}>Оплаченные места нельзя освобождать вручную.</p>
          </div>
          <span className="text-xs text-black/40">{allocations.filter((allocation) => !allocation.releasedAt).length} активных</span>
        </div>
        <div className="mt-4 divide-y divide-black/[0.06]">
          {allocations.length === 0 ? <p className="py-3 text-sm text-black/45">Выделений пока нет.</p> : allocations.map((allocation) => (
            <div key={allocation.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div><span className="text-black">{allocation.quantity} мест / {allocation.allocationCategory}</span><span className="ml-2 text-black/40">{allocation.tier ?? "без тарифа"}</span><p className="mt-1 text-xs text-black/45">{allocation.reason}</p></div>
              {allocation.releasedAt ? <span className="text-xs text-black/40">Освобождено</span> : allocation.allocationCategory === "paid" ? <span className="text-xs text-black/40">Оплачено</span> : <button type="button" disabled={saving} onClick={() => void releaseAllocation(allocation.id)} className="rounded-full border border-black/10 px-3 py-1.5 text-xs text-black hover:bg-black/[0.04] disabled:opacity-50">Освободить</button>}
            </div>
          ))}
        </div>
      </section>

      {message ? <p className="mt-4 text-sm text-black/60" role="status">{message}</p> : null}
    </div>
  );
}
