"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import { CalendarCheck, FileText, Presentation, SlidersHorizontal, type LucideIcon } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const steps: { title: string; text: string; icon: LucideIcon }[] = [
  { title: "Собираете программу", text: "Выбираете длительность и блоки в конфигураторе выше.", icon: SlidersHorizontal },
  { title: "Получаете КП", text: "В течение рабочего дня присылаем предложение с программой и стоимостью.", icon: FileText },
  { title: "Согласуем детали", text: "Дату, площадку и состав участников: коммерция, маркетинг, HR, руководство.", icon: CalendarCheck },
  { title: "Проводим сессию", text: "Приходим к вашей команде с готовой программой и практикой.", icon: Presentation },
];

const headingFont = { fontFamily: "var(--font-heading)" };
const bodyFont = { fontFamily: "var(--font-body)" };

// Desktop wave (viewBox 1000 × WAVE_H, stretched to the container width).
// Nodes alternate low / high; text sits above low nodes and below high ones.
const WAVE_H = 200;
const WAVE_TOP = 85; // offset of the wave inside the desktop list
const LIST_H = 370; // desktop list height
// Texts stay outside the band the wave occupies (y ≈ 62–138), so the line never crosses them.
const TEXT_ABOVE = WAVE_TOP + 48; // bottom edge of texts above low nodes
const TEXT_BELOW = WAVE_TOP + 152; // top edge of texts below high nodes
const NODES = [
  { x: 125, y: 130 },
  { x: 375, y: 70 },
  { x: 625, y: 130 },
  { x: 875, y: 70 },
];
const WAVE_POINTS = [{ x: 0, y: 105 }, ...NODES, { x: 1000, y: 95 }];

