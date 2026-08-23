# Case Lab 3 Speakers Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the speakers section the second section on the Case Lab 3 landing page, immediately after the Hero.

**Architecture:** Reuse the existing `CaseLab3Speakers` section and its current responsive styles. Change the composition order in `CaseLab3Page`, use the three current Case Lab 3 visual assets in the speaker section, and add a short program explanation plus stronger image captions. The proof section remains available directly after speakers for now and can be reordered later as part of the full page-structure pass.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules.

## Global Constraints

- Keep the existing Case Lab 3 visual language, content, anchors, and responsive behavior.
- Do not add dependencies, assets, or new client boundaries.
- Do not modify unrelated worktree changes.

---

### Task 1: Move Speakers Into Block 2

**Files:**
- Modify: `app/components/CaseLab3Page.tsx:15-18`
- Modify: `app/sections/CaseLab3Speakers.tsx:7-83`
- Modify: `app/case-lab-3/case-lab-3.module.css:646-684`

**Interfaces:**
- Consumes: Existing `CaseLab3Hero`, `CaseLab3Speakers`, and `CaseLab3Proof` components.
- Produces: Render order `Hero → Speakers → Proof`, with current case visuals and speaker-case captions.

- [ ] **Step 1: Update the page composition**

Change the JSX order so `CaseLab3Speakers` renders immediately after `CaseLab3Hero`, before `CaseLab3Proof`:

```tsx
      <CaseLab3Navbar />
      <CaseLab3Hero />
      <CaseLab3Speakers />
      <CaseLab3Proof />
```

- [ ] **Step 2: Make the section explicitly about the current speakers**

In `CaseLab3Speakers`, use `/Invictus GO.webp`, `/OYU Fest 2026.webp`, and `/ForteXGForce.webp` for the three current case visuals. Set the section label to `На сцене`, add the explanatory copy `Не пересказ со стороны: контекст, решения и последствия от людей, которые отвечали за результат.`, and render each visual caption with its case company.

- [ ] **Step 3: Style the visual captions**

Keep the existing overlay treatment, but render the caption as a two-line grid with a small sequence label and a larger company name aligned to the lower-left of each visual.

- [ ] **Step 4: Run the TypeScript check**

Run: `npx tsc --noEmit --incremental false`

Expected: command exits with status 0.

- [ ] **Step 5: Run production checks**

Run: `npm run lint && npm run build`

Expected: both commands complete successfully with no ESLint or TypeScript errors.

- [ ] **Step 6: Review the final diff**

Run: `git diff -- app/components/CaseLab3Page.tsx`

Expected: only the speakers/proof order changes in the page composition; unrelated worktree changes remain untouched.
