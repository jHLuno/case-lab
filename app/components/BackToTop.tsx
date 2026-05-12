"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp } from "lucide-react";

export default function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisible = () => {
      setVisible(window.scrollY > 400);
    };

    window.addEventListener("scroll", toggleVisible, { passive: true });
    return () => window.removeEventListener("scroll", toggleVisible);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          onClick={scrollToTop}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="fixed bottom-6 right-6 z-50 w-14 h-14 md:w-16 md:h-16 rounded-full
                     bg-white/80 backdrop-blur-2xl
                     border border-black/15
                     shadow-[0_8px_32px_-8px_rgba(4,0,130,0.2)]
                     flex items-center justify-center
                     text-black/60 hover:text-[#040082]
                     hover:bg-white/95 hover:shadow-[0_12px_40px_-8px_rgba(4,0,130,0.3)]
                     hover:-translate-y-1
                     transition-all duration-300 cursor-pointer"
          aria-label="Наверх"
          title="Наверх"
        >
          <ArrowUp size={28} strokeWidth={2} />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
