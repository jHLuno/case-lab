"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";
import styles from "../case-lab-3/case-lab-3.module.css";

const faqItems = [
  {
    question: "Где проходит Case Lab III?",
    answer: "24 сентября 2026 года, с 10:00 до 14:00 (UTC+5), в Narxoz Business School по адресу: Алматы, ул. Жандосова 55/10.",
  },
  {
    question: "На каком языке?",
    answer: "Основная программа проходит на русском языке.",
  },
  {
    question: "Во сколько начало и сколько длится?",
    answer: "Начало в 10:00, продолжительность — 4 часа. Время указано для Asia/Almaty (UTC+5).",
  },
  {
    question: "Можно ли вернуть или передать билет?",
    answer:
      "Передать билет можно, предварительно написав на hello@caselab.kz. Отказаться от участия и запросить возврат можно до начала мероприятия по тому же адресу; возврат рассматривается по условиям публичной оферты и законодательству Республики Казахстан.",
  },
];

export default function CaseLab3FAQ() {
  const [openItem, setOpenItem] = useState<number | null>(0);

  return (
    <section id="faq" className={styles.faqSection} aria-labelledby="case-lab-3-faq-title">
      <div className={styles.faqShell}>
        <ScrollReveal>
          <div className={styles.faqIntro}>
            <h2 id="case-lab-3-faq-title">Вопросы, которые могут возникнуть</h2>
          </div>
        </ScrollReveal>

        <ScrollReveal delay={0.1}>
          <div className={styles.faqList}>
            {faqItems.map((item, index) => {
              const isOpen = index === openItem;
              const buttonId = `case-lab-3-faq-button-${index}`;
              const panelId = `case-lab-3-faq-panel-${index}`;

              return (
                <div key={item.question} className={styles.faqItem}>
                  <button
                    id={buttonId}
                    type="button"
                    className={styles.faqButton}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenItem(isOpen ? null : index)}
                  >
                    <span className={`${styles.faqQuestion} ${isOpen ? styles.faqQuestionOpen : ""}`}>
                      {item.question}
                    </span>
                    <span className={`${styles.faqIcon} ${isOpen ? styles.faqIconOpen : ""}`} aria-hidden="true">
                      <Plus size={17} strokeWidth={1.7} />
                    </span>
                  </button>
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={buttonId}
                    aria-hidden={!isOpen}
                    className={`${styles.faqPanel} ${isOpen ? styles.faqPanelOpen : ""}`}
                  >
                    <div className={styles.faqPanelInner}>
                      <p className={styles.faqAnswer}>{item.answer}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
