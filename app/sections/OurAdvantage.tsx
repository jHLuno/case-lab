"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useInView } from "framer-motion";
import { ArrowRight, ArrowUpRight, AlertTriangle, TrendingDown, HelpCircle } from "lucide-react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLeadPopup } from "../lib/LeadPopupContext";

gsap.registerPlugin(ScrollTrigger);

const pains = [
  {
    id: "01",
    icon: HelpCircle,
    title: "Не понимаем, что именно у нас не работает",
    description:
      "Когда непонятно, что именно не работает: продукт, цена, клиент, модель или маркетинг. Диагностика разложит бизнес по полочкам и покажет, где реальная проблема.",
    stat: "5 элементов",
    statLabel: "продукт, цена, клиент, модель, маркетинг",
  },
  {
    id: "02",
    icon: TrendingDown,
    title: "Делаем много, а ясности и результата нет",
    description:
      "Когда маркетинга много, а роста и ясности нет. Диагностика найдёт, какие активности реально двигают бизнес, а какие — выброшенные деньги.",
    stat: "20+ активностей",
    statLabel: "и неясно, что даёт рост",
  },
  {
    id: "03",
    icon: AlertTriangle,
    title: "Нужно принять решение, но непонятно, от чего отталкиваться",
    description:
      "Когда перед бизнесом стоит следующий шаг, но решение нельзя принимать вслепую. Диагностика даст структуру и основание для выбора направления.",
    stat: "1 структура",
    statLabel: "для принятия решения, а не интуиция",
  },
];

