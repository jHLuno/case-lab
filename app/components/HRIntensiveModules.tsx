"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Layout: editorial rows that "deal out" like stacked sheets on scroll;
// look: soft light-blue glass cards with small illustrations.
const modules = [
  {
    index: "01",
    title: "Зумерология",
    text: "Кто такие Gen Z и Alpha: как они думают, выбирают, покупают и работают. Ценности, мифы о поколении и навыки будущего — на данных и живых кейсах.",
    tag: "Поколения · ценности · навыки будущего",
    art: "zoomer",
    tilt: -3,
  },
  {
    index: "02",
    title: "EJM — карта пути сотрудника",
    text: "Employee Journey Map: разбираем путь сотрудника от первого касания с компанией до ухода — где молодые таланты теряют интерес и что менять на каждом этапе.",
    tag: "Найм · онбординг · удержание",
    art: "ejm",
    tilt: 2.5,
  },
  {
    index: "03",
    title: "EVP и бренд работодателя",
    text: "Тренды HR-брендинга, архетипы работодателя и из чего складывается позиционирование, которое привлекает и удерживает молодые таланты.",
    tag: "Архетипы · позиционирование · тренды",
    art: "evp",
    tilt: -2,
  },
] as const;

type Art = (typeof modules)[number]["art"];

const headingFont = { fontFamily: "var(--font-heading)" };
const bodyFont = { fontFamily: "var(--font-body)" };

function ModuleArt({ kind }: { kind: Art }) {
  const gradId = `hr-art-${kind}`;
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a1a9e" />
          <stop offset="100%" stopColor="#040082" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {kind === "zoomer" && (
        <g>
          {[
            { x: 34, h: 38, l: "X" },
            { x: 82, h: 62, l: "Y" },
            { x: 130, h: 92, l: "Z" },
            { x: 178, h: 112, l: "α" },
          ].map((bar) => (
            <g key={bar.l} className="hr-art-bar" style={{ transformOrigin: `${bar.x + 14}px 128px` }}>
              <rect x={bar.x} y={128 - bar.h} width="28" height={bar.h} rx="8" fill={`url(#${gradId})`} />
              <text x={bar.x + 14} y={144} textAnchor="middle" fontSize="11" fill="#040082" opacity="0.6" style={bodyFont}>
                {bar.l}
              </text>
            </g>
          ))}
        </g>
      )}
      {kind === "ejm" && (
        <g>
          <path
            className="hr-art-path"
            d="M16 112 C 56 112, 56 52, 96 60 S 140 120, 176 76 S 210 26, 226 30"
            fill="none"
            stroke={`url(#${gradId})`}
            strokeWidth="5"
            strokeLinecap="round"
            pathLength={1}
          />
          {[
            [16, 112],
            [96, 60],
            [146, 100],
            [176, 76],
            [226, 30],
          ].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r="8" fill="#fff" stroke="#040082" strokeWidth="3" />
          ))}
        </g>
      )}
      {kind === "evp" && (
        <g className="hr-art-rings" style={{ transformOrigin: "120px 75px" }}>
          <circle cx="120" cy="75" r="62" fill="none" stroke="#040082" strokeOpacity="0.15" strokeWidth="10" />
          <circle cx="120" cy="75" r="42" fill="none" stroke="#040082" strokeOpacity="0.3" strokeWidth="10" />
          <circle cx="120" cy="75" r="22" fill={`url(#${gradId})`} />
          <path d="M120 64 l3.2 6.8 7.3 .9 -5.4 5 1.4 7.3 -6.5 -3.6 -6.5 3.6 1.4 -7.3 -5.4 -5 7.3 -.9z" fill="#fff" />
        </g>
      )}
    </svg>
  );
}

