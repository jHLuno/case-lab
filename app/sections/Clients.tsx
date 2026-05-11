"use client";

import { ArrowRight } from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";

const industries = [
  { id: 1, title: "Hero's Journey", abbr: "HJ" },
  { id: 2, title: "abr", abbr: "abr" },
  { id: 3, title: "inDrive", abbr: "ID" },
  { id: 4, title: "Shetel", abbr: "SH" },
  { id: 5, title: "ZimaBlue", abbr: "ZB" },
  { id: 6, title: "Citix", abbr: "CX" },
];

export default function Clients() {
  return (
    <section id="industries" aria-label="Компании" className="relative bg-white py-24 md:py-40 px-6 md:px-10">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        <ScrollReveal>
          <h2
            className="text-black text-[clamp(29px,4vw,54px)] font-bold leading-[1.15] mb-12 md:mb-16 uppercase tracking-[0.02em]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Компании,
            <br />
            <span className="whitespace-nowrap">чьи кейсы мы разобрали</span>
          </h2>
        </ScrollReveal>
      </div>

      {/* Marquee cards */}
      <div className="overflow-hidden py-3">
        <div
          className="marquee-track flex gap-4 md:gap-6"
          style={{ willChange: "transform" }}
        >
          {[...industries, ...industries].map((industry, i) => (
            <div
              key={`${industry.id}-${i}`}
              className="relative rounded-[16px] overflow-hidden group cursor-pointer flex-shrink-0 border border-black/[0.08] bg-white hover:border-[#040082]/30 hover:shadow-[0_12px_40px_-12px_rgba(4,0,130,0.15)] hover:scale-[1.02] transition-all duration-500"
              style={{ width: "clamp(280px, 35vw, 400px)" }}
            >
              <div className="aspect-[4/3] relative overflow-hidden flex flex-col items-center justify-center p-8">
                <div
                  className="absolute inset-0 opacity-[0.04]"
                  style={{
                    background: `linear-gradient(135deg, #040082 0%, #1a1a9e 50%, #040082 100%)`,
                  }}
                />
                <span
                  className="relative z-10 text-[clamp(48px,6vw,80px)] font-bold leading-none text-black/8 select-none"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {industry.abbr}
                </span>
              </div>
              <div className="p-5 md:p-6 border-t border-black/5">
                <span
                  className="text-black text-[18px] md:text-[22px] font-normal leading-[1.15] block"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {industry.title}
                </span>
                <span
                  className="text-gray text-[12px] md:text-[13px] font-light mt-1 block"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Кейс в разработке
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-[1078px] mx-auto mt-8">
        <ScrollReveal delay={0.2}>
          <a
            href="#industries"
            className="inline-flex items-center gap-2 bg-[#040082] text-white px-6 py-3 rounded-full text-[14px] font-normal hover:bg-[#0600a8] transition-all duration-300 group"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Все кейсы
            <ArrowRight
              size={14}
              strokeWidth={2}
              className="group-hover:translate-x-1 transition-transform"
            />
          </a>
        </ScrollReveal>
      </div>

    </section>
  );
}
