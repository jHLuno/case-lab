"use client";

import { useRef, useState, useEffect } from "react";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const timelineSteps = [
  { id: "01", title: "Заявка и брифинг", subtitle: "Короткая форма, выбираем удобное время" },
  { id: "02", title: "Диагностическая сессия", subtitle: "2 часа структурированного интервью с командой" },
  { id: "03", title: "Анализ и brief", subtitle: "Карта слепых зон, гипотезы, приоритеты — за 48 часов" },
  { id: "04", title: "Презентация и план", subtitle: "Обсуждаем findings, определяем первые шаги" },
];

const STEP_TOPS = ["10%", "36.7%", "63.3%", "90%"] as const;

export default function Timeline() {
  const sectionRef = useRef<HTMLElement>(null);
  const pathRef = useRef<SVGPathElement>(null);
  const pathBgRef = useRef<SVGPathElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fillLineRef = useRef<HTMLDivElement>(null);
  const mobileDotRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Mobile-only scroll animations with proper cleanup
  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile || !sectionRef.current) return;

    const ctx = gsap.context(() => {
      if (fillLineRef.current) {
        gsap.to(fillLineRef.current, {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 60%",
            end: "bottom 70%",
            scrub: true,
          },
        });
      }

      mobileDotRefs.current.forEach((dot) => {
        if (!dot) return;
        gsap.fromTo(
          dot,
          { scale: 1, backgroundColor: "rgba(0,0,0,0.12)" },
          {
            scale: 1.3,
            backgroundColor: "#040082",
            boxShadow: "0 0 0 6px rgba(4,0,130,0.12)",
            scrollTrigger: {
              trigger: dot,
              start: "top 80%",
              end: "top 55%",
              scrub: true,
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Header words blur reveal
      const headerWords = headerRef.current?.querySelectorAll(".timeline-word");
      if (headerWords && headerWords.length > 0) {
        gsap.fromTo(
          headerWords,
          { opacity: 0.1, y: 20, filter: "blur(6px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            stagger: 0.08,
            scrollTrigger: {
              trigger: headerRef.current,
              start: "top 85%",
              end: "top 55%",
              scrub: true,
            },
          }
        );
      }

      // Curved line draw animation (desktop only)
      if (pathRef.current && pathBgRef.current) {
        const length = pathRef.current.getTotalLength();
        gsap.set([pathRef.current, pathBgRef.current], {
          strokeDasharray: length,
          strokeDashoffset: length,
        });
        gsap.to([pathRef.current, pathBgRef.current], {
          strokeDashoffset: 0,
          ease: "none",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 60%",
            end: "bottom 70%",
            scrub: true,
          },
        });
      }

      // Items blur reveal by word
      itemRefs.current.forEach((item) => {
        if (!item) return;
        const words = item.querySelectorAll(".timeline-item-word");
        const subtitle = item.querySelector("p");
        const num = item.querySelector("span");

        if (words.length > 0) {
          gsap.fromTo(
            words,
            { opacity: 0.15, y: 15, filter: "blur(4px)" },
            {
              opacity: 1,
              y: 0,
              filter: "blur(0px)",
              stagger: 0.06,
              scrollTrigger: {
                trigger: item,
                start: "top 85%",
                end: "top 60%",
                scrub: true,
              },
            }
          );
        }

        if (subtitle) {
          gsap.fromTo(
            subtitle,
            { opacity: 0, y: 10 },
            {
              opacity: 1,
              y: 0,
              scrollTrigger: {
                trigger: item,
                start: "top 80%",
                end: "top 55%",
                scrub: true,
              },
            }
          );
        }

        if (num) {
          gsap.fromTo(
            num,
            { opacity: 0, x: -10 },
            {
              opacity: 1,
              x: 0,
              scrollTrigger: {
                trigger: item,
                start: "top 85%",
                end: "top 65%",
                scrub: true,
              },
            }
          );
        }
      });

      // Dots fill animation
      dotRefs.current.forEach((dot) => {
        if (!dot) return;
        gsap.fromTo(
          dot,
          {
            scale: 1,
            backgroundColor: "rgba(0,0,0,0.12)",
            boxShadow: "0 0 0 0px rgba(4,0,130,0)",
          },
          {
            scale: 1.3,
            backgroundColor: "#040082",
            boxShadow: "0 0 0 6px rgba(4,0,130,0.12)",
            scrollTrigger: {
              trigger: dot,
              start: "top 80%",
              end: "top 55%",
              scrub: true,
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="process" aria-label="Процесс диагностики" className="relative bg-white py-24 md:py-40 px-6 md:px-10">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        {/* Header */}
        <div ref={headerRef} style={{ willChange: "filter, transform, opacity" }}>
          <span
            className="text-gray text-[11px] mb-3 block leading-[1.58] uppercase tracking-wider"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Процесс
          </span>
          <h2
            className="text-black text-[clamp(29px,4vw,54px)] font-bold leading-[1.15] mb-16 md:mb-24 uppercase tracking-[0.02em] flex flex-wrap gap-x-[0.25em]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {"Как проходит сессия".split(" ").map((word, i) => (
              <span
                key={i}
                className="timeline-word inline-block"
                style={{ willChange: "filter, opacity, transform" }}
              >
                {word}
              </span>
            ))}
          </h2>
        </div>

        {/* Desktop: curved timeline with guaranteed alignment */}
        <div className="hidden md:block relative h-[500px] lg:h-[540px]">
          {/* SVG wrapper — aspect ratio 1:5 matches viewBox 100×500 for 1:1 pixel mapping */}
          <div
            className="absolute left-1/2 -translate-x-1/2 top-0 h-full"
            style={{ aspectRatio: "1 / 5" }}
          >
            <svg
              className="w-full h-full"
              viewBox="0 0 100 500"
              preserveAspectRatio="xMidYMid meet"
              style={{ overflow: "visible" }}
            >
              <defs>
                <linearGradient id="curveGrad" x1="0" y1="0" x2="0" y2="500">
                  <stop offset="0%" stopColor="#040082" />
                  <stop offset="50%" stopColor="#1a1a9e" />
                  <stop offset="100%" stopColor="#040082" />
                </linearGradient>
              </defs>
              {/* Background faint line */}
              <path
                ref={pathBgRef}
                d="M50,50 C200,50 220,120 50,183.3 C-120,220 -120,280 50,316.7 C220,380 200,450 50,450"
                fill="none"
                stroke="rgba(4, 0, 130, 0.08)"
                strokeWidth="1.5"
              />
              {/* Animated fill line */}
              <path
                ref={pathRef}
                d="M50,50 C200,50 220,120 50,183.3 C-120,220 -120,280 50,316.7 C220,380 200,450 50,450"
                fill="none"
                stroke="url(#curveGrad)"
                strokeWidth="2"
              />
            </svg>
          </div>

          {/* Dots — exact same top % as curve points in viewBox */}
          {timelineSteps.map((_, i) => (
            <div
              key={`dot-${i}`}
              ref={(el) => {
                dotRefs.current[i] = el;
              }}
              className="absolute left-1/2 w-4 h-4 rounded-full border-2 border-white z-10"
              style={{
                top: STEP_TOPS[i],
                transform: "translate(-50%, -50%)",
                willChange: "transform, background-color, box-shadow",
              }}
            />
          ))}

          {/* Text blocks — same top % as dots, alternating sides */}
          {timelineSteps.map((step, i) => {
            const isLeft = i % 2 === 0; // 01 left, 02 right, 03 left, 04 right
            return (
              <div
                key={step.id}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="absolute left-0 right-0 flex items-center cursor-pointer group"
                style={{
                  top: STEP_TOPS[i],
                  transform: "translateY(-50%)",
                  willChange: "filter, transform, opacity",
                }}
                onClick={() => { /* step toggle placeholder */ }}
              >
                {/* Left text */}
                <div
                  className={`flex-1 ${isLeft ? "text-right pr-8 md:pr-16 lg:pr-32 xl:pr-60" : ""}`}
                >
                  {isLeft && (
                    <>
                      <span
                        className="text-gray text-[11px] mb-2 block leading-[1.58]"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {step.id}
                      </span>
                      <h3
                        className="text-black text-[14px] md:text-[16px] lg:text-[18px] font-normal mb-1 leading-[1.22] uppercase tracking-[0.02em] flex flex-wrap gap-x-[0.2em] justify-end"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {step.title.split(" ").map((word, wi) => (
                          <span
                            key={wi}
                            className="timeline-item-word inline-block"
                            style={{ willChange: "filter, opacity, transform" }}
                          >
                            {word}
                          </span>
                        ))}
                      </h3>
                      {step.subtitle && (
                        <p
                          className="text-black/60 text-[12px] md:text-[14px] lg:text-[16px] leading-[1.25] font-light"
                          style={{ fontFamily: "var(--font-body)" }}
                        >
                          {step.subtitle}
                        </p>
                      )}
                    </>
                  )}
                </div>

                {/* Center spacer — dot sits here */}
                <div className="w-4 flex-shrink-0" />

                {/* Right text */}
                <div
                  className={`flex-1 ${!isLeft ? "text-left pl-8 md:pl-16 lg:pl-32 xl:pl-60" : ""}`}
                >
                  {!isLeft && (
                    <>
                      <span
                        className="text-gray text-[11px] mb-2 block leading-[1.58]"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {step.id}
                      </span>
                      <h3
                        className="text-black text-[14px] md:text-[16px] lg:text-[18px] font-normal mb-1 leading-[1.22] uppercase tracking-[0.02em] flex flex-wrap gap-x-[0.2em]"
                        style={{ fontFamily: "var(--font-heading)" }}
                      >
                        {step.title.split(" ").map((word, wi) => (
                          <span
                            key={wi}
                            className="timeline-item-word inline-block"
                            style={{ willChange: "filter, opacity, transform" }}
                          >
                            {word}
                          </span>
                        ))}
                      </h3>
                      {step.subtitle && (
                        <p
                          className="text-black/60 text-[12px] md:text-[14px] lg:text-[16px] leading-[1.25] font-light"
                          style={{ fontFamily: "var(--font-body)" }}
                        >
                          {step.subtitle}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mobile: straight left line */}
        <div className="md:hidden relative">
          {/* Background line */}
          <div
            className="absolute left-6 top-0 bottom-0 w-px"
            style={{ background: "rgba(4, 0, 130, 0.08)" }}
          />
          {/* Fill line */}
          <div
            className="absolute left-6 top-0 w-px origin-top"
            style={{
              height: "100%",
              background: "linear-gradient(to bottom, #040082, #1a1a9e, #040082)",
              transform: "scaleY(0)",
            }}
            ref={fillLineRef}
          />

          <div className="space-y-8">
            {timelineSteps.map((step, i) => (
              <div
                key={step.id}
                className="relative pl-16 cursor-pointer group"
              >
                <div
                  ref={(el) => {
                    mobileDotRefs.current[i] = el;
                  }}
                  className="absolute left-4 top-2 w-4 h-4 rounded-full border-2 border-white z-10"
                />

                <span
                  className="text-gray text-[11px] mb-2 block leading-[1.58]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {step.id}
                </span>
                <h3
                  className="text-black text-[16px] font-normal mb-1 leading-[1.22] uppercase tracking-[0.02em]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {step.title}
                </h3>
                {step.subtitle && (
                  <p
                    className="text-black/60 text-[14px] leading-[1.25] font-light"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {step.subtitle}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
