"use client";

import { ArrowRight, Check, Users } from "lucide-react";
import { useLeadPopup } from "../lib/LeadPopupContext";

const included = [
  "6 часов практической работы",
  "Рабочие материалы сессии",
  "Каркас EVP вашей компании",
  "Первые действия после сессии",
];

const tiers = [
  {
    count: "1 участник",
    total: "135 000 ₸",
    perPerson: "за участника",
    note: "Соло",
    savings: null,
    benefit: "Разрывы между ролями вы согласовываете сами, после сессии.",
    highlighted: false,
  },
  {
    count: "2 участника",
    total: "230 000 ₸",
    perPerson: "115 000 ₸ / чел",
    note: "Дуо",
    savings: "Экономия 40 000 ₸ против соло",
    benefit: "Два взгляда на EVP в одной комнате — разрывы видно сразу, а не в переписке.",
    highlighted: false,
  },
  {
    count: "3 участника",
    total: "300 000 ₸",
    perPerson: "100 000 ₸ / чел",
    note: "Трио",
    savings: "Экономия 105 000 ₸ против соло",
    benefit: "Руководитель, HR и маркетинг выходят с одним согласованным EVP, а не с тремя разными.",
    highlighted: true,
  },
];

export default function EVPProPricing() {
  const { openPopup } = useLeadPopup();

  return (
    <section
      id="pricing"
      aria-labelledby="evp-pricing-title"
      className="relative isolate overflow-hidden bg-[#043B2C] px-6 py-14 text-white md:px-10 md:py-20"
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
            <div
              key={tier.count}
              data-evp-reveal
              style={{ transitionDelay: `${index * 140}ms` }}
              className="relative h-full pt-4"
            >
              {tier.highlighted && (
                <span
                  className="absolute left-1/2 top-0 z-20 -translate-x-1/2 rounded-full bg-white px-4 py-1.5 text-[10px] font-medium uppercase tracking-[0.12em] text-[#075C43] shadow-[0_8px_20px_rgba(0,0,0,0.25)] md:text-[11px]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Выгоднее всего
                </span>
              )}

              <article
                className={`evp-alignment-glass-card flex h-full flex-col rounded-[24px] p-8 md:p-10 ${
                  tier.highlighted ? "border border-white/30" : ""
                }`}
              >
                <div className="relative z-10 flex min-h-[28px] items-center">
                  <p
                    className="text-[13px] uppercase tracking-[0.12em] text-white/60 md:text-[14px]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {tier.count}
                  </p>
                </div>

                <p
                  className="relative z-10 mt-4 text-[17px] font-bold uppercase tracking-[0.02em] md:text-[20px]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {tier.note}
                </p>

                <div className="relative z-10 mt-7" style={{ fontFamily: "var(--font-body)" }}>
                  <p className="text-[clamp(28px,3vw,38px)] leading-none">{tier.total}</p>
                  <div className="mt-3 flex min-h-[26px] flex-wrap items-center gap-x-3 gap-y-2">
                    <p className="text-[13px] text-white/65 md:text-[14px]">{tier.perPerson}</p>
                    {tier.savings && (
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] ${
                          tier.highlighted ? "border-white/40 text-white" : "border-white/25 text-white/80"
                        }`}
                      >
                        {tier.savings}
                      </span>
                    )}
                  </div>
                </div>

                <div className="relative z-10 mt-6 flex flex-1 flex-col gap-6">
                  <p
                    className={`flex min-h-[62px] items-start gap-2.5 text-[14px] leading-[1.45] md:min-h-[42px] ${
                      tier.highlighted ? "text-white/90" : "text-white/70"
                    }`}
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    <Users size={15} strokeWidth={2} aria-hidden="true" className="mt-[2px] shrink-0 text-white/60" />
                    {tier.benefit}
                  </p>

                  <div>
                    <p
                      className="text-[11px] uppercase tracking-[0.14em] text-white/60"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      В формат входит
                    </p>
                    <ul className="mt-3 space-y-2" style={{ fontFamily: "var(--font-body)" }}>
                      {included.map((item) => (
                        <li key={item} className="flex items-start gap-2.5 text-[14px] text-white/70 md:text-[15px]">
                          <Check size={14} strokeWidth={2.5} className="mt-[3px] shrink-0 text-white/60" aria-hidden="true" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={openPopup}
                  className={`relative z-10 mt-9 inline-flex min-h-11 items-center justify-center gap-3 rounded-full px-6 py-3 text-[14px] font-medium transition-[background-color,gap] duration-200 hover:gap-4 md:text-[15px] ${
                    tier.highlighted
                      ? "bg-white text-[#075C43] hover:bg-white/90"
                      : "border border-white/30 text-white hover:bg-white/10"
                  }`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Забронировать место
                  <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                </button>
              </article>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
