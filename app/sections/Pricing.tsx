"use client";

import { useRef, useEffect } from "react";
import { ArrowRight, Check, Star, Zap } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function BlurRevealHeading({ text, className = "" }: { text: string; className?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const words = ref.current.querySelectorAll(".blur-word");
    if (words.length === 0) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { opacity: 0.1, y: 20, filter: "blur(6px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          stagger: 0.06,
          scrollTrigger: {
            trigger: ref.current,
            start: "top 85%",
            end: "top 55%",
            scrub: true,
          },
        }
      );
    });

    return () => ctx.revert();
  }, []);

  return (
    <h2
      ref={ref}
      className={`flex flex-wrap gap-x-[0.25em] ${className}`}
      style={{ fontFamily: "var(--font-heading)" }}
    >
      {text.split(" ").map((word, i) => (
        <span key={i} className="blur-word inline-block" style={{ willChange: "filter, opacity, transform" }}>
          {word}
        </span>
      ))}
    </h2>
  );
}

const starterPlan = {
  name: "Диагностика",
  badge: "01 — DX",
  originalPrice: "200 000 ₸",
  price: "145 000 ₸",
  priceNote: "Первые 5 консультаций",
  features: [
    "2 часа структурированного интервью",
    "Разбор текущих каналов и коммуникаций",
    "Карта слепых зон и точек роста",
    "Diagnostics brief — рабочий документ",
    "Первичные гипотезы с приоритетами",
  ],
  cta: "Записаться",
  popular: false,
};

const proPlan = {
  name: "Сопровождение",
  badge: "02 — PARTNERSHIP",
  price: "800 000 ₸",
  priceNote: "Полный цикл",
  features: [
    "Всё из базового пакета",
    "Глубинные интервью с экспертами рынка",
    "Количественное исследование аудитории",
    "Детальная стратегия на 90 дней",
    "Сопровождение внедрения — 2 недели",
    "Приоритетная поддержка в Telegram",
  ],
  cta: "Выбрать пакет",
  popular: true,
};

function StarShape({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg aria-hidden="true" className={className} style={style} width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z" fill="currentColor" />
    </svg>
  );
}

interface Plan {
  name: string;
  badge: string;
  originalPrice?: string;
  price: string;
  priceNote: string;
  features: string[];
  cta: string;
  popular: boolean;
}

