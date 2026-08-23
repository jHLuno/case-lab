# Case Lab 3 Testimonial Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fourth `/case-lab-3` section with the approved static three-card testimonial gallery.

**Architecture:** Keep `CaseLab3Proof` as a focused client component because future video URLs need local player state. Store the three reference records in the component, render all cards at once, and mount at most one lazy iframe when a future record has an `embedUrl`. Use the existing Case Lab CSS module for the responsive three-column card grid and reference styling.

**Tech Stack:** Next.js App Router, React, TypeScript, `next/image`, `lucide-react`, Framer Motion-free static markup, CSS Modules.

## Global Constraints

- Keep one static set of exactly three cards; do not add carousel state or auto-rotation.
- Use the reference names, roles, and quotes exactly.
- Use the supplied speaker portraits converted to WebP as poster images.
- Do not mount an iframe when `embedUrl` is empty; future players use `loading="lazy"`.
- Preserve visible keyboard focus, focus restoration on close, responsive behavior, and reduced-motion-safe behavior.
- Do not change dependencies, video hosting, database state, or unrelated dirty worktree files.

---

### Task 1: Replace testimonial data and markup

**Files:**
- Modify: `app/sections/CaseLab3Proof.tsx`

**Interfaces:**
- Consumes: existing Case Lab section shell and CSS module.
- Produces: three static testimonial cards and an optional single player.

- [ ] **Step 1: Replace the local records**

Use these fields for the three cards:

```tsx
const testimonials = [
  {
    id: "testimonial-01",
    name: "Екатерина Щипачёва",
    role: "CMO Intertop & Pandora",
    duration: "01:24",
    quote: "После Case Lab я пересобрала подход к работе с кейсами: меньше теории, больше вопросов к тому, почему команда вообще приняла именно такое решение.",
    photo: "/CASElab.webp",
    embedUrl: "",
  },
  {
    id: "testimonial-02",
    name: "Елена Афонина",
    role: "Управляющий директор Centras Group",
    duration: "01:07",
    quote: "Увидел, как другие команды находят выход из похожих ситуаций. Забрал несколько идей, которые уже внедрили в следующем спринте.",
    photo: "/caselab2.webp",
    embedUrl: "",
  },
  {
    id: "testimonial-03",
    name: "Аида Нурсултанова",
    role: "Директор по маркетингу дистрибуции Li Auto",
    duration: "00:58",
    quote: "Разбор кейсов без прикрас — это то, чего часто не хватает в индустрии. После Case Lab появилось больше смелости принимать решения и тестировать.",
    photo: "/Invictus%20GO.webp",
    embedUrl: "",
  },
] as const;
```

- [ ] **Step 2: Add one optional-player state**

Keep `activeVideoId: string | null` and a map of play-button refs. The play handler must return without state changes for an empty URL. The close handler must capture the previous id, clear state, and restore focus with `requestAnimationFrame`.

- [ ] **Step 3: Render the approved card structure**

Render the existing heading and description, then map all three records into cards. Each poster includes the image and a compact video link. If the record is active and has a URL, render its lazy iframe and close button in the same poster frame. Render author metadata and quote below the poster. Do not render carousel arrows or pagination dots.

- [ ] **Step 4: Remove obsolete selection behavior**

Remove `activeIndex`, the five-second interval, `AnimatePresence`, `motion`, the left selector list, progress bars, and the single active quote panel. Keep only the section shell and the new static gallery.

- [ ] **Step 5: Run the component type and lint checks**

Run `npx tsc --noEmit --incremental false` and the repository's component lint command. Expected result: no TypeScript or ESLint errors.

---

### Task 2: Replace testimonial styles with the reference card grid

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css`

**Interfaces:**
- Consumes: the new class names from `CaseLab3Proof`.
- Produces: the desktop three-card gallery, fixed poster ratio, card body hierarchy, static controls, and mobile stack.

- [ ] **Step 1: Remove old list/quote rules**

Delete the obsolete `.testimonialLayout`, `.testimonialList`, `.testimonialSelector*`, `.testimonialProgress*`, `.testimonialQuote*`, `.testimonialAuthor*`, and old `.testimonialVideo*` rules that only support the selector-and-active-quote composition.

- [ ] **Step 2: Add desktop gallery rules**

Use a three-column grid with the existing Case Lab spacing rhythm. Give each card a thin light border and `22px` corners. Set the poster to a square aspect ratio, use `object-fit: cover` with `object-position: center 20%` for the portraits, and place the compact video link at the lower left. Keep the body padding near the existing `24px` scale, use a fixed minimum card height, and align the accent rule and quote consistently across cards.

- [ ] **Step 3: Add optional player styles**

Make the iframe fill the poster frame, keep the close button accessible, and style disabled play controls without hover movement.

- [ ] **Step 4: Add responsive rules**

At the existing mobile breakpoint, change the gallery to one column, reduce card/body spacing, keep poster ratio at `16 / 9`, and make the controls fit without horizontal overflow. Preserve heading wrapping and the existing section gutters.

- [ ] **Step 5: Run style and build verification**

Run `git diff --check` and `npm run build`. Expected result: no whitespace errors and a successful production build.

---

### Task 3: Review the complete diff

**Files:**
- Inspect: `app/sections/CaseLab3Proof.tsx`
- Inspect: `app/case-lab-3/case-lab-3.module.css`

- [ ] **Step 1: Confirm scope**

Run `git diff -- app/sections/CaseLab3Proof.tsx app/case-lab-3/case-lab-3.module.css` and confirm that only the fourth block implementation changed.

- [ ] **Step 2: Confirm no empty player requests**

Inspect the render condition and confirm an iframe exists only inside `activeVideoId === testimonial.id && testimonial.embedUrl`.

- [ ] **Step 3: Confirm final checks**

Run `npx tsc --noEmit --incremental false`, the component lint command, `git diff --check`, and `npm run build`.
