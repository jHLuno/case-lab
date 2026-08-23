# Case Lab III Hero CTA Implementation Plan

> **For agentic workers:** Implement this plan task-by-task and verify the result before completion.

**Goal:** Replace the first-screen ticket CTA with a specular WebGL button and keep the button adjacent to the ticket-price text on the right.

**Architecture:** Keep the effect isolated in a reusable client-side `SpecularButton` with a CSS module. Use a two-column desktop footer with the date/place on the left and a flex purchase group containing the button and price on the right; switch back to the current stacked layout at the responsive breakpoint.

**Tech Stack:** Next.js App Router, React, CSS Modules, TypeScript.

## Global Constraints

- Change only the first-screen hero CTA.
- Preserve the current checkout action, mobile behavior, and tickets-section CTA.
- Do not add dependencies or touch unrelated worktree changes; `ogl` is already installed.

---

### Task 1: Add the specular button

**Files:**
- Create: `app/components/SpecularButton.tsx`
- Create: `app/components/SpecularButton.module.css`
- Modify: `app/sections/CaseLab3Hero.tsx:1-92`
- Modify: `app/case-lab-3/case-lab-3.module.css:119-145,379-423,830-834`

**Interfaces:**
- Consumes: Existing `.heroCta` and `caseLab3CheckoutHref`.
- Produces: A client-side hero CTA with `padding: 14px 76px`, `font-size: 16px`, a `20px` arrow, and preserved checkout navigation, adjacent to the ticket-price text. `.ticketCta` remains unchanged.

- [x] **Step 1: Render the hero SpecularButton**

Render `SpecularButton` in the hero with the existing checkout target and the requested visual sizing:

```css
<SpecularButton
  size="lg"
  radius={999}
  tint="#ffffff"
  tintOpacity={1}
  textColor="#160f43"
  className={styles.heroCta}
  style={{ padding: "14px 76px", fontSize: "16px" }}
  onClick={() => window.location.assign(caseLab3CheckoutHref)}
>
  Купить билет
  <ArrowUpRight size={20} strokeWidth={2} aria-hidden="true" />
</SpecularButton>
```

- [x] **Step 2: Align the desktop hero footer**

Use a two-column grid for `.caseRoomShapeFooter` and a horizontal flex layout for `.caseRoomPurchase` on desktop so the button sits beside the price. Restore the existing flex column layout at `max-width: 900px`.

Expected: The date, CTA, and price align horizontally on desktop; mobile/tablet layouts remain stacked.

- [x] **Step 3: Run checks**

Run: `npm run lint`, `npx tsc --noEmit --incremental false`, and `npm run build`

Expected: All commands exit successfully with no lint, TypeScript, or build errors.

- [x] **Step 4: Inspect worktree scope**

Run: `git status --short`

Expected: Only the intended CSS change and the newly added planning/spec documents are attributable to this task; existing unrelated modifications remain untouched.
