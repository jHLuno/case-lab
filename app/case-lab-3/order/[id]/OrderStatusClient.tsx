"use client";

import { useEffect, useState } from "react";

import type { OrderStatusResponse } from "../../../lib/case-lab-3/contracts";

import styles from "./order.module.css";

const FINAL_PAYMENT_STATUSES = new Set<OrderStatusResponse["paymentStatus"]>([
  "paid",
  "failed",
  "review_required",
  "partially_refunded",
  "refunded",
]);

function statusCopy(status: OrderStatusResponse): { title: string; description: string } {
  if (status.paymentStatus === "paid") {
    return { title: "Оплата подтверждена", description: "Билет доступен ниже и отправлен на email участника." };
  }
  if (status.paymentStatus === "failed") {
    return { title: "Оплата не подтверждена", description: "Проверьте статус позже или начните новую попытку оплаты." };
  }
  if (status.paymentStatus === "review_required") {
    return { title: "Не оплачивайте повторно", description: "Проверяем платеж вручную. Если понадобится помощь, напишите на hello@caselab.kz." };
  }
  if (status.paymentStatus === "refunded") {
    return { title: "Возврат подтвержден", description: "Билет отменен, средства возвращены." };
  }
  if (status.paymentStatus === "partially_refunded") {
    return { title: "Частичный возврат подтвержден", description: "Часть средств возвращена. Билет остается действительным." };
  }
  if (status.paymentStatus === "processing") {
    return { title: "Проверяем оплату", description: "Результат появится на этой странице автоматически." };
  }
  return { title: "Ожидаем оплату", description: "Не закрывайте страницу, если оплата еще идет." };
}

export default function OrderStatusClient({
  orderId,
  initialStatus,
}: {
  orderId: string;
  initialStatus: OrderStatusResponse;
}) {
  const [status, setStatus] = useState(initialStatus);
  const copy = statusCopy(status);

  useEffect(() => {
    if (FINAL_PAYMENT_STATUSES.has(initialStatus.paymentStatus)) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`/api/case-lab-3/orders/${encodeURIComponent(orderId)}/status`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const next = await response.json() as OrderStatusResponse;
        if (response.ok && next && typeof next.paymentStatus === "string") {
          setStatus(next);
          if (FINAL_PAYMENT_STATUSES.has(next.paymentStatus)) return;
        }
      } catch {
        if (controller.signal.aborted) return;
      }
      attempts += 1;
      if (attempts < 90 && !controller.signal.aborted) timer = setTimeout(poll, 1000);
    };

    void poll();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [initialStatus.paymentStatus, orderId]);

  return (
    <section className={styles.statusCard} aria-live={status.paymentStatus === "review_required" ? "assertive" : "polite"}>
      <p className={styles.statusKicker}>Статус заказа</p>
      <h2>{copy.title}</h2>
      <p>{copy.description}</p>
      <dl className={styles.statusMeta}>
        <div>
          <dt>Чек</dt>
          <dd>{status.receiptStatus === "issued" ? "сформирован" : "формируется"}</dd>
        </div>
        <div>
          <dt>Email</dt>
          <dd>{status.emailStatus === "sent" ? "отправлен" : "ожидает отправки"}</dd>
        </div>
      </dl>
    </section>
  );
}
