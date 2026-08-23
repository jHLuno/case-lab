# Case Lab 3 Process And Testimonials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the new third `Как проходит Case Lab` section, move the testimonial section to fourth position, and prepare it for lazy external 9:16 video players.

**Architecture:** Keep `CaseLab3Page` as the page-order composition root. Add a static server-rendered `CaseLab3HowItWorks` section. Keep `CaseLab3Proof` as a focused client component with one active testimonial player at a time; initial markup contains optimized poster images only, and an iframe is mounted only after the user activates a configured external embed URL.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, CSS Modules, `next/image`, existing `ScrollReveal`, existing Case Lab Benzin/Gilroy tokens.

## Global Constraints

- Original video files do not enter `public/`, the Git repository, or the primary application host.
- Use optional external `embedUrl` values; empty URLs render a poster-only state without a broken media request.
- Do not autoplay, preload, or mount three or four iframes at once.
- Reserve the 9:16 media box to prevent layout shift.
- Use `aria-expanded`, `aria-controls`, and descriptive iframe titles for active players.
- Preserve the existing reduced-motion behavior and do not add scroll hijacking to either section.
- Do not add dependencies, environment variables, database changes, or public video assets.
- Preserve all unrelated dirty worktree changes.

---

### Task 1: Add The How Case Lab Works Section

**Files:**
- Create: `app/sections/CaseLab3HowItWorks.tsx`
- Modify: `app/components/CaseLab3Page.tsx`
- Modify: `app/case-lab-3/case-lab-3.module.css`

**Interfaces:**
- Consumes: existing `styles` CSS module and page composition.
- Produces: a section with `id="case-lab-3-how-it-works"` and heading id `case-lab-3-how-it-works-title` inserted after `CaseLab3Speakers` and before `CaseLab3Proof`.

- [x] **Step 1: Add the static section component**

Create `CaseLab3HowItWorks.tsx` with a local ordered `steps` array and the complete supplied meaning distributed into five steps. Keep the component server-rendered: do not add `"use client"`, GSAP, Motion, or event handlers.

```tsx
import styles from "../case-lab-3/case-lab-3.module.css";

const steps = [
  {
    title: "CMO приносит свой кейс",
    body: "Он показывает контекст: с чего всё началось, какая была проблема и какие ограничения стояли перед командой.",
  },
  {
    title: "Зал предлагает решения",
    body: "Участники разбирают ситуацию, предлагают свои варианты и пытаются угадать, что команда сделала на самом деле.",
  },
  {
    title: "Спикер раскрывает реальный ход событий",
    body: "После обсуждения CMO показывает, какие решения приняли, что сработало, где ошиблись и к какому результату пришли.",
  },
  {
    title: "Точные ответы превращаются в баллы",
    body: "Баллы попадают в общий scoreboard, который обновляется по ходу вечера.",
  },
  {
    title: "В финале определяем топ-3",
    body: "Участники Case Lab III, которые лучше всех разбирались в кейсах и чаще попадали в реальные решения команд, получат призы.",
  },
] as const;

export default function CaseLab3HowItWorks() {
  return (
    <section
      id="case-lab-3-how-it-works"
      className={styles.howItWorksSection}
      aria-labelledby="case-lab-3-how-it-works-title"
    >
      <div className={styles.howItWorksLayout}>
        <div className={styles.howItWorksIntro}>
          <p className={styles.howItWorksKicker}>Внутри Case Lab</p>
          <h2 id="case-lab-3-how-it-works-title">Как проходит Case Lab</h2>
          <p className={styles.howItWorksOutcome}>
            Здесь не слушают готовые лекции. Зал вместе с CMO проходит путь от проблемы до решения.
          </p>
          <div className={styles.howItWorksScoreboard}>
            <strong>TOP 3</strong>
            <span>участника Case Lab III получат призы</span>
          </div>
        </div>

        <ol className={styles.howItWorksSteps}>
          {steps.map((step, index) => (
            <li key={step.title} className={styles.howItWorksStep}>
              <span className={styles.howItWorksStepNumber}>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
```

- [x] **Step 2: Insert the section into the page order**

In `CaseLab3Page.tsx`, import `CaseLab3HowItWorks` and render it directly after `<CaseLab3Speakers />`:

```tsx
<CaseLab3Speakers />
<CaseLab3HowItWorks />
<CaseLab3Proof />
```

Do not alter the archive, ticket, footer, or checkout wiring.

- [x] **Step 3: Add responsive styles for the new section**

Add module styles using the existing `#040082`, white, `var(--font-heading)`, and `var(--font-body)` tokens. Use a two-column desktop layout with the process rail on the right and a one-column mobile fallback. The ordered list may use number markers because the order is meaningful.

