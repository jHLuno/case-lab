"use client";

import { useRef, useState, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowRight } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const stages = [
  {
    num: "01",
    year: "2025",
    title: "Платформа",
    desc: "Ивенты с разбором сильных маркетинговых кейсов казахстанских компаний. Реальные метрики, реальные команды, реальный опыт.",
  },
  {
    num: "02",
    year: "2026",
    title: "Диагностика + Экспертиза",
    desc: "Запускаем сейчас: 2-часовая диагностика маркетинга и сеть практиков из FMCG, SaaS, Retail, FinTech под конкретный контекст клиента.",
  },
  {
    num: "03",
    year: "2026+",
    title: "Экосистема",
    desc: "Интегрированный подход: диагностика + эксперты + инструменты + сообщество. Полный цикл от проблемы до решения.",
  },
];

/* ─── Horizontal elliptical orbit ─── */
const CX = 250;
const CY = 185;
const RX = 210;
const RY = 75;

// Star angles: top-left, top-right, bottom-center
const STAR_ANGLES = [210, 330, 90]; // degrees

function ellipsePoint(angleDeg: number) {
  const a = (angleDeg * Math.PI) / 180;
  return { x: CX + RX * Math.cos(a), y: CY + RY * Math.sin(a) };
}

const STARS = STAR_ANGLES.map(ellipsePoint);

// Cubic Bézier control-point multiplier for 120° arc
const K = 0.7698;

function bezierControl(p: { x: number; y: number }, angleDeg: number, isEnd: boolean) {
  const a = (angleDeg * Math.PI) / 180;
  const tx = -RX * Math.sin(a);
  const ty = RY * Math.cos(a);
  return {
    x: p.x + (isEnd ? -1 : 1) * K * tx,
    y: p.y + (isEnd ? -1 : 1) * K * ty,
  };
}

// 3 arc segments
const SEGMENTS = [
  {
    p0: STARS[0], // 210°
    cp1: bezierControl(STARS[0], 210, false),
    cp2: bezierControl(STARS[1], 330, true),
    p3: STARS[1], // 330°
  },
  {
    p0: STARS[1], // 330°
    cp1: bezierControl(STARS[1], 330, false),
    cp2: bezierControl(STARS[2], 90, true),
    p3: STARS[2], // 90°
  },
  {
    p0: STARS[2], // 90°
    cp1: bezierControl(STARS[2], 90, false),
    cp2: bezierControl(STARS[0], 210, true),
    p3: STARS[0], // 210°
  },
];

function segD(seg: typeof SEGMENTS[0]) {
  return `M${seg.p0.x.toFixed(1)},${seg.p0.y.toFixed(1)} C${seg.cp1.x.toFixed(1)},${seg.cp1.y.toFixed(1)} ${seg.cp2.x.toFixed(1)},${seg.cp2.y.toFixed(1)} ${seg.p3.x.toFixed(1)},${seg.p3.y.toFixed(1)}`;
}

