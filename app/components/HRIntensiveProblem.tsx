"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, ArrowUpRight, Briefcase, Tractor, UserMinus } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// Card layout mirrors the homepage "Когда нужна диагностика?" block (app/sections/ClientsPain.tsx).
const symptoms = [
  {
    id: "01",
    icon: Briefcase,
    title: "Бренд знают мамы, но не дочери",
    description:
      "Косметическая компания: ядро покупателей — женщины 45+. Молодёжь бренд просто не знает, а команда и консультанты говорят на языке своего поколения.",
    stat: "45+",
    statLabel: "возраст основных покупателей бренда",
  },
  {
    id: "02",
    icon: Tractor,
    title: "Наследник уходит к конкуренту",
    description:
      "Дистрибьютор агротехники: ферму принимает сын основателя и первым делом покупает другой бренд. Техника не хуже — просто лояльность держалась на убеждениях отца.",
    stat: "55 vs 32",
    statLabel: "возраст продавца и нового владельца",
  },
  {
    id: "03",
    icon: UserMinus,
    title: "Молодые не приходят и не остаются",
    description:
      "Вакансии закрываются месяцами, молодые кандидаты выбирают других работодателей. А те, кто пришёл, быстро уходят: руководители не понимают, как их мотивировать и удерживать.",
    stat: "43%",
    statLabel: "казахстанцев моложе 25 лет",
  },
];

const headingFont = { fontFamily: "var(--font-heading)" };
const bodyFont = { fontFamily: "var(--font-body)" };

