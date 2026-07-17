"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useReducedMotion } from "framer-motion";
import EVPStarburst from "../components/EVPStarburst";

const facilitators = [
  {
    name: "Данияр Косназаров",
    role: "Ведущий",
    description: "Советник президента Narxoz University, основатель Case Lab, ex-CMO Qazaq Republic и KPMG. 50+ компаний в консалтинге.",
    photo: "/daniyar-kosnazarov.webp",
    position: "center 20%",
    scale: "140%",
  },
  {
    name: "Амиржан Жампеисов",
    role: "Со-ведущий",
    description: "CEO Founder's Hub, ex-Founder ARN Labs, координатор проекта Case Lab. Развитие стартапов и работа с предпринимательскими проектами.",
    photo: "/amirzhan-zhampeisov.webp",
    position: "center 15%",
    scale: "100%",
  },
];

function FacilitatorPortrait({ facilitator }: { facilitator: (typeof facilitators)[number] }) {
  const portraitRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const [colorProgress, setColorProgress] = useState(0);

  useEffect(() => {
    if (shouldReduceMotion) {
      setColorProgress(1);
      return;
    }

    let frame: number | undefined;
    const updateProgress = () => {
      const portrait = portraitRef.current;
      if (!portrait) return;

      const start = window.innerHeight * 0.92;
      const end = window.innerHeight * 0.45;
      const nextProgress = Math.min(Math.max((start - portrait.getBoundingClientRect().top) / (start - end), 0), 1);
      setColorProgress((current) => (Math.abs(current - nextProgress) < 0.01 ? current : nextProgress));
      frame = undefined;
    };
    const requestUpdate = () => {
      if (frame !== undefined) return;
      frame = window.requestAnimationFrame(updateProgress);
    };

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    requestUpdate();

    return () => {
      window.removeEventListener("scroll", requestUpdate);
      window.removeEventListener("resize", requestUpdate);
      if (frame !== undefined) window.cancelAnimationFrame(frame);
    };
  }, [shouldReduceMotion]);

  return (
    <div
      ref={portraitRef}
      className="evp-facilitator-portrait relative aspect-[4/3] overflow-hidden rounded-[24px] bg-[#075C43]/10"
    >
      <Image
        src={facilitator.photo}
        alt={facilitator.name}
        fill
        sizes="(max-width: 767px) 100vw, 50vw"
        className="evp-facilitator-image object-cover"
        style={{
          objectPosition: facilitator.position,
          scale: facilitator.scale,
          filter: `grayscale(${Math.round((1 - colorProgress) * 100)}%)`,
        }}
      />
    </div>
  );
}

export default function EVPProFacilitators() {
  return (
    <section id="facilitators" aria-labelledby="evp-facilitators-title" className="relative bg-white px-6 pb-12 pt-10 md:px-10 md:pb-20 md:pt-16">
      <div className="absolute top-0 left-0 h-px w-full divider-gradient" />

      <div className="relative mx-auto max-w-[1440px]">
        <div data-evp-reveal className="relative">
          <EVPStarburst
            className="evp-starburst-orbit pointer-events-none absolute right-30 top-[calc(50%-30px)] -z-10 hidden h-40 w-40 text-[#075C43] md:block md:h-48 md:w-48 lg:h-56 lg:w-56"
          />
          <h2
            id="evp-facilitators-title"
            className="max-w-[13ch] text-[clamp(29px,4.4vw,56px)] font-bold leading-[1.06] tracking-[0.02em] uppercase text-black"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Кто проведёт <span className="text-[#075C43]">EVP Pro</span>
          </h2>
          <p
            className="mt-5 max-w-[46ch] text-[15px] leading-[1.5] text-black/55 md:text-[17px]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Два взгляда на одну задачу: стратегия бренда и опыт работы с командами и основателями.
          </p>
        </div>

        <div className="mt-14 grid gap-14 md:mt-20 md:grid-cols-2 md:gap-x-16 md:gap-y-0">
          {facilitators.map((facilitator, index) => (
            <article
              key={facilitator.name}
              data-evp-reveal
              style={{ transitionDelay: `${index * 140}ms` }}
            >
              <FacilitatorPortrait facilitator={facilitator} />

              <div className="mt-7 md:mt-9">
                <p
                  className="mb-3 inline-flex w-fit rounded-full border border-white/25 bg-[#075C43] px-4 py-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/90 md:px-5 md:text-[12px]"
                  style={{ fontFamily: "var(--font-body)" }}
                >
                  {facilitator.role}
                </p>
                <h3
                  className="text-[22px] font-bold uppercase leading-[1.15] tracking-[0.02em] text-black md:text-[28px]"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  {facilitator.name}
                </h3>
                <p
                  data-evp-reveal
                  className="mt-4 max-w-[46ch] text-[15px] leading-[1.5] text-black/65 md:text-[16px]"
                  style={{ fontFamily: "var(--font-body)", transitionDelay: `${index * 140 + 160}ms` }}
                >
                  {facilitator.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
