"use client";

import { ArrowRight, Check } from "lucide-react";
import { useLeadPopup } from "../lib/LeadPopupContext";

const tiers = [
  {
    count: "1 участник",
    total: "135 000 ₸",
    perPerson: null,
    note: "Личное участие",
    highlighted: false,
  },
  {
    count: "2 участника",
    total: "230 000 ₸",
    perPerson: "115 000 ₸ / чел",
    note: "Команда",
    highlighted: false,
  },
  {
    count: "3 участника",
    total: "300 000 ₸",
    perPerson: "100 000 ₸ / чел",
    note: "Выгоднее всего",
    highlighted: true,
  },
];

const included = [
  "6 часов практической работы",
  "Рабочие материалы сессии",
  "Каркас EVP вашей компании",
  "Первые действия после сессии",
];

export default function EVPProPricing() {
  const { openPopup } = useLeadPopup();

  return (
    <section
      aria-labelledby="evp-pricing-title"
      className="relative isolate overflow-hidden bg-[#043B2C] px-6 pb-16 pt-24 text-white md:px-10 md:pb-28 md:pt-40"
    >
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(94,188,143,0.26),transparent_34%)]" />
      <div aria-hidden="true" className="evp-alignment-atmosphere absolute inset-x-0 bottom-0 h-[62%]" />

      <div className="relative z-10 mx-auto max-w-[1160px]">
        <div data-evp-reveal className="text-center">
          <h2
            id="evp-pricing-title"
            className="mx-auto max-w-[18ch] text-[clamp(26px,3.8vw,52px)] font-bold leading-[1.06] tracking-[0.02em] uppercase"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Стоимость участия
          </h2>
          <p
            className="mx-auto mt-5 max-w-[52ch] text-[15px] leading-[1.5] text-white/70 md:text-[17px]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Чем больше людей из компании приходит вместе, тем ниже цена за участника — и тем быстрее команда заговорит одним языком.
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:mt-14 md:grid-cols-3 md:gap-6">
          {tiers.map((tier, index) => (
            <article
              key={tier.count}
              data-evp-reveal
              style={{ transitionDelay: `${index * 140}ms` }}
              className={`evp-alignment-glass-card flex flex-col rounded-[24px] p-8 md:p-10 ${
                tier.highlighted ? "border border-white/30" : ""
              }`}
            >
              <div className="relative z-10 flex items-start justify-between gap-4">
                <p
                  className="text-[13px] uppercase tracking-[0.12em] text-white/60 md:text-[14px]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {tier.count}
                </p>
                {tier.highlighted && (
                  <p
                    className="shrink-0 rounded-full bg-white px-3.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[#075C43] md:text-[11px]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    Выгоднее всего
                  </p>
                )}
              </div>

              <p
                className="relative z-10 mt-4 text-[17px] font-bold uppercase tracking-[0.02em] md:text-[20px]"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {tier.note}
              </p>

              <div className="relative z-10 mt-7" style={{ fontFamily: "var(--font-body)" }}>
                <p className="text-[clamp(28px,3vw,38px)] leading-none">{tier.total}</p>
                <p className="mt-3 text-[13px] text-white/55 md:text-[14px]">
                  {tier.perPerson ?? "за участника"}
                </p>
              </div>

              <button
                type="button"
                onClick={openPopup}
                className={`relative z-10 mt-9 inline-flex min-h-11 items-center justify-center gap-3 rounded-full px-6 py-3 text-[14px] transition-[background-color,gap] duration-200 hover:gap-4 md:text-[15px] ${
                  tier.highlighted
                    ? "bg-white text-[#075C43] hover:bg-white/90"
                    : "border border-white/30 text-white hover:bg-white/10"
                }`}
                style={{ fontFamily: "var(--font-body)" }}
              >
                Записаться
                <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
              </button>
            </article>
          ))}
        </div>

        <div data-evp-reveal className="mt-10 border-t border-white/15 pt-8 text-center md:mt-14">
          <p
            className="text-[13px] uppercase tracking-[0.12em] text-white/50 md:text-[14px]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            В каждый формат входит
          </p>
          <ul
            className="mx-auto mt-5 flex max-w-full items-center justify-center gap-x-6 overflow-x-auto whitespace-nowrap md:gap-x-8"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {included.map((item) => (
              <li key={item} className="flex shrink-0 items-center gap-2 text-[14px] text-white/75 md:text-[15px]">
                <Check size={14} strokeWidth={2.5} className="shrink-0 text-white/50" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
