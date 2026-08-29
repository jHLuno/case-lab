# Case Lab 3 Topic Width Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Уменьшить количество строк у длинных тем в Hero на `/case-lab-3`, дав Qara Studios дополнительную ширину.

**Architecture:** Сохранить текущую сетку и карточки. Базовая ширина тем остается `20ch`, а Qara получает отдельный modifier-класс с `max-width: 22ch`; Invictus и Forte не меняются.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, Node test runner.

## Global Constraints

- Сохранить для обычных тем максимальную ширину `.caseRoomCaseFeaturedDescription` в `20ch`.
- Установить для темы Qara Studios отдельную максимальную ширину `22ch`.
- Сохранить общий контейнер карточек, отступы, типографику, мобильную структуру и тексты без изменений.
- Не менять ширину обычных подписей карточек и другие секции страницы.
- Не добавлять зависимости, environment variables или новые публичные API.

---

### Task 1: Add the Width Source Contract

**Files:**
- Modify: `tests/case-lab-3-assets.test.mjs:94-97`
- Test: `tests/case-lab-3-assets.test.mjs`

**Interfaces:**
- Consumes: the existing `caseLabStyles` source string.
- Produces: source-level assertions requiring the shared topic selector to use `max-width: 20ch` and Qara's modifier to use `max-width: 22ch`.

- [x] **Step 1: Add a failing source-contract test**

Add this test after the existing Hero card inset test:

```js
test("hero case topics use a wider text measure", () => {
  assert.match(caseLabStyles, /\.caseRoomCase \.caseRoomCaseFeaturedDescription\s*\{[^}]*max-width:\s*20ch;/s);
});

test("Qara hero topic uses the extra-wide text measure", () => {
  assert.match(
    heroSource,
    /className=\{`\$\{styles\.caseRoomCaseFeaturedDescription\} \$\{styles\.caseRoomCaseFeaturedDescriptionWide\}`\}/,
  );
  assert.match(
    caseLabStyles,
    /\.caseRoomCase \.caseRoomCaseFeaturedDescriptionWide\s*\{[^}]*max-width:\s*22ch;/s,
  );
});
```

- [x] **Step 2: Run the focused test and confirm it fails**

Run: `node --test tests/case-lab-3-assets.test.mjs`

Expected: FAIL in `Qara hero topic uses the extra-wide text measure`, because the Hero span and modifier selector do not yet exist.

### Task 2: Widen Only the Topic Text

**Files:**
- Modify: `app/sections/CaseLab3Hero.tsx:108`
- Modify: `app/case-lab-3/case-lab-3.module.css:544-553`

**Interfaces:**
- Consumes: the existing general `.caseRoomCase span { max-width: 18ch; }` rule and shared topic selector.
- Produces: Invictus and Forte topic text capped at `20ch`, Qara topic text capped at `22ch`, and ordinary card text still capped at `18ch`.

- [x] **Step 1: Add the topic-specific width override**

In the existing selector `.caseRoomCase .caseRoomCaseFeaturedDescription`, keep `max-width: 20ch;` before the typography declarations, and add a Qara-only modifier after it:

```css
.caseRoomCase .caseRoomCaseFeaturedDescription {
  max-width: 20ch;
  font-size: clamp(14px, 1.5vw, 18px);
  font-weight: 500;
  letter-spacing: -.02em;
  line-height: 1.08;
}

.caseRoomCase .caseRoomCaseFeaturedDescriptionWide {
  max-width: 22ch;
}
```

Add `styles.caseRoomCaseFeaturedDescriptionWide` to the Qara topic span in `app/sections/CaseLab3Hero.tsx`. Do not modify `.caseRoomCase span`, card padding, grid columns, mobile breakpoints, or any copy.

- [x] **Step 2: Run the focused source-contract test**

Run: `node --test tests/case-lab-3-assets.test.mjs`

Expected: all tests pass, including `hero case topics use a wider text measure`.

### Task 3: Run Layout and Repository Verification

**Files:**
- Review: `app/case-lab-3/case-lab-3.module.css`
- Review: `tests/case-lab-3-assets.test.mjs`

**Interfaces:**
- Consumes: the topic-specific `20ch` CSS override, Qara's `22ch` modifier, and existing responsive layout rules.
- Produces: verified layout source without unrelated changes.

- [x] **Step 1: Run the layout detector**

Run: `node /Users/arney/.agents/skills/impeccable/scripts/detect.mjs --json --scope layout app/sections/CaseLab3Hero.tsx app/case-lab-3/case-lab-3.module.css`

Expected: no new layout findings attributable to this change.

- [x] **Step 2: Run all Case Lab 3 tests**

Run: `node --test tests/case-lab-3-*.test.mjs`

Expected: all tests pass.

- [x] **Step 3: Run TypeScript verification**

Run: `npx tsc --noEmit --incremental false`

Expected: exit code `0`.

- [x] **Step 4: Run lint**

Run: `npm run lint`

Expected: exit code `0`.

- [x] **Step 5: Run the production build**

Run: `npm run build`

Expected: exit code `0`.

- [x] **Step 6: Check patch formatting**

Run: `git diff --check`

Expected: no output and exit code `0`. Review the targeted diff and preserve unrelated existing worktree changes.
