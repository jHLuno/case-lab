# Case Lab 3 Topics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Обновить утвержденные темы трех кейсов во всех местах, где они отображаются на `/case-lab-3`.

**Architecture:** Сохранить текущую структуру данных и компонентов. Полные формулировки будут синхронно заменены в Hero-подписях и полях `title` массива `cases`; accessible-версия блока спикеров уже использует `item.title` и обновится автоматически.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules, Node test runner.

## Global Constraints

- Для `Qara Studios` использовать: `Как коллаборации и маркетинг масштабировали OYU Fest?`
- Для `Invictus GO` использовать: `Как построить маркетинг, который масштабируется вместе с бизнесом?`
- Для `Forte Bank × GForce Grey` использовать: `Как арт-инсталляция ForteBank разошлась по всему миру?`
- Описания кейсов, порядок, стили и metadata оставить без изменений.
- Не добавлять зависимости, environment variables или новые публичные API.
- Не менять незатронутые пользователем файлы и существующие изменения в рабочем дереве.

---

### Task 1: Add Topic Source Contracts

**Files:**
- Modify: `tests/case-lab-3-assets.test.mjs:72-80`
- Test: `tests/case-lab-3-assets.test.mjs`

**Interfaces:**
- Consumes: `heroSource` and `speakersSource`, loaded from the existing Hero and Speakers components.
- Produces: source-level assertions that require each approved topic in both display components and reject the previous topic copy.

- [x] **Step 1: Add a failing source-contract test**

Add this test after the existing hero event details test:

```js
test("Case Lab 3 topics are synchronized across Hero and speakers", () => {
  const invictusTopic = "Как построить маркетинг, который масштабируется вместе с бизнесом?";
  const qaraTopic = "Как коллаборации и маркетинг масштабировали OYU Fest?";
  const forteTopic = "Как арт-инсталляция ForteBank разошлась по всему миру?";

  assert.equal(heroSource.split(invictusTopic).length - 1, 1);
  assert.equal(speakersSource.split(invictusTopic).length - 1, 1);
  assert.equal(heroSource.split(qaraTopic).length - 1, 1);
  assert.equal(speakersSource.split(qaraTopic).length - 1, 1);
  assert.equal(heroSource.split(forteTopic).length - 1, 1);
  assert.equal(speakersSource.split(forteTopic).length - 1, 1);
  assert.doesNotMatch(heroSource, /Масштабирование сети фитнес-клубов|Что сработало в продвижении OYU Fest\?/);
  assert.doesNotMatch(heroSource, /Как история<br \/>стала арт-объектом\?/);
  assert.doesNotMatch(speakersSource, /Как масштабировать точки и не потерять спрос|Что осталось после OYU Fest 2026|Когда инсталляция становится метрикой/);
});
```

- [x] **Step 2: Run the focused test and confirm it fails against the old copy**

Run: `node --test tests/case-lab-3-assets.test.mjs`

Expected: FAIL in `Case Lab 3 topics are synchronized across Hero and speakers`, because the old Hero and speaker topic strings are still present.

### Task 2: Replace Approved Topics

**Files:**
- Modify: `app/sections/CaseLab3Hero.tsx:96-120`
- Modify: `app/sections/CaseLab3Speakers.tsx:7-35`

**Interfaces:**
- Consumes: the existing `cases` order, Hero card markup, and `item.title` rendering in the accessible speaker tree.
- Produces: identical approved topic strings for Invictus GO, Qara Studios, and Forte Bank × GForce Grey in both visual locations.

- [x] **Step 1: Replace the three Hero card descriptions**

In `app/sections/CaseLab3Hero.tsx`, replace only the two `caseRoomCaseFeaturedDescription` contents:

```tsx
<span className={styles.caseRoomCaseFeaturedDescription}>Как построить маркетинг, который масштабируется вместе с бизнесом?</span>
```

and:

```tsx
<span className={styles.caseRoomCaseFeaturedDescription}>Как коллаборации и маркетинг масштабировали OYU Fest?</span>
```

and:

```tsx
<span className={styles.caseRoomCaseFeaturedDescription}>Как арт-инсталляция ForteBank разошлась по всему миру?</span>
```

- [x] **Step 2: Replace the three speaker case titles**

In the `cases` array in `app/sections/CaseLab3Speakers.tsx`, replace only these fields:

```ts
title: "Как построить маркетинг, который масштабируется вместе с бизнесом?",
```

and:

```ts
title: "Как коллаборации и маркетинг масштабировали OYU Fest?",
```

and:

```ts
title: "Как арт-инсталляция ForteBank разошлась по всему миру?",
```

Leave each `description`, the case order, and all non-topic case data unchanged. The existing `{item.title}` binding updates both the desktop copy layer and accessible/mobile case copy.

- [x] **Step 3: Run the focused source-contract test**

Run: `node --test tests/case-lab-3-assets.test.mjs`

Expected: PASS, including the new synchronized-topic test.

### Task 3: Run Repository Verification

**Files:**
- Review: `app/sections/CaseLab3Hero.tsx`
- Review: `app/sections/CaseLab3Speakers.tsx`
- Review: `tests/case-lab-3-assets.test.mjs`

**Interfaces:**
- Consumes: the updated source strings and the existing repository checks.
- Produces: verified topic coverage without unrelated source or formatting changes.

- [x] **Step 1: Run all Case Lab 3 tests**

Run: `node --test tests/case-lab-3-*.test.mjs`

Expected: all tests pass.

- [x] **Step 2: Run TypeScript verification**

Run: `npx tsc --noEmit --incremental false`

Expected: exit code `0`.

- [x] **Step 3: Run lint**

Run: `npm run lint`

Expected: exit code `0`.

- [x] **Step 4: Check patch formatting and scope**

Run: `git diff --check`

Expected: no output and exit code `0`. Review `git diff -- app/sections/CaseLab3Hero.tsx app/sections/CaseLab3Speakers.tsx tests/case-lab-3-assets.test.mjs` and confirm only the requested topic strings and their source assertions changed; do not include unrelated existing worktree changes.
