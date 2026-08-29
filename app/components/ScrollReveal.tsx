"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { useRef, useSyncExternalStore, type ReactNode } from "react";

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

interface ScrollRevealProps {
  children: ReactNode;
  delay?: number;
  className?: string;
  direction?: "up" | "down" | "left" | "right";
  forceMotion?: boolean;
}

export default function ScrollReveal({
  children,
  delay = 0,
  className = "",
  direction = "up",
  forceMotion = false,
}: ScrollRevealProps) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });
  const hydrated = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const shouldReduceMotion = forceMotion ? false : prefersReducedMotion;

  const directions = {
    up: { y: 24, x: 0 },
    down: { y: -24, x: 0 },
    left: { x: 24, y: 0 },
    right: { x: -24, y: 0 },
  };

  return (
    <motion.div
      ref={ref}
      initial={false}
      animate={shouldReduceMotion
        ? { opacity: !hydrated || isInView ? 1 : 0 }
        : !hydrated || isInView
          ? { opacity: 1, x: 0, y: 0 }
          : { opacity: 0, ...directions[direction] }}
      transition={shouldReduceMotion
        ? { duration: 0 }
        : { duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
