"use client";

import { useRef, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";

const industries = [
  { id: 1, title: "Hero's Journey", abbr: "HJ" },
  { id: 2, title: "abr", abbr: "abr" },
  { id: 3, title: "inDrive", abbr: "ID" },
  { id: 4, title: "Shetel", abbr: "SH" },
  { id: 5, title: "ZimaBlue", abbr: "ZB" },
  { id: 6, title: "Citix", abbr: "CX" },
];

const AUTO_SCROLL_SPEED = 1.5; // px per frame (~90px/s at 60fps)
const RESUME_DELAY = 3000; // ms after user stops interacting

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

      // User is touching — just track position, don't auto-scroll
      if (!isAutoScrollingRef.current) {
        lastScrollLeftRef.current = el.scrollLeft;
        animId = requestAnimationFrame(tick);
        return;
      }

      // Detect if user scrolled via momentum/wheel while auto-scroll was active
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

      // Seamless loop — jump back when passing half the duplicated track
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
          <div className="mb-12 md:mb-16">
            <span
              className="text-gray text-[11px] mb-3 block leading-[1.58] uppercase tracking-wider"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Кейсы
            </span>
            <h2
              className="text-black text-[clamp(20px,3.5vw,36px)] font-bold leading-[1.12] uppercase tracking-[0.02em] max-w-[520px]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Разобранные кейсы компаний на Case <em>Lab</em>
            </h2>
          </div>
        </ScrollReveal>
      </div>

      {/* Marquee cards — JS auto-scroll on mobile, CSS on desktop */}
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
                  <div className="aspect-[4/3] relative overflow-hidden flex flex-col items-center justify-center p-8">
                    <div
                      className="absolute inset-0 opacity-[0.04]"
                      style={{
                        background: `linear-gradient(135deg, #040082 0%, #1a1a9e 50%, #040082 100%)`,
                      }}
                    />
                    <span
                      className="relative z-10 text-[clamp(48px,6vw,80px)] font-bold leading-none text-black/8 select-none"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {industry.abbr}
                    </span>
                  </div>
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
                      Кейс в разработке
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
            className="inline-flex items-center gap-2 bg-[#040082] text-white px-7 py-3.5 text-[14px] md:px-10 md:py-5 md:text-[15px] rounded-full font-normal hover:bg-[#0600a8] transition-colors duration-300 group"
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
