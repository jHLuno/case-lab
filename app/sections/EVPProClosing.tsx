"use client";

import dynamic from "next/dynamic";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useLeadPopup } from "../lib/LeadPopupContext";

const Dither = dynamic(() => import("../components/Dither"), { ssr: false });

export default function EVPProClosing() {
  const { openPopup } = useLeadPopup();
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="evp-closing-title"
      className="relative isolate overflow-hidden bg-gradient-to-b from-[#043B2C] via-[#06170f] to-black px-6 py-20 text-white md:px-10 md:py-40"
    >
      {!shouldReduceMotion && (
        <span aria-hidden="true" className="absolute inset-0 z-0 opacity-40">
          <Dither
            waveColor={[0.027450980392156862, 0.3607843137254902, 0.2627450980392157]}
            disableAnimation={false}
            enableMouseInteraction={false}
            mouseRadius={0.3}
            colorNum={4}
            pixelSize={2}
            waveAmplitude={0.28}
            waveFrequency={1.6}
            waveSpeed={0.008}
          />
        </span>
      )}
      <div aria-hidden="true" className="absolute inset-0 z-0 bg-[radial-gradient(circle_at_50%_100%,rgba(94,188,143,0.22),transparent_45%)]" />

      <div data-evp-reveal className="relative z-10 mx-auto max-w-[1078px]">
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
          className="group mt-9 inline-flex min-h-11 items-center gap-3 rounded-full bg-[#075C43] px-7 py-3 text-[15px] font-medium text-white transition-[background-color,transform] duration-200 hover:bg-[#0a7a58] active:scale-[0.98] md:mt-11 md:px-9 md:py-4"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Забронировать место
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </div>
    </section>
  );
}
