# Case Lab 3 Testimonials Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fourth `/case-lab-3` testimonial rail with the main-page testimonial composition, including author photos and click-to-load video reviews.

**Architecture:** Keep `CaseLab3Proof` as the only client boundary and store three editable testimonial records locally in that component. Use one active testimonial index and one active external iframe at a time; the initial state contains no video iframe. Extend the existing Case Lab CSS module with the main-page-style list/quote layout, fixed avatar sizing, responsive stacking, and video controls.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict mode, `next/image`, `lucide-react`, CSS Modules, existing Case Lab font and color tokens.

## Global Constraints

- Keep three testimonial records in `CaseLab3Proof.tsx`.
- Use the main-page composition: a selectable list of names on the left and the active quote on the right.
- Add a compact, fixed-size circular author photo beside the active author metadata.
- Add a `Посмотреть видео-отзыв` button to the active quote.
- Do not autoplay, preload, or mount all three video players.
- Mount one external iframe only after the video button is clicked, with `loading="lazy"` and a descriptive `title`.
- Keep video URLs optional so future content changes only edit the local data records.
- Preserve responsive behavior, visible keyboard focus, and reduced-motion behavior.
- Do not change dependencies, video hosting, database state, or unrelated dirty worktree files.

---

### Task 1: Rebuild The Case Lab Testimonial Component

**Files:**
- Modify: `app/sections/CaseLab3Proof.tsx`

**Interfaces:**
- Consumes: existing `styles` CSS module and the existing Case Lab page composition.
- Produces: a client component with three local testimonial records, selectable list state, author avatar metadata, a video button, and at most one active iframe.

- [x] **Step 1: Define the editable testimonial records**

Replace the four generic records with three records shaped as follows. Keep the fields at the top of the file so event-specific names, roles, photos, quotes, posters, and provider URLs can be changed without altering the rendering logic.

```tsx
const testimonials = [
  {
    id: "testimonial-01",
    name: "Участник Case Lab 01",
    role: "Участник предыдущего Case Lab",
    quote: "Что изменилось после разбора реального кейса.",
    photo: "/CASElab.webp",
    embedUrl: "",
  },
  {
    id: "testimonial-02",
    name: "Участник Case Lab 02",
    role: "Участник предыдущего Case Lab",
    quote: "Ещё один отзыв о том, что участник забрал с собой.",
    photo: "/caselab2.webp",
    embedUrl: "",
  },
  {
    id: "testimonial-03",
    name: "Участник Case Lab 03",
    role: "Участник предыдущего Case Lab",
    quote: "Отзыв о разборе реальных маркетинговых кейсов.",
    photo: "/Invictus GO.webp",
    embedUrl: "",
  },
] as const;
```

The empty `embedUrl` values are intentional until the real video URLs are supplied. The button must remain visible as the future content action, but it must not create a request when the URL is empty.

- [x] **Step 2: Implement selectable testimonial and player state**

Use `activeIndex` for the selected quote and `activeVideoIndex` for the single mounted player. Match the main block's five-second rotation and progress indicator while no video is active; pause rotation while a player is open. When a testimonial is selected, close any existing player before showing the new quote. When the video button is clicked and the record has a URL, set `activeVideoIndex` to `activeIndex`; when the record has no URL, do nothing. Keep a ref to the video button and return focus to it when closing the player.

```tsx
const [activeIndex, setActiveIndex] = useState(0);
const [activeVideoIndex, setActiveVideoIndex] = useState<number | null>(null);
const videoButtonRef = useRef<HTMLButtonElement | null>(null);

useEffect(() => {
  if (activeVideoIndex !== null) return;
  const interval = setInterval(() => {
    setActiveIndex((previous) => (previous + 1) % testimonials.length);
  }, 5000);
  return () => clearInterval(interval);
}, [activeVideoIndex]);

const selectTestimonial = (index: number) => {
  setActiveVideoIndex(null);
  setActiveIndex(index);
};

const closeVideo = () => {
  setActiveVideoIndex(null);
  requestAnimationFrame(() => videoButtonRef.current?.focus());
};
```

