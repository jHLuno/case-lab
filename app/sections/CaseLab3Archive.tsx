"use client";

import Image from "next/image";
import styles from "../case-lab-3/case-lab-3.module.css";

const archiveCases = [
  { title: "Hero's Journey", speaker: "Диана Тажимова", image: "/Диана%20Тажимова%20(Hero's%20Journey).webp", position: "center 20%" },
  { title: "abr", speaker: "Салтанат Муса", image: "/Салтанат%20Муса(abr).webp", position: "center 20%" },
  { title: "inDrive", speaker: "Алексей Понтус", image: "/Алексей%20Понтус%20(InDriver).webp", position: "center 20%" },
  { title: "Shetel", speaker: "Нурсултан Магзумов", image: "/Нурсултан%20Магзумов%20(Shetel)%20.webp", position: "center top" },
  { title: "ZimaBlue", speaker: "Фарангиза Шукашева", image: "/Фарангиза%20Шукашева%20(ZimaBlue).webp", position: "center 20%" },
  { title: "Citix", speaker: "Леонид Нигматуллин", image: "/Леонид%20Нигматуллин%20(Citix).webp", position: "center top" },
];

export default function CaseLab3Archive() {
  const items = [...archiveCases, ...archiveCases];

  return (
    <section id="case-lab-3-cases" className={styles.archiveSection} aria-labelledby="case-lab-3-cases-title">
      <div className={styles.archiveIntro}>
        <p className={styles.sectionKicker}>Case Lab archive</p>
        <h2 id="case-lab-3-cases-title">Кейсы, которые уже разбирали.</h2>
        <p>Третий поток продолжает разговор: меньше теории, больше решений, контекста и последствий.</p>
      </div>

      <div className={styles.archiveViewport}>
        <div className={styles.archiveTrack}>
          {items.map((item, index) => (
            <article key={`${item.title}-${index}`} className={styles.archiveCard}>
              <div className={styles.archiveImage}>
                <Image
                  src={item.image}
                  alt={item.speaker}
                  fill
                  loading={index < archiveCases.length ? "eager" : "lazy"}
                  className="object-cover"
                  style={{ objectPosition: item.position }}
                  sizes="clamp(280px, 32vw, 390px)"
                />
                <div className={styles.archiveImageShade} aria-hidden="true" />
              </div>
              <div className={styles.archiveCardBody}>
                <strong>{item.title}</strong>
                <span>{item.speaker}</span>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
