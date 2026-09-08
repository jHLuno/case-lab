import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import TicketView from "../../../components/case-lab-3/TicketView";
import {
  ORDER_SESSION_COOKIE,
  parseOrderSession,
} from "../../../lib/case-lab-3/orders.server";
import {
  getPurchaserOrderView,
  TicketAuthorizationError,
} from "../../../lib/case-lab-3/ticket.server";
import OrderStatusClient from "./OrderStatusClient";
import styles from "./order.module.css";

export const metadata: Metadata = {
  title: "Заказ Case Lab III",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rawSession = (await cookies()).get(ORDER_SESSION_COOKIE)?.value;
  const session = parseOrderSession(rawSession);
  if (!session) notFound();

  let view: Awaited<ReturnType<typeof getPurchaserOrderView>>;
  try {
    view = await getPurchaserOrderView(session, id);
  } catch (error) {
    if (error instanceof TicketAuthorizationError) notFound();
    throw new Error("Protected page unavailable");
  }

  const status = {
    orderNumber: view.order.orderNumber,
    paymentStatus: view.order.paymentStatus,
    ticketStatus: view.order.ticketStatus,
    receiptStatus: view.order.receiptStatus,
    emailStatus: view.order.emailStatus,
    receiptUrl: null,
  };
  return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <a className={styles.backLink} href="/case-lab-3/">Case Lab III</a>
          <p className={styles.kicker}>Защищенная страница покупателя</p>
          <h1>Ваш заказ</h1>
          <p className={styles.orderNumber}>{view.order.orderNumber}</p>
          <p className={styles.intro}>Здесь собраны детали оплаты и доступа к билету. Ссылка предназначена только для покупателя.</p>

          <OrderStatusClient orderId={view.order.id} initialStatus={status} />

          <section className={styles.orderDetails}>
            <p className={styles.sectionKicker}>Данные заказа</p>
            <dl>
              <div><dt>Участник</dt><dd>{view.order.participant.firstName} {view.order.participant.lastName}</dd></div>
              <div><dt>Email покупателя</dt><dd>{view.order.purchaserEmail}</dd></div>
              <div><dt>Тариф</dt><dd>{view.order.tier === "early_bird" ? "Early Bird" : "Стандарт"}</dd></div>
              <div><dt>Сумма</dt><dd>{(view.order.amountMinor / 100).toLocaleString("ru-RU")} ₸</dd></div>
            </dl>
          </section>

          {view.ticket && (
            <section className={styles.ticketSection}>
              <p className={styles.sectionKicker}>Доступ к билету</p>
              <TicketView ticket={view.ticket} />
            </section>
          )}
        </div>
      </main>
  );
}
