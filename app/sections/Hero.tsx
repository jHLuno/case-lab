"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { useLeadPopup } from "../lib/LeadPopupContext";

const Silk = dynamic(() => import("../components/Silk"), { ssr: false });

export default function Hero() {
  const containerRef = useRef<HTMLElement>(null);
  const { openPopup } = useLeadPopup();

  return (
    <section
      ref={containerRef}
      aria-label="Главный экран"
      className="relative min-h-[100dvh] w-full overflow-hidden bg-[#000011] flex items-end"
    >
      {/* Silk background */}
      <div className="absolute inset-0 w-full h-full">
        <Silk
          speed={5.1}
          scale={1}
          color="#040082"
          noiseIntensity={0.6}
          rotation={1.3}
        />
      </div>

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
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.8,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.2,
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
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.35,
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
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.7,
                ease: [0.16, 1, 0.3, 1],
                delay: 0.5,
              }}
              className="mt-8 md:mt-10"
            >
              <button
                type="button"
                onClick={openPopup}
                className="inline-flex items-center gap-3 bg-white text-[#040082] px-7 py-3.5 text-[14px] md:px-10 md:py-5 md:text-[15px] font-normal rounded-full cursor-pointer hover:gap-4 transition-[gap,transform] duration-200"
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
                Офлайн в Алматы. Дата сессии — в течение 24ч после заявки.<br />
                Интервью + анализ + brief с точками роста — через 48 часов
              </p>
            </motion.div>
          </div>

          {/* Right — Partner logos */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.7,
              ease: [0.16, 1, 0.3, 1],
              delay: 0.65,
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
