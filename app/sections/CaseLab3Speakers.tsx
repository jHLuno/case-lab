"use client";

import Image from "next/image";
import ScrollReveal from "../components/ScrollReveal";
import styles from "../case-lab-3/case-lab-3.module.css";

const cases = [
  {
    company: "Invictus Go",
    role: "exCMO Invictus Go · нынешний CMO Bayan Sulu",
    title: "Как масштабировать точки и не потерять спрос",
    description: "О решениях, которые стояли за открытием успешных залов в Алматы и за его пределами.",
    image: "/CASElab.webp",
    alt: "Фрагмент визуальных материалов Case Lab",
  },
  {
    company: "Qara Studios",
    role: "CMO Qara Studios",
    title: "Что осталось после OYU Fest 2026",
    description: "Результаты прошедшего фестиваля и разбор решений, которые к ним привели.",
    image: "/caselab2.webp",
    alt: "Разбор кейса на сцене Case Lab",
  },
  {
    company: "Forte Bank × GForce Grey",
    role: "CMO Forte Bank",
    title: "Когда инсталляция становится метрикой",
    description: "Кейс «Спасение собаки» и то, как идея повлияла на показатели бренда.",
    image: "/og-image.png",
    alt: "Графический материал Case Lab",
  },
];

export default function CaseLab3Speakers() {
  return (
    <section id="case-lab-3-speakers" className={styles.speakersSection} aria-labelledby="case-lab-3-speakers-title">
      <div className={styles.contentShell}>
        <ScrollReveal>
          <div className={styles.sectionIntroWide}>
            <p className={styles.sectionKicker}>Главная программа</p>
            <h2 id="case-lab-3-speakers-title">Три кейса. Три человека, которые принимали решения.</h2>
          </div>
        </ScrollReveal>

        <div className={styles.speakerVisualGrid}>
          {cases.map((item, index) => (
            <ScrollReveal key={item.company} delay={index * 0.08} className={index === 0 ? styles.speakerVisualFeature : ""}>
              <figure className={styles.speakerVisual}>
                <Image
                  src={item.image}
                  alt={item.alt}
                  fill
                  className="object-cover"
                  sizes={index === 0 ? "(max-width: 767px) 100vw, 50vw" : "(max-width: 767px) 100vw, 25vw"}
                />
                <div className={styles.speakerVisualShade} aria-hidden="true" />
                <figcaption>{String(index + 1).padStart(2, "0")} / case room</figcaption>
              </figure>
            </ScrollReveal>
          ))}
        </div>

        <div className={styles.caseList}>
          {cases.map((item, index) => (
            <ScrollReveal key={`${item.company}-copy`} delay={index * 0.08}>
              <article className={styles.caseRow}>
                <span className={styles.caseIndex}>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{item.company}</h3>
                  <p className={styles.caseRole}>{item.role}</p>
                </div>
                <div>
                  <p className={styles.caseTitle}>{item.title}</p>
                  <p className={styles.caseDescription}>{item.description}</p>
                </div>
              </article>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
