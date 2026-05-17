"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
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

export default function Cases() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isAutoScrollingRef = useRef(true);
  const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollLeftRef = useRef(0);
  const halfWidthRef = useRef(0);

  useEffect(() => {
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!isMobile || !containerRef.current) return;

    let animId: number;
    const el = containerRef.current;

    const updateHalfWidth = () => {
      if (el) halfWidthRef.current = el.scrollWidth / 2;
    };
    updateHalfWidth();
    window.addEventListener("resize", updateHalfWidth);

    const tick = () => {
      if (!el) {
        animId = requestAnimationFrame(tick);
        return;
      }

      if (!isAutoScrollingRef.current) {
        lastScrollLeftRef.current = el.scrollLeft;
        animId = requestAnimationFrame(tick);
        return;
      }

      const expected = lastScrollLeftRef.current + AUTO_SCROLL_SPEED;
      const diff = Math.abs(el.scrollLeft - expected);
      if (diff > AUTO_SCROLL_SPEED * 5) {
        isAutoScrollingRef.current = false;
        lastScrollLeftRef.current = el.scrollLeft;
        if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
        resumeTimerRef.current = setTimeout(() => {
          isAutoScrollingRef.current = true;
        }, RESUME_DELAY);
        animId = requestAnimationFrame(tick);
        return;
      }

      el.scrollLeft += AUTO_SCROLL_SPEED;
      lastScrollLeftRef.current = el.scrollLeft;

      if (el.scrollLeft >= halfWidthRef.current) {
        el.scrollLeft -= halfWidthRef.current;
        lastScrollLeftRef.current = el.scrollLeft;
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", updateHalfWidth);
      if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    };
  }, []);

  const handleTouchStart = () => {
    isAutoScrollingRef.current = false;
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
  };

  const handleTouchEnd = () => {
    if (resumeTimerRef.current) clearTimeout(resumeTimerRef.current);
    resumeTimerRef.current = setTimeout(() => {
      isAutoScrollingRef.current = true;
    }, RESUME_DELAY);
  };

  return (
    <section id="cases" aria-label="Кейсы" className="relative bg-white py-16 md:py-40 px-6 md:px-10 overflow-clip z-[3]">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        <ScrollReveal>
          <h2
            className="text-black text-[clamp(16px,4vw,54px)] font-bold leading-[1.15] mb-12 md:mb-16 uppercase tracking-[0.02em]"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Разобранные кейсы компаний на Case <em>Lab</em>
          </h2>
        </ScrollReveal>
      </div>

      {/* Marquee cards */}
      <div
        ref={containerRef}
        className="overflow-x-auto md:overflow-hidden py-3 scrollbar-hide"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="marquee-track flex">
          {[0, 1].map((set) => (
            <div key={set} className="flex gap-4 md:gap-6 flex-shrink-0 pr-4 md:pr-6">
              {industries.map((industry) => (
                <div
                  key={`${industry.id}-${set}`}
                  className="relative rounded-[16px] overflow-hidden group cursor-pointer flex-shrink-0 border border-black/[0.08] bg-white hover:border-[#040082]/30 hover:shadow-[0_12px_40px_-12px_rgba(4,0,130,0.15)] hover:scale-[1.02] transition-all duration-500"
                  style={{ width: "clamp(280px, 35vw, 400px)" }}
                >
                  {/* Photo with blue overlay */}
                  <div className="aspect-[4/3] relative overflow-hidden">
                    <Image
                      src={industry.photo}
                      alt={industry.speaker}
                      fill
                      className="object-cover"
                      style={{ objectPosition: industry.objectPos }}
                      sizes="(max-width: 768px) 280px, 400px"
                    />
                    {/* Blue gradient overlay — stronger at bottom, fades to transparent at top */}
                    <div
                      className="absolute inset-0"
                      style={{
                        background: "linear-gradient(0deg, rgba(4,0,130,0.7) 0%, rgba(4,0,130,0.3) 40%, transparent 100%)",
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

      <div className="max-w-[1078px] mx-auto mt-8">
        <ScrollReveal delay={0.2}>
          <a
            href="#news"
            className="inline-flex items-center gap-2 bg-[#040082] text-white px-7 py-3.5 text-[14px] md:px-10 md:py-5 md:text-[15px] rounded-full font-normal hover:bg-[#0600a8] transition-colors duration-200 group"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Все кейсы
            <ArrowRight
              size={14}
              strokeWidth={2}
              className="group-hover:translate-x-1 transition-transform"
            />
          </a>
        </ScrollReveal>
      </div>
    </section>
  );
}