export default function HRIntensiveProblem() {
  const shouldReduceMotion = useReducedMotion() ?? false;
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = grid.querySelectorAll<HTMLElement>(".pain-card");

    if (shouldReduceMotion) {
      cards.forEach((card) => (card.style.opacity = "1"));
      return;
    }

    const ctx = gsap.context(() => {
      cards.forEach((card, i) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 80, rotateX: 20, scale: 0.92 },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            scale: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: { trigger: card, start: "top 85%", toggleActions: "play none none none" },
            delay: i * 0.12,
          }
        );
      });
    }, grid);

    return () => ctx.revert();
  }, [shouldReduceMotion]);

  const hover = (i: number) => (shouldReduceMotion ? false : hoveredIndex === i);

  return (
    <section
      id="problem"
      tabIndex={-1}
      aria-labelledby="hr-problem-title"
      className="relative overflow-clip bg-white px-6 py-16 md:px-10 md:py-40"
    >
      <div className="divider-gradient absolute left-0 top-0 h-[1px] w-full" />

      <div className="mx-auto max-w-[1200px]">
        <div className="mb-12 md:mb-20">
          <span
            className="mb-3 block text-[11px] font-normal uppercase leading-[1.58] tracking-wider text-[#040082]"
            style={bodyFont}
          >
            Если узнаёте себя
          </span>
          <h2
            id="hr-problem-title"
            className="text-[clamp(22px,3.5vw,42px)] font-bold uppercase leading-[1.12] tracking-[0.02em] text-black"
            style={headingFont}
          >
            <span className="md:block md:whitespace-nowrap">Поколение сменилось.</span>{" "}
            <span className="md:block md:whitespace-nowrap">Ваши продажи — ещё нет</span>
          </h2>
          <p
            className="mt-5 max-w-[880px] text-balance text-[15px] font-light leading-[1.55] text-black/60 md:mt-6 md:text-[17px]"
            style={bodyFont}
          >
            Компании, которые 10–15 лет назад были лидерами рынка, теряют выручку и людей: молодёжь не покупает их продукт и не идёт к ним работать.
          </p>
        </div>

        <div ref={gridRef} className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6" style={{ perspective: "1200px" }}>
          {symptoms.map((item, i) => {
            const Icon = item.icon;
            const isHovered = hover(i);

            return (
              <div
                key={item.id}
                className="pain-card gsap-hidden group relative h-full cursor-default"
                style={{ transformStyle: "preserve-3d" }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <motion.article
                  className="relative flex h-full flex-col overflow-hidden rounded-[16px] border border-black/[0.08] bg-white p-7 md:p-10 lg:p-8 xl:p-10"
                  animate={{
                    y: isHovered ? -6 : 0,
                    rotateX: isHovered ? -2 : 0,
                    rotateY: isHovered ? (i === 0 ? 2 : i === 2 ? -2 : 0) : 0,
                    borderColor: isHovered ? "rgba(4, 0, 130, 0.25)" : "rgba(0, 0, 0, 0.08)",
                    boxShadow: isHovered
                      ? "0 20px 40px -10px rgba(4, 0, 130, 0.15), 0 0 0 1px rgba(4, 0, 130, 0.1)"
                      : "0 0 0 0 rgba(4, 0, 130, 0)",
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  <motion.div
                    aria-hidden="true"
                    className="absolute left-0 right-0 top-0 h-[3px] rounded-t-[16px]"
                    style={{ background: "linear-gradient(90deg, #040082, #1a1a9e)" }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  />

                  <div className="mb-6 flex items-start justify-between">
                    <span aria-hidden="true" className="text-[48px] font-bold leading-none text-black/[0.1]" style={headingFont}>
                      {item.id}
                    </span>
                    <motion.div
                      aria-hidden="true"
                      className="flex h-10 w-10 items-center justify-center rounded-full"
                      style={{ background: "linear-gradient(135deg, #040082, #1a1a9e)" }}
                      animate={{ scale: isHovered ? 1.1 : 1, rotate: isHovered ? 5 : 0 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Icon size={18} className="text-white" strokeWidth={1.5} />
                    </motion.div>
                  </div>

                  <h3
                    className="mb-4 text-[17px] font-normal uppercase leading-[1.25] tracking-[0.02em] text-black md:text-[19px] lg:text-[17px] xl:text-[19px]"
                    style={headingFont}
                  >
                    {item.title}
                  </h3>

                  <p className="mb-6 text-[14px] font-light leading-[1.5] text-black/50" style={bodyFont}>
                    {item.description}
                  </p>

                  <motion.div
                    className="mt-auto border-t border-black/5 pt-4"
                    animate={{ opacity: isHovered ? 1 : 0.7 }}
                    transition={{ duration: 0.3 }}
                  >
                    <span
                      className="mb-1 block text-[22px] font-bold leading-none text-[#040082] md:text-[26px]"
                      style={headingFont}
                    >
                      {item.stat}
                    </span>
                    <span className="text-[12px] font-light leading-[1.4] text-gray" style={bodyFont}>
                      {item.statLabel}
                    </span>
                  </motion.div>

                  <motion.div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-[16px]"
                    style={{ background: "radial-gradient(circle at 50% 0%, rgba(4, 0, 130, 0.04) 0%, transparent 60%)" }}
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.4 }}
                  />
                </motion.article>
              </div>
            );
          })}
        </div>

        <div className="mt-12 md:mt-16" style={{ perspective: "1000px" }}>
          <TiltLink reduceMotion={shouldReduceMotion} />
        </div>
      </div>
    </section>
  );
}

function TiltLink({ reduceMotion }: { reduceMotion: boolean }) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const active = isHovered && !reduceMotion;

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current || reduceMotion) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    setTilt({ x: (y - 0.5) * -24, y: (x - 0.5) * 24 });
    setGlarePos({ x: x * 100, y: y * 100 });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
    setGlarePos({ x: 50, y: 50 });
  };

  return (
    <motion.a
      ref={ref}
      href="#request"
      className="relative block w-full overflow-hidden rounded-[16px] md:rounded-[20px]"
      style={bodyFont}
      animate={{ rotateX: active ? tilt.x : 0, rotateY: active ? tilt.y : 0, scale: active ? 1.02 : 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
    >
      <div className="relative flex items-center justify-between overflow-hidden rounded-[16px] bg-[#040082] px-6 py-4 text-white md:rounded-[20px] md:px-10 md:py-7">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 transition-opacity duration-300"
          style={{
            opacity: active ? 0.15 : 0,
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.8) 0%, transparent 60%)`,
          }}
        />
        <div className="relative z-10 flex w-full items-center justify-between gap-3 md:gap-4">
          <div className="flex flex-row items-center gap-3 md:gap-6">
            <span className="whitespace-nowrap text-[15px] font-normal leading-tight md:text-[22px]">Запросить КП</span>
            <span className="hidden text-[14px] font-light text-white/50 md:inline md:text-[16px]">
              Программа и цена в течение рабочего дня
            </span>
          </div>
          <motion.div
            aria-hidden="true"
            className="relative z-10 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-white/10 md:h-14 md:w-14"
            animate={{ rotate: active ? -45 : 0, scale: active ? 1.1 : 1 }}
            transition={{ duration: 0.3 }}
          >
            {active ? <ArrowUpRight size={22} strokeWidth={2} /> : <ArrowRight size={20} strokeWidth={2} />}
          </motion.div>
        </div>
      </div>
    </motion.a>
  );
}
