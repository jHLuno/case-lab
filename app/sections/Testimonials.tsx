"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const testimonials = [
  {
    name: "Анна Ким",
    quote:
      "За два часа я наконец поняла, почему наш маркетинг работает вхолостую. Диагностика показала, что 60% бюджета утекает в каналы с нулевой конверсией. Получила конкретный план из трёх шагов — без воды.",
    role: "Руководитель маркетинга, Hero's Journey",
    session: "Декабрь 2025",
  },
  {
    name: "Дамир Сатбаев",
    quote:
      "Я пришёл с ощущением, что в маркетинге бардак, но не мог объяснить почему. Case Lab структурировал разговор так, что проблемы всплыли сами. Через 48 часов у меня был рабочий документ, который я показал собственнику.",
    role: "CEO, abr",
    session: "Март 2026",
  },
  {
    name: "Марат Исаев",
    quote:
      "Сопротивлялся диагностике — думал, что и так всё знаю. Оказалось, я не вижу очевидного: наша коммуникация пересекается с двумя конкурентами в одном сегменте. Диагностика дала язык, на котором я смог объяснить это команде.",
    role: "Marketing Director, Shetel",
    session: "Декабрь 2025",
  },
  {
    name: "Елена Волкова",
    quote:
      "Два часа — и я поняла, кто наш реальный клиент. Раньше мы стреляли по всем сегментам, а после диагностики сфокусировались на одном. Экономия бюджета и рост ROMI — результат через квартал.",
    role: "Brand Manager, inDrive Kazakhstan",
    session: "Март 2026",
  },
];

export default function Testimonials() {
  const [activeIndex, setActiveIndex] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // Staggered reveal for company items on all breakpoints
      gsap.fromTo(
        section.querySelectorAll(".testimonial-item"),
        { opacity: 0, y: 30 },
        {
          opacity: 1,
          y: 0,
          stagger: 0.12,
          scrollTrigger: {
            trigger: section,
            start: "top 80%",
            end: "top 40%",
            scrub: true,
            invalidateOnRefresh: true,
          },
        }
      );

      // Pin + progress-based active index on all breakpoints
      const mm = gsap.matchMedia();

      mm.add("(max-width: 1023px)", () => {
        ScrollTrigger.create({
          trigger: section,
          start: "top 15%",
          end: "+=600",
          pin: true,
          scrub: 1.2,
          id: "testimonials-mobile",
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const progress = self.progress;
            const segmentSize = 1 / testimonials.length;
            const rawIndex = progress / segmentSize;
            const index = Math.min(Math.floor(rawIndex), testimonials.length - 1);
            const isLastSegment = index === testimonials.length - 1;
            const segmentProgress = isLastSegment && progress > 0.98
              ? 1
              : rawIndex - index;

            setActiveIndex(index);

            lineRefs.current.forEach((line, i) => {
              if (!line) return;
              if (i === index) {
                line.style.width = `${segmentProgress * 100}%`;
              } else {
                line.style.width = "0%";
              }
            });
          },
        });
      });

      mm.add("(min-width: 1024px)", () => {
        ScrollTrigger.create({
          trigger: section,
          start: "top 15%",
          end: `+=${window.innerHeight * 2.5}`,
          pin: true,
          scrub: 1.2,
          id: "testimonials",
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            const progress = self.progress;
            const segmentSize = 1 / testimonials.length;
            const rawIndex = progress / segmentSize;
            const index = Math.min(Math.floor(rawIndex), testimonials.length - 1);
            const isLastSegment = index === testimonials.length - 1;
            const segmentProgress = isLastSegment && progress > 0.98
              ? 1
              : rawIndex - index;

            setActiveIndex(index);

            lineRefs.current.forEach((line, i) => {
              if (!line) return;
              if (i === index) {
                line.style.width = `${segmentProgress * 100}%`;
              } else {
                line.style.width = "0%";
              }
            });
          },
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleCompanyClick = (index: number) => {
    setActiveIndex(index);
    lineRefs.current.forEach((line, i) => {
      if (!line) return;
      line.style.width = i === index ? "100%" : "0%";
    });
  };

  return (
    <section
      ref={sectionRef}
      id="testimonials"
      aria-label="Результаты сессий"
      className="relative bg-white py-16 md:py-40 px-6 md:px-10 overflow-hidden"
    >
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        {/* Header */}
        <div className="mb-8 md:mb-12">
          <span
            className="text-[#040082] text-[11px] mb-3 block leading-[1.58] uppercase tracking-wider font-normal"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Результаты диагностики
          </span>
          <h2
            className="text-black text-[clamp(16px,4vw,48px)] font-bold leading-[1.15] mb-8 md:mb-12 uppercase tracking-[0.02em]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Что изменилось после сессии
          </h2>
        </div>

        {/* Company List + Quote */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          {/* Company List */}
          <div className="space-y-0">
            {testimonials.map((t, i) => (
              <div
                key={t.name}
                onClick={() => handleCompanyClick(i)}
                className={`testimonial-item border-t border-black/10 py-4 transition-all duration-500 ease-out cursor-pointer select-none ${
                  activeIndex === i
                    ? "opacity-100"
                    : "opacity-40 hover:opacity-70"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-black text-[15px] md:text-[18px] font-normal leading-[1.22]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {t.name}
                  </span>
                  <motion.div
                    animate={{ rotate: activeIndex === i ? 180 : 0 }}
                    transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <svg
                      aria-hidden="true"
                      width="14"
                      height="14"
                      viewBox="0 0 16 16"
                      fill="none"
                      className="text-black"
                      focusable="false"
                    >
                      <path
                        d="M4 6L8 10L12 6"
                        stroke="currentColor"
                        strokeWidth="1"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </motion.div>
                </div>

                {/* Progress line */}
                <div className="h-[2px] mt-3 relative overflow-hidden bg-black/10">
                  <div
                    ref={(el) => {
                      lineRefs.current[i] = el;
                    }}
                    className="absolute inset-y-0 left-0 will-change-[width]"
                    style={{
                      background: "linear-gradient(90deg, #040082, #1a1a9e)",
                    }}
                  />
                </div>
              </div>
            ))}
            {/* Progress dots — desktop only */}
            <div className="hidden lg:flex items-center gap-2 mt-6">
              {testimonials.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-500 ${
                    i === activeIndex ? "w-6 bg-[#040082]" : "w-1.5 bg-black/20"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Quote */}
          <div className="testimonial-item lg:flex lg:items-center">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                className="w-full"
              >
                <blockquote
                  cite="#testimonials"
                  className="text-black text-[14px] md:text-[22px] lg:text-[24px] font-normal leading-[1.4] mb-6 break-words"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  &ldquo;{testimonials[activeIndex].quote}&rdquo;
                </blockquote>
                <div>
                  <span
                    className="inline-block bg-[#040082]/10 text-[#040082] text-[11px] md:text-[12px] font-normal px-3 py-1.5 rounded-full mb-3 uppercase tracking-wider"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {testimonials[activeIndex].session}
                  </span>
                  <p
                    className="text-black text-[13px] md:text-[16px] font-normal"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {testimonials[activeIndex].name}
                  </p>
                  <p
                    className="text-black/60 text-[13px] md:text-[16px] font-light"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
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
