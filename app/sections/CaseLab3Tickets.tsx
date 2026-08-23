"use client";

import { ArrowUpRight, Check } from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";
import styles from "../case-lab-3/case-lab-3.module.css";
import { caseLab3CheckoutHref } from "../lib/caseLab3";

const included = [
  "три подробных разбора кейсов",
  "живой разговор с CMO после выступлений",
  "знакомства с людьми из маркетинга и креатива",
];

export default function CaseLab3Tickets() {
  return (
    <section id="tickets" className={styles.ticketSection} aria-labelledby="case-lab-3-tickets-title">
      <div className={styles.contentShell}>
        <div className={styles.ticketGrid}>
          <ScrollReveal>
            <div>
              <p className={styles.sectionKicker}>20 мест по ранней цене</p>
              <h2 id="case-lab-3-tickets-title">Прийти за кейсом. Уйти с решением.</h2>
              <p className={styles.ticketCopy}>
                Early Bird действует на первые 20 билетов. После этого стоимость участия составит 15 000 ₸.
              </p>
              {caseLab3CheckoutHref ? (
                <a href={caseLab3CheckoutHref} className={styles.ticketCta}>
                  Купить билет
                  <ArrowUpRight size={17} strokeWidth={2} aria-hidden="true" />
                </a>
              ) : (
                <p className={styles.checkoutUnavailable} role="status">
                  Покупка билетов временно недоступна.
                </p>
              )}
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.12}>
            <div className={styles.ticketPriceBlock}>
              <div className={styles.ticketPriceTop}>
                <span>Early Bird</span>
                <strong>7 890 ₸</strong>
              </div>
              <div className={styles.ticketPriceBottom}>
                <span>затем</span>
                <strong>15 000 ₸</strong>
              </div>
              <ul>
                {included.map((item) => (
                  <li key={item}>
                    <Check size={15} strokeWidth={2.4} aria-hidden="true" />
                    {item}
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
