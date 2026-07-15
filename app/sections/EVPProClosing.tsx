"use client";

import { ArrowRight } from "lucide-react";
import { useLeadPopup } from "../lib/LeadPopupContext";

export default function EVPProClosing() {
  const { openPopup } = useLeadPopup();

  return (
    <section aria-labelledby="evp-closing-title" className="relative overflow-hidden bg-[#040082] px-6 py-20 text-white md:px-10 md:py-36">
      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_90%_90%,rgba(255,255,255,0.16),transparent_28%),radial-gradient(circle_at_12%_10%,rgba(107,107,255,0.42),transparent_25%)]" />
      <div data-evp-reveal className="relative mx-auto max-w-[1078px]">
        <p className="text-[14px] text-white/70" style={{ fontFamily: "var(--font-body)" }}>
          25 сентября · 11:00-17:00 · Алматы, Narxoz Business School
        </p>
        <h2
          id="evp-closing-title"
          className="mt-6 max-w-[14ch] text-[clamp(30px,5vw,68px)] font-bold leading-[1.04] tracking-[0.02em] uppercase"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Соберите компанию, которую выбирают сильные люди
        </h2>
        <p className="mt-7 max-w-[52ch] text-[16px] leading-[1.5] text-white/78 md:text-[19px]" style={{ fontFamily: "var(--font-body)" }}>
          Приходите командой, чтобы за одну сессию начать говорить с рынком труда одним голосом.
        </p>
        <button
          type="button"
          onClick={openPopup}
          className="group mt-9 inline-flex min-h-11 items-center gap-3 rounded-full bg-white px-7 py-3 text-[15px] font-medium text-[#075C43] transition-[background-color,transform] duration-200 hover:bg-white/90 active:scale-[0.98] md:mt-11 md:px-9 md:py-4"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Записаться на EVP Pro
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </div>
    </section>
  );
}
