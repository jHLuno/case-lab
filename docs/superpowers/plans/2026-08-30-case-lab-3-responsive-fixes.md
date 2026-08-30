# Case Lab III Responsive Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct responsive layout, copy hierarchy, and mobile testimonial interaction on `/case-lab-3` from 320px through large desktop widths.

**Architecture:** Keep the route and page composition unchanged. Use the existing route-scoped CSS module for responsive layout and add a small client-side carousel state machine only to the testimonials section, preserving the existing desktop grid and semantic content.

**Tech Stack:** Next.js App Router, React 19, strict TypeScript, CSS Modules, lucide-react, Node test runner.

## Global Constraints

- Keep the event details alignment rule active at every viewport width.
- Use existing Case Lab fonts, colors, imagery, and interaction patterns.
- Mobile carousel covers 320px through 767px; tablet and desktop keep the current testimonial grid.
- Keep touch targets at least 44px and preserve visible keyboard focus.
- Do not change checkout behavior, route composition, legal pages, dependencies, or security configuration.

### Task 1: Add regression expectations

**Files:**
- Modify: `tests/case-lab-3-p1.test.mjs`
- Modify: `tests/case-lab-3-tickets-editorial.test.mjs`

- [x] Replace the stale testimonial assertion that forbids `useState|useRef` with assertions for the mobile carousel state, timer, visibility pause, touch handlers, focus pause, and accessible controls.
- [x] Add source assertions for the shared date flex alignment, mobile price alignment, tablet ticket artwork constraints, stronger ticket facts, added catering/prizes copy, scoreboard bottom alignment, speaker description measure, and mobile footer left alignment.
- [x] Run the focused tests and confirm they fail because the production source does not yet include the new behavior.

Run: `node --test tests/case-lab-3-p1.test.mjs tests/case-lab-3-tickets-editorial.test.mjs`
Expected: FAIL on the new carousel and responsive assertions.

### Task 2: Implement hero and section responsive CSS

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css`
- Modify: `app/components/CaseLab3Footer.tsx`

- [x] Make `.caseRoomDetails` align its number and detail column by height at the base rule; give the detail column a flex column with top/bottom distribution and prevent venue wrapping from changing the alignment unexpectedly.
- [x] Add mobile/tablet-safe top spacing inside `.caseRoomShape`, then set mobile heading and copy sizes that remain readable at 320px.
- [x] Make `.caseRoomPurchase` align its price copy to the CTA start below 768px and center it against the button from 768px upward.
- [x] Add a `min-width: 1080px` rule that increases `.caseRoomCaseFeaturedDescription` by 2–4px and widens its measure.
- [x] Increase large-screen speaker copy measure/type without changing the heading scale; align `.howItWorksScoreboard` items to the bottom edge.
- [x] Widen and slightly increase the ticket heading from 768px; strengthen `.ticketFact` type hierarchy.
- [x] Replace the tablet ticket art’s oversized overlap with bounded transforms, dimensions, and gap while keeping the desktop treatment from 1024px upward.
- [x] Add a `caseLabFooterDetails` class to the footer details row and mobile selectors scoped under `.caseLabPage` so the logo, email, and social links share the same left edge below 768px.

### Task 3: Implement ticket copy additions

**Files:**
- Modify: `app/sections/CaseLab3Tickets.tsx`

- [x] Extend the `included` array with a tasteful catering item and a chance to win gifts/prizes.
- [x] Keep the existing server-rendered component, fail-closed disabled CTA, and ticket asset dimensions unchanged.

### Task 4: Implement mobile testimonial carousel

**Files:**
- Modify: `app/sections/CaseLab3Proof.tsx`
- Modify: `app/case-lab-3/case-lab-3.module.css`

- [x] Add client behavior only to this section with `useState`, `useRef`, and `useEffect` for the active slide, viewport visibility, document visibility, focus pause, and touch pause.
- [x] Auto-advance the active index every 3000ms only when the mobile media query matches, the section is visible, the document is visible, and no interaction pause is active.
- [x] Pause on focus entering the carousel, touch start, and document hidden; resume after touch end/cancel has been idle for 3000ms or after focus leaves.
- [x] Provide previous/next 44px controls, a polite current-slide status, and native horizontal touch scrolling for the mobile-only track.
- [x] Keep all three testimonial articles in the DOM and preserve their existing review links and labels.
- [x] Add reduced-motion handling that avoids animated scrolling; keep Case Lab’s existing page motion policy intact.
- [x] Hide the carousel controls and track treatment outside mobile so the existing desktop grid remains unchanged.

### Task 5: Verify and review scope

**Files:**
- Verify: all files above

- [x] Run `node --test tests/case-lab-3-p1.test.mjs tests/case-lab-3-p2.test.mjs tests/case-lab-3-process-and-testimonials.test.mjs tests/case-lab-3-tickets-editorial.test.mjs tests/case-lab-3-assets.test.mjs`.
- [x] Run `npx tsc --noEmit --incremental false`.
- [x] Run `npm run build`.
- [x] Inspect `git diff --check` and the final diff; verify all twelve requested behaviors and confirm no unrelated files changed.
