"use client";

import { useRef, useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { useLeadPopup } from "../lib/LeadPopupContext";
import ScrollReveal from "../components/ScrollReveal";

const stages = [
  {
    num: "01",
    year: "2025",
    title: "Платформа",
    desc: "Ивенты с разбором сильных маркетинговых кейсов казахстанских компаний. Реальные метрики, реальные команды, реальный опыт.",
  },
  {
    num: "02",
    year: "2026",
    title: "Диагностика + Экспертиза",
    desc: "Запускаем сейчас: 2-часовая диагностика маркетинга и сеть практиков из FMCG, SaaS, Retail, FinTech под конкретный контекст клиента.",
  },
  {
    num: "03",
    year: "2026+",
    title: "Экосистема",
    desc: "Интегрированный подход: диагностика + эксперты + инструменты + сообщество. Полный цикл от проблемы до решения.",
  },
];

export default function Evolution() {
  const { openPopup } = useLeadPopup();
  const [activeIndex, setActiveIndex] = useState(0);

  // Simple auto-rotate every 3s
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % stages.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section aria-label="Эволюция проекта" className="relative bg-white py-16 md:py-40 px-6 md:px-10">
      {/* Top divider */}
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center gap-8 md:gap-10 lg:gap-16">
        {/* Left: Stage indicator */}
        <div className="flex-1 flex items-center justify-center w-full min-w-0">
          <ScrollReveal>
            <div className="relative w-full flex flex-col items-center justify-center py-12">
              {/* Large stage number */}
              <div className="text-center mb-6">
                <span
                  className="text-[#040082] text-[13px] font-bold uppercase tracking-[3px] block mb-2"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  ЭТАП
                </span>
                <span
                  className="text-black/10 text-[80px] md:text-[120px] font-bold leading-none block transition-all duration-500"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {String(activeIndex + 1).padStart(2, "0")}
                </span>
              </div>

              {/* Progress dots */}
              <div className="flex items-center gap-3">
                {stages.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setActiveIndex(i)}
                    className={`rounded-full transition-all duration-500 ${
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
        </div>

        {/* Right: Facts */}
        <div className="flex-1 w-full max-w-lg">
          <ScrollReveal>
            <div className="mb-10 md:mb-16">
              <span
                className="text-gray text-[11px] mb-3 block leading-[1.58] uppercase tracking-wider"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Эволюция проекта
              </span>
              <h2
                className="text-black text-[clamp(20px,3vw,36px)] font-bold leading-[1.12] uppercase tracking-[0.02em]"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                От платформы — к экосистеме
              </h2>
            </div>
          </ScrollReveal>

          <div className="space-y-3 md:space-y-4">
            {stages.map((stage, i) => {
              const isActive = i === activeIndex;
              return (
                <ScrollReveal key={stage.num} delay={i * 0.1}>
                  <div
                    className="relative pl-6 md:pl-7 cursor-pointer transition-all duration-500"
                    style={{
                      opacity: isActive ? 1 : 0.35,
                    }}
                    onClick={() => setActiveIndex(i)}
                  >
                    <div
                      className="absolute left-0 top-0.5 bottom-0.5 w-[2px] rounded-full transition-all duration-500"
                      style={{
                        background: isActive
                          ? "linear-gradient(to bottom, #040082, #1a1a9e)"
                          : "rgba(0,0,0,0.06)",
                      }}
                    />

                    <div className="flex items-baseline gap-2 mb-1.5">
                      <span
                        className="text-[#040082] text-[11px] uppercase tracking-wider font-normal"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {stage.year}
                      </span>
                      <span
                        className="text-black/[0.12] text-[11px] font-light"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {stage.num}
                      </span>
                    </div>

                    <h3
                      className="text-black text-[15px] md:text-[20px] font-bold leading-[1.15] uppercase tracking-[0.02em] mb-1.5"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {stage.title}
                    </h3>

                    <p
                      className="text-black/50 text-[13px] md:text-[14px] leading-[1.45] font-light"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {stage.desc}
                    </p>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>

          {/* CTA */}
          <ScrollReveal delay={0.3}>
            <div className="mt-10 md:mt-16 mb-4 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <button
                type="button"
                onClick={openPopup}
                className="inline-flex items-center gap-2 bg-[#040082] text-white px-7 py-3.5 text-[14px] md:px-8 md:py-4 md:text-[15px] rounded-full font-normal hover:bg-[#0600a8] transition-colors duration-300 group"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Начать диагностику
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-300" />
              </button>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
