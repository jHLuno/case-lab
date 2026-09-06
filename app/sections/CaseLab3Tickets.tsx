import Image from "next/image";
import { ArrowUpRight, CalendarDays, Check, MapPin } from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";
import styles from "../case-lab-3/case-lab-3.module.css";

const included = [
  "Разборы Invictus, OYU Fest и ForteBank",
  "Обсуждение решений и вопросы спикерам",
  "Знакомства с коллегами и кейтеринг",
  "Участие в рейтинге и призы для топ-3",
] as const;

const tickets = [
  {
    src: "/case-lab-3-ticket-standard.webp",
    alt: "Стандарт: 15 000 ₸ после первых 20 билетов",
    width: 2400,
    height: 1200,
  },
  {
    src: "/case-lab-3-ticket-early-bird.webp",
    alt: "Early Bird: 7 890 ₸, первые 20 билетов",
    width: 2400,
    height: 1200,
  },
] as const;

export default function CaseLab3Tickets() {
  return (
    <section id="tickets" tabIndex={-1} className={styles.ticketSection} aria-labelledby="case-lab-3-tickets-title">
      <div className={styles.contentShell}>
        <div className={styles.ticketGrid}>
          <ScrollReveal forceMotion className={styles.ticketLeadGridItem}>
            <div className={styles.ticketLead}>
              <p className={styles.ticketMeta}>24 сентября · Алматы</p>
              <h2 id="case-lab-3-tickets-title">БИЛЕТЫ НА CASE LAB III</h2>
              <p className={styles.ticketCopy}>
                Три кейса изнутри. Ваши решения.
                <br />
                Ответы тех, кто их принимал.
              </p>
              <div className={styles.ticketFacts} aria-label="Детали мероприятия">
                <div className={styles.ticketFact}>
                  <CalendarDays size={22} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <strong>24 сентября 2026</strong>
                    <small>10:00–14:00</small>
                  </span>
                </div>
                <div className={styles.ticketFact}>
                  <MapPin size={22} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <strong>Narxoz Business School</strong>
                    <small>Алматы</small>
                  </span>
                </div>
              </div>
            </div>
          </ScrollReveal>

          <ScrollReveal forceMotion className={styles.ticketPurchaseGridItem} delay={0.12}>
            <div className={styles.ticketPurchaseArea}>
              <div className={styles.ticketArtwork}>
                {tickets.map((ticket) => (
                  <Image
                    key={ticket.src}
                    src={ticket.src}
                    alt={ticket.alt}
                    width={ticket.width}
                    height={ticket.height}
                    quality={100}
                    sizes="(max-width: 767px) 100vw, 46vw"
                    className={styles.ticketImage}
                  />
                ))}
              </div>
              <div className={styles.ticketPurchaseMeta}>
                <span>Первые 20 билетов</span>
                <span>Затем — <strong>15 000 ₸</strong></span>
              </div>
              <button type="button" className={styles.ticketCta}>
                <span>Купить билет за 7 890 ₸</span>
                <ArrowUpRight size={23} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <p className={styles.ticketPurchaseNote}>Один билет — вся программа Case Lab III</p>
            </div>
          </ScrollReveal>

          <ScrollReveal forceMotion className={styles.ticketIncludedGridItem} delay={0.24}>
            <div className={styles.ticketIncluded}>
              <p>В билет входит</p>
              <ul>
                {included.map((item) => (
                  <li key={item}>
                    <Check size={16} strokeWidth={2.2} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
