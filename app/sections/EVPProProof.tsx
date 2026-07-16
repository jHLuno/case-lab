"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

const testimonials = [
  {
    name: "Турлан Абиш",
    quote:
      "Мы привлекли Данияра в момент, когда нужно было «пересобрать» бренд заново. После сессии внутри команды появилось общее понимание и уверенность в направлении. Многие решения, которые раньше обсуждались долго и без финала, стали очевидными.",
    role: "Директор, Arigato Travel",
  },
  {
    name: "Жанна Нуртаева",
    quote:
      "По итогам работы мы получили чёткое позиционирование, единую логику коммуникаций и практическую маркетинговую рамку. Это не просто стратегический документ, а рабочий инструмент для принятия управленческих решений.",
    role: "CEO & Founder, 71 East Hotel",
  },
];

export default function EVPProProof() {
  const [activeIndex, setActiveIndex] = useState(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;
    const interval = setInterval(() => {
      setActiveIndex((current) => (current + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  return (
    <section aria-labelledby="evp-proof-title" className="relative bg-white px-6 py-10 md:px-10 md:py-14">
      <div className="mx-auto max-w-[1440px]">
        <div data-evp-reveal className="mb-8 md:mb-12">
          <span
            className="mb-3 block text-[11px] uppercase tracking-wider text-[#075C43]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Опыт Case Lab
          </span>
          <h2
            id="evp-proof-title"
            className="max-w-[18ch] text-[clamp(24px,4vw,48px)] font-bold uppercase leading-[1.15] tracking-[0.02em] text-black"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Подход, который уже работает
          </h2>
        </div>

        <div data-evp-reveal className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            {testimonials.map((testimonial, index) => (
              <div
                key={testimonial.name}
                onClick={() => setActiveIndex(index)}
                className={`cursor-pointer select-none border-t border-black/10 py-4 transition-opacity duration-200 ease-out ${
                  activeIndex === index ? "opacity-100" : "opacity-40 hover:opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[15px] font-normal leading-[1.22] text-black md:text-[18px]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {testimonial.name}
                  </span>
                  <svg
                    aria-hidden="true"
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    className={`text-black transition-transform duration-500 ${activeIndex === index ? "rotate-180" : ""}`}
                  >
                    <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>

                <div className="relative mt-3 h-[2px] overflow-hidden bg-black/10">
                  <div
                    className="absolute inset-y-0 left-0 bg-[#075C43]"
                    style={{
                      width: activeIndex === index ? "100%" : "0%",
                      transition: activeIndex === index && !shouldReduceMotion ? "width 4700ms linear" : "none",
                    }}
                  />
                </div>
              </div>
            ))}

            <div className="mt-6 flex items-center gap-2">
              {testimonials.map((testimonial, index) => (
                <div
                  key={testimonial.name}
                  className="h-1.5 rounded-full transition-[width,background-color] duration-500"
                  style={{
                    width: index === activeIndex ? 24 : 6,
                    backgroundColor: index === activeIndex ? "#075C43" : "rgba(0,0,0,0.15)",
                  }}
                />
              ))}
            </div>
          </div>

          <div className="min-h-[210px] pt-4 lg:flex lg:items-start lg:pt-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={shouldReduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? undefined : { opacity: 0, y: -12 }}
                transition={{ duration: shouldReduceMotion ? 0 : 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <blockquote
                  className="mb-6 break-words text-[15px] font-normal leading-[1.5] text-black md:text-[18px] lg:text-[20px]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  &ldquo;{testimonials[activeIndex].quote}&rdquo;
                </blockquote>
                <div>
                  <p className="text-[13px] font-normal text-black md:text-[16px]" style={{ fontFamily: "var(--font-body)" }}>
                    {testimonials[activeIndex].name}
                  </p>
                  <p className="text-[13px] font-light text-black/60 md:text-[16px]" style={{ fontFamily: "var(--font-body)" }}>
                    {testimonials[activeIndex].role}
                  </p>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
