"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";

const Dither = dynamic(() => import("../components/Dither"), { ssr: false });

const audiences = [
  {
    role: "Собственники и founders",
    label: "Собственники",
    benefit: "Как сделать компанию выбором сильных людей, а не ещё одним работодателем на рынке.",
  },
  {
    role: "HR и HRBP",
    label: "HR и HRBP",
    benefit: "Как перевести EVP из презентации в понятный опыт сотрудника и кандидата.",
  },
  {
    role: "PR и маркетинг",
    label: "PR и маркетинг",
    benefit: "Как говорить с рынком труда тем же голосом, которым компания говорит с клиентами.",
  },
];

const takeaways = ["Каркас EVP", "Карта ключевых разрывов", "Единый язык для команды", "Первые действия после сессии"];

export default function EVPProAudience() {
  const [activeAudience, setActiveAudience] = useState(0);
  const shouldReduceMotion = useReducedMotion();
  const audience = audiences[activeAudience];
  const changeAudience = (direction: -1 | 1) => {
    setActiveAudience((current) => (current + direction + audiences.length) % audiences.length);
  };

  return (
    <section aria-labelledby="evp-audience-title" className="bg-white px-6 py-12 md:px-10 md:py-[72px]">
      <div className="mx-auto grid max-w-[1440px] gap-12 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)] lg:gap-20">
        <div data-evp-reveal className="max-w-[420px]">
          <h2
            id="evp-audience-title"
            className="max-w-[14ch] text-[clamp(23px,3.6vw,50px)] font-bold leading-[1.06] tracking-[0.02em] uppercase text-black"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Вы получите максимум,<br />
            <span className="relative isolate inline-flex items-center gap-3 px-3 py-1 text-white before:absolute before:inset-0 before:-z-20 before:-translate-y-[6px] before:bg-[#075C43]">
              {!shouldReduceMotion && (
                <span aria-hidden="true" className="absolute inset-0 -z-10 -translate-y-[6px] overflow-hidden">
                  <Dither
                    waveColor={[0.027450980392156862, 0.3607843137254902, 0.2627450980392157]}
                    disableAnimation={false}
                    enableMouseInteraction={false}
                    mouseRadius={0.3}
                    colorNum={5}
                    pixelSize={1}
                    waveAmplitude={0.35}
                    waveFrequency={2}
                    waveSpeed={0.01}
                  />
                </span>
              )}
              если вы <ArrowRight aria-hidden="true" className="h-[0.9em] w-[0.9em]" strokeWidth={3} />
            </span>
          </h2>
          <p className="mt-6 max-w-[34ch] text-[16px] leading-[1.5] text-black/65 md:text-[18px]" style={{ fontFamily: "var(--font-body)" }}>
            EVP не создаётся силами одного отдела. Это разговор о компании, который должны вести вместе те, кто влияет на людей и репутацию.
          </p>
        </div>

        <div data-evp-reveal>
          <div className="overflow-hidden rounded-[28px] border border-black/10 bg-[#f5f5f5] p-3 md:p-4">
            <div className="relative min-h-[290px] md:min-h-[340px]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.article
                  key={audience.role}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -12 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.36, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 rounded-[20px] bg-[#0a0a0a] p-7 text-white md:p-10"
                >
                  <p className="text-[13px] tracking-[0.08em] text-white/50" style={{ fontFamily: "var(--font-body)" }}>
                    0{activeAudience + 1} / 0{audiences.length}
                  </p>
                  <h3 className="mt-10 max-w-[14ch] text-[clamp(28px,3.7vw,52px)] font-bold leading-[1.08] tracking-[0.02em] uppercase" style={{ fontFamily: "var(--font-heading)" }}>
                    {audience.role}
                  </h3>
                  <p className="mt-7 max-w-[44ch] text-[17px] leading-[1.45] text-white/75 md:text-[21px]" style={{ fontFamily: "var(--font-body)" }}>
                    {audience.benefit}
                  </p>
                </motion.article>
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-between gap-6 px-4 py-5 md:px-6">
              <p className="text-[18px] text-black md:text-[22px]" style={{ fontFamily: "var(--font-body)" }}>
                Выгода для роли
              </p>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => changeAudience(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-black/15 text-black transition-colors hover:border-[#075C43] hover:text-[#075C43]" aria-label="Предыдущая аудитория">
                  <ArrowLeft size={17} strokeWidth={1.5} />
                </button>
                <div className="flex items-center gap-2" aria-label={`Аудитория ${activeAudience + 1} из ${audiences.length}`}>
                  {audiences.map((item, index) => (
                    <span key={item.role} className={`h-2.5 w-2.5 rotate-45 border transition-[background-color,border-color,transform] duration-300 ${index === activeAudience ? "scale-110 border-[#075C43] bg-[#075C43]" : "border-black/20 bg-transparent"}`} />
                  ))}
                </div>
                <button type="button" onClick={() => changeAudience(1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-black/15 text-black transition-colors hover:border-[#075C43] hover:text-[#075C43]" aria-label="Следующая аудитория">
                  <ArrowRight size={17} strokeWidth={1.5} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div data-evp-reveal className="mx-auto mt-16 max-w-[1440px] border-t border-black/10 pt-8 md:mt-24 md:pt-10">
        <h2 className="max-w-[15ch] text-[clamp(27px,3.8vw,48px)] font-bold leading-[1.08] tracking-[0.02em] uppercase text-black" style={{ fontFamily: "var(--font-heading)" }}>
          С чем вы уйдёте
        </h2>
        <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-4 md:mt-10 md:gap-x-8" style={{ fontFamily: "var(--font-body)" }}>
          {takeaways.map((takeaway) => (
            <li key={takeaway} className="border-b border-[#075C43]/35 pb-1 text-[16px] text-[#075C43] md:text-[20px]">
              {takeaway}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
