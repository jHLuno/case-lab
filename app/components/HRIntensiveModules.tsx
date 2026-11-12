"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Rows are "sheets": from md up the list pins when the first sheet reaches the top
// and the next sheets rise from below onto it, stacking with a slight skew.
// (Pinned with GSAP, because the global html/body overflow-x: hidden disables
// position: sticky.)
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

// The block pins just below the fixed navbar; each landed sheet sits a step lower
// so the edges of the ones underneath stay visible.
const PIN_TOP = 110;
const SHEET_STEP = 28;

const headingFont = { fontFamily: "var(--font-heading)" };
const bodyFont = { fontFamily: "var(--font-body)" };

const ACCENT = "#040082";

function Pill({ x, y, label, filled }: { x: number; y: number; label: string; filled?: boolean }) {
  const width = label.length * 8.6 + 26;
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height="26" rx="13" fill={filled ? ACCENT : "#fff"} stroke={filled ? "none" : ACCENT} strokeOpacity="0.15" />
      <text x={width / 2} y="17.5" textAnchor="middle" fontSize="13" fontWeight="500" fill={filled ? "#fff" : ACCENT} style={bodyFont}>
        {label}
      </text>
    </g>
  );
}

// Soft document/chart illustrations (style of the chosen reference), drawn in brand blue.
function ModuleArt({ kind }: { kind: (typeof modules)[number]["art"] }) {
  const shadow = `hr-art-shadow-${kind}`;
  const area = `hr-art-area-${kind}`;

  return (
    <svg viewBox="0 0 400 300" className="h-full w-full" aria-hidden="true">
      <defs>
        <filter id={shadow} x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="8" stdDeviation="10" floodColor={ACCENT} floodOpacity="0.14" />
        </filter>
        <linearGradient id={area} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.95" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0.35" />
        </linearGradient>
      </defs>

      {kind === "zoomer" && (
        <g filter={`url(#${shadow})`}>
          {[
            { x: 52, h: 96 },
            { x: 116, h: 74 },
            { x: 180, h: 170 },
            { x: 244, h: 58 },
            { x: 308, h: 124 },
          ].map((bar) => (
            <rect key={bar.x} x={bar.x} y={272 - bar.h} width="44" height={bar.h + 40} rx="6" fill="#fff" />
          ))}
          <Pill x={170} y={66} label="Gen Z" filled />
        </g>
      )}

      {kind === "ejm" && (
        <g>
          <path
            d="M0 150 C 60 150, 80 70, 140 80 S 220 190, 280 140 S 360 40, 400 60 V 300 H 0 Z"
            fill={`url(#${area})`}
            filter={`url(#${shadow})`}
          />
          <path
            d="M0 150 C 60 150, 80 70, 140 80 S 220 190, 280 140 S 360 40, 400 60"
            fill="none"
            stroke={ACCENT}
            strokeOpacity="0.55"
            strokeWidth="2.5"
          />
          {[
            [140, 80],
            [280, 140],
            [372, 50],
          ].map(([cx, cy]) => (
            <circle key={cx} cx={cx} cy={cy} r="6" fill="#fff" stroke={ACCENT} strokeWidth="2.5" />
          ))}
          <Pill x={24} y={24} label="Найм" filled />
          <Pill x={108} y={24} label="Удержание" />
        </g>
      )}

      {kind === "evp" && (
        <g filter={`url(#${shadow})`}>
          <rect x="96" y="44" width="200" height="200" rx="10" fill="#fff" opacity="0.7" transform="rotate(-8 196 144)" />
          <rect x="120" y="34" width="210" height="210" rx="10" fill="#fff" />
          <rect x="144" y="62" width="96" height="10" rx="5" fill={ACCENT} opacity="0.12" />
          <rect x="144" y="82" width="64" height="10" rx="5" fill={ACCENT} opacity="0.12" />
          <rect x="144" y="112" width="72" height="22" rx="11" fill={ACCENT} opacity="0.75" />
          <rect x="144" y="162" width="162" height="10" rx="5" fill={ACCENT} opacity="0.08" />
          <rect x="144" y="182" width="140" height="10" rx="5" fill={ACCENT} opacity="0.08" />
          <rect x="144" y="202" width="110" height="10" rx="5" fill={ACCENT} opacity="0.08" />
          <circle cx="282" cy="104" r="32" fill={ACCENT} opacity="0.12" />
          <path d="M282 104 V72 A32 32 0 0 1 312.4 94.1 Z" fill={ACCENT} />
          <Pill x={34} y={40} label="EVP" filled />
        </g>
      )}

    </svg>
  );
}

