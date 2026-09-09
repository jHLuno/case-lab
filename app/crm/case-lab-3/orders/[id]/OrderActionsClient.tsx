"use client";

import { useRouter } from "next/navigation";
import { startTransition, useState } from "react";

type Participant = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
};

export default function OrderActionsClient({
  csrfToken,
  orderId,
  participant: initialParticipant,
  hasReceipt,
  ticketStatus: initialTicketStatus,
}: {
  csrfToken: string;
  orderId: string;
  participant: Participant;
  hasReceipt: boolean;
  ticketStatus: string;
}): React.ReactElement {
  const router = useRouter();
  const [participant, setParticipant] = useState(initialParticipant);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [ticketCancelled, setTicketCancelled] = useState(initialTicketStatus === "cancelled");
  const [message, setMessage] = useState("");

  async function action(path: string, body: Record<string, unknown> = {}): Promise<boolean> {
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken, "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error("action");
      return true;
    } catch {
      setMessage("Операция не выполнена.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function transfer(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (!reason.trim()) {
      setMessage("Укажите причину передачи.");
      return;
    }
    if (await action(`/api/admin/case-lab-3/orders/${orderId}/transfer`, { ...participant, reason: reason.trim() })) {
      setMessage("Участник обновлён, новый билет поставлен в очередь отправки.");
      setReason("");
    }
  }

  async function cancelTicket(): Promise<void> {
    if (!window.confirm("Отменить билет? Оплата не возвращается, место не освобождается.")) return;
    if (await action(`/api/admin/case-lab-3/orders/${orderId}/cancel-ticket`, { reason: "CRM cancellation" })) {
      setTicketCancelled(true);
      setMessage("Билет отменён. Оплата не возвращена.");
      startTransition(() => router.refresh());
    }
  }

  return (
    <section className="rounded-2xl border border-black/[0.08] bg-white p-5" aria-labelledby="order-actions-title">
      <h2 id="order-actions-title" className="text-base font-semibold text-black" style={{ fontFamily: "var(--font-heading)" }}>Действия</h2>
      <div className="mt-4 space-y-2">
        <button type="button" disabled={busy} onClick={() => void action(`/api/admin/case-lab-3/orders/${orderId}/resend-ticket`).then((ok) => ok && setMessage("Билет поставлен в очередь повторной отправки."))} className="w-full rounded-full border border-black/10 px-4 py-2 text-left text-sm text-black hover:bg-black/[0.03] disabled:opacity-50">Повторно отправить билет</button>
        <button type="button" disabled={busy || !hasReceipt} onClick={() => void action(`/api/admin/case-lab-3/orders/${orderId}/send-receipt-link`).then((ok) => ok && setMessage("Ссылка на чек поставлена в очередь отправки."))} className="w-full rounded-full border border-black/10 px-4 py-2 text-left text-sm text-black hover:bg-black/[0.03] disabled:opacity-50">Отправить ссылку на чек</button>
      </div>
      <form onSubmit={(event) => void transfer(event)} className="mt-5 border-t border-black/[0.07] pt-5">
        <h3 className="text-sm font-medium text-black">Передать участника</h3>
        <div className="mt-3 space-y-2">
          <input aria-label="Имя нового участника" value={participant.firstName} onChange={(event) => setParticipant((value) => ({ ...value, firstName: event.target.value }))} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" placeholder="Имя" />
          <input aria-label="Фамилия нового участника" value={participant.lastName} onChange={(event) => setParticipant((value) => ({ ...value, lastName: event.target.value }))} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" placeholder="Фамилия" />
          <input aria-label="Email нового участника" type="email" value={participant.email} onChange={(event) => setParticipant((value) => ({ ...value, email: event.target.value }))} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" placeholder="Email" />
          <input aria-label="Причина передачи" value={reason} onChange={(event) => setReason(event.target.value)} className="w-full rounded-lg border border-black/10 px-3 py-2 text-sm" placeholder="Причина" />
          <button type="submit" disabled={busy} className="w-full rounded-full bg-[#040082] px-4 py-2 text-sm text-white disabled:opacity-50">Обновить участника</button>
        </div>
      </form>
      <div className="mt-5 border-t border-black/[0.07] pt-5">
        <h3 className="text-sm font-medium text-black">Отдельно отменить билет</h3>
        <p className="mt-1 text-xs text-black/45">Эта операция не возвращает оплату и не освобождает место.</p>
        <button type="button" disabled={busy || ticketCancelled} onClick={() => void cancelTicket()} className="mt-3 w-full rounded-full bg-red-50 px-4 py-2 text-sm text-red-700 hover:bg-red-100 disabled:opacity-50">Отменить билет</button>
      </div>
      <div className="mt-5 border-t border-black/[0.07] pt-5">
        <h3 className="text-sm font-medium text-black">Возврат оплаты</h3>
        <p className="mt-1 text-xs text-black/50">Автоматический возврат отключён на production-запуске. Выполняйте возврат вручную через кабинет TipTop Pay и отдельно сверяйте заказ и чек.</p>
      </div>
      {message ? <p className="mt-4 text-xs text-black/60" role="status">{message}</p> : null}
    </section>
  );
}
