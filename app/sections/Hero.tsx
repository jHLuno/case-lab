"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";

export default function Hero() {
  const containerRef = useRef<HTMLElement>(null);

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
      className="relative min-h-screen w-full overflow-hidden bg-[#000011] flex items-end"
    >
      {/* Background video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        className="absolute inset-0 w-full h-full object-cover"
      >
        <source src="/Video-Demo.webm" type="video/webm" />
        <source src="/Video-Demo.mp4" type="video/mp4" />
      </video>

      {/* Atmospheric gradient orbs overlaid on video */}
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
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-end justify-between gap-12 md:gap-20">
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
                className="text-white text-[clamp(32px,5vw,72px)] font-bold leading-none tracking-[0.02em] uppercase whitespace-nowrap"
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
              <motion.a
                href="/contact/"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="inline-flex items-center gap-3 bg-white text-[#040082] px-8 py-4 text-[15px] font-normal rounded-full"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Записаться на диагностику
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" className="flex-shrink-0">
                  <path d="M3 8H13M13 8L9 4M13 8L9 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.a>
              <p
                className="text-white/80 text-[12px] mt-4 font-medium max-w-lg leading-[1.5]"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Офлайн в Алматы. Дата сессии — в течение 24 часов после заявки.
                Интервью с командой + анализ + brief с точками роста — через 48 часов
              </p>
            </motion.div>
          </div>

          {/* Right — Social proof */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 1,
              ease: [0.16, 1, 0.3, 1],
              delay: 1.1,
            }}
            className="md:max-w-[380px] md:text-right flex flex-col justify-end"
          >
            <p
              className="text-white/90 text-[11px] uppercase tracking-wider mb-4 font-medium"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Уже провели диагностику
            </p>
            <div className="flex flex-wrap md:justify-end gap-x-4 gap-y-2">
              {["Hero's Journey", "inDrive", "abr", "Shetel"].map((name) => (
                <span
                  key={name}
                  className="text-white/90 text-[14px] font-medium"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {name}
                </span>
              ))}
            </div>
          </motion.div>
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
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