export default function HRIntensiveModules() {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list || shouldReduceMotion) return;

    const ctx = gsap.context(() => {
      list.querySelectorAll<HTMLElement>("[data-module-row]").forEach((row) => {
        const tilt = Number(row.dataset.tilt ?? 0);
        // Rows start as a loose stack of tilted sheets and settle into place while scrolling.
        gsap.fromTo(
          row,
          { y: 90, rotate: tilt, opacity: 0.2 },
          {
            y: 0,
            rotate: 0,
            opacity: 1,
            ease: "none",
            scrollTrigger: { trigger: row, start: "top 95%", end: "top 60%", scrub: 0.6 },
          }
        );
      });
    }, list);

    return () => ctx.revert();
  }, [shouldReduceMotion]);

  return (
    <section
      id="modules"
      tabIndex={-1}
      aria-labelledby="hr-modules-title"
      className="relative isolate overflow-clip px-6 py-20 md:px-10 md:py-36"
      style={{ background: "linear-gradient(180deg, #eef1ff 0%, #dfe6ff 55%, #cfdaff 100%)" }}
    >
      {/* Soft wave lines, as in the reference */}
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 1440 900"
      >
        {[0, 1, 2, 3].map((i) => (
          <path
            key={i}
            d={`M-40 ${180 + i * 170} C 300 ${80 + i * 170}, 520 ${330 + i * 170}, 820 ${220 + i * 170} S 1300 ${120 + i * 170}, 1500 ${260 + i * 170}`}
            fill="none"
            stroke="#ffffff"
            strokeOpacity="0.7"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      <div className="mx-auto max-w-[1200px]">
        <div className="mb-10 md:mb-16">
          <span
            className="mb-3 block text-[11px] font-normal uppercase leading-[1.58] tracking-wider text-[#040082]"
            style={bodyFont}
          >
            Программа
          </span>
          <h2
            id="hr-modules-title"
            className="text-[clamp(28px,9vw,40px)] font-bold uppercase leading-[1] tracking-[0.02em] text-[#040082] md:whitespace-nowrap md:text-[clamp(32px,calc((100vw-80px)/16.5),76px)]"
            style={headingFont}
          >
            Три готовых блока
          </h2>
          <p
            className="mt-5 max-w-[720px] text-balance text-[15px] font-light leading-[1.55] text-black/60 md:mt-6 lg:text-[17px]"
            style={bodyFont}
          >
            Программа уже обкатана на конференциях и корпоративных сессиях. Вы выбираете, сколько времени готова уделить команда, — мы собираем из блоков нужный формат.
          </p>
        </div>

        <ol ref={listRef} className="space-y-4 md:space-y-5">
          {modules.map((module) => (
            <li
              key={module.index}
              data-module-row
              data-tilt={module.tilt}
              className="group will-change-transform"
            >
              <article className="grid gap-6 rounded-[24px] border border-white/80 bg-white/55 p-6 shadow-[0_24px_60px_-28px_rgba(4,0,130,0.35)] backdrop-blur-xl transition-[background-color,box-shadow,transform] duration-300 hover:bg-white/75 hover:shadow-[0_30px_70px_-26px_rgba(4,0,130,0.45)] md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_240px] lg:items-center lg:gap-8 xl:p-10">
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-4 md:gap-6">
                  <span className="text-[13px] sm:pt-1 tracking-[0.12em] text-[#040082]/60" style={bodyFont}>
                    {module.index}
                  </span>
                  <h3
                    className="text-[19px] font-bold uppercase leading-[1.1] tracking-[0.02em] text-[#040082] sm:text-[22px] md:text-[28px] lg:text-[22px] xl:text-[30px]"
                    style={headingFont}
                  >
                    {module.title}
                  </h3>
                </div>

                <div>
                  <p className="text-[15px] font-light leading-[1.55] text-black/65 md:text-[16px]" style={bodyFont}>
                    {module.text}
                  </p>
                  <p className="mt-4 text-[12px] uppercase tracking-[0.1em] text-[#040082]/70" style={bodyFont}>
                    {module.tag}
                  </p>
                </div>

                <div className="hr-art relative h-[150px] w-full max-w-[320px] overflow-hidden rounded-[18px] border border-white/90 bg-gradient-to-br from-white/90 to-[#dfe6ff]/80 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-rotate-2 group-hover:scale-[1.04] lg:max-w-none">
                  <ModuleArt kind={module.art} />
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
