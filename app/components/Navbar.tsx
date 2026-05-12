"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navLinks = [
  { label: "Кейсы", href: "#industries" },
  { label: "Подход", href: "#diagnostics" },
  { label: "Процесс", href: "#process" },
  { label: "Результаты", href: "#testimonials" },
];

export default function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMobileMenu = () => setMobileOpen(false);
  const closeMobileMenuAndReturnFocus = () => {
    setMobileOpen(false);
    toggleRef.current?.focus();
  };
  const getNavHref = (href: string) => (pathname === "/" ? href : `/${href}`);

  // Focus trap + Escape for mobile menu
  useEffect(() => {
    if (!mobileOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeMobileMenuAndReturnFocus();
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

  useEffect(() => {
    if (!mobileOpen) return;

    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
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
          className="flex items-center justify-between md:justify-start gap-1 rounded-full border border-black/10 bg-white/85 backdrop-blur-xl px-3 py-2.5 md:px-2 md:py-2 shadow-[0_4px_20px_-4px_rgba(0,0,0,0.15)]"
        >
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
                href={getNavHref(link.href)}
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
            className="fixed inset-0 z-[60] flex flex-col overflow-hidden bg-[#040082] text-white"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_75%_30%,rgba(120,150,255,0.22),transparent_28%),linear-gradient(180deg,#0a0f9f_0%,#040082_45%,#03045e_100%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.08),transparent_28%)]" />
            <div className="absolute inset-x-0 top-0 h-px bg-white/20" />

            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.18, ease: "easeInOut" } }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative z-10 flex shrink-0 items-center justify-between px-6 pt-5 pb-3"
            >
              <div className="relative h-8 w-[148px] rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
                <Image
                  src="/Logo.png"
                  alt="Case Lab"
                  fill
                  className="object-contain p-2"
                  priority
                  sizes="148px"
                />
              </div>
              <button
                type="button"
                onClick={closeMobileMenuAndReturnFocus}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors duration-300 active:bg-white/20"
                aria-label="Закрыть меню"
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            </motion.div>

            <div className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-10 pb-6">
              <div className="flex flex-col gap-1">
                {navLinks.map((link, i) => (
                 <motion.a
                     key={link.label}
                     href={getNavHref(link.href)}
                     initial={{ opacity: 0, y: 18 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{
                       opacity: 0,
                       y: 10,
                       transition: { duration: 0.18, delay: (navLinks.length - 1 - i) * 0.03, ease: "easeInOut" },
                      }}
                      transition={{ delay: i * 0.06 + 0.08, duration: 0.42 }}
                      onClick={closeMobileMenu}
                     className="group py-3 text-[clamp(30px,8vw,38px)] font-normal leading-[1.02] tracking-[-0.03em] text-white/92 transition-all duration-300 active:translate-x-1 active:text-white"
                     style={{ fontFamily: "var(--font-heading)" }}
                   >
                    <span className="inline-block border-b border-transparent pb-1 group-active:border-white/50">
                      {link.label}
                    </span>
                  </motion.a>
                ))}
              </div>

              <div className="mt-auto pt-10">
                <motion.a
                  href="/contact/"
                   initial={{ opacity: 0, y: 18 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, y: 10, transition: { duration: 0.18, delay: 0.04, ease: "easeInOut" } }}
                   transition={{ delay: 0.34, duration: 0.42 }}
                   onClick={closeMobileMenu}
                   className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] font-normal text-[#040082] transition-transform duration-300 active:scale-[0.98]"
                   style={{ fontFamily: "var(--font-body)" }}
                 >
                  Записаться
                  <ArrowRight size={14} strokeWidth={2.5} />
                </motion.a>

                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10, transition: { duration: 0.18, ease: "easeInOut" } }}
                  transition={{ delay: 0.4, duration: 0.42 }}
                  className="mt-4 max-w-[260px] text-[13px] leading-[1.45] text-white/68"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  Диагностика маркетинга для команд, которым нужен ясный следующий шаг.
                </motion.p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
