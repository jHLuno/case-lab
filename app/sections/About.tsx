"use client";

import { useRef, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const bentoItems = [
  {
    id: "origin",
    label: "2025 — Начало",
    title: "Платформа для разбора кейсов казахстанских компаний",
    body: "Case Lab был создан как пространство для анализа сильных маркетинговых кейсов с реальным влиянием на узнаваемость, коммерческий результат и стандарты рынка.",
    col: "md:col-span-6 md:row-span-2",
    dark: true,
  },
  {
    id: "streams",
    label: "Потоки",
    title: "2",
    body: "потока разбора маркетинговых кейсов",
    col: "md:col-span-3",
    dark: false,
  },
  {
    id: "cases",
    label: "Кейсы",
    title: "5",
    body: "компаний, меняющих стандарты рынка",
    col: "md:col-span-3",
    dark: false,
  },
  {
    id: "evolution",
    label: "Эволюция",
    title: "От разбора кейсов — к экспертизе и сопровождению бизнеса",
    body: "",
    col: "md:col-span-6",
    dark: true,
  },
];

  const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 40, scale: 0.96 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export default function About() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const sectionRef = useRef<HTMLElement>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  // Blur reveal for heading
  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      const mainWords = headingRef.current?.querySelectorAll(".about-word");
      if (mainWords && mainWords.length > 0) {
        gsap.fromTo(
          mainWords,
          { opacity: 0.1, y: 20, filter: "blur(6px)" },
          {
            opacity: 1,
            y: 0,
            filter: "blur(0px)",
            stagger: 0.06,
            scrollTrigger: {
              trigger: headingRef.current,
              start: "top 85%",
              end: "top 55%",
              scrub: true,
            },
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} aria-label="О платформе" className="relative bg-white py-16 md:py-40 px-6 md:px-10 overflow-clip">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1200px] mx-auto">
        {/* ——— History ——— */}
        <div ref={headingRef} className="mb-12 md:mb-20">
          <span
            className="text-gray text-[11px] mb-3 block leading-[1.58] uppercase tracking-wider"
            style={{ fontFamily: "var(--font-body)" }}
          >
            История
          </span>
          <h2
            className="text-black text-[clamp(20px,3.5vw,42px)] font-bold leading-[1.12] uppercase tracking-[0.02em] break-words"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {"История".split(" ").map((word, i) => (
              <span key={i} className="about-word inline-block">
                {word}
              </span>
            ))}{" "}
            <span className="border-b-2 border-[#040082] pb-1 md:pb-1.5 mb-1 md:mb-0 about-word inline-block">
              экспертизы
            </span>{" "}
            <span className="about-word inline-block mt-1 md:mt-0">
              Case
            </span>{" "}
            <span className="about-word inline-block">
              Lab
            </span>
          </h2>
        </div>

        {/* Bento grid */}
        <motion.div
          ref={ref}
          variants={containerVariants}
          initial="hidden"
          animate={isInView ? "visible" : "hidden"}
          className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5 auto-rows-auto"
        >
          {bentoItems.map((item) => (
            <motion.div key={item.id} variants={itemVariants} className={`${item.col}`}>
              <div
                className={`relative h-full rounded-[20px] overflow-hidden flex flex-col ${
                  item.dark
                    ? "min-h-[320px] md:min-h-0 p-9 md:p-10"
                    : "min-h-[160px] p-9 md:p-10"
                }`}
                style={{
                  background: item.dark
                    ? item.id === "origin"
                      ? `linear-gradient(165deg, rgba(4, 0, 130, 0.80) 0%, rgba(6, 6, 50, 0.84) 45%, rgba(2, 2, 25, 0.88) 100%), url(/CASElab.webp)`
                      : item.id === "evolution"
                        ? `linear-gradient(165deg, rgba(4, 0, 130, 0.80) 0%, rgba(6, 6, 50, 0.84) 45%, rgba(2, 2, 25, 0.88) 100%), url(/caselab2.webp)`
                        : "linear-gradient(165deg, rgba(4, 0, 130, 0.95) 0%, rgba(6, 6, 50, 0.98) 45%, rgba(2, 2, 25, 1) 100%)"
                    : "#fff",
                  backgroundSize: (item.id === "origin" || item.id === "evolution") ? "cover" : undefined,
                  backgroundPosition: (item.id === "origin" || item.id === "evolution") ? "center" : undefined,
                  border: item.dark ? "none" : "1px solid rgba(0,0,0,0.08)",
                }}
              >
                {item.dark && (
                  <>
                    <svg aria-hidden="true" className="absolute top-8 left-8 text-white/15 w-5 h-5 animate-pulse" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z"/></svg>
                    <svg aria-hidden="true" className="absolute top-14 left-14 text-white/10 w-3 h-3 animate-pulse" style={{ animationDelay: "0.7s" }} viewBox="0 0 24 24" fill="currentColor"><path d="M12 0L13.5 10.5L24 12L13.5 13.5L12 24L10.5 13.5L0 12L10.5 10.5L12 0Z"/></svg>
                  </>
                )}

                  <span
                  className={`text-[11px] uppercase tracking-wider block mb-6 ${
                    item.dark ? "text-white/70" : "text-[#040082]"
                  }`}
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {item.label}
                </span>

                {item.id === "streams" || item.id === "cases" ? (
                  <div className="mt-auto">
                    <span
                      className={`text-[clamp(32px,4vw,56px)] font-normal leading-none block mb-2 ${
                        item.dark ? "text-white" : "text-black"
                      }`}
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {item.title}
                    </span>
                    <p
                      className={`text-[14px] leading-[1.35] font-light ${
                          item.dark ? "text-white/50" : "text-black/60"
                      }`}
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {item.body}
                    </p>
                  </div>
                ) : (
                  <div className="mt-auto">
                    <h3
                      className={`text-[16px] md:text-[22px] font-normal leading-[1.25] uppercase tracking-[0.02em] mb-4 ${
                        item.dark ? "text-white" : "text-black"
                      }`}
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {item.title}
                    </h3>
                    {item.body && (
                      <p
                        className={`text-[14px] leading-[1.45] max-w-md font-light ${
                        item.dark ? "text-white/50" : "text-black/60"
                        }`}
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {item.body}
                      </p>
                    )}
                  </div>
                )}

                {item.dark && (
                  <div
                    className="absolute inset-0 opacity-0 pointer-events-none"
                    style={{ background: "radial-gradient(circle at 30% 20%, rgba(4, 0, 130, 0.3) 0%, transparent 50%)" }}
                  />
                )}
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.6, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mt-12 md:mt-16"
        >
          <a
            href="#news"
            className="inline-flex items-center gap-2 text-black text-[15px] font-normal hover:gap-3 transition-[gap] duration-200 group"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Компании в разборе
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
