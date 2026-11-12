"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const steps = [
  { title: "Собираете программу", text: "Выбираете длительность и блоки в конфигураторе выше." },
  { title: "Получаете КП", text: "В течение рабочего дня присылаем предложение с программой и стоимостью." },
  { title: "Согласуем детали", text: "Дату, площадку и состав участников: коммерция, маркетинг, HR, руководство." },
  { title: "Проводим сессию", text: "Приходим к вашей команде с готовой программой и практикой." },
];

const headingFont = { fontFamily: "var(--font-heading)" };
const bodyFont = { fontFamily: "var(--font-body)" };

// A blue progress line draws along the track while scrolling; each step lights up
// (glowing node, solid number, dark title) as the line reaches it.
export default function HRIntensiveSteps() {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const listRef = useRef<HTMLOListElement>(null);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const items = Array.from(list.querySelectorAll<HTMLElement>("[data-step]"));
    const fills = Array.from(list.querySelectorAll<HTMLElement>("[data-track-fill]"));

    const setActive = (count: number) =>
      items.forEach((item, i) => item.toggleAttribute("data-active", i < count));

    if (shouldReduceMotion) {
      setActive(items.length);
      gsap.set(fills, { scaleX: 1, scaleY: 1 });
      return;
    }

    const ctx = gsap.context(() => {
      ScrollTrigger.create({
        trigger: list,
        start: "top 80%",
        end: "bottom 40%",
        scrub: 0.4,
        onUpdate: (self) => {
          // Horizontal fill on desktop, vertical on mobile (the other one is hidden).
          gsap.set(fills, { scaleX: self.progress, scaleY: self.progress });
          // A step activates once the line has reached its node.
          setActive(Math.min(items.length, Math.floor(self.progress * (items.length - 1) + 1.0001)));
        },
      });
    }, list);

    return () => ctx.revert();
  }, [shouldReduceMotion]);

  return (
    <section aria-labelledby="hr-steps-title" className="bg-white px-6 py-24 md:px-10 md:py-32">
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

        <ol ref={listRef} className="relative mt-[48px] grid gap-10 pl-10 md:mt-16 md:grid-cols-4 md:gap-6 md:pl-0 md:pt-14">
          {/* Track: vertical on mobile, horizontal from md */}
          <span aria-hidden="true" className="absolute bottom-2 left-[11px] top-2 w-[2px] bg-black/10 md:hidden">
            <span data-track-fill className="absolute inset-0 origin-top scale-y-0 bg-[#040082]" />
          </span>
          <span aria-hidden="true" className="absolute left-0 right-0 top-[11px] hidden h-[2px] bg-black/10 md:block">
            <span data-track-fill className="absolute inset-0 origin-left scale-x-0 bg-gradient-to-r from-[#040082] to-[#1a1a9e]" />
          </span>

          {steps.map((step, index) => (
            <li key={step.title} data-step className="group relative">
              {/* Node on the track */}
              <span
                aria-hidden="true"
                className="absolute -left-10 top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-black/15 bg-white transition-[border-color,background-color,box-shadow] duration-500 group-data-[active]:border-[#040082] group-data-[active]:bg-[#040082] group-data-[active]:shadow-[0_0_0_8px_rgba(4,0,130,0.1),0_0_28px_6px_rgba(4,0,130,0.35)] md:-top-14 md:left-0"
              >
                <span className="h-2 w-2 rounded-full bg-black/15 transition-colors duration-500 group-data-[active]:bg-white" />
              </span>

              <span
                className="block text-[44px] font-bold leading-none text-transparent transition-colors duration-500 [-webkit-text-stroke:1.5px_rgba(0,0,0,0.15)] group-data-[active]:text-[#040082] group-data-[active]:[-webkit-text-stroke:1.5px_#040082] md:text-[56px]"
                style={headingFont}
              >
                0{index + 1}
              </span>
              <h3
                className="mt-4 text-[18px] font-bold leading-[1.3] text-black/35 transition-colors duration-500 group-data-[active]:text-black"
                style={bodyFont}
              >
                {step.title}
              </h3>
              <p
                className="mt-2 text-[15px] leading-[1.5] text-black/35 transition-colors duration-500 group-data-[active]:text-black/60"
                style={bodyFont}
              >
                {step.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