Render the section with `id="case-lab-3-proof"` and a heading such as `Что говорят участники`. Render three real `<button>` selectors instead of clickable `<div>` elements, with a progress line whose width is `100%` only for the active item and transitions for 4700ms. The active quote contains the fixed-size circular `next/image`, name, role, quote, and `Посмотреть видео-отзыв` button. Render the iframe only when `activeVideoIndex === activeIndex` and `embedUrl` is non-empty:

```tsx
{activeVideoIndex === activeIndex && testimonials[activeIndex].embedUrl ? (
  <div id={`${testimonials[activeIndex].id}-player`} className={styles.testimonialVideo}>
    <iframe
      src={testimonials[activeIndex].embedUrl}
      title={`Видео-отзыв: ${testimonials[activeIndex].name}`}
      loading="lazy"
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
      allowFullScreen
    />
    <button type="button" onClick={closeVideo} aria-label="Закрыть видео-отзыв">
      <X size={18} aria-hidden="true" />
    </button>
  </div>
) : null}
```

The video trigger uses `aria-expanded`, `aria-controls`, and an explicit label. If a URL is empty, keep the button visible but disabled with the accessible label `Видео-отзыв скоро появится`, so no empty iframe is ever mounted.

- [x] **Step 3: Run the type check for the component**

Run: `npx tsc --noEmit --incremental false`

Expected: exit code `0`; the CSS module fields, `next/image` props, and button refs type-check successfully.

---

### Task 2: Match The Main Testimonials Layout In Case Lab Styles

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css`

**Interfaces:**
- Consumes: class names used by the rebuilt `CaseLab3Proof` component.
- Produces: desktop two-column list/quote layout, circular fixed-size avatar, fixed video box, mobile stack, and visible focus states.

- [x] **Step 1: Replace rail-specific testimonial rules**

Remove the current `.proofIntro`, `.testimonialRail`, `.testimonialCard`, `.testimonialMedia`, `.testimonialPlayer`, `.testimonialShade`, `.testimonialPlay`, `.testimonialClose`, `.testimonialPending`, and `.testimonialBody` rules that implement the four-card rail. Add the following main-page-style rules:

```css
.proofIntro {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, .85fr);
  gap: clamp(28px, 8vw, 120px);
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
  max-width: 42ch;
  margin: 0;
  color: #4f4e5b;
  font-size: 17px;
  line-height: 1.5;
}

.testimonialLayout {
  display: grid;
  grid-template-columns: minmax(220px, .8fr) minmax(0, 1.2fr);
  gap: clamp(36px, 8vw, 120px);
  margin-top: var(--case-lab-headline-content-gap);
}

.testimonialList {
  align-self: start;
}

.testimonialSelector {
  display: block;
  width: 100%;
  padding: 18px 0;
  border: 0;
  border-top: 1px solid rgba(10, 10, 22, .12);
  background: transparent;
  color: #0a0a16;
  cursor: pointer;
  text-align: left;
}

.testimonialSelector:last-child {
  border-bottom: 1px solid rgba(10, 10, 22, .12);
}

.testimonialSelector:not([aria-selected="true"]) {
  opacity: .45;
}

.testimonialSelector:focus-visible,
.testimonialVideoClose:focus-visible,
.testimonialVideoButton:focus-visible {
  outline: 2px solid #040082;
  outline-offset: 4px;
}

.testimonialSelectorName {
  font-family: var(--font-body);
  font-size: 17px;
  line-height: 1.2;
}

.testimonialQuote {
  min-height: 300px;
}

.testimonialAuthor {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 26px;
}

.testimonialAvatar {
  position: relative;
  width: 64px;
  height: 64px;
  flex: 0 0 64px;
  overflow: hidden;
  border-radius: 50%;
  background: #e7e7f0;
}

.testimonialAuthorText {
  display: grid;
  gap: 3px;
}

.testimonialAuthorText strong,
.testimonialAuthorText span {
  font-family: var(--font-body);
  font-size: 14px;
  line-height: 1.25;
}

.testimonialAuthorText span {
  color: rgba(10, 10, 22, .58);
}

