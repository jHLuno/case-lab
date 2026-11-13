"use client";

import { useEffect, useRef } from "react";

// Port of the "Step progress" motion component (designbookmark.com/motion#db-step-progress).
// Same spring physics and values as the original: the line's length springs to the
// current step, a finished step fills and draws a check, the current one pops.
// Springs are "stiffness damping" with mass 1, integrated in 4 substeps per frame.

type Spring = { x: number; v: number; t: number; k: number; c: number };
const spring = (x: number, k: number, c: number): Spring => ({ x, v: 0, t: x, k, c });
const stepSpring = (s: Spring, dt: number) => {
  const a = -s.k * (s.x - s.t) - s.c * s.v;
  s.v += a * dt;
  s.x += s.v * dt;
};
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

const LINE = [160, 22] as const; // line length
const FILL = [260, 24] as const; // finished step fill
const CHECK = [140, 20] as const; // check drawing itself
const POP = [500, 14] as const; // pop when a step becomes current
const ON = [300, 26] as const; // current step highlight
const CHECK_DELAY = 0.12; // seconds before the check starts drawing

const ACCENT = "#040082";
const CHECK_LENGTH = 22;

type Props = {
  steps: string[];
  current: number;
  /** Mark the last step as finished too (e.g. after the request was sent). */
  complete?: boolean;
};

export default function StepProgress({ steps, current, complete = false }: Props) {
  const barRef = useRef<HTMLSpanElement>(null);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const numRefs = useRef<(HTMLElement | null)[]>([]);
  const pathRefs = useRef<(SVGPathElement | null)[]>([]);
  const springs = useRef<{ line: Spring; items: { f: Spring; c: Spring; p: Spring; on: Spring }[] } | null>(null);
  const timers = useRef<number[]>([]);
  const prev = useRef<number | null>(null);
  const n = steps.length;

  if (springs.current == null) {
    springs.current = {
      line: spring(0, ...LINE),
      items: steps.map(() => ({ f: spring(0, ...FILL), c: spring(0, ...CHECK), p: spring(1, ...POP), on: spring(0, ...ON) })),
    };
  }

  // Retarget springs whenever the step changes.
  useEffect(() => {
    const s = springs.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const i = clamp(current, 0, n - 1);
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];

    s.line.t = n > 1 ? i / (n - 1) : 0;
    s.items.forEach((item, k) => {
      const done = k < i || (complete && k === n - 1);
      item.f.t = done ? 1 : 0;
      item.on.t = k === i && !done ? 1 : 0;
      if (done) {
        if (reduce) item.c.t = 1;
        else timers.current.push(window.setTimeout(() => (item.c.t = 1), CHECK_DELAY * 1000));
      } else item.c.t = 0;
    });

    if (reduce || prev.current === null) {
      // Jump straight to the target: first render, or reduced motion.
      [s.line, ...s.items.flatMap((it) => [it.f, it.c, it.on])].forEach((sp) => {
        sp.x = sp.t;
        sp.v = 0;
      });
    } else if (prev.current !== i) {
      s.items[i].p.x = 0.7;
      s.items[i].p.v = 6;
    }
    prev.current = i;
  }, [current, complete, n]);

  // One rAF loop with 4 substeps, as in the original engine.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const s = springs.current!;
      const dt = Math.min((now - last) / 1000, 1 / 30);
      last = now;
      for (let k = 0; k < 4; k++) {
        stepSpring(s.line, dt / 4);
        s.items.forEach((it) => {
          stepSpring(it.f, dt / 4);
          stepSpring(it.c, dt / 4);
          stepSpring(it.p, dt / 4);
          stepSpring(it.on, dt / 4);
        });
      }
      if (barRef.current) barRef.current.style.width = `${(clamp(s.line.x, 0, 1) * 100).toFixed(3)}%`;
      s.items.forEach((it, k) => {
        const dot = dotRefs.current[k];
        if (!dot) return;
        const f = clamp(it.f.x, 0, 1);
        const o = clamp(it.on.x, 0, 1);
        // Done: brand blue fill. Current: dark fill. Otherwise: light surface.
        dot.style.background =
          f > 0.01
            ? `color-mix(in srgb, ${ACCENT} ${(f * 100).toFixed(1)}%, #ffffff)`
            : o > 0.01
              ? `color-mix(in srgb, #0a0a0a ${(o * 100).toFixed(1)}%, #ffffff)`
              : "";
        dot.style.color = o > 0.5 ? "#ffffff" : "";
        dot.style.transform = `scale(${it.p.x.toFixed(4)})`;
        const num = numRefs.current[k];
        if (num) num.style.opacity = (1 - f).toFixed(3);
        const path = pathRefs.current[k];
        if (path) path.style.strokeDashoffset = (CHECK_LENGTH * (1 - clamp(it.c.x, 0, 1))).toFixed(2);
      });
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      timers.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const pos = (i: number) => `${n > 1 ? (i / (n - 1)) * 100 : 0}%`;

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <div className="relative mx-[14px] h-[32px]" aria-hidden="true">
        <span className="absolute left-0 right-0 top-[14px] h-[4px] rounded-[2px] bg-black/10" />
        <span ref={barRef} className="absolute left-0 top-[14px] h-[4px] w-0 rounded-[2px] bg-[#040082]" />
        {steps.map((name, i) => (
          <span
            key={name}
            ref={(el) => {
              dotRefs.current[i] = el;
            }}
            className="absolute top-0 -ml-[16px] grid h-[32px] w-[32px] place-items-center rounded-full bg-[#f5f5f5] text-[13px] font-bold text-black/45 will-change-transform"
            style={{ left: pos(i) }}
          >
            <b
              ref={(el) => {
                numRefs.current[i] = el;
              }}
              className="absolute font-[inherit]"
            >
              {i + 1}
            </b>
            <svg viewBox="0 0 24 24" className="absolute h-4 w-4" fill="none" stroke="#ffffff" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round">
              <path
                ref={(el) => {
                  pathRefs.current[i] = el;
                }}
                d="M5 12.5l4.5 4.5L19 7.5"
                style={{ strokeDasharray: CHECK_LENGTH, strokeDashoffset: CHECK_LENGTH }}
              />
            </svg>
          </span>
        ))}
      </div>
      <ol className="relative mx-[14px] mt-[10px] h-[18px]">
        {steps.map((name, i) => (
          <li
            key={name}
            aria-current={i === current ? "step" : undefined}
            className={`absolute top-0 -translate-x-1/2 whitespace-nowrap text-[12px] transition-colors duration-300 ${
              i <= current ? "text-black" : "text-black/40"
            }`}
            style={{ left: pos(i) }}
          >
            {name}
          </li>
        ))}
      </ol>
    </div>
  );
}
