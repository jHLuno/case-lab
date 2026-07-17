"use client";

import dynamic from "next/dynamic";
import { ArrowRight } from "lucide-react";
import { useReducedMotion } from "framer-motion";
import { useLeadPopup } from "../lib/LeadPopupContext";

const Grainient = dynamic(() => import("../components/Grainient"), { ssr: false });

const eventFacts = [
  { label: "Дата", value: "25 сентября" },
  { label: "Время", value: "11:00-17:00" },
  { label: "Место", value: "Алматы, Narxoz Business School" },
];

export default function EVPProHero() {
  const { openPopup } = useLeadPopup();
  const shouldReduceMotion = useReducedMotion();

  return (
    <section
      aria-labelledby="evp-pro-title"
      className="relative isolate bg-white p-2 text-white lg:p-3"
    >
      <div className="relative min-h-[calc(100dvh-16px)] overflow-hidden rounded-[28px] md:rounded-[36px] lg:min-h-[calc(100dvh-24px)] lg:rounded-[40px]">
        <div aria-hidden="true" className="evp-hero-background absolute inset-0">
          <div className="absolute inset-0 bg-[#043B2C]" />
          {!shouldReduceMotion && (
            <div className="absolute inset-0">
              <Grainient
                color1="#FF9FFC"
                color2="#075C43"
                color3="#B497CF"
                timeSpeed={0.25}
                colorBalance={0}
                warpStrength={1.75}
                warpFrequency={5.6}
                warpSpeed={0.9}
                warpAmplitude={14}
                blendAngle={-63}
                blendSoftness={0}
                rotationAmount={970}
                noiseScale={2.2}
                grainAmount={0.22}
                grainScale={2.1}
                grainAnimated={false}
                contrast={1.5}
                gamma={1.25}
                saturation={1.05}
                centerX={0}
                centerY={0}
                zoom={0.9}
              />
            </div>
          )}
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(4,59,44,0.62)_0%,rgba(4,59,44,0.28)_45%,rgba(4,59,44,0.08)_100%)]" />
          <div className="evp-hero-signal absolute inset-0 opacity-15">
            <div className="absolute right-[8%] top-[18%] h-[64%] w-px bg-white/35" />
            <div className="absolute right-[18%] top-[8%] h-[78%] w-px bg-white/20" />
            <div className="absolute right-[28%] top-[30%] h-[52%] w-px bg-white/15" />
            <span
              className="absolute right-[5%] top-[12%] text-[clamp(120px,22vw,340px)] font-bold leading-none text-white/[0.07]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              EVP
            </span>
          </div>
        </div>
        <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-16px)] w-full max-w-[1440px] flex-col justify-end px-6 pb-10 pt-32 md:px-10 md:pb-24 md:pt-36 lg:min-h-[calc(100dvh-24px)]">
          <div className="w-full max-w-[780px] -translate-y-10 md:-translate-y-16">
            <h1
              id="evp-pro-title"
              className="evp-hero-enter max-w-[16ch] text-[clamp(30px,5.4vw,76px)] font-bold uppercase leading-[1.02] tracking-[0.02em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              EVP Pro: Как <span className="whitespace-normal md:whitespace-nowrap">хантить лучших?</span>
            </h1>
            <p
              className="evp-hero-enter evp-hero-enter-delay-1 mt-6 max-w-[62ch] text-[16px] leading-[1.5] text-white/82 md:mt-8 md:text-[19px]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Практическая сессия о EVP: как собрать единое предложение работодателя, чтобы HR, маркетинг, PR и руководители говорили с рынком труда одним голосом.
            </p>
            <button
              type="button"
              onClick={openPopup}
              className="evp-hero-enter evp-hero-enter-delay-2 mt-8 inline-flex cursor-pointer items-center gap-3 rounded-full bg-white px-7 py-3.5 text-[14px] font-medium text-[#075C43] transition-[gap,transform] duration-200 hover:gap-4 md:mt-10 md:px-10 md:py-5 md:text-[15px]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Забронировать место
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            </button>
        </div>

          <dl
            className="evp-hero-enter evp-hero-enter-delay-1 mt-12 grid gap-3 border-t border-white/30 pt-5 lg:hidden"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {eventFacts.map((fact) => (
              <div
                key={fact.label}
                className="grid grid-cols-[88px_1fr] gap-4 border-b border-white/20 py-4"
              >
                <dt className="text-[12px] uppercase tracking-[0.12em] text-white/55">{fact.label}</dt>
                <dd className="text-[15px] leading-[1.35] text-white md:text-[17px]">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <aside className="absolute bottom-0 right-0 z-20 hidden h-[17%] w-[55%] items-center justify-center text-[#0a0a0a] lg:flex">
        <dl className="flex w-full items-start justify-center gap-8 px-10" style={{ fontFamily: "var(--font-body)" }}>
          {eventFacts.map((fact) => (
            <div key={fact.label} className="min-w-0 flex-1">
              <dt
                className="text-[16px] font-bold uppercase tracking-[0.1em] text-black"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {fact.label}
              </dt>
              <dd className="mt-2 text-[14px] leading-[1.35] text-black xl:text-[16px]">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </aside>
    </section>
  );
}
