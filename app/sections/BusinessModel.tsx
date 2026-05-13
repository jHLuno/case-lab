"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import ScrollReveal from "../components/ScrollReveal";

gsap.registerPlugin(ScrollTrigger);

const beforeAfter = [
  {
    before: "Маркетинг работает, но непонятно за счёт чего",
    after: "Чёткая карта активностей и их влияния на бизнес",
  },
  {
    before: "Консультант предложил 20 идей",
    after: "3–5 приоритетных направлений с обоснованием",
  },
  {
    before: "Отчёты агентства vs реальность бизнеса",
    after: "Общий язык между собственником, CMO и агентством",
  },
  {
    before: "Решения принимаются на интуиции",
    after: "Решения на основе структурированных данных",
  },
];

const useCases = [
  "маркетинговой стратегии на квартал",
  "брифа для агентств и подрядчиков",
  "внутренней коммуникации между собственником и командой",
];

export default function BusinessModel() {
  const sectionRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current || !lineRef.current || !itemsRef.current) return;

    const ctx = gsap.context(() => {
      // Animated center line (desktop only)
      gsap.fromTo(
        lineRef.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: itemsRef.current,
            start: "top 70%",
            end: "bottom 80%",
            scrub: true,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} aria-label="Что меняется после диагностики" className="relative bg-white py-16 md:py-40 px-6 md:px-10 overflow-clip">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        {/* Header */}
        <ScrollReveal>
          <div className="mb-12 md:mb-12">
            <span
              className="text-gray text-[11px] mb-3 block leading-[1.58]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Case Lab Diagnostics
            </span>
            <h2
              className="text-black text-[clamp(22px,4vw,54px)] font-bold leading-[1.15] uppercase tracking-[0.02em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Что меняется после диагностики
            </h2>
          </div>
        </ScrollReveal>

        {/* Case Lab Label */}
        <ScrollReveal>
          <div className="text-center mb-12 md:mb-12">
            <span
              className="inline-flex items-center gap-[6px]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span className="text-gray text-[15px] md:text-[17px] font-normal uppercase tracking-wider">
                Подход
              </span>
              <span className="inline-flex items-center justify-center bg-[#040082] text-white px-[10px] py-[4px] text-[14px] md:text-[16px] font-normal uppercase tracking-wider leading-none">
                CASE
              </span>
              <span className="text-black text-[15px] md:text-[17px] italic normal-case tracking-wider">
                LAB
              </span>
            </span>
          </div>
        </ScrollReveal>

        {/* Before → After */}
        <div className="relative mb-12 md:mb-20">
          {/* Desktop column headers */}
          <div className="hidden md:grid grid-cols-[1fr_auto_1fr] gap-0 items-center mb-8">
            <span className="text-right pr-12 text-black/30 text-[12px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>До</span>
            <div className="w-16 flex-shrink-0" />
            <span className="pl-12 text-[#040082] text-[12px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>После</span>
          </div>

          {/* Vertical center line — desktop only */}
          <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px pointer-events-none hidden md:block">
            <div className="absolute inset-0 bg-black/5" />
            <div
              ref={lineRef}
              className="absolute top-0 left-0 w-full origin-top"
              style={{
                height: "100%",
                background: "linear-gradient(to bottom, #040082, #1a1a9e, #040082)",
              }}
            />
          </div>

          <div ref={itemsRef} className="max-w-[1078px] mx-auto space-y-4 md:space-y-12">
            {beforeAfter.map((row, i) => (
              <ScrollReveal key={row.before} delay={i * 0.08}>
                <div className="rounded-[16px] border border-black/[0.06] bg-white p-5 md:p-0 md:rounded-none md:border-0 md:bg-transparent grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 md:gap-0 items-start md:items-center">
                  {/* Before */}
                  <div className="text-left md:text-right md:pr-12">
                    <span className="text-[11px] uppercase tracking-wider text-black/30 mb-1.5 block md:hidden" style={{ fontFamily: "var(--font-body)" }}>До</span>
                    <p className="text-[13px] md:text-[18px] leading-[1.35] font-light text-black/40" style={{ fontFamily: "var(--font-body)" }}>
                      {row.before}
                    </p>
                  </div>

                  {/* Arrow — down on mobile, right on desktop */}
                  <div className="flex md:hidden items-center justify-center py-2">
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 16 16" fill="none">
                      <path d="M8 3v10M8 13l-4-4M8 13l4-4" stroke="#040082" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <div className="hidden md:flex w-16 flex-shrink-0 items-center justify-center">
                    <svg aria-hidden="true" width="24" height="24" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="#040082" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>

                  {/* After — blue shape */}
                  <div className="md:pl-12 pt-1 md:pt-0">
                    <div className="bg-[#040082] rounded-[12px] px-6 py-5 md:px-7 md:py-5">
                      <span className="text-[11px] uppercase tracking-wider text-white/60 mb-1.5 block md:hidden" style={{ fontFamily: "var(--font-body)" }}>После</span>
                      <p className="text-white text-[14px] md:text-[17px] leading-[1.35] font-normal" style={{ fontFamily: "var(--font-body)" }}>
                        {row.after}
                      </p>
                    </div>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>

        {/* Use cases */}
        <ScrollReveal delay={0.1}>
          <div
            className="rounded-[20px] p-8 md:p-12"
            style={{
              background: "linear-gradient(170deg, rgba(4, 0, 130, 0.05) 0%, rgba(6, 6, 50, 0.06) 40%, rgba(2, 2, 25, 0.08) 100%)",
            }}
          >
            <h3
              className="text-black text-[16px] md:text-[22px] font-normal leading-[1.25] mb-6 uppercase tracking-[0.02em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Diagnostics brief используется как основа для
            </h3>
            <ul className="space-y-4">
              {useCases.map((uc) => (
                <li key={uc} className="flex items-start gap-3">
                  <svg
                    aria-hidden="true"
                    focusable="false"
                    className="flex-shrink-0 mt-[6px]"
                    width="10"
                    height="10"
                    viewBox="0 0 24 24"
                    fill="#040082"
                  >
                    <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                  </svg>
                  <span
                    className="text-black/60 text-[16px] leading-[1.35] font-light"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {uc}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
