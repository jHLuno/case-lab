# Case Lab III Ticket Assets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Case Lab III ticket artwork with two `2400x1200` WebP assets encoded at quality `100`, and give the ticket section a `65% / 35%` copy-to-artwork layout.

**Architecture:** Keep the existing `CaseLab3Tickets` component and CSS module. Replace only its image source metadata and focused ticket layout rules; retain `next/image`, accessibility semantics, event copy, CTA behavior, and mobile stacking. Generate the optimized assets locally with `cwebp`, then validate their format and dimensions from the filesystem.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, `next/image`, Node test runner, `cwebp`.

## Global Constraints

- Resize both assets to exactly `2400x1200` pixels.
- Encode both WebP assets at quality `100`.
- Use a desktop ticket grid ratio of `65% / 35%`.
- Preserve the current event copy, image alt text, `next/image` usage, disabled checkout CTA, and mobile stacked reading order.
- Do not change checkout behavior, event data, navigation, schema, or other Case Lab sections.

---

### Task 1: Update Focused Ticket Expectations

**Files:**
- Modify: `tests/case-lab-3-tickets-editorial.test.mjs:23-66`
- Modify: `tests/case-lab-3-assets.test.mjs:121-127`

**Interfaces:**
- Consumes: the existing ticket source and CSS module strings.
- Produces: focused assertions for the new WebP names, `2400x1200` metadata, slightly enlarged artwork, wider copy column, and quality `100`.

- [ ] **Step 1: Replace old ticket asset assertions**

Expect `case-lab-3-ticket-early-bird.webp` and `case-lab-3-ticket-standard.webp`, and remove expectations for the versioned `v4/v5` names.

- [ ] **Step 2: Update explicit source dimensions**

Expect both ticket entries to contain `width: 2400` and `height: 1200`, while retaining the existing `quality={100}` assertion.

- [ ] **Step 3: Add layout assertions**

Assert the ticket grid contains `grid-template-columns: minmax(0, 65fr) minmax(0, 35fr)` and the artwork uses a compact desktop width and scale below the current full-size layout.

- [ ] **Step 4: Run focused tests and confirm the new expectations fail**

Run: `node --test tests/case-lab-3-tickets-editorial.test.mjs tests/case-lab-3-assets.test.mjs`

Expected: FAIL because the component and CSS still reference the old assets and dimensions.

### Task 2: Generate And Wire Ticket Assets

**Files:**
- Create: `public/case-lab-3-ticket-early-bird.webp`
- Create: `public/case-lab-3-ticket-standard.webp`
- Modify: `app/sections/CaseLab3Tickets.tsx:12-24`

**Interfaces:**
- Consumes: `public/early bird.png` and `public/standard.png`.
- Produces: two WebP files with exact `2400x1200` dimensions and ticket metadata pointing at those files.

- [ ] **Step 1: Convert the supplied PNGs**

Run:

```bash
cwebp -q 100 -resize 2400 1200 "public/early bird.png" -o public/case-lab-3-ticket-early-bird.webp
cwebp -q 100 -resize 2400 1200 "public/standard.png" -o public/case-lab-3-ticket-standard.webp
```

- [ ] **Step 2: Update ticket metadata**

Change only the two `tickets` entries in `app/sections/CaseLab3Tickets.tsx`:

```ts
{
  src: "/case-lab-3-ticket-early-bird.webp",
  alt: "Early Bird: 7 890 ₸, первые 20 билетов",
  width: 2400,
  height: 1200,
},
{
  src: "/case-lab-3-ticket-standard.webp",
  alt: "Стандарт: 15 000 ₸ после первых 20 билетов",
  width: 2400,
  height: 1200,
},
```

- [ ] **Step 3: Verify generated file properties**

Run: `file public/case-lab-3-ticket-early-bird.webp public/case-lab-3-ticket-standard.webp && sips -g pixelWidth -g pixelHeight public/case-lab-3-ticket-early-bird.webp public/case-lab-3-ticket-standard.webp`

Expected: both files report WebP and `2400` by `1200` pixels.

### Task 3: Adjust Ticket Layout

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css:1092-1277`

**Interfaces:**
- Consumes: the existing ticket component class names.
- Produces: a wide left copy column, compact right artwork, preserved desktop overlap, and responsive tablet/mobile behavior.

- [ ] **Step 1: Set the desktop grid ratio**

Use `grid-template-columns: minmax(0, 65fr) minmax(0, 35fr)` in `.ticketGrid`, retain center alignment, and use a moderate responsive gap.

- [ ] **Step 2: Increase the left copy measure and heading scale**

Set `.ticketLead` to a larger maximum width, give `.ticketGrid h2` a display range of `clamp(34px, 5.2vw, 68px)` with a `12ch` measure, and widen `.ticketCopy` to match the new column.

- [ ] **Step 3: Make the ticket artwork smaller without changing markup**

Use the full desktop artwork column width and `scale(1.3)` for both tickets, retaining the upper ticket's `rotate(-10deg)` and the `5%` desktop separation.

- [ ] **Step 4: Preserve responsive behavior**

Keep the single-column rule at `max-width: 900px`; at `max-width: 767px`, use `scale(.92)` and `margin-top: -6%` for the second ticket so the artwork stays contained without changing the reading order.

- [ ] **Step 5: Run focused tests and confirm they pass**

Run: `node --test tests/case-lab-3-tickets-editorial.test.mjs tests/case-lab-3-assets.test.mjs`

Expected: PASS with all focused ticket and asset assertions green.

### Task 4: Run Project Verification

**Files:**
- Verify: `app/sections/CaseLab3Tickets.tsx`
- Verify: `app/case-lab-3/case-lab-3.module.css`
- Verify: `tests/case-lab-3-tickets-editorial.test.mjs`
- Verify: `tests/case-lab-3-assets.test.mjs`
- Verify: generated files in `public/`

**Interfaces:**
- Consumes: the completed asset and layout changes.
- Produces: passing focused tests, TypeScript validation, and a production build.

- [ ] **Step 1: Run the full Case Lab source tests**

Run: `node --test tests/case-lab-3-*.test.mjs`

Expected: PASS with zero failed tests.

- [ ] **Step 2: Run TypeScript validation**

Run: `npx tsc --noEmit --incremental false`

Expected: exit code `0`.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit code `0` and a successful Next.js production build.

- [ ] **Step 4: Inspect the final diff and status**

Run: `git status --short && git diff -- app/sections/CaseLab3Tickets.tsx app/case-lab-3/case-lab-3.module.css tests/case-lab-3-tickets-editorial.test.mjs tests/case-lab-3-assets.test.mjs`

Expected: only the ticket asset/component/CSS/test changes and the new WebP assets are present; no checkout, schema, navigation, or unrelated changes are introduced.
