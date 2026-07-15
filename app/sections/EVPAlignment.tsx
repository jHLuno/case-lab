"use client";

import { useRef } from "react";
import { useEffect, useState } from "react";
import { useReducedMotion } from "framer-motion";

const voices = [
  {
    role: "Руководитель",
    gap: "Говорит о росте бизнеса, но не формулирует, какую роль в этом играет человек.",
  },
  {
    role: "HR",
    gap: "Описывает вакансию и условия, но не объясняет, почему здесь стоит строить карьеру.",
  },
  {
    role: "Маркетинг",
    gap: "Развивает бренд для клиентов, а история для будущей команды остаётся отдельной.",
  },
  {
    role: "PR",
    gap: "Формирует внешнюю репутацию, не опираясь на реальный опыт людей внутри компании.",
  },
];

const alignmentStatement = "Без единого EVP руководитель, HR, маркетинг и PR рассказывают о компании по-разному. Рынок труда слышит не одну сильную историю, а несколько несвязанных голосов.";
const alignmentWords = alignmentStatement.split(" ");

function HighlightWord({
  word,
  index,
  scrollProgress,
  shouldReduceMotion,
}: {
  word: string;
  index: number;
  scrollProgress: number;
  shouldReduceMotion: boolean | null;
}) {
  const start = index / alignmentWords.length;
  const wordProgress = Math.min(Math.max((scrollProgress - start) / 0.07, 0), 1);
  const opacity = shouldReduceMotion ? 1 : 0.35 + wordProgress * 0.65;

  return (
    <span className="transition-colors duration-100" style={{ color: `rgb(255 255 255 / ${opacity})` }}>
      {word}{" "}
    </span>
  );
}

export default function EVPAlignment() {
  const sectionRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setScrollProgress(1);
      return;
    }

    let frame: number | undefined;
    const updateProgress = () => {
      const section = sectionRef.current;
      if (!section) return;

      const start = window.innerHeight * 0.45;
      const end = window.innerHeight * 0.05;
      const nextProgress = Math.min(Math.max((start - section.getBoundingClientRect().top) / (start - end), 0), 1);
      setScrollProgress((current) => (Math.abs(current - nextProgress) < 0.01 ? current : nextProgress));
      frame = undefined;
    };
    const requestUpdate = () => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(updateProgress);
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    requestUpdate();

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [shouldReduceMotion]);

  return (
    <section
      aria-labelledby="evp-alignment-title"
      className="relative isolate overflow-hidden bg-[#043B2C] px-6 py-14 text-white md:px-10 md:py-[72px]"
      ref={sectionRef}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(94,188,143,0.26),transparent_34%)]" />
      <div aria-hidden="true" className="evp-alignment-atmosphere absolute inset-x-0 bottom-0 h-[62%]" />
      <div className="relative z-10 mx-auto max-w-[1160px]">
        <p
          data-evp-reveal
          className="mx-auto w-fit rounded-full border border-white/25 px-6 py-2.5 text-[14px] text-white/75 md:text-[16px]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Когда компания говорит разными голосами
        </p>

        <h2
          id="evp-alignment-title"
          aria-label={alignmentStatement}
          className="mx-auto mt-6 max-w-[37ch] text-center text-[clamp(24px,3.2vw,44px)] leading-[1.18] normal-case md:mt-8"
          style={{ fontFamily: "var(--font-body)" }}
        >
          <span aria-hidden="true">
            {alignmentWords.map((word, index) => (
              <HighlightWord
                key={`${word}-${index}`}
                word={word}
                index={index}
                scrollProgress={scrollProgress}
                shouldReduceMotion={shouldReduceMotion}
              />
            ))}
          </span>
        </h2>

        <div data-evp-reveal className="mt-8 grid gap-3 sm:grid-cols-2 lg:mt-10 lg:grid-cols-4">
          {voices.map((voice) => (
            <article key={voice.role} className="evp-alignment-glass-card min-h-[185px] rounded-[20px] p-5 md:min-h-[210px] md:p-6">
              <h3
                className="relative z-10 text-[17px] font-bold uppercase tracking-[0.02em] text-white md:text-[19px]"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {voice.role}
              </h3>
              <p className="relative z-10 mt-4 text-[16px] leading-[1.45] text-white/80 md:text-[17px]" style={{ fontFamily: "var(--font-body)" }}>
                {voice.gap}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
