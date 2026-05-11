"use client";

import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

export default function Footer() {
  return (
    <footer className="relative bg-white pt-20 md:pt-32 pb-8 px-6 md:px-10">
      {/* Top divider */}
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1078px] mx-auto">
        {/* CTA Section */}
        <div className="text-center mb-20 md:mb-28">
          <h2
            className="text-black text-[clamp(32px,5vw,64px)] font-bold leading-[1.05] uppercase tracking-[0.02em] mb-6"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Готовы обсудить
            <br />
            задачу?
          </h2>
          <p
            className="text-black/60 text-[16px] md:text-[18px] leading-[1.4] mb-8 max-w-md mx-auto font-light"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Заполните форму — мы свяжемся в течение рабочего дня. Первая консультация бесплатно.
          </p>
          <motion.a
            href="/contact/"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="inline-flex items-center gap-3 bg-[#040082] text-white px-8 py-4 text-[15px] font-normal rounded-full hover:bg-[#0600a0] transition-colors duration-300"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <span>Записаться на диагностику</span>
            <ArrowUpRight size={16} strokeWidth={2} />
          </motion.a>
        </div>

        {/* Minimal info row */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-8 mb-12">
          {/* Logo */}
          <div className="relative h-7 w-[160px]">
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
          <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
            <a
              href="mailto:hello@caselab.kz"
              className="text-black/60 text-[15px] hover:text-black transition-colors duration-300 font-light"
              style={{ fontFamily: "var(--font-body)" }}
            >
              hello@caselab.kz
            </a>
            <span
              className="text-black/20 text-[15px] font-light"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Алматы, Казахстан
            </span>
          </div>

          {/* Social */}
          <div className="flex items-center gap-6">
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
