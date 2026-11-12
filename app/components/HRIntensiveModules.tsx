"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Rows are "sheets": from md up each sheet is pinned while the next one slides
// over it, so they stack with a slight skew. (Pinned with GSAP, because the
// global html/body overflow-x: hidden disables position: sticky.)
// Set `image` to a file in /public/hr-intensive/ once the generated pictures exist;
// until then the row shows a vector placeholder.
const modules: {
  index: string;
  title: string;
  text: string;
  tag: string;
  art: "zoomer" | "ejm" | "evp";
  image?: string;
  tilt: number;
}[] = [
  {
    index: "01",
    title: "Зумерология",
    text: "Кто такие Gen Z и Alpha: как они думают, выбирают, покупают и работают. Ценности, мифы о поколении и навыки будущего — на данных и живых кейсах.",
    tag: "Поколения · ценности · навыки будущего",
    art: "zoomer",
    tilt: -0.8,
  },
  {
    index: "02",
    title: "EJM — карта пути сотрудника",
    text: "Employee Journey Map: разбираем путь сотрудника от первого касания с компанией до ухода — где молодые таланты теряют интерес и что менять на каждом этапе.",
    tag: "Найм · онбординг · удержание",
    art: "ejm",
    tilt: 0.7,
  },
  {
    index: "03",
    title: "EVP и бренд работодателя",
    text: "Тренды HR-брендинга, архетипы работодателя и из чего складывается позиционирование, которое привлекает и удерживает молодые таланты.",
    tag: "Архетипы · позиционирование · тренды",
    art: "evp",
    tilt: -0.5,
  },
];

// Sheets pin below the fixed navbar, each one a step lower so the edges underneath stay visible.
const SHEET_TOP = 96;
const SHEET_STEP = 28;

const headingFont = { fontFamily: "var(--font-heading)" };
const bodyFont = { fontFamily: "var(--font-body)" };

function ModuleArt({ kind }: { kind: (typeof modules)[number]["art"] }) {
  return (
    <svg viewBox="0 0 240 150" className="h-full w-full" aria-hidden="true">
      {kind === "zoomer" &&
        [
          { x: 34, h: 38, l: "X" },
          { x: 82, h: 62, l: "Y" },
          { x: 130, h: 92, l: "Z" },
          { x: 178, h: 112, l: "α" },
        ].map((bar, i) => (
          <g key={bar.l}>
            <rect x={bar.x} y={128 - bar.h} width="28" height={bar.h} rx="8" fill="#040082" opacity={0.35 + i * 0.2} />
            <text x={bar.x + 14} y={144} textAnchor="middle" fontSize="11" fill="#040082" opacity="0.6" style={bodyFont}>
              {bar.l}
            </text>
          </g>
        ))}
      {kind === "ejm" && (
        <g>
          <path
            d="M16 112 C 56 112, 56 52, 96 60 S 140 120, 176 76 S 210 26, 226 30"
            fill="none"
            stroke="#040082"
            strokeWidth="5"
            strokeLinecap="round"
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
        <g>
          <circle cx="120" cy="75" r="62" fill="none" stroke="#040082" strokeOpacity="0.15" strokeWidth="10" />
          <circle cx="120" cy="75" r="42" fill="none" stroke="#040082" strokeOpacity="0.3" strokeWidth="10" />
          <circle cx="120" cy="75" r="22" fill="#040082" />
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

    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px)", () => {
      const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-sheet-row]"));
      const last = rows[rows.length - 1];
      const offset = (i: number) => SHEET_TOP + i * SHEET_STEP;

      rows.slice(0, -1).forEach((row, i) => {
        // Pin each sheet until the last one arrives; the next sheets scroll over it.
        ScrollTrigger.create({
          trigger: row,
          start: `top ${offset(i)}px`,
          endTrigger: last,
          end: `top ${offset(rows.length - 1)}px`,
          pin: true,
          pinSpacing: false,
        });
        // The covered sheet sinks back a little as the next one slides over it.
        gsap.to(row.querySelector("[data-sheet]"), {
          scale: 0.96,
          filter: "brightness(0.94)",
          ease: "none",
          scrollTrigger: {
            trigger: rows[i + 1],
            start: "top bottom",
            end: `top ${offset(i + 1)}px`,
            scrub: true,
          },
        });
      });
    });

    return () => mm.revert();
  }, [shouldReduceMotion]);

  return (
    <section
      id="modules"
      tabIndex={-1}
      aria-labelledby="hr-modules-title"
      className="relative isolate bg-[#040082] px-6 py-20 text-white md:px-10 md:py-36"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.14),transparent_40%)]"
      />

      <div className="mx-auto max-w-[1200px]">
        <div className="mb-10 md:mb-16">
          <span
            className="mb-3 block text-[11px] font-normal uppercase leading-[1.58] tracking-wider text-white/60"
            style={bodyFont}
          >
            Программа
          </span>
          <h2
            id="hr-modules-title"
            className="text-[clamp(28px,9vw,40px)] font-bold uppercase leading-[1] tracking-[0.02em] md:whitespace-nowrap md:text-[clamp(32px,calc((100vw-80px)/16.5),76px)]"
            style={headingFont}
          >
            Три готовых блока
          </h2>
          <p
            className="mt-5 max-w-[720px] text-balance text-[15px] font-light leading-[1.55] text-white/70 md:mt-6 lg:text-[17px]"
            style={bodyFont}
          >
            Программа уже обкатана на конференциях и корпоративных сессиях. Вы выбираете, сколько времени готова уделить команда, — мы собираем из блоков нужный формат.
          </p>
        </div>

        <ol ref={listRef} className="space-y-4 md:space-y-0 md:pb-10">
          {modules.map((module, i) => (
            <li key={module.index} data-sheet-row className="relative md:pb-6" style={{ zIndex: i + 1 }}>
              <article
                data-sheet
                className="grid origin-top gap-6 rounded-[20px] border border-black/5 bg-white p-6 text-black shadow-[0_-18px_40px_-18px_rgba(0,0,17,0.55)] md:min-h-[260px] md:rotate-[var(--sheet-tilt)] md:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)_260px] lg:items-center lg:gap-8 xl:p-10"
                style={{ ["--sheet-tilt" as string]: `${module.tilt}deg` }}
              >
                <div className="flex flex-col items-start gap-2 sm:flex-row sm:gap-4 md:gap-6">
                  <span className="text-[13px] tracking-[0.12em] text-black/40 sm:pt-1" style={bodyFont}>
                    {module.index}
                  </span>
                  <div>
                    <h3
                      className="text-[19px] font-bold uppercase leading-[1.1] tracking-[0.02em] text-[#040082] sm:text-[22px] md:text-[28px] lg:text-[22px] xl:text-[30px]"
                      style={headingFont}
                    >
                      {module.title}
                    </h3>
                    <p className="mt-3 text-[11px] uppercase tracking-[0.1em] text-[#040082]/70" style={bodyFont}>
                      {module.tag}
                    </p>
                  </div>
                </div>

                <p className="text-[15px] font-light leading-[1.55] text-black/65 md:text-[16px]" style={bodyFont}>
                  {module.text}
                </p>

                <div className="relative aspect-[4/3] w-full max-w-[320px] overflow-hidden rounded-[14px] bg-[#f5f5f5] lg:max-w-none">
                  {module.image ? (
                    <Image
                      src={module.image}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 260px, 320px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 p-4">
                      <ModuleArt kind={module.art} />
                    </div>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
