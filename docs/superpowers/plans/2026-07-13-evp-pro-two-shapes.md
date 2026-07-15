# EVP Pro Two-Shape Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompose the EVP Pro Hero as a large rounded Grainient panel plus a separate event-information panel.

**Architecture:** Keep `EVPProHero` as the sole component. Replace the current full-section background and desktop clip path with a rounded primary-surface wrapper and a sibling desktop-only fact panel. Use CSS only for responsive geometry so no layout JavaScript is introduced.

**Tech Stack:** Next.js App Router, React 19, Tailwind CSS 4, Framer Motion, CSS.

## Global Constraints

- Preserve Grainient dynamic import and `prefers-reduced-motion` fallback.
- The primary shape contains the Hero content and visual background.
- The secondary shape contains only event facts and is separate from the primary shape.
- Keep the current mobile facts list inside the primary shape.
- Do not add dependencies or create a test runner for this CSS-only composition.

---

### Task 1: Rebuild the Hero Surface Hierarchy

**Files:**
- Modify: `app/sections/EVPProHero.tsx`
- Modify: `app/globals.css`

**Interfaces:**
- Consumes: existing `eventFacts`, `Grainient`, `useLeadPopup`, and `useReducedMotion` in `app/sections/EVPProHero.tsx`.
- Produces: a desktop primary rounded surface and a desktop secondary fact panel without changing public component props.

- [ ] **Step 1: Remove the desktop clip-path background rule**

Delete the `.evp-hero-background` `clip-path` rule in `app/globals.css` so the primary visual is no longer cut away to create the fact area.

- [ ] **Step 2: Give the primary surface its own rounded container**

In `app/sections/EVPProHero.tsx`, place the existing Grainient background, decorative signal, title, body copy, CTA, and mobile facts inside a large `rounded-[32px]` desktop primary surface. Keep the white section canvas outside it.

- [ ] **Step 3: Create a separate desktop fact panel**

Render the existing event-facts `dl` as a sibling of the primary surface. Position the panel at the lower-right of the desktop composition with a white fill, dark text, and matching rounded corners. Do not add a heading or `EVP Pro` label.

- [ ] **Step 4: Preserve small-screen hierarchy**

At widths below `lg`, render only the primary surface at full available width and retain the existing in-surface stacked facts list.

- [ ] **Step 5: Run static verification**

Run: `npx tsc --noEmit --incremental false`

Expected: command exits with code `0`.

- [ ] **Step 6: Run production verification**

Run: `npm run build`

Expected: build completes and `/evp-pro` remains listed as a static route.

- [ ] **Step 7: Inspect responsive composition**

Open `/evp-pro` at a desktop viewport and a 390px mobile viewport. Confirm the large Grainient shape carries all Hero content, the white facts panel is independently visible only on desktop, and facts remain visible in the mobile primary shape.
