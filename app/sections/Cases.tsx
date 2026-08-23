"use client";

import { useRef, useEffect, useState, type FocusEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";

const industries = [
  {
    id: 1,
    title: "Hero's Journey",
    speaker: "Диана Тажимова",
    initials: "ДТ",
    photo: "/Диана%20Тажимова%20(Hero's%20Journey).webp",
    objectPos: "center 20%",
  },
  {
    id: 2,
    title: "abr",
    speaker: "Салтанат Муса",
    initials: "СМ",
    photo: "/Салтанат%20Муса(abr).webp",
    objectPos: "center 20%",
  },
  {
    id: 3,
    title: "inDrive",
    speaker: "Алексей Понтус",
    initials: "АП",
    photo: "/Алексей%20Понтус%20(InDriver).webp",
    objectPos: "center 20%",
  },
  {
    id: 4,
    title: "Shetel",
    speaker: "Нурсултан Магзумов",
    initials: "НМ",
    photo: "/Нурсултан%20Магзумов%20(Shetel)%20.webp",
    objectPos: "center top",
  },
  {
    id: 5,
    title: "ZimaBlue",
    speaker: "Фарангиза Шукашева",
    initials: "ФШ",
    photo: "/Фарангиза%20Шукашева%20(ZimaBlue).webp",
    objectPos: "center 20%",
  },
  {
    id: 6,
    title: "Citix",
    speaker: "Леонид Нигматуллин",
    initials: "ЛН",
    photo: "/Леонид%20Нигматуллин%20(Citix).webp",
    objectPos: "center top",
  },
];

const AUTO_SCROLL_SPEED = 1.5;
const RESUME_DELAY = 3000;

type CasesProps = {
  alignToCaseLab?: boolean;
};

export default function Cases({ alignToCaseLab = false }: CasesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const halfWidthRef = useRef(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [interactionPaused, setInteractionPaused] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const [pageHidden, setPageHidden] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(true);
  const shouldAutoAnimate = !isPaused && !interactionPaused && isInView && !pageHidden && !prefersReducedMotion;
  const caseLabShell = `max-w-[1078px] ${alignToCaseLab ? "ml-4 md:ml-10" : "mx-auto"}`;

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    const updateMedia = () => {
      setIsMobile(mediaQuery.matches);
      setPrefersReducedMotion(reducedMotionQuery.matches);
    };
    updateMedia();
    mediaQuery.addEventListener("change", updateMedia);
    reducedMotionQuery.addEventListener("change", updateMedia);

    return () => {
      mediaQuery.removeEventListener("change", updateMedia);
      reducedMotionQuery.removeEventListener("change", updateMedia);
    };
  }, []);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => setIsInView(entry.isIntersecting),
      { rootMargin: "200px 0px" },
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const handleVisibilityChange = () => setPageHidden(document.hidden);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    if (!isMobile || !shouldAutoAnimate || !containerRef.current) return;

    let animId: number;
    const el = containerRef.current;

    const updateHalfWidth = () => {
      if (el) halfWidthRef.current = el.scrollWidth / 2;
    };
    updateHalfWidth();
    window.addEventListener("resize", updateHalfWidth);

    const tick = () => {
      el.scrollLeft += AUTO_SCROLL_SPEED;

      if (halfWidthRef.current > 0 && el.scrollLeft >= halfWidthRef.current) {
        el.scrollLeft -= halfWidthRef.current;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updateHalfWidth);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, [isMobile, shouldAutoAnimate]);

  const handleTouchStart = () => {
    setInteractionPaused(true);
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };

  const handleTouchEnd = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      setInteractionPaused(false);
    }, RESUME_DELAY);
  };

  const handlePauseToggle = () => {
    setIsPaused((current) => !current);
  };

  const handleRegionBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setInteractionPaused(false);
    }
  };

  return (
    <section id="cases" tabIndex={-1} aria-label="Кейсы" className="relative bg-white py-16 md:py-40 px-6 md:px-10 overflow-clip z-[3]">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className={caseLabShell}>
        <ScrollReveal>
          <h2
            className="text-black text-[clamp(24px,4vw,54px)] font-bold leading-[1.15] mb-12 md:mb-16 uppercase tracking-[0.02em]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Разобранные кейсы компаний на Case <em>Lab</em>
          </h2>
        </ScrollReveal>
      </div>

      {/* Marquee cards */}
      <div
        className="relative"
        onMouseEnter={() => setInteractionPaused(true)}
        onMouseLeave={() => setInteractionPaused(false)}
        onFocusCapture={() => setInteractionPaused(true)}
        onBlurCapture={handleRegionBlur}
      >
        <div className={`${caseLabShell} mb-2 flex justify-end`}>
          <button
            type="button"
            className="rounded-full border border-[#040082]/25 px-4 py-2 text-[12px] text-[#040082] transition-colors hover:bg-[#040082] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            aria-pressed={isPaused}
            disabled={prefersReducedMotion}
            onClick={handlePauseToggle}
            style={{ fontFamily: "var(--font-body)" }}
          >
            {prefersReducedMotion ? "Автодвижение отключено" : isPaused ? "Продолжить карусель" : "Поставить карусель на паузу"}
          </button>
        </div>
        <div
          ref={containerRef}
          className="overflow-x-auto py-3 scrollbar-hide md:overflow-hidden"
          aria-label="Лента кейсов"
          tabIndex={0}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
        <div className={`marquee-track flex ${shouldAutoAnimate ? "" : "marqueePaused"}`}>
          {[0, 1].map((set) => (
            <div key={set} className="flex flex-shrink-0 gap-4 pr-4 md:gap-6 md:pr-6" aria-hidden={set === 1}>
              {industries.map((industry) => (
                <div
                  key={`${industry.id}-${set}`}
                  className="relative flex-shrink-0 overflow-hidden rounded-[16px] border border-black/[0.08] bg-white"
                  style={{ width: "clamp(280px, 35vw, 400px)", contain: "layout style paint" }}
                >
                  {/* Photo with blue overlay */}
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <Image
                      src={industry.photo}
                      alt=""
                      fill
                      className="object-cover"
                      style={{ objectPosition: industry.objectPos }}
                      sizes="(max-width: 768px) 280px, 400px"
                      loading="lazy"
                    />
                    {/* Blue gradient overlay */}
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{
                        background: "linear-gradient(0deg, rgba(4,0,130,0.7) 0%, rgba(4,0,130,0.3) 40%, transparent 100%)",
                        willChange: "transform",
                      }}
                    />
                  </div>

                  {/* Info */}
                  <div className="p-5 md:p-6 border-t border-black/5">
                    <span
                      className="text-black text-[18px] md:text-[22px] font-normal leading-[1.15] block"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {industry.title}
                    </span>
                    <span
                      className="text-gray text-[12px] md:text-[13px] font-light mt-1 block"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {industry.speaker}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
        </div>
      </div>

      <div className={`${caseLabShell} mt-8`}>
        <ScrollReveal delay={0.2}>
          <Link
            href="/#news"
            className="inline-flex items-center gap-2 bg-[#040082] text-white px-7 py-3.5 text-[14px] md:px-10 md:py-5 md:text-[15px] rounded-full font-normal hover:bg-[#0600a8] transition-colors duration-200 group"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Все кейсы
            <ArrowRight
              size={14}
              strokeWidth={2}
              className="group-hover:translate-x-1 transition-transform"
            />
          </Link>
        </ScrollReveal>
      </div>
    </section>
  );
}
