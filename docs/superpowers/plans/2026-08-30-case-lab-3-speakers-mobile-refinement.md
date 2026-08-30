# Case Lab 3 Speakers Mobile Refinement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the mobile speaker card titles more compact and reveal the tops of all three speaker photos.

**Architecture:** Keep the existing mobile accessible-card fallback and apply two scoped CSS overrides inside the current `max-width: 767px` media query. No JSX, assets, desktop sticky-stage behavior, or shared components change.

**Tech Stack:** Next.js App Router, React, CSS Modules, Node test runner, TypeScript, ESLint.

## Global Constraints

- Only the mobile accessible card presentation is in scope.
- The desktop sticky speaker stage, JSX structure, copy, image assets, and other routes remain unchanged.
- At `max-width: 767px`, use `font-size: clamp(18px, 5vw, 22px)` and `line-height: 1.02` for `.speakerAccessibleCase h3`.
- At `max-width: 767px`, use `object-position: center top` for `.speakerAccessibleVisual > img`.
- Keep the current visual container height, spacing, card treatment, and body copy sizing.
- Do not add dependencies or change checkout, navigation, or motion behavior.

---

### Task 1: Refine mobile speaker cards

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css:1589-1650` for the existing mobile accessible-card rules.
- Modify: `tests/case-lab-3-p2.test.mjs:621-637` to cover the new mobile CSS contract.

**Interfaces:**
- Consumes: Existing `.speakerAccessibleCase`, `.speakerAccessibleVisual`, and Next/Image `fill` markup from `app/sections/CaseLab3Speakers.tsx`.
- Produces: Mobile speaker cards with compact case titles and top-aligned photo crops; no new component interface.

- [ ] **Step 1: Write the failing regression test**

Add this test after the existing responsive alignment test in `tests/case-lab-3-p2.test.mjs`:

```js
test("Case Lab 3 mobile speaker cards keep titles compact and reveal photo tops", () => {
  assert.match(
    caseLabStylesSource,
    /@media \(max-width: 767px\)[\s\S]*?\.speakerAccessibleCase h3\s*\{[\s\S]*?font-size:\s*clamp\(18px,\s*5vw,\s*22px\);[\s\S]*?line-height:\s*1\.02;/,
  );
  assert.match(
    caseLabStylesSource,
    /@media \(max-width: 767px\)[\s\S]*?\.speakerAccessibleVisual > img\s*\{[\s\S]*?object-position:\s*center top;/,
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs
```

Expected: the existing tests pass, but the new test fails because the current mobile title rule still uses `clamp(20px, calc(7vw - 6px), 26px)` and no mobile photo `object-position` override exists.

- [ ] **Step 3: Implement the minimal CSS change**

Inside the existing `@media (max-width: 767px)` block in `app/case-lab-3/case-lab-3.module.css`, add the image rule and replace the mobile title values:

```css
  .speakerAccessibleVisual > img { object-position: center top; }
  .speakerAccessibleCase h3 {
    margin: 0;
    font-family: var(--font-heading);
    font-size: clamp(18px, 5vw, 22px);
    font-weight: 400;
    line-height: 1.02;
    overflow-wrap: anywhere;
  }
```

Preserve the existing `.speakerAccessibleCase` layout, image container height, paragraph rule, and all desktop rules.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 5: Run the complete verification suite**

Run each command from the repository root:

```bash
node --test tests/*.test.mjs
rtk tsc --noEmit --incremental false
rtk lint
rtk npm run build
rtk git diff --check
```

Expected: `76/76` tests pass, TypeScript reports no errors, ESLint reports no issues, the production build completes successfully, and `git diff --check` is clean.

- [ ] **Step 6: Review and commit the implementation**

Confirm the diff contains only the CSS rule changes and regression assertions, then run:

```bash
rtk git add app/case-lab-3/case-lab-3.module.css tests/case-lab-3-p2.test.mjs
rtk git commit -m "fix(case-lab-3): refine mobile speaker cards"
```

Expected: one commit containing only the mobile speaker-card refinement and its regression test.
