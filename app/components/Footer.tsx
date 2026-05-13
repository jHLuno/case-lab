"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { useLeadPopup } from "../lib/LeadPopupContext";

export default function Footer() {
  const { openPopup } = useLeadPopup();
  return (
    <footer className="relative bg-white pt-20 md:pt-32 pb-8 px-6 md:px-10 z-[2]">
      {/* Top divider */}
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        {/* CTA Section */}
        <div className="text-center mb-20 md:mb-32">
          <h2
            className="text-black text-[clamp(24px,4vw,48px)] font-bold leading-[1.05] uppercase tracking-[0.02em] mb-6 md:mb-8 md:max-w-none"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <span className="md:whitespace-nowrap">Готовы обсудить задачу?</span>
          </h2>
          <p
            className="text-black/60 text-[15px] md:text-[18px] leading-[1.4] mb-10 md:mb-12 max-w-md mx-auto font-light"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Заполните форму — мы свяжемся в течение рабочего дня. Первая консультация бесплатно.
          </p>
          <motion.button
            type="button"
            onClick={openPopup}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-3 bg-[#040082] text-white px-7 py-3.5 text-[14px] md:px-8 md:py-4 md:text-[15px] font-normal rounded-full hover:bg-[#0600a0] transition-colors duration-300"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <span>Записаться на диагностику</span>
            <ArrowUpRight size={16} strokeWidth={2} />
          </motion.button>
        </div>

        {/* Minimal info row */}
        <div className="flex flex-col md:flex-row items-start justify-between gap-8 mb-12">
          {/* Logo */}
          <div className="relative h-7 w-[130px]">
            <Image
              src="/Logo.png"
              alt="Case Lab"
              fill
              className="object-contain"
              loading="lazy"
              sizes="160px"
            />
          </div>

          {/* Contact */}
          <div>
            <a
              href="mailto:hello@caselab.kz"
              className="text-black/60 text-[15px] hover:text-black transition-colors duration-300 font-light"
              style={{ fontFamily: "var(--font-body)" }}
            >
              hello@caselab.kz
            </a>
          </div>

          {/* Social */}
          <div className="flex flex-wrap items-center gap-4 md:gap-6">
            <a
              href="https://instagram.com/narxoz_business_school"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray text-[15px] font-light hover:text-black transition-colors duration-300"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Instagram Narxoz
            </a>
            <a
              href="https://instagram.com/kosnazzar"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray text-[15px] font-light hover:text-black transition-colors duration-300"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Instagram Kosnazzar
            </a>
            <a
              href="https://www.linkedin.com/in/daniyar-kosnazarov-300806110/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray text-[15px] font-light hover:text-black transition-colors duration-300"
              style={{ fontFamily: "var(--font-body)" }}
            >
              LinkedIn
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pt-6 border-t border-black/5">
          <span
            className="text-black/20 text-[12px] font-light"
            style={{ fontFamily: "var(--font-body)" }}
          >
            &copy; 2026 Case Lab. Все права защищены.
          </span>
          <div className="flex items-center gap-6">
            <a
              href="/privacy/"
              className="text-black/20 text-[12px] font-light hover:text-black/40 transition-colors duration-300"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Политика конфиденциальности
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
