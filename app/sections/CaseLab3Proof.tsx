"use client";

import Image from "next/image";
import { Play } from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";
import styles from "../case-lab-3/case-lab-3.module.css";

const proofItems = [
  {
    image: "/CASElab.webp",
    label: "Поток 01",
    title: "Что забрали с собой после прошлого Case Lab",
    alt: "Материалы и участники прошлого мероприятия Case Lab",
  },
  {
    image: "/caselab2.webp",
    label: "Поток 02",
    title: "Когда кейс разбирают не со стороны, а изнутри",
    alt: "Участник выступает перед аудиторией на Case Lab",
  },
];

export default function CaseLab3Proof() {
  return (
    <section id="case-lab-3-proof" className={styles.proofSection} aria-labelledby="case-lab-3-proof-title">
      <div className={styles.contentShell}>
        <ScrollReveal>
          <div className={styles.sectionIntro}>
            <p className={styles.sectionKicker}>До этого уже было</p>
            <h2 id="case-lab-3-proof-title">Не обещаем инсайты. Показываем, как это выглядит.</h2>
            <p>
              На прошлых потоках маркетологи приходили за насмотренностью, а уходили с решениями, которые можно обсуждать с командой уже на следующий день.
            </p>
          </div>
        </ScrollReveal>

        <div className={styles.proofGrid}>
          {proofItems.map((item, index) => (
            <ScrollReveal key={item.label} delay={index * 0.1}>
              <article className={styles.proofCard}>
                <div className={styles.proofMedia}>
                  <Image
                    src={item.image}
                    alt={item.alt}
                    fill
                    className="object-cover"
                    sizes="(max-width: 767px) 100vw, 50vw"
                  />
                  <div className={styles.proofMediaShade} aria-hidden="true" />
                  <span className={styles.proofPlay} aria-hidden="true">
                    <Play size={17} fill="currentColor" strokeWidth={1.5} />
                  </span>
                  <span className={styles.proofLabel}>{item.label} · видеоотзыв</span>
                </div>
                <h3>{item.title}</h3>
              </article>
            </ScrollReveal>
          ))}
        </div>

        <p className={styles.proofNote}>Видеоотзывы с прошлых потоков подключаются в эти два слота.</p>
      </div>
    </section>
  );
}
