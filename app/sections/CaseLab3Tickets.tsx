import Image from "next/image";
import { ArrowUpRight, CalendarDays, Check, MapPin, UsersRound } from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";
import styles from "../case-lab-3/case-lab-3.module.css";

const included = [
  "три подробных разбора кейсов",
  "живой разговор с CMO после выступлений",
  "знакомства с людьми из маркетинга и креатива",
  "вкусный кейтеринг во время мероприятия",
  "возможность выиграть крутые подарки и призы",
] as const;

const tickets = [
  {
    src: "/case-lab-3-ticket-early-bird.webp",
    alt: "Early Bird: 7 890 ₸, первые 20 билетов",
    width: 2400,
    height: 1200,
  },
  {
    src: "/case-lab-3-ticket-standard.webp",
    alt: "Стандарт: 15 000 ₸ после первых 20 билетов",
    width: 2400,
    height: 1200,
  },
] as const;

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
          <ScrollReveal forceMotion>
            <div className={styles.ticketLead}>
              <h2 id="case-lab-3-tickets-title">Стоимость участия на Case Lab III</h2>
              <p className={styles.ticketCopy}>
                Case Lab III — это три реальных кейса от CMO ведущих компаний Казахстана,
                живой разбор с залом и ответы на вопросы, которые обычно остаются за кадром.
              </p>

              <div className={styles.ticketFacts} aria-label="Детали мероприятия">
                <div className={styles.ticketFact}>
                  <CalendarDays size={23} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <strong>24 сентября 2026 года</strong>
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

              <p className={styles.ticketPriceSummary}>
                Early Bird — <strong>7 890 ₸</strong> для первых 20 билетов. Далее — <strong>15 000 ₸</strong>.
              </p>

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

              <button type="button" className={styles.ticketCta} disabled aria-disabled="true">
                Купить билет
                <ArrowUpRight size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.12} forceMotion>
            <div className={styles.ticketArtwork}>
              {tickets.map((ticket) => (
                <Image
                  key={ticket.src}
                  src={ticket.src}
                  alt={ticket.alt}
                  width={ticket.width}
                  height={ticket.height}
                  quality={100}
                  sizes="(max-width: 900px) 100vw, 40vw"
                  className={styles.ticketImage}
                />
              ))}
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