export default function OurAdvantage() {
  const headerRef = useRef(null);
  const headerInView = useInView(headerRef, { once: true, margin: "-100px" });
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gridRef.current) return;

    const ctx = gsap.context(() => {
      const cards = gridRef.current!.querySelectorAll(".pain-card");
      cards.forEach((card, i) => {
        gsap.fromTo(
          card,
          {
            opacity: 0,
            y: 80,
            rotateX: 20,
            scale: 0.92,
          },
          {
            opacity: 1,
            y: 0,
            rotateX: 0,
            scale: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              end: "top 50%",
              toggleActions: "play none none none",
            },
            delay: i * 0.12,
          }
        );
      });
    }, gridRef);

    return () => ctx.revert();
  }, []);

  return (
    <section aria-label="Когда нужна диагностика" className="relative bg-white py-16 md:py-40 px-6 md:px-10 overflow-clip">
      {/* Gradient divider */}
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <motion.div
          ref={headerRef}
          initial={{ opacity: 0, y: 30 }}
          animate={headerInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 md:mb-20"
        >
          <span
            className="text-[#040082] text-[11px] mb-3 block leading-[1.58] uppercase tracking-wider font-normal"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Если узнаёте себя
          </span>
          <h2
            className="text-black text-[clamp(22px,3.5vw,42px)] font-bold leading-[1.12] uppercase tracking-[0.02em] max-w-3xl"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Когда нужна диагностика?
          </h2>
        </motion.div>

        {/* Pain Cards */}
        <div
          ref={gridRef}
          className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6"
          style={{ perspective: "1200px" }}
        >
          {pains.map((pain, i) => {
            const Icon = pain.icon;
            const isHovered = hoveredIndex === i;

            return (
              <div
                key={pain.id}
                className="pain-card relative group cursor-pointer h-full"
                style={{
                  opacity: 0,
                  transformStyle: "preserve-3d",
                }}
                onMouseEnter={() => setHoveredIndex(i)}
                onMouseLeave={() => setHoveredIndex(null)}
                onTouchStart={() => setHoveredIndex(i)}
                onTouchEnd={() => setHoveredIndex(null)}
              >
                <motion.div
                      className="relative rounded-[16px] border border-black/[0.08] bg-white p-8 md:p-10 overflow-hidden flex flex-col h-full"
                  animate={{
                    y: isHovered ? -6 : 0,
                    rotateX: isHovered ? -2 : 0,
                    rotateY: isHovered ? (i === 0 ? 2 : i === 2 ? -2 : 0) : 0,
                    borderColor: isHovered
                      ? "rgba(4, 0, 130, 0.25)"
                      : "rgba(0, 0, 0, 0.08)",
                    boxShadow: isHovered
                      ? "0 20px 40px -10px rgba(4, 0, 130, 0.15), 0 0 0 1px rgba(4, 0, 130, 0.1)"
                      : "0 0 0 0 rgba(4, 0, 130, 0)",
                  }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  style={{ transformStyle: "preserve-3d" }}
                >
                  {/* Accent top bar */}
                  <motion.div
                    className="absolute top-0 left-0 right-0 h-[3px] rounded-t-[16px]"
                    style={{
                      background: "linear-gradient(90deg, #040082, #1a1a9e)",
                    }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                  />

                  {/* Number + Icon */}
                  <div className="flex items-start justify-between mb-6">
                    <span
                      className="text-black/[0.1] text-[48px] font-bold leading-none"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {pain.id}
                    </span>
                    <motion.div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{
                        background: "linear-gradient(135deg, #040082, #1a1a9e)",
                      }}
                      animate={{
                        scale: isHovered ? 1.1 : 1,
                        rotate: isHovered ? 5 : 0,
                      }}
                      transition={{ duration: 0.3 }}
                    >
                      <Icon size={18} className="text-white" strokeWidth={1.5} />
                    </motion.div>
                  </div>

                  {/* Title */}
                  <h3
                    className="text-black text-[17px] md:text-[19px] font-normal leading-[1.25] mb-4 uppercase tracking-[0.02em]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {pain.title}
                  </h3>

                  {/* Description */}
                  <p
                    className="text-black/50 text-[14px] leading-[1.5] font-light mb-6"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {pain.description}
                  </p>

                  {/* Stat highlight */}
                  <motion.div
                    className="pt-4 border-t border-black/5 mt-auto"
                    animate={{
                      opacity: isHovered ? 1 : 0.7,
                    }}
                    transition={{ duration: 0.3 }}
                  >
                    <span
                      className="text-[#040082] text-[22px] md:text-[26px] font-bold leading-none block mb-1"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      {pain.stat}
                    </span>
                    <span
                      className="text-gray text-[12px] leading-[1.4] font-light"
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {pain.statLabel}
                    </span>
                  </motion.div>

                  {/* Hover glow */}
                  <motion.div
                    className="absolute inset-0 rounded-[16px] pointer-events-none"
                    style={{
                      background:
                        "radial-gradient(circle at 50% 0%, rgba(4, 0, 130, 0.04) 0%, transparent 60%)",
                    }}
                    animate={{ opacity: isHovered ? 1 : 0 }}
                    transition={{ duration: 0.4 }}
                  />
                </motion.div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 md:mt-16" style={{ perspective: "1000px" }}>
          <TiltButton />
        </div>
      </div>
    </section>
  );
}

function TiltButton() {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [glarePos, setGlarePos] = useState({ x: 50, y: 50 });
  const { openPopup } = useLeadPopup();

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    
    // Tilt: -12 to 12 degrees
    const tiltX = (y - 0.5) * -24;
    const tiltY = (x - 0.5) * 24;
    
    setTilt({ x: tiltX, y: tiltY });
    setGlarePos({ x: x * 100, y: y * 100 });
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    setTilt({ x: 0, y: 0 });
    setGlarePos({ x: 50, y: 50 });
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={openPopup}
      className="relative block w-full overflow-hidden cursor-pointer"
      style={{
        fontFamily: "var(--font-body)",
      }}
      animate={{
        rotateX: tilt.x,
        rotateY: tilt.y,
        scale: isHovered ? 1.02 : 1,
      }}
      transition={{
        type: "spring",
        stiffness: 300,
        damping: 20,
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleMouseLeave}
      whileTap={{ scale: 0.98 }}
    >
      {/* Button background */}
      <div
        className="relative flex items-center justify-between bg-[#040082] text-white px-6 py-4 md:px-10 md:py-7 rounded-[16px] md:rounded-[20px] overflow-hidden"
      >
        {/* Glare effect */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={{
            opacity: isHovered ? 0.15 : 0,
            background: `radial-gradient(circle at ${glarePos.x}% ${glarePos.y}%, rgba(255,255,255,0.8) 0%, transparent 60%)`,
          }}
        />

        {/* Shimmer */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.1), transparent)",
            backgroundSize: "200% 100%",
          }}
          animate={{
            backgroundPosition: isHovered ? ["-100% 0%", "200% 0%"] : "-100% 0%",
          }}
          transition={{
            duration: 1.5,
            ease: "easeInOut",
            repeat: isHovered ? Infinity : 0,
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex items-center justify-between w-full gap-3 md:gap-4">
          <div className="flex flex-row items-center gap-3 md:gap-6">
            <span className="text-[15px] md:text-[22px] font-normal leading-tight whitespace-nowrap">
              Записаться на диагностику
            </span>
            <span className="hidden md:inline text-white/50 text-[14px] md:text-[16px] font-light">
              200 000 ₸ · 2 часа · Алматы
            </span>
          </div>

          {/* Arrow */}
          <motion.div
            className="relative z-10 flex-shrink-0 w-10 h-10 md:w-14 md:h-14 rounded-full bg-white/10 flex items-center justify-center"
            animate={{
              rotate: isHovered ? -45 : 0,
              scale: isHovered ? 1.1 : 1,
            }}
            transition={{ duration: 0.3 }}
          >
            <motion.div
              animate={{ x: isHovered ? 2 : 0 }}
              transition={{ duration: 0.3 }}
            >
              {isHovered ? (
                <ArrowUpRight size={22} strokeWidth={2} />
              ) : (
                <ArrowRight size={20} strokeWidth={2} />
              )}
            </motion.div>
          </motion.div>
        </div>
      </div>
    </motion.button>
  );
}
