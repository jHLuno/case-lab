"use client";

import { useRef, useEffect } from "react";
import ScrollReveal from "../components/ScrollReveal";

const timelineSteps = [
  { id: "01", title: "Заявка и брифинг", subtitle: "Короткая форма, выбираем удобное время" },
  { id: "02", title: "Диагностическая сессия", subtitle: "2 часа структурированного интервью с командой" },
  { id: "03", title: "Анализ и brief", subtitle: "Карта слепых зон, гипотезы, приоритеты — за 48 часов" },
  { id: "04", title: "Презентация и план", subtitle: "Обсуждаем findings, определяем первые шаги" },
];

export default function Timeline() {
  return (
    <section id="process" aria-label="Процесс диагностики" className="relative bg-white py-16 md:py-40 px-6 md:px-10">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        {/* Header */}
        <ScrollReveal>
          <div>
            <span
              className="text-gray text-[11px] mb-3 block leading-[1.58] uppercase tracking-wider"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Процесс
            </span>
            <h2
              className="text-black text-[clamp(24px,4vw,54px)] font-bold leading-[1.15] mb-12 md:mb-20 uppercase tracking-[0.02em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Как проходит сессия
            </h2>
          </div>
        </ScrollReveal>

        {/* Desktop: grid layout */}
        <div className="hidden md:grid grid-cols-2 gap-x-16 gap-y-12">
          {timelineSteps.map((step, i) => (
            <ScrollReveal key={step.id} delay={i * 0.1}>
              <div className="relative pl-8 border-l-2 border-[#040082]/10">
                {/* Dot */}
                <div className="absolute left-[-5px] top-1 w-2 h-2 rounded-full bg-[#040082]" />

                <span
                  className="text-gray text-[11px] mb-2 block leading-[1.58]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {step.id}
                </span>
                <h3
                  className="text-black text-[16px] lg:text-[20px] font-normal mb-1.5 leading-[1.22] uppercase tracking-[0.02em]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {step.title}
                </h3>
                {step.subtitle && (
                  <p
                    className="text-black/60 text-[14px] lg:text-[16px] leading-[1.35] font-light"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {step.subtitle}
                  </p>
                )}
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Mobile: vertical list */}
        <div className="md:hidden relative">
          {/* Background line */}
          <div
            className="absolute left-6 top-0 bottom-0 w-px"
            style={{ background: "rgba(4, 0, 130, 0.08)" }}
          />

          <div className="space-y-8">
            {timelineSteps.map((step, i) => (
              <ScrollReveal key={step.id} delay={i * 0.08}>
                <div className="relative pl-16">
                  {/* Dot */}
                  <div className="absolute left-[20px] top-2 w-3 h-3 rounded-full bg-[#040082] border-2 border-white" />

                  <span
                    className="text-gray text-[11px] mb-2 block leading-[1.58]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {step.id}
                  </span>
                  <h3
                    className="text-black text-[16px] font-normal mb-1 leading-[1.22] uppercase tracking-[0.02em]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {step.title}
                  </h3>
                  {step.subtitle && (
                    <p
                      className="text-black/60 text-[14px] leading-[1.25] font-light"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {step.subtitle}
                    </p>
                  )}
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