.testimonialQuoteText {
  margin: 0;
  color: #0a0a16;
  font-family: var(--font-body);
  font-size: clamp(18px, 2vw, 25px);
  line-height: 1.45;
}

.testimonialVideoButton {
  display: inline-flex;
  align-items: center;
  gap: 9px;
  margin-top: 28px;
  padding: 12px 18px;
  border: 0;
  border-radius: 999px;
  background: #040082;
  color: #fff;
  cursor: pointer;
  font-family: var(--font-body);
  font-size: 14px;
}

.testimonialVideoButton:disabled {
  background: #aaa9bb;
  cursor: not-allowed;
}

.testimonialVideo {
  position: relative;
  width: min(100%, 360px);
  aspect-ratio: 9 / 16;
  margin-top: 28px;
  overflow: hidden;
  border-radius: 22px;
  background: #17122f;
}

.testimonialVideo iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.testimonialVideoClose {
  position: absolute;
  top: 12px;
  right: 12px;
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, .7);
  border-radius: 50%;
  background: rgba(4, 0, 130, .8);
  color: #fff;
  cursor: pointer;
}
```

- [x] **Step 2: Add the mobile fallback and reduced-motion rule**

At the existing mobile breakpoint, stack `.proofIntro` and `.testimonialLayout`, remove the desktop minimum height, and make the video use the available column width:

```css
@media (max-width: 767px) {
  .proofIntro,
  .testimonialLayout {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .testimonialQuote {
    min-height: 0;
  }

  .testimonialVideo {
    width: 100%;
    max-width: 320px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .testimonialSelector,
  .testimonialVideoButton,
  .testimonialVideoClose {
    transition: none;
  }
}
```

- [x] **Step 3: Check the CSS class wiring**

Run: `rtk grep -n "testimonial" app/sections/CaseLab3Proof.tsx app/case-lab-3/case-lab-3.module.css`

Expected: every testimonial class referenced by the component exists in the module, and the old rail-only class names are no longer referenced by `CaseLab3Proof.tsx`.

---

### Task 3: Verify The Integrated Route And Diff

**Files:**
- Inspect: `app/components/CaseLab3Page.tsx`
- Inspect: `app/sections/CaseLab3Proof.tsx`
- Inspect: `app/case-lab-3/case-lab-3.module.css`

**Interfaces:**
- Consumes: the updated fourth section and existing page order.
- Produces: a type-safe, lint-clean, production-buildable `/case-lab-3` route with lazy single-player behavior.

- [x] **Step 1: Confirm page order and record count**

Run:

```bash
rtk grep -n "CaseLab3Speakers\|CaseLab3HowItWorks\|CaseLab3Proof\|Cases" app/components/CaseLab3Page.tsx
rtk grep -n "id: \"testimonial-" app/sections/CaseLab3Proof.tsx
rtk grep -n "До этого уже было\|participant-04\|testimonialRail" app/sections/CaseLab3Proof.tsx
```

Expected: the page order remains speakers, how-it-works, proof, archive; exactly three `testimonial-*` records exist; and the old four-card markers return no matches.

- [x] **Step 2: Run static verification**

Run: `npx tsc --noEmit --incremental false && npm run lint && npm run build`

Expected: all three commands exit `0` without JSX, CSS-module, lint, or production route errors.

- [x] **Step 3: Inspect the focused diff**

Run: `rtk git diff --stat && rtk git diff -- app/sections/CaseLab3Proof.tsx app/case-lab-3/case-lab-3.module.css docs/superpowers/specs/2026-08-22-case-lab-3-testimonials-layout-design.md docs/superpowers/plans/2026-08-22-case-lab-3-testimonials-layout.md`

Expected: only the testimonial component, its Case Lab styles, and the planning/spec documents added for this task are part of this task's diff. Do not revert or stage unrelated pre-existing worktree changes.

- [x] **Step 4: Report the media handoff**

Report that the three local `embedUrl` values in `CaseLab3Proof.tsx` must be replaced with real Cloudflare Stream, Mux, YouTube, or Vimeo iframe URLs when the video reviews are ready. Visual browser verification is not performed unless explicitly requested.
