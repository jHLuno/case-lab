"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import gsap from "gsap";
import { useLeadPopup } from "../lib/LeadPopupContext";

export default function Hero() {
  const containerRef = useRef<HTMLElement>(null);
  const { openPopup } = useLeadPopup();

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(".hero-orb-1", {
        x: 30,
        y: -20,
        duration: 10,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".hero-orb-2", {
        x: -25,
        y: 35,
        duration: 12,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".hero-orb-3", {
        x: 20,
        y: 15,
        duration: 9,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, containerRef);
    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      aria-label="Главный экран"
      className="relative min-h-[100svh] w-full overflow-hidden bg-[#000011] flex items-end"
    >
      {/* Atmospheric gradient orbs */}
      <div className="absolute top-[-20%] left-[-10%] w-[80vw] h-[80vw] rounded-full bg-[#040082]/40 blur-[120px] hero-orb-1" />
      <div className="absolute top-[10%] right-[-15%] w-[70vw] h-[70vw] rounded-full bg-[#0a1a6e]/30 blur-[100px] hero-orb-2" />
      <div className="absolute bottom-[-30%] left-[25%] w-[60vw] h-[60vw] rounded-full bg-[#0d2d7a]/25 blur-[140px] hero-orb-3" />

      {/* Subtle grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)`,
          backgroundSize: "100px 100px",
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,17,0.6) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full px-6 md:px-10 pb-20 md:pb-32 pt-32">
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-start md:items-end justify-between gap-12 md:gap-20">
          {/* Left — Big headline + CTA */}
          <div className="flex-1">
            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1.2,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.3,
              }}
            >
              <h1
                className="text-white text-[clamp(32px,5vw,72px)] font-bold leading-none tracking-[0.02em] uppercase whitespace-normal md:whitespace-nowrap"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                CASE <em>LAB</em>
              </h1>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.6,
              }}
              className="mt-4 md:mt-6"
            >
              <p
                className="text-white text-[clamp(22px,3vw,42px)] font-normal leading-[1.15] max-w-2xl"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                Диагностика маркетинга за 2 часа
              </p>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 1,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.9,
              }}
              className="mt-8 md:mt-10"
            >
              <button
                type="button"
                onClick={openPopup}
                className="inline-flex items-center gap-3 bg-white text-[#040082] px-7 py-3.5 text-[14px] md:px-10 md:py-5 md:text-[15px] font-normal rounded-full cursor-pointer hover:gap-4 transition-all duration-300"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Записаться на диагностику
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <p
                className="text-white/80 text-[12px] mt-4 font-medium max-w-lg leading-[1.5]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Офлайн в Алматы. Дата сессии — в течение 24 часов после заявки.
                Интервью с командой + анализ + brief с точками роста — через 48 часов
              </p>
            </motion.div>
          </div>

          {/* Right — Partner logos */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1,
              ease: [0.16, 1, 0.3, 1],
              delay: 1.1,
            }}
            className="flex items-center gap-3 md:gap-4 mt-12 md:mt-0 self-end"
          >
            <Image
              src="/Narxoz%20University%20Logo%20White.png"
              alt="Narxoz University"
              width={200}
              height={60}
              className="h-[20px] md:h-[28px] w-auto opacity-90"
              priority
            />
            <Image
              src="/NBS%20LOGO%20FULL%20WHITE.png"
              alt="Narxoz Business School"
              width={180}
              height={50}
              className="h-[10px] md:h-[14px] w-auto opacity-90"
              priority
            />
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator — desktop only */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:block"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 1 }}
      >
        <div className="w-px h-12 bg-white/20 relative overflow-hidden">
          <motion.div
            className="absolute top-0 left-0 w-full bg-white/60"
            animate={{
              height: ["0%", "100%", "0%"],
              top: ["0%", "0%", "100%"],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        </div>
      </motion.div>
    </section>
  );
}
