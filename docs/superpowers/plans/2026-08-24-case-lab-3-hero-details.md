# Case Lab 3 Hero Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Упростить видимые детали события в hero на `/case-lab-3`, сохранив число `24` и увеличив размер текста рядом с ним на `2px`.

**Architecture:** Изменить существующую JSX-разметку `CaseLab3Hero` и единственное CSS-правило `.caseRoomDetails span`. Другие данные события, purchase-блок и секции страницы не затрагиваются.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, Node test runner.

## Global Constraints

- Сохранить число `24` без изменений.
- Оставить рядом только строки `СЕНТЯБРЯ`, `10:00–14:00`, `NARXOZ BUSINESS SCHOOL`.
- Удалить год, часовой пояс, длительность и адрес из видимого hero-блока.
- Изменить `.caseRoomDetails span` с `10px` на `12px`.
- Не менять purchase-блок, адаптивную структуру или другие секции страницы.
- Не добавлять зависимости, environment variables или изменения публичного API.

---

### Task 1: Update Hero Event Details

**Files:**
- Modify: `app/sections/CaseLab3Hero.tsx:69-76`
- Modify: `app/case-lab-3/case-lab-3.module.css:444-451`
- Test: `tests/case-lab-3-assets.test.mjs`

**Interfaces:**
- Consumes: existing `CaseLab3Hero` markup and CSS module class `caseRoomDetails`.
- Produces: hero details that render the unchanged `24` followed by exactly three requested lines, with `12px` text size.

- [ ] **Step 1: Add source-contract assertions for the requested hero details**

Add assertions after the existing hero heading assertions in `tests/case-lab-3-assets.test.mjs`:

```js
assert.match(heroSource, /<strong>24<\/strong>/);
assert.match(heroSource, /СЕНТЯБРЯ 2026<br \/>/);
assert.match(heroSource, /10:00–14:00 \(UTC\+5\), 4 ЧАСА<br \/>/);
assert.match(heroSource, /УЛ\. ЖАНДОСОВА 55\/10, АЛМАТЫ/);
```

- [ ] **Step 2: Run the focused test and verify the old contract passes before changing implementation**

Run: `node --test tests/case-lab-3-assets.test.mjs`

Expected: PASS, confirming the test reads the current source and will fail once the requested copy changes.

- [ ] **Step 3: Replace the visible details copy while preserving the number**

In `app/sections/CaseLab3Hero.tsx`, keep the surrounding structure and replace the existing span contents with:

```tsx
<span>
  СЕНТЯБРЯ<br />
  10:00–14:00<br />
  NARXOZ BUSINESS SCHOOL
</span>
```

Keep this immediately after the unchanged `<strong>24</strong>`.

- [ ] **Step 4: Increase only the adjacent details text by 2px**

In `.caseRoomDetails span` in `app/case-lab-3/case-lab-3.module.css`, change only:

```css
font-size: 12px;
```

Leave `.caseRoomDetails strong` unchanged so the `24` keeps its current size.

- [ ] **Step 5: Update the source-contract assertions to the new copy**

Replace the temporary old-copy assertions in `tests/case-lab-3-assets.test.mjs` with:

```js
assert.match(heroSource, /<strong>24<\/strong>/);
assert.match(heroSource, /СЕНТЯБРЯ<br \/>/);
assert.match(heroSource, /10:00–14:00<br \/>/);
assert.match(heroSource, /NARXOZ BUSINESS SCHOOL/);
assert.doesNotMatch(heroSource, /СЕНТЯБРЯ 2026|UTC\+5|4 ЧАСА|ЖАНДОСОВА/);
assert.match(caseLabStyles, /\.caseRoomDetails span\s*\{[^}]*font-size:\s*12px;/s);
assert.match(caseLabStyles, /\.caseRoomDetails strong\s*\{[^}]*font-size:\s*clamp\(32px, 3\.5vw, 52px\);/s);
```

- [ ] **Step 6: Run focused verification**

Run: `node --test tests/case-lab-3-assets.test.mjs`

Expected: PASS.

- [ ] **Step 7: Run repository checks**

Run: `npx tsc --noEmit --incremental false`

Expected: exit code `0`.

Run: `npm run lint`

Expected: exit code `0`.

Run: `git diff --check`

Expected: no output and exit code `0`.

Review the final diff to confirm that only the requested hero copy, adjacent font size, and its focused test/specification files changed.
