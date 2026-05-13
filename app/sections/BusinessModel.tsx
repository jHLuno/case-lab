"use client";

import ScrollReveal from "../components/ScrollReveal";

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
  {
    num: "01",
    title: "Маркетинговая стратегия",
    desc: "Основа для квартального плана с приоритетами и метриками",
  },
  {
    num: "02",
    title: "Бриф для агентств",
    desc: "Структурированный документ для подрядчиков и партнёров",
  },
  {
    num: "03",
    title: "Внутренняя коммуникация",
    desc: "Общий язык между собственником, CMO и командой",
  },
];

export default function BusinessModel() {
  return (
    <section aria-label="Что меняется после диагностики" className="relative bg-white py-16 md:py-40 px-6 md:px-10 overflow-clip">
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
              <span className="text-black text-[15px] md:text-[17px] font-normal uppercase tracking-wider">
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
        <div className="relative mb-16 md:mb-24">
          {/* Desktop column headers */}
          <div className="hidden md:grid grid-cols-[1fr_auto_1fr] gap-0 items-center mb-8">
            <span className="text-right pr-12 text-black/30 text-[12px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>До</span>
            <div className="w-16 flex-shrink-0" />
            <span className="pl-12 text-[#040082] text-[12px] uppercase tracking-wider font-normal" style={{ fontFamily: "var(--font-body)" }}>После</span>
          </div>

          <div className="space-y-4 md:space-y-12">
            {beforeAfter.map((row, i) => (
              <ScrollReveal key={row.before} delay={i * 0.12}>
                <div className="rounded-[16px] border border-black/[0.06] bg-white p-5 md:p-0 md:rounded-none md:border-0 md:bg-transparent grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-2 md:gap-0 items-start md:items-center">
                  {/* Before */}
                  <div className="text-left md:text-right md:pr-12">
                    <span className="text-[11px] uppercase tracking-wider text-black/30 mb-1.5 block md:hidden" style={{ fontFamily: "var(--font-body)" }}>До</span>
                    <p className="text-[13px] md:text-[18px] leading-[1.35] font-light text-black/40" style={{ fontFamily: "var(--font-body)" }}>
                      {row.before}
                    </p>
                  </div>

                  {/* Arrow */}
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
                    <span className="text-[11px] uppercase tracking-wider text-white/60 mb-1.5 block md:hidden" style={{ fontFamily: "var(--font-body)" }}>После</span>
                    <div className="bg-[#040082] rounded-[12px] px-6 py-5 md:px-7 md:py-5">
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

        {/* Use cases — 3 cards */}
        <ScrollReveal>
          <div className="mb-4">
            <h3
              className="text-black text-[16px] md:text-[22px] font-bold leading-[1.25] uppercase tracking-[0.02em] mb-8 md:mb-10"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Diagnostics brief используется как основа для
            </h3>
          </div>
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          {useCases.map((uc, i) => (
            <ScrollReveal key={uc.num} delay={i * 0.1}>
              <div className="relative rounded-[16px] border border-black/[0.06] bg-white p-8 md:p-9 h-full flex flex-col">
                {/* Number */}
                <span
                  className="text-[#040082]/15 text-[40px] font-bold leading-none block mb-4"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {uc.num}
                </span>

                {/* Title */}
                <h4
                  className="text-black text-[16px] md:text-[18px] font-normal leading-[1.25] uppercase tracking-[0.02em] mb-3"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {uc.title}
                </h4>

                {/* Description */}
                <p
                  className="text-black/50 text-[14px] leading-[1.45] font-light mt-auto"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {uc.desc}
                </p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
