"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { useLeadPopup } from "../lib/LeadPopupContext";

const defaultNavLinks = [
  { label: "Кейсы", href: "#cases" },
  { label: "Подход", href: "#diagnostics" },
  { label: "Процесс", href: "#process" },
  { label: "Результаты", href: "#testimonials" },
];

type NavLink = { label: string; href: string };

type NavbarProps = {
  accent?: "blue" | "emerald";
  logoSrc?: string;
  navLinks?: NavLink[];
  basePath?: string;
  ctaLabel?: string;
};

export default function Navbar({
  accent = "blue",
  logoSrc = "/Logo.png",
  navLinks = defaultNavLinks,
  basePath = "/",
  ctaLabel = "Записаться",
}: NavbarProps) {
  const pathname = usePathname();
  const { openPopup } = useLeadPopup();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [portalNode, setPortalNode] = useState<HTMLElement | null>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMobileMenu = () => setMobileOpen(false);
  const closeMobileMenuAndReturnFocus = () => {
    setMobileOpen(false);
    toggleRef.current?.focus();
  };
  const getNavHref = (href: string) => (pathname === basePath ? href : `${basePath}${href}`);

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
    const node = document.createElement("div");
    node.setAttribute("data-mobile-menu-root", "");
    document.body.appendChild(node);
    setPortalNode(node);

    return () => {
      node.remove();
      setPortalNode(null);
    };
  }, []);

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

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen || !portalNode) return;

    const siblings = Array.from(document.body.children).filter((node) => node !== portalNode);

    siblings.forEach((node) => {
      node.setAttribute("aria-hidden", "true");
      node.setAttribute("inert", "");
    });

    return () => {
      siblings.forEach((node) => {
        node.removeAttribute("aria-hidden");
        node.removeAttribute("inert");
      });
    };
  }, [mobileOpen, portalNode]);

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
          <Link href="/" className="flex items-center flex-shrink-0 px-1 md:px-2">
            <div className="relative w-32 h-11 md:w-[105px] md:h-[33px]">
              <Image
                src={logoSrc}
                alt="Case Lab"
                fill
                className="object-contain"
                priority
                loading="eager"
                sizes="(max-width: 768px) 128px, 105px"
              />
            </div>
          </Link>

          {/* Nav links */}
          <div className="hidden md:flex items-center">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={getNavHref(link.href)}
                className="px-4 py-2 text-[14px] font-normal leading-none rounded-full text-black/60 hover:text-black hover:bg-black/5 transition-colors duration-200"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* CTA */}
          <button
            type="button"
            onClick={openPopup}
            className={`hidden md:inline-flex items-center gap-2 rounded-full px-6 py-3 text-[14px] leading-none text-white transition-colors duration-200 ml-1 ${accent === "emerald" ? "font-medium bg-[#075C43] hover:bg-[#064B36]" : "font-normal bg-[#040082] hover:bg-[#0600a8]"}`}
            style={{ fontFamily: "var(--font-body)" }}
          >
            {ctaLabel}
            <ArrowRight size={13} strokeWidth={2.5} />
          </button>

          {/* Mobile menu button */}
          <motion.button
            ref={toggleRef}
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-full flex-shrink-0 text-black/60 hover:bg-black/5 transition-colors duration-200"
            aria-label="Открыть меню"
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            whileTap={{ scale: 0.94 }}
          >
            <Menu size={20} strokeWidth={1.5} />
          </motion.button>
        </div>
      </motion.nav>

      {/* Mobile Menu Overlay */}
      {portalNode && createPortal(
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
              exit={{ opacity: 0, y: -8, transition: { duration: 0.18, ease: [0.32, 0, 0.67, 0] } }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className="relative z-10 flex shrink-0 items-center justify-between px-6 pt-5 pb-3"
              style={{ paddingTop: "max(20px, calc(env(safe-area-inset-top) + 8px))" }}
            >
              <div className="relative h-10 w-[154px] rounded-full border border-white/60 bg-white px-4 py-2 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.35)]">
                <Image
                  src={logoSrc}
                  alt="Case Lab"
                  fill
                  className="object-contain p-1.5"
                  priority
                  sizes="154px"
                />
              </div>
              <motion.button
                type="button"
                onClick={closeMobileMenuAndReturnFocus}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors duration-200 active:bg-white/20"
                aria-label="Закрыть меню"
                whileTap={{ scale: 0.94, rotate: -6 }}
              >
                <X size={20} strokeWidth={1.75} />
              </motion.button>
            </motion.div>

            <div
              className="relative z-10 flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-10 pb-6"
              style={{ paddingBottom: "max(24px, calc(env(safe-area-inset-bottom) + 16px))" }}
            >
              <div className="flex flex-col gap-1">
                 {navLinks.map((link, i) => (
                  <motion.div
                      key={link.label}
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{
                        opacity: 0,
                       y: 10,
                        transition: { duration: 0.18, delay: (navLinks.length - 1 - i) * 0.03, ease: [0.32, 0, 0.67, 0] },
                      }}
                      transition={{ delay: i * 0.06 + 0.08, duration: 0.42 }}
                      className="flex"
                    >
                    <Link
                      href={getNavHref(link.href)}
                      onClick={closeMobileMenu}
                      className="group py-3 text-[clamp(30px,8vw,38px)] font-normal leading-[1.02] tracking-[-0.03em] text-white/92 transition-[color,transform] duration-200 active:translate-x-1 active:text-white focus-visible:outline-none focus-visible:text-white"
                      style={{ fontFamily: "var(--font-heading)" }}
                    >
                      <span className="inline-block border-b border-transparent pb-1 group-active:border-white/50 group-focus-visible:border-white/60">
                        {link.label}
                      </span>
                    </Link>
                   </motion.div>
                 ))}
               </div>

               <div className="mt-auto pt-10">
                 <motion.div
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: 10, transition: { duration: 0.18, delay: 0.04, ease: [0.32, 0, 0.67, 0] } }}
                    transition={{ delay: 0.34, duration: 0.42 }}
                  >
                    <motion.div whileTap={{ scale: 0.98, y: 1 }}>
                    <button
                      type="button"
                      onClick={() => { closeMobileMenu(); openPopup(); }}
                      className={`group inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] transition-transform duration-200 focus-visible:outline-none ${accent === "emerald" ? "font-medium text-[#075C43]" : "font-normal text-[#040082]"}`}
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {ctaLabel}
                      <ArrowRight size={14} strokeWidth={2.5} className="transition-transform duration-200 group-active:translate-x-0.5 group-focus-visible:translate-x-0.5" />
                    </button>
                    </motion.div>
                  </motion.div>

                <motion.p
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10, transition: { duration: 0.18, ease: [0.32, 0, 0.67, 0] } }}
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
        </AnimatePresence>,
        portalNode
      )}
    </>
  );
}
