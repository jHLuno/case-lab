"use client";

import { PointerEvent, useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";

// Reviews: five cards on an arc (the centre one upright and highest, the side ones
// lower and tilted outwards). The arc turns continuously like a marquee and stops
// on hover; arrows, swipe/drag and a progress line underneath. Companies are not named, so each card shows the
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

// One card passes the centre every SECONDS_PER_CARD while the arc turns.
const SECONDS_PER_CARD = 5;

// Card size and step along the arc for a given stage width: three cards fit on screen.
function arcGeometry(width: number) {
  const cardW = width < 768 ? Math.min(340, width * 0.78) : Math.max(300, Math.min(460, width * 0.36));
  return { cardW, spacing: cardW * (width < 768 ? 1.04 : 1.1), drop: cardW * 0.1 };
}

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
  const n = reviews.length;
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLLIElement | null)[]>([]);
  const thumbRef = useRef<HTMLSpanElement>(null);
  const [current, setCurrent] = useState(0);
  // Animation state lives in refs: the loop writes styles directly, without re-rendering.
  const pos = useRef(0); // continuous position on the arc, in cards
  const target = useRef<number | null>(null); // set by arrows: glide to this card, then resume
  const paused = useRef(false);
  const drag = useRef<{ x: number; pos: number } | null>(null);
  const reduceMotion = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reduceMotion.current = mq.matches;
    const onChange = () => (reduceMotion.current = mq.matches);
    mq.addEventListener("change", onChange);

    let raf = 0;
    let last = performance.now();
    let shown = 0;
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 1 / 20);
      last = now;

      if (drag.current === null) {
        if (target.current !== null) {
          // Ease towards the chosen card.
          const delta = target.current - pos.current;
          pos.current += delta * Math.min(1, dt * 6);
          if (Math.abs(delta) < 0.001) {
            pos.current = target.current;
            target.current = null;
          }
        } else if (!paused.current && !reduceMotion.current) {
          pos.current += dt / SECONDS_PER_CARD;
        }
      }

      const stage = stageRef.current;
      const width = stage?.clientWidth ?? 1200;
      // Three cards on screen: the centre one and one on each side.
      const { cardW, spacing, drop } = arcGeometry(width);
      const tilt = 7;

      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        let d = (((i - pos.current) % n) + n) % n; // 0..n
        if (d > n / 2) d -= n; // shortest signed distance from the centre
        const fade = Math.max(0, Math.min(1, (1.75 - Math.abs(d)) / 0.4));
        el.style.width = `${cardW}px`;
        el.style.transform = `translateX(calc(-50% + ${d * spacing}px)) translateY(${d * d * drop}px) rotate(${d * tilt}deg)`;
        el.style.opacity = String(fade);
        el.style.zIndex = String(Math.round(10 - Math.abs(d) * 2));
        el.style.pointerEvents = fade < 0.2 ? "none" : "";
      });

      const wrapped = ((pos.current % n) + n) % n;
      if (thumbRef.current) thumbRef.current.style.left = `${(wrapped / n) * 100}%`;
      const nearest = Math.round(wrapped) % n;
      if (nearest !== shown) {
        shown = nearest;
        setCurrent(nearest);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      mq.removeEventListener("change", onChange);
    };
  }, [n]);

  const step = (dir: 1 | -1) => {
    const base = target.current ?? Math.round(pos.current);
    target.current = base + dir;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    drag.current = { x: e.clientX, pos: pos.current };
    target.current = null;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag.current || !stageRef.current) return;
    const { spacing } = arcGeometry(stageRef.current.clientWidth);
    pos.current = drag.current.pos - (e.clientX - drag.current.x) / spacing;
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    target.current = Math.round(pos.current); // settle on the nearest card
  };

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
        ref={stageRef}
        role="region"
        aria-roledescription="карусель"
        aria-label="Отзывы участников"
        className="relative mt-[32px] h-[290px] cursor-grab touch-pan-y select-none active:cursor-grabbing md:mt-[40px] md:h-[300px]"
        onMouseEnter={() => (paused.current = true)}
        onMouseLeave={() => (paused.current = false)}
        onFocus={() => (paused.current = true)}
        onBlur={() => (paused.current = false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        <ul>
          {reviews.map((review, i) => (
            <li
              key={i}
              ref={(el) => {
                cardRefs.current[i] = el;
              }}
              aria-hidden={i !== current ? true : undefined}
              className="absolute left-1/2 top-0 will-change-transform"
              style={{ transformOrigin: "50% 100%", width: 340 }}
            >
              <ReviewCard review={review} />
            </li>
          ))}
        </ul>
      </div>

      {/* Controls: arrows and a progress line */}
      <div className="mx-auto mt-2 flex max-w-[1160px] items-center justify-between gap-6 px-6 md:px-10 xl:px-0">
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label="Предыдущий отзыв"
          className="grid h-[44px] w-[44px] place-items-center rounded-full border border-black/10 text-black transition-colors duration-200 hover:border-[#040082]/40 hover:text-[#040082]"
        >
          <ArrowLeft size={18} aria-hidden="true" />
        </button>
        <div className="relative h-[2px] w-[160px] overflow-hidden rounded-full bg-black/10" aria-hidden="true">
          <span ref={thumbRef} className="absolute inset-y-0 left-0 rounded-full bg-[#040082]" style={{ width: `${100 / n}%` }} />
        </div>
        <button
          type="button"
          onClick={() => step(1)}
          aria-label="Следующий отзыв"
          className="grid h-[44px] w-[44px] place-items-center rounded-full bg-[#040082] text-white transition-colors duration-200 hover:bg-[#0600a8]"
        >
          <ArrowRight size={18} aria-hidden="true" />
        </button>
      </div>
      <p className="sr-only" aria-live="polite">
        Отзыв {current + 1} из {n}
      </p>
    </section>
  );
}
