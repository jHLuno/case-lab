"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

function BlurRevealWords({ text, className, style }: { text: string; className?: string; style?: React.CSSProperties }) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const words = ref.current.querySelectorAll(".bw");
    if (words.length === 0) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { opacity: 0.1, y: 10, filter: "blur(4px)" },
        {
          opacity: 1,
          y: 0,
          filter: "blur(0px)",
          stagger: 0.04,
          scrollTrigger: {
            trigger: ref.current,
            start: "top 85%",
            end: "top 60%",
            scrub: true,
          },
        }
      );
    });
    return () => ctx.revert();
  }, []);
  return (
    <p ref={ref} className={className} style={style}>
      {text.split(" ").map((w, i) => (
        <span key={i} className="bw inline-block mr-[0.25em]" style={{ willChange: "filter, opacity, transform" }}>
          {w}
        </span>
      ))}
    </p>
  );
}

const beforeAfter = [
  {
    before: "Маркетинг работает, но непонятно за счёт чего",
    after: "Чёткая карта активностей и их влияния на бизнес",
  },
  {
    before: "Консультант предложил 20 идей",
    after: "3–5 приоритетных направлений с обоснованием",
  },
  {
    before: "Отчёты агентства vs реальность бизнеса",
    after: "Общий язык между собственником, CMO и агентством",
  },
  {
    before: "Решения принимаются на интуиции",
    after: "Решения на основе структурированных данных",
  },
];

const useCases = [
  "маркетинговой стратегии на квартал",
  "брифа для агентств и подрядчиков",
  "внутренней коммуникации между собственником и командой",
];

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