function PricingCard({
  plan,
}: {
  plan: Plan;
}) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 60, filter: "blur(4px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          scrollTrigger: {
            trigger: cardRef.current,
            start: "top 85%",
            end: "top 55%",
            scrub: true,
          },
        }
      );
    });
    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={cardRef}
      className="relative h-full"
      style={{ opacity: 0 }}
    >
      <div
        className={`relative rounded-[20px] overflow-hidden flex flex-col h-full ${
          plan.popular
            ? "border-2 border-[#040082]/30"
            : "border border-white/10"
        }`}
        style={{
          background: plan.popular
            ? "linear-gradient(170deg, rgba(4, 0, 130, 0.98) 0%, rgba(6, 6, 50, 0.99) 40%, rgba(2, 2, 25, 1) 100%)"
            : "linear-gradient(170deg, rgba(4, 0, 130, 0.92) 0%, rgba(6, 6, 50, 0.96) 40%, rgba(2, 2, 25, 0.98) 100%)",
        }}
      >
        {/* Decorative stars */}
        <StarShape className="absolute top-8 left-8 text-white/15 w-5 h-5 animate-pulse" />
        <StarShape className="absolute top-14 left-14 text-white/10 w-3 h-3 animate-pulse" style={{ animationDelay: "0.7s" }} />
        <StarShape className="absolute top-10 right-12 text-white/12 w-4 h-4 animate-pulse" style={{ animationDelay: "1.2s" }} />

        {plan.popular && (
          <>
            <StarShape className="absolute bottom-40 left-16 text-white/10 w-4 h-4 animate-pulse" style={{ animationDelay: "1.6s" }} />
            <StarShape className="absolute bottom-28 right-24 text-white/15 w-3 h-3 animate-pulse" style={{ animationDelay: "0.4s" }} />
          </>
        )}

        <div className="relative z-10 p-8 md:p-10 lg:p-12 flex flex-col h-full">
          {/* Badge */}
          <span
            className="inline-flex items-center gap-1.5 border border-white/20 rounded-full px-3 py-1.5 text-white/60 text-[10px] md:text-[11px] uppercase tracking-wider mb-6 w-fit"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <span className="text-white/40">{plan.badge.split(" — ")[0]}</span>
            <span className="w-3 h-px bg-white/20" />
            <span className="text-white/80">{plan.badge.split(" — ")[1]}</span>
          </span>

          {/* Name */}
          <h3
            className="text-white text-[clamp(24px,3vw,36px)] font-normal uppercase leading-[1.1] tracking-[0.02em] mb-6"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {plan.name}
          </h3>

          {/* Price */}
          <div className="mb-8">
            {/* Original price row — same height in both cards */}
            <div className="min-h-[28px] mb-1">
              {plan.originalPrice ? (
                <div
                  className="text-white/30 text-[16px] md:text-[18px] font-light line-through"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {plan.originalPrice}
                </div>
              ) : (
                <div
                  className="text-white/0 text-[16px] md:text-[18px] font-light line-through select-none"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  —
                </div>
              )}
            </div>
            <div
              className="text-white text-[clamp(32px,4vw,48px)] font-normal leading-[1] mb-2"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {plan.price}
            </div>
            <p
              className="text-white/40 text-[12px] md:text-[13px] font-light"
              style={{ fontFamily: "var(--font-body)" }}
            >
              {plan.priceNote}
            </p>
          </div>

          {/* Features */}
          <ul className="space-y-3 mb-10 flex-1">
            {plan.features.map((feature, i) => (
              <li
                key={i}
                className="flex items-start gap-3 text-white/70 text-[13px] md:text-[14px] leading-[1.4] font-light"
                style={{ fontFamily: "var(--font-body)" }}
              >
                <span className="mt-[3px] flex-shrink-0">
                  {plan.popular ? (
                    <Zap size={14} className="text-white/50" />
                  ) : (
                    <Check size={14} className="text-white/50" />
                  )}
                </span>
                {feature}
              </li>
            ))}
          </ul>

          {/* CTA */}
          <a
            href="/contact/"
            className={`group/btn inline-flex items-center justify-center gap-3 px-8 py-4 text-[15px] font-normal rounded-full w-full transition-all duration-300 hover:gap-4 ${
              plan.popular
                ? "bg-white text-[#040082] hover:bg-white/90"
                : "bg-white/10 text-white border border-white/20 hover:bg-white/20"
            }`}
            style={{ fontFamily: "var(--font-body)" }}
          >
            <span>{plan.cta}</span>
            <span className="transition-transform duration-300 group-hover/btn:translate-x-1">
              <ArrowRight size={16} strokeWidth={2} />
            </span>
          </a>
        </div>

      </div>
    </div>
  );
}

export default function Pricing() {
  const sectionRef = useRef<HTMLElement>(null);

  return (
    <section ref={sectionRef} id="diagnostics" aria-label="Форматы диагностики" className="relative bg-white py-24 md:py-40 px-6 md:px-10 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1200px] mx-auto">
        {/* Case Lab Label */}
        <div className="text-center mb-10 md:mb-14">
          <span
            className="case-lab-badge inline-flex items-center gap-[6px]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <span className="text-gray text-[15px] md:text-[17px] font-normal uppercase tracking-wider">
              Продукт
            </span>
            <span className="inline-flex items-center justify-center bg-[#040082] text-white px-[10px] py-[4px] text-[14px] md:text-[16px] font-normal uppercase tracking-wider leading-none">
              CASE
            </span>
            <span className="text-black text-[15px] md:text-[17px] italic normal-case tracking-wider">
              LAB
            </span>
          </span>
        </div>

        {/* Header */}
        <div className="mb-12 md:mb-20 text-center">
          <BlurRevealHeading
            text="Форматы диагностики"
            className="text-black text-[clamp(29px,4.5vw,54px)] font-bold leading-[1.1] uppercase tracking-[0.02em] justify-center"
          />
          <p
            className="text-black/60 text-[16px] md:text-[18px] leading-[1.3] mt-4 max-w-2xl mx-auto font-light"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Два формата диагностики — выберите под задачу
          </p>
        </div>

        {/* Pricing Cards */}
        <div
          className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8"
          style={{ perspective: "1200px" }}
        >
          <PricingCard plan={starterPlan} />
          <PricingCard plan={proPlan} />
        </div>

        {/* Bottom note */}
        <div className="mt-12 md:mt-16 text-center">
          <p
            className="text-black/60 text-[14px] font-light"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Оба пакета — офлайн в Алматы. Дата сессии — в течение 24 часов после заявки.
          </p>
        </div>
      </div>
    </section>
  );
}
