# Case Lab 3 Section Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/case-lab-3` a consistent `48px` headline-to-content gap and a `72px` content-to-next-headline handoff gap across desktop, tablet, and mobile.

**Architecture:** Keep the existing React structure and GSAP scene. Define spacing tokens in the Case Lab 3 CSS module, use them for section boundaries and content starts, and use a native sticky speakers stage so its `300svh` scroll runway does not cause JS pin/unpin jumps.

The shared global stylesheet makes `body` a horizontal-hidden scroll container, so the CSS module must scope `overflow-x: clip` and `overflow-y: visible` to `html` and `body` while `#case-lab-3-speakers` exists.

**Tech Stack:** Next.js 16 App Router, React 19, CSS Modules, GSAP ScrollTrigger, TypeScript.

## Global Constraints

- CSS-only implementation in the Case Lab 3 module.
- Preserve the desktop/tablet sticky speakers interaction and reduced-motion behavior.
- Preserve the existing mobile fallback list.
- Do not modify existing unrelated worktree changes.
- Use `48px` for headline-to-content and `72px` for content-to-next-headline.
- Give each desktop/tablet photo state the same `0.8` stable hold and use `0.32` for each crossfade.
- Keep the stage grid visible while it approaches the sticky scene; do not add a blank pre-lock state.

---

### Task 1: Normalize Case Lab 3 Section Rhythm

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css:528-675, 781-805, 851-862, 989-1057`
- Test: `npx tsc --noEmit --incremental false`
- Test: `npm run build`

**Interfaces:**
- Consumes: Existing `.proofSection`, `.speakersSection`, `.archiveSection`, `.ticketSection`, `.speakerScene`, `.speakerStage`, `.speakerStageGrid`, `.speakerMobileCases`, `.proofGrid`, and `.archiveIntro` rules.
- Produces: CSS custom properties `--case-lab-headline-content-gap` and `--case-lab-content-next-headline-gap`, shared spacing behavior, and a centered native-sticky speaker stage.

- [ ] **Step 1: Define the shared spacing tokens and section boundary behavior**

Add the tokens to the Case Lab 3 section selectors:

```css
--case-lab-headline-content-gap: 48px;
--case-lab-content-next-headline-gap: calc(var(--case-lab-headline-content-gap) * 1.5);
```

Use the `72px` handoff token as the top padding for the speakers, archive, and ticket sections, and set the white content sections' bottom padding to `0` so the combined distance to the next headline is not doubled by adjacent section padding. For the desktop/tablet speakers-to-proof transition, use a `48px` stage inset plus the remaining `24px` proof top padding; keep the mobile proof top padding at `72px` because the pinned stage is hidden there. Preserve the ticket section's existing bottom padding for the footer transition.

- [ ] **Step 2: Set the shared headline-to-content gap**

Replace the proof grid's responsive `64px`/`42px` top margin with `var(--case-lab-headline-content-gap)`. Replace the archive intro's `56px` bottom margin with the same token. Set the desktop speakers scene and mobile speakers list to the same token.

- [ ] **Step 3: Remove the speakers parent-layout gap**

Keep `.speakerScene` at `min-height: 300svh` for ScrollTrigger, remove its desktop/tablet outer top margin, make `.speakerStage` `position: sticky; top: 0`, change it to `align-items: center` with no extra top padding, remove the `.speakerStageGrid` vertical transform, keep the grid visible in normal flow, and size it to `calc(100svh - (var(--case-lab-headline-content-gap) * 2))`. Add the route-scoped `html:has(#case-lab-3-speakers)` and `body:has(#case-lab-3-speakers)` overflow override. Remove `pin: stage` from both ScrollTrigger configurations while leaving the timeline, reduced-motion state updates, and `scrub` behavior unchanged. Build the timeline with `0.8` stable holds before, between, and after the two `0.32` crossfades.

- [ ] **Step 4: Normalize responsive overrides**

Update later media-query rules that would otherwise override the shared values: the desktop `.speakerScene` margin, the mobile `.speakerMobileCases` margin, the mobile `.proofGrid` margin, the speakers-to-proof padding override, and the archive section's responsive top/bottom padding.

- [ ] **Step 5: Inspect the focused diff**

Run:

```bash
git diff -- app/case-lab-3/case-lab-3.module.css
```

Expected: only spacing, alignment, and related responsive override changes in the Case Lab 3 CSS module. No React, animation, asset, or unrelated worktree files are changed by this task.

- [ ] **Step 6: Run static verification**

Run:

```bash
npx tsc --noEmit --incremental false
npm run build
```

Expected: both commands exit successfully. If an existing repository issue prevents either command, report the exact command and error without changing unrelated files.
