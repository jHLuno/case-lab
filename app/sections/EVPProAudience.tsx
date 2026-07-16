"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

const Dither = dynamic(() => import("../components/Dither"), { ssr: false });

const audiences = [
  {
    role: "Собственники и руководители",
    label: "Собственники",
    benefit: "Как сделать компанию выбором сильных людей, а не ещё одним работодателем на рынке.",
    detail: "Вы получите единый ориентир для решений о найме, бренде и коммуникации — и перестанете держать это в голове одного человека.",
  },
  {
    role: "HR и HRBP",
    label: "HR и HRBP",
    benefit: "Как перевести EVP из презентации в понятный опыт сотрудника и кандидата.",
    detail: "Вы получите формулировки, которые сразу можно использовать в вакансиях, онбординге и разговорах с командой.",
  },
  {
    role: "PR и маркетинг",
    label: "PR и маркетинг",
    benefit: "Как говорить с рынком труда тем же голосом, которым компания говорит с клиентами.",
    detail: "Вы получите общий словарь с HR, чтобы внешний бренд и то, что видит команда изнутри, не расходились.",
  },
];

const takeaways = ["Каркас EVP", "Карта ключевых разрывов", "Единый язык для команды", "Первые действия после сессии"];

export default function EVPProAudience() {
  const [activeAudience, setActiveAudience] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const shouldReduceMotion = useReducedMotion();
  const audience = audiences[activeAudience];
  const changeAudience = (direction: -1 | 1) => {
    setActiveAudience((current) => (current + direction + audiences.length) % audiences.length);
  };

  useEffect(() => {
    if (shouldReduceMotion || isPaused) return;
    const timer = setInterval(() => {
      setActiveAudience((current) => (current + 1) % audiences.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [activeAudience, shouldReduceMotion, isPaused]);

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
            <span className="relative isolate inline-flex items-center gap-3 px-3 py-1 text-white before:absolute before:inset-0 before:-z-10 before:-translate-y-[6px] before:bg-[#075C43]">
              если вы <ArrowRight aria-hidden="true" className="h-[0.9em] w-[0.9em]" strokeWidth={3} />
            </span>
          </h2>
          <p className="mt-6 max-w-[34ch] text-[16px] leading-[1.5] text-black/65 md:text-[18px]" style={{ fontFamily: "var(--font-body)" }}>
            EVP не создаётся силами одного отдела. Это разговор о компании, который должны вести вместе те, кто влияет на людей и репутацию.
          </p>

          <div className="mt-12 md:mt-16">
            <h3
              className="text-[clamp(20px,2.6vw,30px)] font-bold leading-[1.1] tracking-[0.02em] uppercase text-black"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              С чем вы уйдёте
            </h3>
            <ul className="mt-6 flex flex-col gap-3" style={{ fontFamily: "var(--font-body)" }}>
              {takeaways.map((takeaway) => (
                <li key={takeaway} className="flex items-center gap-3 text-[15px] text-black/75 md:text-[17px]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#075C43]/10">
                    <Check size={13} className="text-[#075C43]" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  {takeaway}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div
          data-evp-reveal
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          onFocus={() => setIsPaused(true)}
          onBlur={() => setIsPaused(false)}
        >
          <div className="overflow-hidden rounded-[28px] border border-black/10 bg-[#f5f5f5] p-3 md:p-4">
            <div className="relative min-h-[290px] md:min-h-[340px]">
              <AnimatePresence mode="wait" initial={false}>
                <motion.article
                  key={audience.role}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -12 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.36, ease: [0.16, 1, 0.3, 1] }}
                  className="absolute inset-0 overflow-hidden rounded-[20px] bg-[#0a0a0a] p-7 text-white md:p-10"
                >
                  {!shouldReduceMotion && (
                    <span aria-hidden="true" className="absolute inset-0 z-0">
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
                  <p className="relative z-10 text-[13px] tracking-[0.08em] text-white/50" style={{ fontFamily: "var(--font-body)" }}>
                    0{activeAudience + 1} / 0{audiences.length}
                  </p>
                  <h3 className="relative z-10 mt-10 max-w-[14ch] text-[clamp(28px,3.7vw,52px)] font-bold leading-[1.08] tracking-[0.02em] uppercase" style={{ fontFamily: "var(--font-heading)" }}>
                    {audience.role}
                  </h3>
                  <p className="relative z-10 mt-7 max-w-[44ch] text-[17px] leading-[1.45] text-white/75 md:text-[21px]" style={{ fontFamily: "var(--font-body)" }}>
                    {audience.benefit}
                  </p>
                </motion.article>
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-3 px-4 py-5 md:px-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div role="tablist" aria-label="Аудитории EVP Pro" className="flex flex-wrap items-center gap-x-5 gap-y-2">
                  {audiences.map((item, index) => {
                    const isActive = index === activeAudience;
                    return (
                      <button
                        key={item.role}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveAudience(index)}
                        className={`border-b-2 pb-0.5 text-[14px] transition-colors duration-200 md:text-[16px] ${
                          isActive ? "border-[#075C43] text-[#075C43]" : "border-transparent text-black/45 hover:text-black/70"
                        }`}
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {item.label}
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" onClick={() => changeAudience(-1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-black/15 text-black transition-colors hover:border-[#075C43] hover:text-[#075C43]" aria-label="Предыдущая аудитория">
                    <ArrowLeft size={17} strokeWidth={1.5} />
                  </button>
                  <button type="button" onClick={() => changeAudience(1)} className="flex h-10 w-10 items-center justify-center rounded-full border border-black/15 text-black transition-colors hover:border-[#075C43] hover:text-[#075C43]" aria-label="Следующая аудитория">
                    <ArrowRight size={17} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.p
                  key={audience.role}
                  initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={shouldReduceMotion ? undefined : { opacity: 0, y: -6 }}
                  transition={{ duration: shouldReduceMotion ? 0 : 0.28, ease: [0.16, 1, 0.3, 1] }}
                  className="max-w-[64ch] text-[14px] leading-[1.5] text-black/55 md:text-[15px]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {audience.detail}
                </motion.p>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
