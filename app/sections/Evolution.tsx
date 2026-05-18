"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLeadPopup } from "../lib/LeadPopupContext";
import ScrollReveal from "../components/ScrollReveal";

const stages = [
  {
    num: "01",
    title: "Платформа",
    desc: "Ивенты с разбором сильных маркетинговых кейсов казахстанских компаний. Реальные метрики, реальные команды, реальный опыт.",
  },
  {
    num: "02",
    title: "Диагностика + Экспертиза",
    desc: "Запускаем сейчас: 2-часовая диагностика маркетинга и сеть практиков из FMCG, SaaS, Retail, FinTech под конкретный контекст клиента.",
  },
  {
    num: "03",
    title: "Экосистема",
    desc: "Интегрированный подход: диагностика + эксперты + инструменты + сообщество. Полный цикл от проблемы до решения.",
  },
];

const ROTATE_INTERVAL = 4000;

export default function Evolution() {
  const { openPopup } = useLeadPopup();
  const [activeIndex, setActiveIndex] = useState(0);

  const goToNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % stages.length);
  }, []);

  useEffect(() => {
    const interval = setInterval(goToNext, ROTATE_INTERVAL);
    return () => clearInterval(interval);
  }, [goToNext]);

  return (
    <section
      aria-label="Эволюция проекта"
      className="relative bg-white py-16 md:py-40 px-6 md:px-10"
    >
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        {/* Header — same style as other sections */}
        <ScrollReveal>
          <div className="mb-12 md:mb-20">
            <span
              className="text-[#040082] text-[11px] mb-3 block leading-[1.58] uppercase tracking-wider font-normal"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Эволюция проекта
            </span>
            <h2
              className="text-black text-[clamp(22px,4vw,48px)] font-bold leading-[1.15] uppercase tracking-[0.02em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              От платформы — к экосистеме
            </h2>
          </div>
        </ScrollReveal>

        {/* Content block */}
        <ScrollReveal delay={0.1}>
          <div className="flex flex-col items-center text-center">
            {/* Number */}
            <div className="relative h-[120px] md:h-[200px] w-full flex items-center justify-center mb-4 md:mb-6">
              <AnimatePresence mode="wait">
                <motion.span
                  key={activeIndex}
                  initial={{ opacity: 0, y: 40 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -40 }}
                  transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                  className="text-black/[0.06] text-[100px] md:text-[180px] font-bold leading-none select-none"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {stages[activeIndex].num}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Title + Description — fixed height to prevent layout shift */}
            <div className="min-h-[180px] md:min-h-[140px] flex flex-col items-center justify-start">
              <AnimatePresence mode="wait">
                <motion.h3
                  key={`title-${activeIndex}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                  className="text-black text-[clamp(18px,3vw,32px)] font-bold leading-[1.15] uppercase tracking-[0.02em] mb-4"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {stages[activeIndex].title}
                </motion.h3>
              </AnimatePresence>

              <AnimatePresence mode="wait">
                <motion.p
                  key={`desc-${activeIndex}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, delay: 0.04, ease: "easeOut" }}
                  className="text-black/60 text-[14px] md:text-[16px] leading-[1.6] font-light max-w-xl mx-auto"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {stages[activeIndex].desc}
                </motion.p>
              </AnimatePresence>
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-3 mt-4 md:mt-12">
              {stages.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveIndex(i)}
                  className={`rounded-full transition-all duration-300 ${
                    i === activeIndex
                      ? "w-8 h-2 bg-[#040082]"
                      : "w-2 h-2 bg-black/15 hover:bg-black/30"
                  }`}
                  aria-label={`Этап ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </ScrollReveal>

        {/* CTA */}
        <ScrollReveal delay={0.2}>
          <div className="mt-4 md:mt-16 text-center">
            <button
              type="button"
              onClick={openPopup}
              className="inline-flex items-center gap-2 bg-[#040082] text-white px-7 py-3.5 text-[14px] md:px-10 md:py-5 md:text-[15px] rounded-full font-normal hover:bg-[#0600a8] transition-colors duration-200 group"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Начать диагностику
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-200" />
            </button>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
