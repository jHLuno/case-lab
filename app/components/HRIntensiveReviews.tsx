"use client";

import { PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

// Reviews: cards sit on an arc (the centre one upright and highest, the side ones
// lower and tilted outwards) and the arc turns by itself; arrows, swipe and a
// progress line underneath. Companies are not named, so each card shows the
// author's role, industry and the session format instead.
// TODO(content): replace the placeholder reviews below with real ones.
type Review = {
  initials: string;
  author: string; // name if the person agreed, otherwise only the role
  role: string; // role, industry, company size
  quote: string;
  tag: string; // format or result of the session
};

const reviews: Review[] = [
  {
    initials: "HR",
    author: "HR-директор",
    role: "FMCG, 1 500+ сотрудников",
    quote: "Текст отзыва: что изменилось в команде после сессии и что стало понятнее про молодых кандидатов и клиентов.",
    tag: "Целый день",
  },
  {
    initials: "КД",
    author: "Коммерческий директор",
    role: "Дистрибуция, 300+ сотрудников",
    quote: "Текст отзыва: какой инсайт про молодых клиентов команда продаж забрала в работу.",
    tag: "Полдня",
  },
  {
    initials: "CMO",
    author: "Директор по маркетингу",
    role: "Ритейл, 800+ сотрудников",
    quote: "Текст отзыва: что поменяли в коммуникации бренда после блока о зумерах.",
    tag: "3 часа",
  },
  {
    initials: "CEO",
    author: "Генеральный директор",
    role: "Финансовые услуги, 2 000+ сотрудников",
    quote: "Текст отзыва: зачем руководству было важно пройти интенсив вместе с командой.",
    tag: "Целый день",
  },
  {
    initials: "HR",
    author: "Руководитель по найму",
    role: "IT, 150+ сотрудников",
    quote: "Текст отзыва: что изменилось в найме молодых специалистов после разбора EJM.",
    tag: "Полдня",
  },
];

const headingFont = { fontFamily: "var(--font-heading)" };
const bodyFont = { fontFamily: "var(--font-body)" };

const AUTOPLAY_MS = 3500;
// The list is repeated so the arc always has cards on both sides; repeats are hidden from screen readers.
const COPIES = reviews.length < 7 ? 2 : 1;
const slides = Array.from({ length: COPIES }, () => reviews).flat();

function ReviewCard({ review }: { review: Review }) {
  return (
    <figure className="flex h-full flex-col rounded-[20px] border border-white bg-[#eef0fb] p-6 shadow-[0_24px_50px_-28px_rgba(4,0,130,0.35)]">
      <figcaption className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full bg-[#040082] text-[12px] font-bold text-white"
          style={headingFont}
        >
          {review.initials}
        </span>
        <span className="min-w-0" style={bodyFont}>
          <span className="block text-[15px] font-medium text-black">{review.author}</span>
          <span className="block text-[12px] text-black/50">{review.role}</span>
        </span>
      </figcaption>
      <blockquote className="mt-5 flex-1 text-[15px] leading-[1.5] text-black/75" style={bodyFont}>
        <span aria-hidden="true" className="mr-1 text-[#040082]">
          «
        </span>
        {review.quote}
        <span aria-hidden="true" className="ml-0.5 text-[#040082]">
          »
        </span>
      </blockquote>
      <p className="mt-5 text-[11px] uppercase tracking-[0.1em] text-[#040082]/70" style={bodyFont}>
        Формат: {review.tag}
      </p>
    </figure>
  );
}

export default function HRIntensiveReviews() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [narrow, setNarrow] = useState(false);
  const dragStart = useRef<number | null>(null);
  const n = slides.length;

  useEffect(() => {
    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const width = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setReduceMotion(motion.matches);
      setNarrow(width.matches);
    };
    sync();
    motion.addEventListener("change", sync);
    width.addEventListener("change", sync);
    return () => {
      motion.removeEventListener("change", sync);
      width.removeEventListener("change", sync);
    };
  }, []);

  const go = useCallback((step: number) => setActive((current) => (current + step + n) % n), [n]);

  // The arc turns by itself; it stops on hover, focus and for reduced motion.
  useEffect(() => {
    if (paused || reduceMotion) return;
    const id = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, reduceMotion, go]);

  const onPointerDown = (e: PointerEvent) => {
    dragStart.current = e.clientX;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (dragStart.current === null) return;
    const dx = e.clientX - dragStart.current;
    dragStart.current = null;
    if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
  };

  // Geometry of the arc.
  const spacing = narrow ? 250 : 360;
  const drop = narrow ? 22 : 34; // how much lower each step away from the centre sits
  const tilt = narrow ? 6 : 8; // degrees per step

  const current = active % reviews.length;

  return (
    <section aria-labelledby="hr-reviews-title" className="overflow-hidden bg-white py-[48px] md:py-14 lg:py-16">
      <div className="mx-auto max-w-[1160px] px-6 md:px-10 xl:px-0">
        <span className="mb-3 block text-[11px] uppercase leading-[1.58] tracking-wider text-[#040082]" style={bodyFont}>
          Отзывы
        </span>
        <h2
          id="hr-reviews-title"
          className="text-[clamp(26px,3.8vw,52px)] font-bold uppercase leading-[1.06] tracking-[0.02em] text-black"
          style={headingFont}
        >
          Что говорят участники
        </h2>
        <p className="mt-5 max-w-[640px] text-[15px] leading-[1.55] text-black/60 lg:text-[17px]" style={bodyFont}>
          Названия компаний не раскрываем: указываем роль автора, отрасль и формат сессии.
        </p>
      </div>

      <div
        role="region"
        aria-roledescription="карусель"
        aria-label="Отзывы участников"
        className="relative mt-[32px] h-[330px] touch-pan-y select-none md:mt-[40px] md:h-[360px]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (dragStart.current = null)}
      >
        <ul>
          {slides.map((review, i) => {
            // Shortest signed distance from the active card, so the arc wraps around.
            let d = i - active;
            if (d > n / 2) d -= n;
            if (d < -n / 2) d += n;
            const hidden = Math.abs(d) > 2;
            const isCopy = i >= reviews.length;
            return (
              <li
                key={i}
                aria-hidden={isCopy || d !== 0 ? true : undefined}
                className="absolute left-1/2 top-0 w-[260px] md:w-[340px]"
                style={{
                  transform: `translateX(calc(-50% + ${d * spacing}px)) translateY(${d * d * drop}px) rotate(${d * tilt}deg)`,
                  transformOrigin: "50% 100%",
                  opacity: hidden ? 0 : 1,
                  zIndex: 10 - Math.abs(d),
                  transition: reduceMotion
                    ? "none"
                    : "transform 900ms cubic-bezier(0.16, 1, 0.3, 1), opacity 500ms ease",
                  pointerEvents: hidden ? "none" : undefined,
                }}
              >
                <ReviewCard review={review} />
              </li>
            );
          })}
        </ul>
      </div>

      {/* Controls: arrows and a progress line */}
      <div className="mx-auto mt-2 flex max-w-[1160px] items-center justify-between gap-6 px-6 md:px-10 xl:px-0">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="Предыдущий отзыв"
          className="grid h-[44px] w-[44px] place-items-center rounded-full border border-black/10 text-black transition-colors duration-200 hover:border-[#040082]/40 hover:text-[#040082]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div
          className="relative h-[2px] w-[160px] overflow-hidden rounded-full bg-black/10"
          role="progressbar"
          aria-label="Положение в карусели"
          aria-valuemin={1}
          aria-valuemax={reviews.length}
          aria-valuenow={current + 1}
        >
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-[#040082] transition-[left] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{ width: `${100 / reviews.length}%`, left: `${(current * 100) / reviews.length}%` }}
          />
        </div>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="Следующий отзыв"
          className="grid h-[44px] w-[44px] place-items-center rounded-full bg-[#040082] text-white transition-colors duration-200 hover:bg-[#0600a8]"
        >
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        Отзыв {current + 1} из {reviews.length}
      </p>
    </section>
  );
}
