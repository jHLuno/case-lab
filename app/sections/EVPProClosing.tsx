"use client";

import { ArrowRight, Calendar, Clock, MapPin } from "lucide-react";
import { useLeadPopup } from "../lib/LeadPopupContext";

const eventMeta = [
  { icon: Calendar, label: "Дата", value: "25 сентября" },
  { icon: Clock, label: "Время", value: "11:00–17:00" },
  { icon: MapPin, label: "Место", value: "Алматы, Narxoz Business School" },
];

export default function EVPProClosing() {
  const { openPopup } = useLeadPopup();

  return (
    <section
      aria-labelledby="evp-closing-title"
      className="relative isolate overflow-hidden bg-[#043B2C] px-6 pb-4 pt-24 text-white md:px-10 md:pb-6 md:pt-32 lg:pb-8 lg:pt-40"
    >
      {/* Scattered center glows */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div
          className="absolute h-[45%] w-[45%] rounded-full opacity-25 blur-[80px]"
          style={{
            left: "18%",
            top: "22%",
            background: "radial-gradient(circle, rgba(94,188,143,0.7) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute h-[38%] w-[38%] rounded-full opacity-20 blur-[70px]"
          style={{
            left: "52%",
            top: "35%",
            background: "radial-gradient(circle, rgba(211,160,255,0.6) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute h-[32%] w-[32%] rounded-full opacity-22 blur-[60px]"
          style={{
            left: "36%",
            top: "48%",
            background: "radial-gradient(circle, rgba(17,119,84,0.8) 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute h-[28%] w-[28%] rounded-full opacity-18 blur-[55px]"
          style={{
            left: "68%",
            top: "14%",
            background: "radial-gradient(circle, rgba(129,231,176,0.6) 0%, transparent 70%)",
          }}
        />
      </div>

      <div aria-hidden="true" className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(94,188,143,0.18),transparent_34%)]" />

      <div data-evp-reveal className="relative z-10 mx-auto max-w-[900px] text-center">
        <div className="flex flex-wrap items-center justify-center gap-3 md:gap-4">
          {eventMeta.map((item, index) => {
            const isCenter = index === 1;
            return (
              <div
                key={item.label}
                className={`inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm ${
                  isCenter
                    ? "px-5 py-2.5 md:px-7 md:py-3"
                    : "px-3.5 py-1.5 md:px-4 md:py-2"
                }`}
                style={{ fontFamily: "var(--font-body)" }}
              >
                <span className="flex h-[14px] w-[14px] shrink-0 items-center justify-center text-white/60" aria-hidden="true">
                  <item.icon size={14} strokeWidth={1.5} />
                </span>
                <span
                  className={`translate-y-px leading-none text-white/85 ${
                    isCenter ? "text-[14px] md:text-[16px]" : "text-[12px] md:text-[13px]"
                  }`}
                >
                  {item.value}
                </span>
              </div>
            );
          })}
        </div>

        <h2
          id="evp-closing-title"
          className="mt-8 text-[clamp(32px,5.2vw,72px)] font-bold uppercase leading-[1.05] tracking-[0.02em] md:mt-10"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Привлекайте лучших
        </h2>

        <p
          className="mx-auto mt-6 max-w-[52ch] text-[17px] leading-[1.5] text-white/75 md:mt-8 md:text-[21px]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Приходите командой, чтобы за одну сессию начать говорить с рынком труда одним голосом.
        </p>

        <button
          type="button"
          onClick={openPopup}
          className="group mx-auto mt-8 inline-flex min-h-11 items-center gap-3 rounded-full bg-white px-7 py-3.5 text-[15px] font-medium text-[#075C43] transition-[background-color,transform,gap] duration-200 hover:gap-4 hover:bg-white/90 active:scale-[0.98] md:mt-10 md:px-9 md:py-4"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Забронировать место
          <ArrowRight size={16} strokeWidth={2} aria-hidden="true" className="transition-transform duration-200 group-hover:translate-x-1" />
        </button>
      </div>
    </section>
  );
}