export default function Evolution() {
  const sectionRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const segRefs = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      // Header blur reveal
      const words = headerRef.current?.querySelectorAll(".evo-word");
      if (words && words.length > 0) {
        gsap.fromTo(
          words,
          { opacity: 0.1, y: 20, filter: "blur(6px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            stagger: 0.06,
            scrollTrigger: {
              trigger: headerRef.current,
              start: "top 85%",
              end: "top 55%",
              scrub: true,
            },
          }
        );
      }

      // Orbit draw animation — all breakpoints via matchMedia
      const mm = gsap.matchMedia();

      mm.add("(max-width: 767px)", () => {
        const lengths = segRefs.current.map((el) => (el ? el.getTotalLength() : 0));
        const totalLength = lengths.reduce((a, b) => a + b, 0);

        segRefs.current.forEach((el, i) => {
          if (!el) return;
          gsap.set(el, {
            strokeDasharray: lengths[i],
            strokeDashoffset: lengths[i],
          });
        });

        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top 70%",
          end: "+=1800",
          scrub: true,
          onUpdate: (self) => {
            const p = self.progress;
            const seg = 1 / stages.length;
            const idx = Math.min(Math.floor(p / seg), stages.length - 1);
            setActiveIndex(idx);

            let filled = p * totalLength;
            segRefs.current.forEach((el, i) => {
              if (!el) return;
              const len = lengths[i];
              if (filled <= 0) {
                gsap.set(el, { strokeDashoffset: len });
              } else if (filled >= len) {
                gsap.set(el, { strokeDashoffset: 0 });
              } else {
                gsap.set(el, { strokeDashoffset: len - filled });
              }
              filled -= len;
            });
          },
        });

        // Mobile facts: fade in together, activeIndex handles highlight
        gsap.fromTo(
          ".evo-fact",
          { opacity: 0, y: 20 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            ease: "power2.out",
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      mm.add("(min-width: 768px)", () => {
        const lengths = segRefs.current.map((el) => (el ? el.getTotalLength() : 0));
        const totalLength = lengths.reduce((a, b) => a + b, 0);

        segRefs.current.forEach((el, i) => {
          if (!el) return;
          gsap.set(el, {
            strokeDasharray: lengths[i],
            strokeDashoffset: lengths[i],
          });
        });

        ScrollTrigger.create({
          trigger: sectionRef.current,
          start: "top 15%",
          end: `+=${window.innerHeight * 2.5}`,
          pin: true,
          scrub: true,
          onUpdate: (self) => {
            const p = self.progress;
            const seg = 1 / stages.length;
            const idx = Math.min(Math.floor(p / seg), stages.length - 1);
            setActiveIndex(idx);

            let filled = p * totalLength;
            segRefs.current.forEach((el, i) => {
              if (!el) return;
              const len = lengths[i];
              if (filled <= 0) {
                gsap.set(el, { strokeDashoffset: len });
              } else if (filled >= len) {
                gsap.set(el, { strokeDashoffset: 0 });
              } else {
                gsap.set(el, { strokeDashoffset: len - filled });
              }
              filled -= len;
            });
          },
        });
      });
    }, sectionRef);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <section ref={sectionRef} aria-label="Эволюция проекта" className="relative bg-white py-24 md:py-40 px-6 md:px-10 overflow-hidden">
      {/* Top divider */}
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center gap-8 md:gap-10 lg:gap-16 h-full">
        {/* Left: Horizontal Elliptical Orbit */}
        <div className="flex-1 flex items-center justify-center w-full min-w-0">
          <div
            className="relative w-full"
            style={{
              maxWidth: 580,
              aspectRatio: "580 / 400",
            }}
          >
            {/* SVG orbit */}
            <svg
              viewBox="0 0 500 340"
              className="w-full h-full"
              style={{ overflow: "visible", display: "block" }}
            >
              <defs>
                <linearGradient id="orbitGrad" x1="0" y1="0" x2="0" y2="340">
                  <stop offset="0%" stopColor="#040082" />
                  <stop offset="50%" stopColor="#1a1a9e" />
                  <stop offset="100%" stopColor="#040082" />
                </linearGradient>

                <radialGradient id="starOn" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#e8e8ff" />
                  <stop offset="30%" stopColor="#6b6be0" />
                  <stop offset="70%" stopColor="#040082" />
                  <stop offset="100%" stopColor="#020040" />
                </radialGradient>
                <radialGradient id="starOff" cx="35%" cy="35%" r="65%">
                  <stop offset="0%" stopColor="#f0f0f5" />
                  <stop offset="30%" stopColor="#c0c0d0" />
                  <stop offset="70%" stopColor="#a0a0b8" />
                  <stop offset="100%" stopColor="#8888a0" />
                </radialGradient>
              </defs>

              {/* Background faint orbit */}
              <path
                d={`${segD(SEGMENTS[0])} ${segD(SEGMENTS[1]).replace("M", "L")} ${segD(SEGMENTS[2]).replace("M", "L")}`}
                fill="none"
                stroke="rgba(4, 0, 130, 0.08)"
                strokeWidth="2"
                strokeLinecap="round"
              />

              {/* Animated fill segments */}
              {SEGMENTS.map((seg, i) => (
                <path
                  key={`fill-${i}`}
                  ref={(el) => { segRefs.current[i] = el; }}
                  d={segD(seg)}
                  fill="none"
                  stroke="url(#orbitGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                />
              ))}

              {/* Center text */}
              <text
                x={CX}
                y={CY - 6}
                textAnchor="middle"
                fill="#040082"
                fontSize="13"
                fontWeight="700"
                letterSpacing="3"
                style={{ fontFamily: "var(--font-heading), sans-serif" }}
              >
                ЭТАП
              </text>
              <text
                x={CX}
                y={CY + 26}
                textAnchor="middle"
                fill="rgba(0,0,0,0.18)"
                fontSize="44"
                fontWeight="700"
                style={{
                  fontFamily: "var(--font-heading), sans-serif",
                  transition: "all 0.4s ease",
                }}
              >
                {String(activeIndex + 1).padStart(2, "0")}
              </text>

              {/* Stars — native SVG, exact orbit positioning */}
              {stages.map((stage, i) => {
                const pos = STARS[i];
                const isActive = i === activeIndex;
                const s = isActive ? 1.15 : 1;
                return (
                  <g key={stage.num} style={{ transition: "all 0.6s ease" }}>
                    {/* Halo */}
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={isActive ? 18 : 10}
                      fill="none"
                      stroke={isActive ? "rgba(4,0,130,0.15)" : "rgba(4,0,130,0.06)"}
                      strokeWidth={isActive ? 2 : 1}
                      style={{ transition: "all 0.6s ease" }}
                    />
                    {/* Star — classic 4-point sparkle */}
                    <g transform={`translate(${pos.x},${pos.y}) scale(${s})`}>
                      <path
                        d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5Z"
                        fill={`url(#${isActive ? "starOn" : "starOff"})`}
                        style={{ transition: "all 0.6s ease", transform: "translate(-12px, -12px)" }}
                      />
                    </g>
                    {/* Year label */}
                    <text
                      x={pos.x}
                      y={pos.y + (i === 2 ? 34 : -26)}
                      textAnchor="middle"
                      fill={isActive ? "#040082" : "rgba(0,0,0,0.3)"}
                      fontSize="12"
                      fontWeight={isActive ? 600 : 400}
                      style={{
                        transition: "all 0.6s ease",
                        fontFamily: "var(--font-body), sans-serif",
                      }}
                    >
                      {stage.year}
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Mobile orbit + facts indicate progress via active styling; no separate progress bar */}
          </div>
        </div>

        {/* Right: Facts */}
        <div className="flex-1 w-full max-w-lg">
          <div ref={headerRef} className="mb-5 md:mb-8">
            <span
              className="text-gray text-[11px] mb-2 block leading-[1.58] uppercase tracking-wider"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Эволюция проекта
            </span>
            <h2
              className="text-black text-[clamp(20px,3vw,36px)] font-bold leading-[1.12] uppercase tracking-[0.02em] flex flex-wrap gap-x-[0.25em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              {"От платформы — к экосистеме".split(" ").map((word, i) => (
                <span key={i} className="evo-word inline-block" style={{ willChange: "filter, opacity, transform" }}>
                  {word}
                </span>
              ))}
            </h2>
          </div>

          <div className="space-y-3 md:space-y-4">
            {stages.map((stage, i) => {
              const isActive = i === activeIndex;
              return (
                <div
                  key={stage.num}
                  className={`evo-fact relative pl-6 md:pl-7 transition-all duration-700 ease-out cursor-default ${
                    !isActive ? "max-md:opacity-30 max-md:blur-[0.4px]" : ""
                  }`}
                  style={{
                    opacity: isActive ? 1 : 0.35,
                    filter: isActive ? "blur(0px)" : "blur(0.6px)",
                    transform: isActive ? "translateX(0)" : "translateX(-3px)",
                  }}
                >
                  <div
                    className="absolute left-0 top-0.5 bottom-0.5 w-[2px] rounded-full transition-all duration-700"
                    style={{
                      background: isActive
                        ? "linear-gradient(to bottom, #040082, #1a1a9e)"
                        : "rgba(0,0,0,0.06)",
                      opacity: isActive ? 1 : 0.3,
                    }}
                  />

                  <div className="flex items-baseline gap-2 mb-1.5">
                    <span
                      className="text-[#040082] text-[11px] uppercase tracking-wider font-normal"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {stage.year}
                    </span>
                    <span
                      className="text-black/[0.12] text-[11px] font-light"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {stage.num}
                    </span>
                  </div>

                  <h3
                    className="text-black text-[15px] md:text-[20px] font-bold leading-[1.15] uppercase tracking-[0.02em] mb-1.5"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {stage.title}
                  </h3>

                  <p
                    className="text-black/50 text-[13px] md:text-[14px] leading-[1.45] font-light"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {stage.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* CTA */}
          <div className="mt-10 md:mt-16 mb-4 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <a
              href="/contact/"
              className="inline-flex items-center gap-2 bg-[#040082] text-white px-6 py-3 rounded-full text-[14px] font-normal hover:bg-[#0600a8] transition-colors duration-300 group"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Начать диагностику
              <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform duration-300" />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