export default function HRIntensiveModules() {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const listRef = useRef<HTMLOListElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const list = listRef.current;
    const wrap = wrapRef.current;
    if (!list || !wrap || shouldReduceMotion) return;

    const mm = gsap.matchMedia();
    mm.add("(min-width: 768px)", () => {
      const rows = Array.from(list.querySelectorAll<HTMLElement>("[data-sheet-row]"));
      const sheets = rows.map((row) => row.querySelector<HTMLElement>("[data-sheet]"));
      const incoming = rows.slice(1);

      // Later sheets sit on top of the first one, each a step lower.
      gsap.set(list, { position: "relative", paddingBottom: incoming.length * SHEET_STEP });
      gsap.set(incoming, { position: "absolute", top: 0, left: 0, right: 0 });

      // The heading and the stack pin together once the heading is just below the navbar;
      // while pinned, the next sheets rise from the bottom of the screen onto the first one.
      // On screens too short for heading + stack, only the stack pins.
      const withHeading = wrap.offsetHeight + PIN_TOP <= window.innerHeight;
      const pinTarget = withHeading ? wrap : list;
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: pinTarget,
          start: `top ${PIN_TOP}px`,
          end: () => `+=${incoming.length * window.innerHeight * 0.8}`,
          pin: pinTarget,
          scrub: 0.6,
          invalidateOnRefresh: true,
        },
      });

      incoming.forEach((row, k) => {
        const i = k + 1;
        tl.fromTo(row, { y: () => window.innerHeight }, { y: i * SHEET_STEP, ease: "none" });
        tl.to(sheets[i - 1], { scale: 0.96, ease: "none" }, "<");
      });
    });

    return () => mm.revert();
  }, [shouldReduceMotion]);

  return (
    <section
      id="modules"
      tabIndex={-1}
      aria-labelledby="hr-modules-title"
      className="relative isolate overflow-clip bg-[#040082] px-6 py-[48px] text-white md:px-10 md:py-14 lg:py-16"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.14),transparent_40%)]"
      />

      <div ref={wrapRef} className="mx-auto max-w-[1200px]">
        <div className="mb-[32px] md:mb-12">
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

        <ol ref={listRef} className="space-y-4 md:space-y-0">
          {modules.map((module, i) => (
            <li key={module.index} data-sheet-row className="relative" style={{ zIndex: i + 1 }}>
              <article
                data-sheet
                // Reference layout: number · title · stacked tags · description · picture, all top-aligned.
                className="grid origin-top items-start gap-4 rounded-[20px] border border-black/5 bg-white p-6 text-black shadow-[0_-18px_40px_-18px_rgba(0,0,17,0.55)] md:min-h-[260px] md:rotate-[var(--sheet-tilt)] md:gap-5 md:p-[32px] lg:grid-cols-[28px_minmax(0,1fr)_minmax(0,1fr)_240px] lg:gap-x-[32px] lg:gap-y-4 lg:[grid-template-areas:'num_title_desc_img'_'num_tags_desc_img'] xl:grid-cols-[28px_minmax(0,1.3fr)_minmax(0,0.55fr)_minmax(0,1fr)_260px] xl:p-10 xl:[grid-template-areas:'num_title_tags_desc_img']"
                style={{ ["--sheet-tilt" as string]: `${module.tilt}deg` }}
              >
                <span className="text-[13px] tracking-[0.12em] text-black/40 lg:pt-1 lg:[grid-area:num]" style={bodyFont}>
                  {module.index}
                </span>

                <h3
                  className="text-[19px] font-bold uppercase leading-[1.1] tracking-[0.02em] text-[#040082] sm:text-[22px] md:text-[28px] lg:text-[22px] lg:[grid-area:title] xl:text-[24px]"
                  style={headingFont}
                >
                  {module.title}
                </h3>

                <ul className="space-y-0.5 text-[12px] leading-[1.4] text-[#040082]/70 lg:[grid-area:tags] xl:pl-4 xl:pt-1" style={bodyFont}>
                  {module.tag.split(" · ").map((tag) => (
                    <li key={tag}>{tag}</li>
                  ))}
                </ul>

                <p className="text-[14px] leading-[1.5] text-black/75 lg:[grid-area:desc] xl:pt-0.5" style={bodyFont}>
                  {module.text}
                </p>

                <div className="relative aspect-[4/3] w-full max-w-[320px] overflow-hidden rounded-[14px] bg-[#dde1fa] lg:max-w-none lg:[grid-area:img]">
                  {module.image ? (
                    <Image
                      src={module.image}
                      alt=""
                      fill
                      sizes="(min-width: 1280px) 260px, (min-width: 1024px) 240px, 320px"
                      className="object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0">
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
