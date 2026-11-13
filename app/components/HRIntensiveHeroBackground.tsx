"use client";

import dynamic from "next/dynamic";
import { useReducedMotion } from "framer-motion";

const Silk = dynamic(() => import("./Silk"), { ssr: false });

// Same background as the homepage hero (app/sections/Hero.tsx).
export default function HRIntensiveHeroBackground() {
  const shouldReduceMotion = useReducedMotion() ?? false;

  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="absolute inset-0 h-full w-full">
        {/* speed 0 freezes the silk pattern for reduced-motion users */}
        <Silk speed={shouldReduceMotion ? 0 : 5.1} scale={1} color="#040082" noiseIntensity={0.6} rotation={1.3} />
      </div>
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)",
          backgroundSize: "100px 100px",
        }}
      />
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, transparent 0%, rgba(0,0,17,0.6) 100%)" }}
      />
    </div>
  );
}