export default function BusinessModel() {
  const sectionRef = useRef<HTMLElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);
  const useCasesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Fill line for comparison
      if (lineRef.current) {
        gsap.fromTo(
          lineRef.current,
          { scaleY: 0 },
          {
            scaleY: 1,
            ease: "none",
            scrollTrigger: {
              trigger: itemsRef.current,
              start: "top 70%",
              end: "bottom 80%",
              scrub: true,
            },
          }
        );
      }

      // Arrow reveal only
      const rows = itemsRef.current?.querySelectorAll(".ba-row");
      rows?.forEach((row) => {
        const arrow = row.querySelector(".ba-arrow");
        if (arrow) {
          gsap.fromTo(
            arrow,
            { scaleX: 0, opacity: 0 },
            {
              scaleX: 1,
              opacity: 1,
              scrollTrigger: {
                trigger: row,
                start: "top 80%",
                end: "top 60%",
                scrub: true,
              },
            }
          );
        }
      });

      // Case Lab badge blur reveal
      const badge = sectionRef.current?.querySelector(".case-lab-badge");
      if (badge) {
        gsap.fromTo(
          badge,
          { opacity: 0, y: 30, filter: "blur(8px)", scale: 0.9 },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            scale: 1,
            scrollTrigger: {
              trigger: badge,
              start: "top 90%",
              end: "top 70%",
              scrub: true,
            },
          }
        );
      }

      // Use cases
      const ucItems = useCasesRef.current?.querySelectorAll(".use-case-item");
      ucItems?.forEach((item, i) => {
        gsap.fromTo(
          item,
          { opacity: 0, y: 20, filter: "blur(4px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            scrollTrigger: {
              trigger: item,
              start: "top 85%",
              end: "top 65%",
              scrub: true,
            },
          }
        );
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} aria-label="Что меняется после диагностики" className="relative bg-white py-24 md:py-40 px-6 md:px-10 overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        {/* Header */}
        <div className="mb-12 md:mb-20">
          <span
            className="text-gray text-[11px] mb-4 block leading-[1.58]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Case Lab Diagnostics
          </span>
          <BlurRevealHeading
            text="Что меняется после диагностики"
            className="text-black text-[clamp(29px,4vw,54px)] font-bold leading-[1.15] uppercase tracking-[0.02em]"
          />
        </div>

        {/* Case Lab Label */}
        <div className="text-center mb-12 md:mb-16">
          <span
            className="case-lab-badge inline-flex items-center gap-[6px]"
            style={{ willChange: "filter, opacity, transform", fontFamily: "var(--font-heading)" }}
          >
            <span className="text-gray text-[15px] md:text-[17px] font-normal uppercase tracking-wider">
              Подход
            </span>
            <span className="inline-flex items-center justify-center bg-[#040082] text-white px-[10px] py-[4px] text-[14px] md:text-[16px] font-normal uppercase tracking-wider leading-none">
              CASE
            </span>
            <span className="text-black text-[15px] md:text-[17px] italic normal-case tracking-wider">
              LAB
            </span>
          </span>
        </div>

        {/* Before → After */}
        <div ref={itemsRef} className="relative mb-16 md:mb-24">
          {/* Vertical dividing line — visible on all sizes */}
          <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-px pointer-events-none hidden md:block">
            <div className="absolute inset-0 bg-black/5" />
            <div
              ref={lineRef}
              className="absolute top-0 left-0 w-full origin-top"
              style={{
                height: "100%",
                background: "linear-gradient(to bottom, #040082, #1a1a9e, #040082)",
              }}
            />
          </div>

          <div className="max-w-[1078px] mx-auto space-y-10 md:space-y-12">
            {beforeAfter.map((row) => (
              <div
                key={row.before}
                className="ba-row grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 md:gap-0 items-start md:items-center"
              >
                {/* Before — dimmed, outdated approach */}
                <div className="ba-before text-left md:text-right md:pr-12 pb-4 md:pb-0 border-b border-black/5 md:border-0">
                  <span className="text-[11px] uppercase tracking-wider text-black/30 mb-1 block md:hidden" style={{ fontFamily: "var(--font-body)" }}>До</span>
                  <BlurRevealWords
                    text={row.before}
                    className="text-[15px] md:text-[18px] leading-[1.3] font-light text-black/30 font-body"
                  />
                </div>

                {/* Arrow (desktop) */}
                <div className="hidden md:flex ba-arrow w-16 flex-shrink-0 items-center justify-center">
                  <div className="w-8 h-8 rounded-full bg-[#040082] flex items-center justify-center">
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* After — Case Lab solution */}
                <div className="ba-after md:pl-12 pt-4 md:pt-0">
                  <span className="text-[11px] uppercase tracking-wider text-[#040082] mb-1 block md:hidden" style={{ fontFamily: "var(--font-body)" }}>После</span>
                  <BlurRevealWords
                    text={row.after}
                    className="text-[15px] md:text-[18px] leading-[1.3] font-normal text-black font-body"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Use cases */}
        <div
          ref={useCasesRef}
          className="rounded-[20px] p-8 md:p-12"
          style={{
            background: "linear-gradient(170deg, rgba(4, 0, 130, 0.05) 0%, rgba(6, 6, 50, 0.06) 40%, rgba(2, 2, 25, 0.08) 100%)",
          }}
        >
          <h3
            className="text-black text-[18px] md:text-[22px] font-normal leading-[1.25] mb-6 uppercase tracking-[0.02em]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Diagnostics brief используется как основа для
          </h3>
          <ul className="space-y-4">
            {useCases.map((uc) => (
              <li
                key={uc}
                className="use-case-item flex items-start gap-3"
                style={{ willChange: "filter, opacity, transform" }}
              >
                <svg
                  aria-hidden="true"
                  focusable="false"
                  className="flex-shrink-0 mt-[6px]"
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="#040082"
                >
                  <path d="M12 0L14.59 9.41L24 12L14.59 14.59L12 24L9.41 14.59L0 12L9.41 9.41L12 0Z" />
                </svg>
                <span
                  className="text-black/60 text-[16px] leading-[1.35] font-light"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {uc}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
