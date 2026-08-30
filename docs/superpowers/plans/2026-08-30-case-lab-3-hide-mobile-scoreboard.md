# Case Lab 3 Mobile Scoreboard Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hide the `ТОП-3` scoreboard and its prize copy on phone widths while preserving the tablet and desktop presentation.

**Architecture:** Add one scoped CSS override to the existing `max-width: 767px` media query. Keep the scoreboard markup in place so the `768px+` layout is unchanged; `display: none` removes the complete mobile block, including its divider and accessible content, without leaving layout space.

**Tech Stack:** Next.js App Router, CSS Modules, Node test runner, TypeScript, ESLint.

## Global Constraints

- The change applies only at the existing mobile breakpoint `max-width: 767px`.
- At `768px` and above, the scoreboard remains unchanged.
- JSX, copy, desktop/tablet layout, and other routes remain unchanged.
- Inside the existing mobile media query, set `.howItWorksScoreboard` to `display: none`.
- Preserve the existing uncommitted speaker-card title adjustment `font-size: clamp(18px, 5vw, 18px)`.
- Do not add dependencies or change checkout, navigation, or motion behavior.

---

### Task 1: Hide the mobile scoreboard

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css:1481-1504` for the existing mobile process-section rules.
- Modify: `tests/case-lab-3-p2.test.mjs:621-648` to cover the mobile-only hide and preserve the current speaker-card assertion.

**Interfaces:**
- Consumes: Existing `.howItWorksScoreboard` markup from `app/sections/CaseLab3HowItWorks.tsx`.
- Produces: A process section without the scoreboard at widths up to `767px`, while retaining the existing block at `768px+`.

- [ ] **Step 1: Update the existing speaker-card assertion for the current working-tree value**

The working tree already contains the user's uncommitted title-size refinement. Update only the expected value in the existing test so it matches that preserved CSS:

```js
/@media \(max-width: 767px\)[\s\S]*?\.speakerAccessibleCase h3\s*\{[\s\S]*?font-size:\s*clamp\(18px,\s*5vw,\s*18px\);[\s\S]*?line-height:\s*1\.02;/
```

- [ ] **Step 2: Add the failing scoreboard regression test**

Add this test after the existing responsive alignment test in `tests/case-lab-3-p2.test.mjs`:

```js
test("Case Lab 3 hides the scoreboard on phone widths only", () => {
  assert.match(
    caseLabStylesSource,
    /@media \(max-width: 767px\)[\s\S]*?\.howItWorksScoreboard\s*\{[^}]*display:\s*none;/,
  );
});
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs
```

Expected: the test suite still fails because the mobile `.howItWorksScoreboard` rule currently only changes margins and does not set `display: none`.

- [ ] **Step 4: Implement the minimal mobile CSS change**

Inside the existing `@media (max-width: 767px)` block that contains `.howItWorksScoreboard`, add `display: none` and preserve its breakpoint scope:

```css
  .howItWorksScoreboard {
    display: none;
  }
```

Do not remove the JSX or alter the base scoreboard styles, because tablet and desktop must retain the current divider, label, and prize copy.

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 6: Run the complete verification suite**

Run from the repository root:

```bash
node --test tests/*.test.mjs
rtk tsc --noEmit --incremental false
rtk lint
rtk npm run build
rtk git diff --check
```

Expected: all tests pass, TypeScript reports no errors, ESLint reports no issues, the production build completes successfully, and `git diff --check` is clean.

- [ ] **Step 7: Review and commit only the intended implementation files**

Review the diff. Preserve the user's existing CSS adjustment, and stage only the CSS and test files for this implementation:

```bash
rtk git add app/case-lab-3/case-lab-3.module.css tests/case-lab-3-p2.test.mjs
rtk git commit -m "fix(case-lab-3): hide mobile scoreboard"
```

Expected: one implementation commit containing the mobile scoreboard hide and its regression assertion; no unrelated files are staged.
