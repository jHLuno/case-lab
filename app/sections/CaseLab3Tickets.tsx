import Image from "next/image";
import { ArrowUpRight, CalendarDays, Check, MapPin, UsersRound } from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";
import styles from "../case-lab-3/case-lab-3.module.css";

const included = [
  "три подробных разбора кейсов",
  "живой разговор с CMO после выступлений",
  "знакомства с людьми из маркетинга и креатива",
];

export default function CaseLab3Tickets() {
  return (
    <section id="tickets" tabIndex={-1} className={styles.ticketSection} aria-labelledby="case-lab-3-tickets-title">
      <div className={styles.ticketBackground} aria-hidden="true">
        <Image
          src="/case-lab-3-tickets-bg.png"
          alt=""
          fill
          sizes="100vw"
          loading="lazy"
          className={styles.ticketBackgroundImage}
        />
      </div>
      <div className={styles.ticketOverlay} aria-hidden="true" />

      <div className={styles.contentShell}>
        <div className={styles.ticketGrid}>
          <ScrollReveal>
            <div className={styles.ticketLead}>
              <p className={styles.ticketKicker}>Билет</p>
              <h2 id="case-lab-3-tickets-title">Прийти за кейсом. Уйти с решением.</h2>
              <p className={styles.ticketCopy}>
                Case Lab III — это три реальных кейса от CMO ведущих компаний Казахстана,
                живой разбор с залом и ответы на вопросы, которые обычно остаются за кадром.
              </p>

              <div className={styles.ticketFacts} aria-label="Детали мероприятия">
                <div className={styles.ticketFact}>
                  <CalendarDays size={23} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <strong>24 сентября 2026</strong>
                    <small>10:00–14:00</small>
                  </span>
                </div>
                <div className={styles.ticketFact}>
                  <MapPin size={23} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <strong>Narxoz Business School</strong>
                    <small>Алматы</small>
                  </span>
                </div>
                <div className={styles.ticketFact}>
                  <UsersRound size={23} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <strong>100 мест</strong>
                    <small>в зале</small>
                  </span>
                </div>
              </div>

              <button type="button" className={styles.ticketCta} disabled aria-disabled="true">
                Купить билет
                <ArrowUpRight size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.12}>
            <div className={styles.ticketPanel} aria-label="Стоимость и содержание билета">
              <div className={styles.ticketPanelHeader}>
                <span className={styles.ticketBadge}>Early Bird</span>
                <span>Первые 20 билетов</span>
              </div>

              <div className={styles.ticketPrice}>
                <strong>7 890</strong>
                <span>₸</span>
              </div>

              <div className={styles.ticketPriceNote}>Специальная цена на первые 20 билетов</div>

              <div className={styles.ticketLaterPrice}>
                <span>Затем</span>
                <strong>15 000 ₸</strong>
              </div>

              <div className={styles.ticketIncluded}>
                <p>В билет входит:</p>
                <ul>
                  {included.map((item) => (
                    <li key={item}>
                      <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