// Smooth curve through the points (Catmull-Rom converted to cubic Béziers).
function wavePath(points: { x: number; y: number }[]) {
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x} ${c1.y}, ${c2.x} ${c2.y}, ${p2.x} ${p2.y}`;
  }
  return d;
}
const WAVE_D = wavePath(WAVE_POINTS);

function StepText({ index, title, text }: { index: number; title: string; text: string }) {
  return (
    <div className="relative">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-10 right-0 select-none text-[120px] font-bold leading-none text-black/[0.04] transition-colors duration-500 group-data-[active]:text-[#040082]/[0.08]"
        style={headingFont}
      >
        {index + 1}
      </span>
      <h3
        className="relative text-[18px] font-bold leading-[1.3] text-black/35 transition-colors duration-500 group-data-[active]:text-black"
        style={bodyFont}
      >
        {title}
      </h3>
      <p
        className="relative mt-2 text-[15px] leading-[1.5] text-black/35 transition-colors duration-500 group-data-[active]:text-black/60"
        style={bodyFont}
      >
        {text}
      </p>
    </div>
  );
}

const nodeClass =
  "flex items-center justify-center rounded-full border border-black/10 bg-white text-black/30 shadow-[0_10px_30px_-12px_rgba(4,0,130,0.25)] transition-[background-color,border-color,color,box-shadow] duration-500 group-data-[active]:border-[#040082] group-data-[active]:bg-[#040082] group-data-[active]:text-white group-data-[active]:shadow-[0_0_0_10px_rgba(4,0,130,0.08),0_0_36px_8px_rgba(4,0,130,0.35)]";

export default function HRIntensiveSteps() {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLDivElement>(null);
  const revealRef = useRef<SVGRectElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    const reveal = revealRef.current;
    if (!root || !reveal) return;

    const desktopItems = Array.from(root.querySelectorAll<HTMLElement>("[data-wave-step]"));
    const mobileItems = Array.from(root.querySelectorAll<HTMLElement>("[data-line-step]"));
    const mobileFill = root.querySelector<HTMLElement>("[data-line-fill]");

    const render = (progress: number) => {
      // The wave only moves left to right, so revealing it with a growing clip
      // keeps the drawn part and the node positions exactly in sync.
      const drawnTo = progress * 1000;
      reveal.setAttribute("width", String(drawnTo));
      desktopItems.forEach((item, i) => item.toggleAttribute("data-active", drawnTo >= NODES[i].x));
      if (mobileFill) mobileFill.style.transform = `scaleY(${progress})`;
      // Mobile: a step lights up once the filled line reaches its node.
      const line = mobileFill?.parentElement?.getBoundingClientRect();
      if (line && line.height > 0) {
        const filledTo = line.top + line.height * progress;
        mobileItems.forEach((item) => {
          const node = item.querySelector<HTMLElement>("[data-node]")?.getBoundingClientRect();
          if (node) item.toggleAttribute("data-active", filledTo >= node.top + node.height / 2);
        });
      }
    };

    if (shouldReduceMotion) {
      render(1);
      return;
    }

    render(0);
    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: root,
        start: "top 85%",
        // Finishes as soon as the whole timeline is on screen.
        end: "bottom 85%",
        onUpdate: (self) => render(self.progress),
      });
    }, root);

    return () => ctx.revert();
  }, [shouldReduceMotion]);

  return (
    <section aria-labelledby="hr-steps-title" className="bg-white px-6 py-[48px] md:px-10 md:py-14 lg:py-16">
      <div className="mx-auto max-w-[1160px]">
        <span className="mb-3 block text-[11px] uppercase leading-[1.58] tracking-wider text-[#040082]" style={bodyFont}>
          Процесс
        </span>
        <h2
          id="hr-steps-title"
          className="text-[clamp(26px,3.8vw,52px)] font-bold uppercase leading-[1.06] tracking-[0.02em] text-black"
          style={headingFont}
        >
          Как это работает
        </h2>

        <div ref={rootRef} className="mt-[32px] md:mt-[40px]">
          {/* Desktop (lg+): wave with alternating steps */}
          <ol className="relative hidden lg:block" style={{ height: LIST_H }}>
            <svg
              aria-hidden="true"
              className="absolute left-0 w-full overflow-visible"
              style={{ top: WAVE_TOP }}
              height={WAVE_H}
              viewBox={`0 0 1000 ${WAVE_H}`}
              preserveAspectRatio="none"
            >
              <defs>
                <clipPath id="hr-steps-reveal">
                  <rect ref={revealRef} x="0" y="-20" width="0" height={WAVE_H + 40} />
                </clipPath>
                <linearGradient id="hr-steps-wave" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#040082" />
                  <stop offset="100%" stopColor="#1a1a9e" />
                </linearGradient>
              </defs>
              <path d={WAVE_D} fill="none" stroke="rgba(0,0,0,0.1)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
              <path
                d={WAVE_D}
                fill="none"
                stroke="url(#hr-steps-wave)"
                strokeWidth="3"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
                clipPath="url(#hr-steps-reveal)"
              />
            </svg>

            {steps.map((step, index) => {
              const node = NODES[index];
              const low = node.y > WAVE_H / 2;
              const Icon = step.icon;
              return (
                <li key={step.title} data-wave-step className="group">
                  <span
                    aria-hidden="true"
                    className={`absolute h-[48px] w-[48px] -translate-x-1/2 -translate-y-1/2 ${nodeClass}`}
                    style={{ left: `${node.x / 10}%`, top: WAVE_TOP + node.y }}
                  >
                    <Icon size={20} strokeWidth={1.75} />
                  </span>
                  <div
                    className="absolute w-[22%] -translate-x-1/2"
                    style={
                      low
                        ? { left: `${node.x / 10}%`, bottom: LIST_H - TEXT_ABOVE }
                        : { left: `${node.x / 10}%`, top: TEXT_BELOW }
                    }
                  >
                    <StepText index={index} title={step.title} text={step.text} />
                  </div>
                </li>
              );
            })}
          </ol>

          {/* Phone and tablet: vertical line */}
          <ol className="relative grid gap-10 pl-14 lg:hidden">
            <span aria-hidden="true" className="absolute bottom-6 left-[19px] top-6 w-[2px] bg-black/10">
              <span data-line-fill className="absolute inset-0 origin-top bg-[#040082]" style={{ transform: "scaleY(0)" }} />
            </span>
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} data-line-step className="group relative">
                  <span aria-hidden="true" data-node className={`absolute -left-14 top-0 h-10 w-10 ${nodeClass}`}>
                    <Icon size={17} strokeWidth={1.75} />
                  </span>
                  <div className="pt-2">
                    <StepText index={index} title={step.title} text={step.text} />
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