```css
.howItWorksSection {
  margin-top: var(--case-lab-content-next-headline-gap);
  padding: clamp(52px, 8vw, 112px) 24px;
  background: #040082;
  color: #fff;
}

.howItWorksLayout {
  display: grid;
  grid-template-columns: minmax(240px, .75fr) minmax(0, 1.25fr);
  gap: clamp(36px, 9vw, 144px);
  width: min(100%, 1320px);
  margin: 0 auto;
}

.howItWorksIntro {
  position: sticky;
  top: 32px;
  align-self: start;
}

.howItWorksKicker {
  margin: 0 0 20px;
  color: #c8d9f3;
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
}

.howItWorksIntro h2 {
  max-width: 8ch;
  margin: 0;
  font-size: clamp(34px, 5vw, 68px);
  line-height: .96;
  letter-spacing: -.035em;
}

.howItWorksOutcome {
  max-width: 30ch;
  margin: 28px 0 0;
  color: rgba(255, 255, 255, .72);
  font-size: 17px;
  line-height: 1.45;
}

.howItWorksScoreboard {
  display: flex;
  align-items: end;
  gap: 12px;
  margin-top: clamp(42px, 8vw, 100px);
  padding-top: 18px;
  border-top: 1px solid rgba(255, 255, 255, .28);
}

.howItWorksScoreboard strong {
  font-family: var(--font-heading);
  font-size: clamp(32px, 4vw, 58px);
  font-weight: 400;
  line-height: .8;
  letter-spacing: -.05em;
}

.howItWorksScoreboard span {
  max-width: 16ch;
  color: rgba(255, 255, 255, .68);
  font-size: 12px;
  line-height: 1.25;
}

.howItWorksSteps {
  display: grid;
  gap: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.howItWorksStep {
  display: grid;
  grid-template-columns: 52px minmax(0, 1fr);
  gap: 18px;
  padding: 24px 0;
  border-top: 1px solid rgba(255, 255, 255, .24);
}

.howItWorksStep:last-child {
  border-bottom: 1px solid rgba(255, 255, 255, .24);
}

.howItWorksStepNumber {
  color: #afa8ff;
  font-family: var(--font-heading);
  font-size: 18px;
}

.howItWorksStep h3 {
  margin: 0;
  font-size: clamp(19px, 2vw, 28px);
  line-height: 1;
  letter-spacing: -.025em;
}

.howItWorksStep p {
  max-width: 52ch;
  margin: 12px 0 0;
  color: rgba(255, 255, 255, .7);
  font-size: 16px;
  line-height: 1.45;
}

@media (max-width: 767px) {
  .howItWorksSection {
    margin-top: var(--case-lab-content-next-headline-gap);
    padding-right: 16px;
    padding-left: 16px;
  }

  .howItWorksLayout {
    display: block;
  }

  .howItWorksIntro {
    position: static;
  }

  .howItWorksIntro h2 {
    max-width: 10ch;
    font-size: 32px;
  }

  .howItWorksScoreboard {
    margin-top: 42px;
    margin-bottom: 34px;
  }

  .howItWorksStep {
    grid-template-columns: 36px minmax(0, 1fr);
    gap: 12px;
    padding: 20px 0;
  }
}
```

- [x] **Step 4: Run the type check for the new section**

Run: `npx tsc --noEmit --incremental false`

Expected: exit code `0`; no missing CSS module property or import errors.

---

### Task 2: Convert The Proof Section Into A Lazy Video Testimonial Rail

**Files:**
- Modify: `app/sections/CaseLab3Proof.tsx`
- Modify: `app/case-lab-3/case-lab-3.module.css`

**Interfaces:**
- Consumes: poster paths already present in `public/`, optional provider embed URLs in the local data array.
- Produces: `CaseLab3Proof` with one active embed at a time and no external media request before activation.

- [x] **Step 1: Replace proof copy and data with explicit testimonial records**

Keep the component client-side and replace the old two-item proof data with four records. Use `embedUrl: ""` for records whose provider URL has not been supplied yet; this is the intentional poster-only state, not a network placeholder.

```tsx
"use client";

import Image from "next/image";
import { Play, X } from "lucide-react";
import { useState } from "react";
import ScrollReveal from "../components/ScrollReveal";
import styles from "../case-lab-3/case-lab-3.module.css";

const testimonials = [
  {
    id: "participant-01",
    label: "Отзыв участника 01",
    name: "Участник Case Lab",
    quote: "Что изменилось после разбора кейса",
    poster: "/CASElab.webp",
    embedUrl: "",
  },
  {
    id: "participant-02",
    label: "Отзыв участника 02",
    name: "Участник Case Lab",
    quote: "Когда решения можно забрать в работу",
    poster: "/caselab2.webp",
    embedUrl: "",
  },
  {
    id: "participant-03",
    label: "Отзыв участника 03",
    name: "Участник Case Lab",
    quote: "Как меняется взгляд на маркетинговый кейс",
    poster: "/Invictus GO.webp",
    embedUrl: "",
  },
  {
    id: "participant-04",
    label: "Отзыв участника 04",
    name: "Участник Case Lab",
    quote: "Что остаётся после вечера в зале",
    poster: "/OYU Fest 2026.webp",
    embedUrl: "",
  },
] as const;
```

