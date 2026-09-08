import type { TicketPresentation } from "../../lib/case-lab-3/ticket.server";
import Image from "next/image";

import styles from "./TicketView.module.css";

export default function TicketView({ ticket }: { ticket: TicketPresentation }) {
  const statusLabel = ticket.status === "valid" ? "Действителен" : ticket.status === "used" ? "Использован" : "Отменен";

  return (
    <article className={styles.ticket} data-ticket-view="participant">
      <div className={styles.ticketHeader}>
        <div>
          <p className={styles.kicker}>Case Lab III · билет участника</p>
          <h2>{ticket.eventName}</h2>
          <p className={styles.status}>{statusLabel}</p>
        </div>
        <span className={styles.revision}>Ревизия {ticket.revisionNumber}</span>
      </div>

      <div className={styles.ticketBody}>
        <div className={styles.details}>
          <p className={styles.label}>Участник</p>
          <p className={styles.name}>{ticket.participant.firstName} {ticket.participant.lastName}</p>
          <dl>
            <div>
              <dt>Дата</dt>
              <dd>{ticket.eventDate}</dd>
            </div>
            <div>
              <dt>Время</dt>
              <dd>{ticket.eventTime}</dd>
            </div>
            <div>
              <dt>Место</dt>
              <dd>{ticket.venue}</dd>
            </div>
          </dl>
        </div>

        <div className={styles.qrPanel}>
          <Image className={styles.qr} src={ticket.qrDataUrl} alt="QR-код билета для входа" width={180} height={180} unoptimized />
          <p>Покажите QR-код на входе</p>
        </div>
      </div>

      <div className={styles.credentials}>
        <div>
          <span>Номер билета</span>
          <strong>{ticket.publicTicketNumber}</strong>
        </div>
        <div>
          <span>Код для ручной проверки</span>
          <code>{ticket.manualCode}</code>
        </div>
      </div>

      <div className={styles.footer}>
        <span>Поддержка: {ticket.supportEmail}</span>
        <a href={ticket.pdfUrl} download={`case-lab-3-ticket-${ticket.publicTicketNumber}.pdf`}>
          Скачать PDF
        </a>
      </div>
    </article>
  );
}
