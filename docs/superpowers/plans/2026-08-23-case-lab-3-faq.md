# Case Lab 3 FAQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an accessible five-question FAQ accordion immediately after the Case Lab 3 ticket pricing section.

**Architecture:** Keep FAQ behavior in a dedicated client component and keep presentation in the existing Case Lab 3 CSS module. Compose the component after `CaseLab3Tickets` and before the footer; do not change checkout behavior or add dependencies.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Framer Motion `ScrollReveal`, CSS Modules, `lucide-react`.

## Global Constraints

- Use the existing Case Lab 3 visual language: white background, dark typography, thin dividers, and lavender accent.
- Use five approved questions and avoid promising an unverified start time, duration, or full event recording.
- Keep the FAQ keyboard-operable with `aria-expanded` and explicit button-to-panel relationships.
- Do not install packages or modify checkout behavior.

---

### Task 1: Build The FAQ Component

**Files:**
- Create: `app/sections/CaseLab3FAQ.tsx`

**Interfaces:**
- Consumes: `ScrollReveal` from `app/components/ScrollReveal.tsx` and styles from `app/case-lab-3/case-lab-3.module.css`.
- Produces: default-exported `CaseLab3FAQ` component with a five-item accordion and `id="faq"` section anchor.

- [ ] **Step 1: Define the FAQ data and local open state**

Use the approved copy and initialize item `0` as open:

```tsx
const faqItems = [
  {
    question: "Где проходит Case Lab III?",
    answer: "24 сентября в Алматы, в Narxoz Business School.",
  },
  {
    question: "На каком языке?",
    answer: "Основная программа проходит на русском языке.",
  },
  {
    question: "Во сколько начало и сколько длится?",
    answer: "Время начала и точную продолжительность сообщим в подтверждении участия после покупки билета.",
  },
  {
    question: "Будет ли запись?",
    answer: "Полная запись мероприятия не входит в программу; на встрече будут доступны материалы и видеоотзывы прошлых потоков, указанные в составе билета.",
  },
  {
    question: "Можно ли вернуть или передать билет?",
    answer: "Передать билет можно, предварительно написав на hello@caselab.kz. Отказаться от участия и запросить возврат можно до начала мероприятия по тому же адресу; возврат рассматривается по условиям публичной оферты и законодательству Республики Казахстан.",
  },
];
```

- [ ] **Step 2: Render accessible accordion markup**

Use a `<section id="faq" aria-labelledby="case-lab-3-faq-title">`, a heading, and one button per item. Generate stable ids from the item index, set `aria-expanded`, `aria-controls`, and `id` on each button, and set `role="region"` plus `aria-labelledby` on each panel. Toggle the clicked item, closing it when clicked again.

- [ ] **Step 3: Wrap the heading and list in `ScrollReveal`**

Use two `ScrollReveal` wrappers, matching the existing Case Lab 3 section animation pattern. Apply the new module classes to the section, intro, list, item, button, icon, panel, and answer.

### Task 2: Add FAQ Layout And Styling

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css` after the ticket block styles and before the responsive rules.

**Interfaces:**
- Consumes: the class names emitted by `CaseLab3FAQ`.
- Produces: responsive white FAQ section with visible keyboard focus, divider-based rows, and animated open/close panels.

- [ ] **Step 1: Add base FAQ styles**

Implement the following style responsibilities:

```css
.faqSection {
  padding: var(--case-lab-content-next-headline-gap) 24px clamp(84px, 12vw, 170px);
  background: #fff;
  color: #0a0a16;
}

.faqIntro h2 { /* heading uses existing heading family and scale */ }
.faqIntro p { /* muted supporting copy */ }
.faqList { /* centered max-width list with top divider */ }
.faqItem { /* bottom divider */ }
.faqButton { /* full-width flex button, left-aligned text */ }
.faqQuestion { /* body font, bold, blue when open */ }
.faqIcon { /* circular plus control, rotates when open */ }
.faqPanel { /* grid row transition and opacity */ }
.faqAnswer { /* readable max-width, muted text */ }
```

Keep all values derived from existing Case Lab 3 colors, typography variables, spacing, and divider opacity.

- [ ] **Step 2: Add responsive and reduced-motion rules**

At `max-width: 640px`, reduce section side padding to `16px` and let the heading wrap naturally. At `prefers-reduced-motion: reduce`, disable FAQ transition durations while preserving the open/closed state.

- [ ] **Step 3: Preserve keyboard focus visibility**

Add a visible `:focus-visible` outline to `.faqButton` using the existing blue/lavender palette. Do not remove the browser focus indicator without replacing it.

### Task 3: Compose The Section And Navigation

**Files:**
- Modify: `app/components/CaseLab3Page.tsx`
- Modify: `app/components/CaseLab3Navbar.tsx`

**Interfaces:**
- Consumes: default-exported `CaseLab3FAQ` from `app/sections/CaseLab3FAQ.tsx`.
- Produces: page order `CaseLab3Tickets` -> `CaseLab3FAQ` -> `Footer`, plus a `Вопросы` anchor in the Case Lab 3 navbar.

- [ ] **Step 1: Import and render `CaseLab3FAQ`**

Add the import and render it directly after `<CaseLab3Tickets />`, before `<Footer />`.

- [ ] **Step 2: Add the FAQ navigation link**

Append `{ label: "Вопросы", href: "#faq" }` after the existing tickets link without changing existing labels or hrefs.

### Task 4: Verify The Implementation

**Files:**
- No additional files.

- [ ] **Step 1: Run TypeScript validation**

Run `npx tsc --noEmit --incremental false`.

Expected: exit code `0` with no TypeScript errors.

- [ ] **Step 2: Run the production build**

Run `npm run build`.

Expected: exit code `0` and successful Next.js production compilation.

- [ ] **Step 3: Inspect the final diff**

Run `git diff -- app/components/CaseLab3Page.tsx app/components/CaseLab3Navbar.tsx app/sections/CaseLab3FAQ.tsx app/case-lab-3/case-lab-3.module.css` and confirm only the FAQ component, composition, navigation, and styles changed for this task.