When real URLs arrive, replace only the corresponding `embedUrl` strings with provider iframe URLs such as `https://iframe.videodelivery.net/<VIDEO_UID>`.

- [x] **Step 2: Implement the one-active-player interaction**

Use a single `activeId` state. Render a poster button until the selected item has a non-empty `embedUrl`; when selected, render one inline iframe inside the same 9:16 box. For empty URLs, keep the poster visible and show a non-interactive `Видео скоро появится` label instead of creating an empty iframe.

```tsx
export default function CaseLab3Proof() {
  const [activeId, setActiveId] = useState<string | null>(null);

  return (
    <section id="case-lab-3-proof" className={styles.proofSection} aria-labelledby="case-lab-3-proof-title">
      <div className={styles.contentShell}>
        <ScrollReveal>
          <div className={styles.proofIntro}>
            <h2 id="case-lab-3-proof-title">Что участники уносят с собой</h2>
            <p>
              Участники прошлых потоков рассказывают, что изменилось после разбора реальных кейсов и какие решения они забрали с собой в работу.
            </p>
          </div>
        </ScrollReveal>

        <div className={styles.testimonialRail}>
          {testimonials.map((item, index) => {
            const isActive = activeId === item.id;
            const hasEmbed = item.embedUrl.length > 0;

            return (
              <ScrollReveal key={item.id} delay={index * 0.06}>
                <article className={`${styles.testimonialCard} ${index === 0 ? styles.testimonialCardFeatured : ""}`}>
                  <div className={styles.testimonialMedia}>
                    {isActive && hasEmbed ? (
                      <>
                        <iframe
                          src={item.embedUrl}
                          title={`${item.label}: ${item.name}`}
                          loading="lazy"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                        <button
                          type="button"
                          className={styles.testimonialClose}
                          onClick={() => setActiveId(null)}
                          aria-label={`Закрыть ${item.label.toLowerCase()}`}
                        >
                          <X size={18} strokeWidth={2} aria-hidden="true" />
                        </button>
                      </>
                    ) : (
                      <>
                        <Image
                          src={item.poster}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width: 767px) 78vw, (max-width: 1100px) 24vw, 270px"
                        />
                        <div className={styles.testimonialShade} aria-hidden="true" />
                        {hasEmbed ? (
                          <button
                            type="button"
                            className={styles.testimonialPlay}
                            onClick={() => setActiveId(item.id)}
                            aria-expanded={false}
                            aria-controls={`${item.id}-player`}
                            aria-label={`Смотреть ${item.label.toLowerCase()}`}
                          >
                            <Play size={18} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
                          </button>
                        ) : (
                          <span className={styles.testimonialPending}>Видео скоро появится</span>
                        )}
                      </>
                    )}
                  </div>
                  <div className={styles.testimonialBody}>
                    <span>{item.label}</span>
                    <h3>{item.quote}</h3>
                    <p>{item.name}</p>
                  </div>
                </article>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
```

The implementation must add `id={`${item.id}-player`}` to the iframe wrapper or iframe itself so every `aria-controls` value resolves to an existing element. The active close button should use `aria-expanded={true}` on the active state if a play toggle remains available; if only the close control is shown while active, keep the state exposed by the surrounding card and ensure the close button label is specific.

- [x] **Step 3: Add poster-first 9:16 rail styles**

Replace the old `.proofGrid`, `.proofCard`, `.proofMedia`, `.proofPlay`, `.proofLabel`, and `.proofNote` styles with a text-and-rail composition. Keep the white section background and existing content shell. Use a desktop horizontal rail with four visible compact vertical cards and mobile scroll-snap.

