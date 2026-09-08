import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import TicketView from "../../../components/case-lab-3/TicketView";
import { parseTicketSession, TICKET_SESSION_COOKIE } from "../../../lib/case-lab-3/orders.server";
import {
  getParticipantTicketView,
  TicketAuthorizationError,
} from "../../../lib/case-lab-3/ticket.server";
import styles from "./ticket.module.css";

export const metadata: Metadata = {
  title: "Билет Case Lab III",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export default async function TicketPage({ params }: { params: Promise<{ number: string }> }) {
  const { number } = await params;
  const rawSession = (await cookies()).get(TICKET_SESSION_COOKIE)?.value;
  const session = parseTicketSession(rawSession);
  if (!session) notFound();

  let view: Awaited<ReturnType<typeof getParticipantTicketView>>;
  try {
    view = await getParticipantTicketView(session, number);
  } catch (error) {
    if (error instanceof TicketAuthorizationError) notFound();
    throw new Error("Protected page unavailable");
  }

  return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <a className={styles.backLink} href="/case-lab-3/">Case Lab III</a>
          <p className={styles.kicker}>Защищенная страница участника</p>
          <h1>Ваш билет</h1>
          <p className={styles.intro}>Покажите QR-код на входе. Не пересылайте эту страницу и код для ручной проверки другим людям.</p>
          <TicketView ticket={view.ticket} />
        </div>
      </main>
  );
}
