# Case Lab 3 Mobile Process Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 20px gap between the process description and the first step divider on phone widths.

**Architecture:** Keep the current mobile single-column process layout and add `margin-top: 20px` to `.howItWorksSteps` inside the existing `max-width: 767px` media query. This mirrors the existing `padding-bottom: 20px` on each `.howItWorksStep` without changing internal step spacing or tablet/desktop behavior.

**Tech Stack:** Next.js App Router, CSS Modules, Node test runner, TypeScript, ESLint.

## Global Constraints

- Only the mobile process layout at `max-width: 767px` changes.
- The desktop/tablet layout, step content, scoreboard behavior, and other routes remain unchanged.
- The mobile `.howItWorksSteps` list receives `margin-top: 20px`.
- The list's internal `gap: 0` and each step's existing `padding: 20px 0` remain unchanged.
- Do not add dependencies or change checkout, navigation, or motion behavior.

---

### Task 1: Add mobile process spacing

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css:1507-1517` for the mobile process list rule.
- Modify: `tests/case-lab-3-p2.test.mjs:650-655` to cover the mobile spacing contract.

**Interfaces:**
- Consumes: Existing `.howItWorksOutcome`, `.howItWorksSteps`, and `.howItWorksStep` styles.
- Produces: A 20px separation before the first mobile step divider; no new component interface.

- [ ] **Step 1: Add the failing regression test**

Add this test after the existing scoreboard visibility test:

```js
test("Case Lab 3 matches the mobile process spacing rhythm", () => {
  assert.match(
    caseLabStylesSource,
    /@media \(max-width: 767px\)[\s\S]*?\.howItWorksSteps\s*\{[^}]*margin-top:\s*20px;/,
  );
  assert.match(caseLabStylesSource, /\.howItWorksStep\s*\{[\s\S]*?padding:\s*20px 0;/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs
```

Expected: the new spacing assertion fails because the mobile `.howItWorksSteps` rule currently has no `margin-top: 20px`.

- [ ] **Step 3: Implement the minimal CSS change**

Inside the existing mobile `.howItWorksSteps` rule, add the single spacing declaration:

```css
  .howItWorksSteps {
    margin-top: 20px;
  }
```

Preserve the existing `padding-left`, list structure, step padding, and all non-mobile rules.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 5: Run the complete verification suite**

Run from the repository root:

```bash
node --test tests/*.test.mjs
rtk tsc --noEmit --incremental false
rtk lint
rtk npm run build
rtk git diff --check
```

Expected: all tests pass, TypeScript reports no errors, ESLint reports no issues, the production build completes successfully, and `git diff --check` is clean.

- [ ] **Step 6: Review and commit the implementation**

Confirm the diff contains only the mobile spacing declaration and its regression test, then run:

```bash
rtk git add app/case-lab-3/case-lab-3.module.css tests/case-lab-3-p2.test.mjs
rtk git commit -m "fix(case-lab-3): align mobile process spacing"
```

Expected: one commit containing the mobile process spacing change and its regression assertion.