```css
.proofIntro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, .65fr);
  gap: clamp(28px, 8vw, 140px);
  align-items: end;
}

.proofIntro h2 {
  max-width: 10ch;
  margin: 0;
  font-family: var(--font-heading);
  font-size: clamp(34px, 5vw, 68px);
  line-height: .97;
  letter-spacing: -.035em;
}

.proofIntro > p {
  max-width: 48ch;
  margin: 0;
  color: #4f4e5b;
  font-size: 17px;
  line-height: 1.5;
}

.testimonialRail {
  display: flex;
  gap: 12px;
  margin-top: var(--case-lab-headline-content-gap);
  overflow-x: auto;
  padding-bottom: 8px;
  scrollbar-width: none;
}

.testimonialRail::-webkit-scrollbar { display: none; }

.testimonialCard {
  flex: 0 0 clamp(210px, 21vw, 270px);
  overflow: hidden;
  border-radius: 22px;
  background: #f4f4f8;
}

.testimonialCardFeatured {
  transform: translateY(22px);
}

.testimonialMedia {
  position: relative;
  aspect-ratio: 9 / 16;
  overflow: hidden;
  background: #17122f;
}

.testimonialMedia iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  border: 0;
}

.testimonialShade {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(9, 6, 27, .04) 32%, rgba(9, 6, 27, .82) 100%);
  pointer-events: none;
}

.testimonialPlay,
.testimonialClose {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: grid;
  width: 48px;
  height: 48px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, .7);
  border-radius: 999px;
  background: rgba(4, 0, 130, .72);
  color: #fff;
}

.testimonialClose {
  top: 12px;
  right: 12px;
  bottom: auto;
  width: 36px;
  height: 36px;
}

.testimonialPending {
  position: absolute;
  right: 16px;
  bottom: 16px;
  left: 16px;
  color: rgba(255, 255, 255, .86);
  font-size: 12px;
  line-height: 1.2;
}

.testimonialBody {
  display: grid;
  gap: 8px;
  padding: 16px;
}

.testimonialBody > span,
.testimonialBody > p {
  margin: 0;
  color: #6b6976;
  font-size: 11px;
  letter-spacing: .04em;
  text-transform: uppercase;
}

.testimonialBody h3 {
  min-height: 2.1em;
  margin: 0;
  font-size: clamp(17px, 1.6vw, 22px);
  line-height: 1;
  letter-spacing: -.025em;
}

.testimonialBody > p {
  text-transform: none;
}

@media (max-width: 767px) {
  .proofIntro {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .proofIntro h2 { max-width: 11ch; font-size: 32px; }

  .testimonialRail {
    margin-right: -16px;
    margin-left: -16px;
    padding-right: 16px;
    padding-left: 16px;
    scroll-snap-type: x mandatory;
  }

  .testimonialCard {
    flex-basis: min(78vw, 300px);
    scroll-snap-align: start;
  }

  .testimonialCardFeatured { transform: none; }
}

@media (prefers-reduced-motion: reduce) {
  .testimonialCardFeatured { transform: none; }
}
```

- [x] **Step 4: Re-check the accessibility wiring**

Confirm that active players have an iframe `id`, the button's `aria-controls` points to it, the iframe title contains the testimonial label, and empty `embedUrl` records render no iframe at all. Confirm that the poster image remains inside a fixed 9:16 box before activation.

- [x] **Step 5: Run lint and type checks**

Run: `npx tsc --noEmit --incremental false && npm run lint`

Expected: both commands exit `0`; no JSX, CSS module, or lint errors.

---

### Task 3: Verify The Integrated Case Lab 3 Page

**Files:**
- Inspect: `app/components/CaseLab3Page.tsx`
- Inspect: `app/sections/CaseLab3HowItWorks.tsx`
- Inspect: `app/sections/CaseLab3Proof.tsx`
- Inspect: `app/case-lab-3/case-lab-3.module.css`

**Interfaces:**
- Consumes: completed section order and styles from Tasks 1 and 2.
- Produces: verified build output and a focused diff with no unrelated file edits.

- [x] **Step 1: Verify requested visible copy and page order**

Run:

```bash
rtk grep -n "До этого уже было" app/sections/CaseLab3Proof.tsx
rtk grep -n "Как проходит Case Lab" app/sections/CaseLab3HowItWorks.tsx app/components/CaseLab3Page.tsx
rtk grep -n "CaseLab3Speakers\|CaseLab3HowItWorks\|CaseLab3Proof" app/components/CaseLab3Page.tsx
```

Expected: the first command returns no matches; the second finds the new heading and import/render; the third shows speakers before how-it-works before proof.

- [x] **Step 2: Run the full static verification**

Run: `npx tsc --noEmit --incremental false`

Expected: exit code `0`.

Run: `npm run lint`

Expected: exit code `0`.

Run: `npm run build`

Expected: exit code `0`; Next.js completes the production build without new route, CSS, or client boundary errors.

- [x] **Step 3: Inspect the final diff**

Run: `rtk git diff --stat && rtk git diff -- app/components/CaseLab3Page.tsx app/sections/CaseLab3HowItWorks.tsx app/sections/CaseLab3Proof.tsx app/case-lab-3/case-lab-3.module.css`

Expected: only the intended page order, new section, testimonial facade, and CSS module changes are present in the implementation diff. Do not revert or stage unrelated pre-existing worktree changes.

- [x] **Step 4: Record the remaining media handoff**

After verification, report that the UI is ready for poster-first external players and that the four `embedUrl` values in `CaseLab3Proof.tsx` must be filled with Cloudflare Stream/Mux iframe URLs when the real videos are available. Visual browser verification is not performed unless the user explicitly requests it.
