import Image from "next/image";
import { ArrowUpRight } from "lucide-react";
import styles from "../case-lab-3/case-lab-3.module.css";

const testimonials = [
  {
    id: "testimonial-01",
    name: "Екатерина Щипачёва",
    role: "CMO Intertop & Pandora",
    quote:
      "После Case Lab я пересобрала подход к работе с кейсами: меньше теории, больше вопросов к тому, почему команда вообще приняла именно такое решение.",
    photo: "/testimonial-ekaterina.webp",
  },
  {
    id: "testimonial-02",
    name: "Елена Афонина",
    role: "Управляющий директор Centras Group",
    quote:
      "Увидела, как другие команды находят выход из похожих ситуаций. Забрала несколько идей, которые уже внедрили в следующем спринте.",
    photo: "/testimonial-elena.webp",
  },
  {
    id: "testimonial-03",
    name: "Аида Нурсултанова",
    role: "Директор по маркетингу дистрибуции Li Auto",
    quote:
      "Разбор кейсов без прикрас — это то, чего часто не хватает в индустрии. После Case Lab появилось больше смелости принимать решения и тестировать.",
    photo: "/testimonial-aida.webp",
  },
] as const;

export default function CaseLab3Proof() {
  return (
    <section
      id="case-lab-3-proof"
      tabIndex={-1}
      className={styles.proofSection}
      aria-labelledby="case-lab-3-proof-title"
    >
      <div className={styles.contentShell}>
        <div className={styles.proofIntro}>
          <div>
            <h2 id="case-lab-3-proof-title">ЧТО ГОВОРЯТ УЧАСТНИКИ</h2>
            <p className={styles.proofIntroDescription}>
              Участники прошлых Case Lab рассказывают,
              <br />
              что поменяли в работе после разбора реальных кейсов.
            </p>
          </div>
        </div>

        <div className={styles.testimonialGallery}>
          {testimonials.map((testimonial) => {
            return (
              <article key={testimonial.id} className={styles.testimonialCard}>
                <div className={styles.testimonialMedia}>
                  <Image
                    src={testimonial.photo}
                    alt=""
                    fill
                    loading="eager"
                    quality={100}
                    sizes="(min-width: 1200px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className={styles.testimonialPoster}
                  />
                </div>

                <div className={styles.testimonialCardBody}>
                  <h3>{testimonial.name}</h3>
                  <p className={styles.testimonialRole}>{testimonial.role}</p>
                  <span className={styles.testimonialRule} aria-hidden="true" />
                  <blockquote>
                    &laquo;{testimonial.quote}&raquo;
                  </blockquote>
                  <span className={styles.testimonialReviewLabel} aria-hidden="true">
                    Посмотреть отзыв
                    <ArrowUpRight size={16} strokeWidth={2} />
                  </span>
                </div>
              </article>
            );
          })}
        </div>

      </div>
    </section>
  );
}
