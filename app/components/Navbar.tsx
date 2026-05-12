"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import Image from "next/image";

const navLinks = [
  { label: "Кейсы", href: "#industries" },
  { label: "Подход", href: "#diagnostics" },
  { label: "Процесс", href: "#process" },
  { label: "Результаты", href: "#testimonials" },
];

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Focus trap + Escape for mobile menu
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        toggleRef.current?.focus();
        return;
      }

      if (e.key === "Tab") {
        const focusable = menuRef.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])'
        );
        if (!focusable || focusable.length === 0) return;

        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    // Focus first link when menu opens
    const firstLink = menuRef.current?.querySelector<HTMLElement>("a");
    firstLink?.focus();

    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mobileOpen]);

  return (
    <>
      <motion.nav
        className="fixed top-4 md:top-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-30px)] md:w-auto"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <div
          className="relative flex items-center justify-between md:justify-start gap-1 rounded-full border border-black/10 bg-white/85 px-3 py-2.5 md:px-2 md:py-2 shadow-sm shadow-black/5"
        >
          <div
            className="absolute -inset-4 rounded-full backdrop-blur-[40px] -z-10"
            style={{ WebkitBackdropFilter: "blur(40px)" }}
            aria-hidden="true"
          />
          {/* Logo */}
          <a href="/" className="flex items-center flex-shrink-0 px-1 md:px-2">
            <div className="relative w-32 h-11 md:w-[105px] md:h-[33px]">
              <Image
                src="/Logo.png"
                alt="Case Lab"
                fill
                className="object-contain"
                priority
                loading="eager"
                sizes="(max-width: 768px) 128px, 105px"
              />
            </div>
          </a>

          {/* Nav links */}
          <div className="hidden md:flex items-center">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="px-4 py-2 text-[14px] font-normal leading-none rounded-full text-black/60 hover:text-black hover:bg-black/5 transition-all duration-300"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA */}
          <a
            href="/contact/"
            className="hidden md:inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-normal leading-none bg-[#040082] text-white hover:bg-[#0600a8] transition-all duration-300 ml-1"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Записаться
            <ArrowRight size={13} strokeWidth={2.5} />
          </a>

          {/* Mobile menu button */}
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 text-black/60 hover:bg-black/5 transition-colors duration-300"
            aria-label="Открыть меню"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            <Menu size={20} strokeWidth={1.5} />
          </button>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            ref={menuRef}
            id="mobile-menu"
            role="dialog"
            aria-modal="true"
            aria-label="Главное меню"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-[#02020a]/95 backdrop-blur-xl flex flex-col"
          >
            <div className="w-full flex items-center justify-between px-6 py-5">
              <div className="relative h-6 w-[140px]">
                <Image
                  src="/Logo.png"
                  alt="Case Lab"
                  fill
                  className="object-contain invert"
                  priority
                  sizes="140px"
                />
              </div>
              <button
                type="button"
                onClick={() => {
                  setMobileOpen(false);
                  toggleRef.current?.focus();
                }}
                className="text-white w-10 h-10 flex items-center justify-center"
                aria-label="Закрыть меню"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <div className="flex flex-col px-6 pt-12 gap-2">
              {navLinks.map((link, i) => (
                <motion.a
                  key={link.label}
                  href={link.href}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 + 0.1, duration: 0.4 }}
                  onClick={() => {
                    setMobileOpen(false);
                    toggleRef.current?.focus();
                  }}
                  className="text-white/90 text-[28px] font-normal leading-[1.2] py-3"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {link.label}
                </motion.a>
              ))}
              <motion.a
                href="/contact/"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.4 }}
                onClick={() => {
                  setMobileOpen(false);
                  toggleRef.current?.focus();
                }}
                className="inline-flex items-center gap-2 bg-white text-[#040082] rounded-full px-6 py-3 text-[14px] font-normal mt-6 self-start"
                style={{ fontFamily: "var(--font-body)" }}
              >
                Записаться
                <ArrowRight size={14} strokeWidth={2.5} />
              </motion.a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
