"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowUp } from "lucide-react";

export default function BackToTop({ forceMotion = false }: { forceMotion?: boolean }) {
  const [visible, setVisible] = useState(false);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const shouldReduceMotion = forceMotion ? false : prefersReducedMotion;

  useEffect(() => {
    const toggleVisible = () => {
      setVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", toggleVisible, { passive: true });
    return () => window.removeEventListener("scroll", toggleVisible);
  }, []);

  const scrollToTop = () => {
    if (shouldReduceMotion) {
      window.scrollTo({ top: 0, behavior: "auto" });
      return;
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          onClick={scrollToTop}
          initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          animate={shouldReduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 20 }}
          transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.3, ease: "easeOut" }}
            className="motion-control fixed bottom-4 right-4 md:bottom-6 md:right-6 z-50 h-11 w-11 md:w-14 md:h-14 rounded-full
                     bg-white/80 backdrop-blur-2xl
                     border border-black/15
                     shadow-[0_8px_32px_-8px_rgba(4,0,130,0.2)]
                     flex items-center justify-center
                     text-black/60 hover:text-[#040082]
                     hover:bg-white/95 hover:shadow-[0_12px_40px_-8px_rgba(4,0,130,0.3)]
                     hover:-translate-y-1
                     transition-[background-color,box-shadow,transform,color] duration-200 cursor-pointer"
          aria-label="Наверх"
          title="Наверх"
        >
          <ArrowUp size={20} strokeWidth={2.5} className="md:w-7 md:h-7" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
