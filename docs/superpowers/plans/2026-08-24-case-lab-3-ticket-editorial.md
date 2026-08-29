# Case Lab III Ticket Editorial Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Case Lab III ticket section before testimonials and replace its plain pricing block with an image-led editorial ticket conversion section.

**Architecture:** Keep `CaseLab3Tickets` as a focused server-rendered section. Use a generated `next/image` background as decorative media, real HTML for all event and ticket data, and CSS Module classes for the responsive split layout. Preserve the existing `#tickets` anchor and disabled checkout behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, `next/image`, Lucide React, CSS Modules, Node source-level tests.

## Global Constraints

- Target order is `Hero -> Speakers -> How It Works -> Tickets -> Proof -> Cases -> FAQ`.
- Keep `#tickets`, heading association, and keyboard-focus target unchanged.
- Use the verified event data: 24 сентября 2026 года, 10:00–14:00, Narxoz Business School, Алматы, 100 мест, Early Bird 7 890 ₸ for the first 20 tickets, then 15 000 ₸.
- Use native disabled-button semantics; do not add a checkout URL, API, database, inventory counter, attendee avatars, or payment-brand marks.
- Store the generated background at `public/case-lab-3-tickets-bg.png`.
- Keep text and ticket data in HTML, not in the generated image.
- Keep the background decorative with an empty alt value and preserve reduced-motion behavior.
- Do not install packages or change the public navigation contract.

---

### Task 1: Add Ticket Section Regression Tests

**Files:**
- Create: `tests/case-lab-3-tickets-editorial.test.mjs`
- Read: `app/components/CaseLab3Page.tsx`
- Read: `app/sections/CaseLab3Tickets.tsx`
- Read: `app/case-lab-3/case-lab-3.module.css`

**Interfaces:**
- Consumes: current page source, ticket component source, and CSS Module source.
- Produces: source-level checks for section order, generated media, verified copy, and disabled CTA semantics.

- [ ] **Step 1: Write the failing focused test**

Create `tests/case-lab-3-tickets-editorial.test.mjs` with these assertions:

```js
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/components/CaseLab3Page.tsx", import.meta.url), "utf8");
const ticketSource = await readFile(new URL("../app/sections/CaseLab3Tickets.tsx", import.meta.url), "utf8");
const ticketStyles = await readFile(new URL("../app/case-lab-3/case-lab-3.module.css", import.meta.url), "utf8");

test("tickets appear after process and before proof", () => {
  const processIndex = pageSource.indexOf("<CaseLab3HowItWorks />");
  const ticketIndex = pageSource.indexOf("<CaseLab3Tickets />");
  const proofIndex = pageSource.indexOf("<CaseLab3Proof />");

  assert.ok(processIndex >= 0);
  assert.ok(ticketIndex > processIndex);
  assert.ok(proofIndex > ticketIndex);
});

test("ticket section uses the generated background and disabled CTA", () => {
  assert.match(ticketSource, /id="tickets"/);
  assert.match(ticketSource, /case-lab-3-tickets-bg\.png/);
  assert.match(ticketSource, /alt=""/);
  assert.match(ticketSource, /disabled/);
  assert.match(ticketSource, /aria-disabled="true"/);
  assert.match(ticketSource, /24 сентября 2026/);
  assert.match(ticketSource, /10:00–14:00/);
  assert.match(ticketSource, /Narxoz Business School/);
  assert.match(ticketSource, /100 мест/);
  assert.match(ticketSource, /7 890 ₸/);
  assert.match(ticketSource, /15 000 ₸/);
  assert.match(ticketSource, /Первые 20 билетов/);
});

test("ticket section exposes the editorial layout classes", () => {
  assert.match(ticketStyles, /\.ticketBackground\s*\{/);
  assert.match(ticketStyles, /\.ticketOverlay\s*\{/);
  assert.match(ticketStyles, /\.ticketPanel\s*\{/);
  assert.match(ticketStyles, /\.ticketFacts\s*\{/);
});
```

- [ ] **Step 2: Run the focused test and verify it fails for the unimplemented behavior**

Run:

```bash
node --test tests/case-lab-3-tickets-editorial.test.mjs
```

Expected: FAIL because the current page keeps tickets after cases, the component has no generated background or native `disabled` attribute, and the new CSS classes do not exist.

- [ ] **Step 3: Commit the regression test**

```bash
git add tests/case-lab-3-tickets-editorial.test.mjs
git commit -m "test(case-lab-3): specify editorial ticket section"
```

### Task 2: Add Background Asset And Move Section Order

**Files:**
- Create: `public/case-lab-3-tickets-bg.png`
- Modify: `app/components/CaseLab3Page.tsx:18-23`

**Interfaces:**
- Consumes: the generated preview at `/var/folders/86/7hqnmlds1332lmhclsts8gtw0000gn/T/opencode/case-lab-3-tickets-bg.png`.
- Produces: a committed public image path and the target section order consumed by the ticket component and navigation.

- [ ] **Step 1: Copy the reviewed generated image into the public asset directory**

Run:

```bash
cp "/var/folders/86/7hqnmlds1332lmhclsts8gtw0000gn/T/opencode/case-lab-3-tickets-bg.png" "/Users/arney/icomat-replica/public/case-lab-3-tickets-bg.png"
```

The copied asset must remain horizontal and must not contain text, logos, pricing, or UI.

- [ ] **Step 2: Move `CaseLab3Tickets` directly after `CaseLab3HowItWorks`**

Update the main sequence in `app/components/CaseLab3Page.tsx` to:

```tsx
        <CaseLab3Hero />
        <CaseLab3Speakers />
        <CaseLab3HowItWorks />
        <CaseLab3Tickets />
        <CaseLab3Proof />
        <Cases alignToCaseLab />
        <CaseLab3FAQ />
```

- [ ] **Step 3: Run the focused test**

Run:

```bash
node --test tests/case-lab-3-tickets-editorial.test.mjs
```

Expected: the order and asset assertions pass; markup and CSS assertions remain red until Task 3 and Task 4.

- [ ] **Step 4: Commit the order and asset**

```bash
git add public/case-lab-3-tickets-bg.png app/components/CaseLab3Page.tsx
git commit -m "feat(case-lab-3): move tickets before testimonials"
```

### Task 3: Build Semantic Ticket Markup

**Files:**
- Modify: `app/sections/CaseLab3Tickets.tsx:1-53`

**Interfaces:**
- Consumes: `/case-lab-3-tickets-bg.png`, the existing `ScrollReveal`, CSS classes from Task 4, and the existing `#tickets` section contract.
- Produces: accessible ticket content with real event facts, prices, included benefits, and a disabled primary button.

- [ ] **Step 1: Replace the current two-column ticket markup with the editorial structure**

Use this complete component implementation:

```tsx
import Image from "next/image";
import { ArrowUpRight, CalendarDays, Check, MapPin, UsersRound } from "lucide-react";
import ScrollReveal from "../components/ScrollReveal";
import styles from "../case-lab-3/case-lab-3.module.css";

const included = [
  "три подробных разбора кейсов",
  "живой разговор с CMO после выступлений",
  "знакомства с людьми из маркетинга и креатива",
];

export default function CaseLab3Tickets() {
  return (
    <section id="tickets" tabIndex={-1} className={styles.ticketSection} aria-labelledby="case-lab-3-tickets-title">
      <div className={styles.ticketBackground} aria-hidden="true">
        <Image
          src="/case-lab-3-tickets-bg.png"
          alt=""
          fill
          sizes="100vw"
          loading="lazy"
          className={styles.ticketBackgroundImage}
        />
      </div>
      <div className={styles.ticketOverlay} aria-hidden="true" />

      <div className={styles.contentShell}>
        <div className={styles.ticketGrid}>
          <ScrollReveal>
            <div className={styles.ticketLead}>
              <p className={styles.ticketKicker}>Билет</p>
              <h2 id="case-lab-3-tickets-title">Прийти за кейсом. Уйти с решением.</h2>
              <p className={styles.ticketCopy}>
                Case Lab III — это три реальных кейса от CMO ведущих компаний Казахстана,
                живой разбор с залом и ответы на вопросы, которые обычно остаются за кадром.
              </p>

              <div className={styles.ticketFacts} aria-label="Детали мероприятия">
                <div className={styles.ticketFact}>
                  <CalendarDays size={23} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <strong>24 сентября 2026</strong>
                    <small>10:00–14:00</small>
                  </span>
                </div>
                <div className={styles.ticketFact}>
                  <MapPin size={23} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <strong>Narxoz Business School</strong>
                    <small>Алматы</small>
                  </span>
                </div>
                <div className={styles.ticketFact}>
                  <UsersRound size={23} strokeWidth={1.5} aria-hidden="true" />
                  <span>
                    <strong>100 мест</strong>
                    <small>в зале</small>
                  </span>
                </div>
              </div>

              <button type="button" className={styles.ticketCta} disabled aria-disabled="true">
                Купить билет
                <ArrowUpRight size={18} strokeWidth={2} aria-hidden="true" />
              </button>
            </div>
          </ScrollReveal>

          <ScrollReveal delay={0.12}>
            <div className={styles.ticketPanel} aria-label="Стоимость и содержание билета">
              <div className={styles.ticketPanelHeader}>
                <span className={styles.ticketBadge}>Early Bird</span>
                <span>Первые 20 билетов</span>
              </div>

              <div className={styles.ticketPrice}>
                <strong>7 890</strong>
                <span>₸</span>
              </div>

              <div className={styles.ticketPriceNote}>Специальная цена на первые 20 билетов</div>

              <div className={styles.ticketLaterPrice}>
                <span>Затем</span>
                <strong>15 000 ₸</strong>
              </div>

              <div className={styles.ticketIncluded}>
                <p>В билет входит:</p>
                <ul>
                  {included.map((item) => (
                    <li key={item}>
                      <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Run TypeScript and the focused test**

Run:

```bash
npx tsc --noEmit --incremental false
node --test tests/case-lab-3-tickets-editorial.test.mjs
```

Expected: TypeScript passes; the focused test still reports only the missing CSS class assertions.

- [ ] **Step 3: Commit the semantic markup**

```bash
git add app/sections/CaseLab3Tickets.tsx
git commit -m "feat(case-lab-3): add ticket editorial content"
```

### Task 4: Style The Editorial Ticket Layout

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css:1039-1137`
- Modify: `app/case-lab-3/case-lab-3.module.css:1247-1279`
- Modify: `app/case-lab-3/case-lab-3.module.css:1400-1441`

**Interfaces:**
- Consumes: the class names emitted by the Task 3 component.
- Produces: desktop split composition, readable tablet layout, mobile stacking, and reduced-motion-safe disabled CTA styling.

- [ ] **Step 1: Replace the old ticket CSS block with the editorial styles**

Replace the current `.ticketSection` through `.ticketPriceBlock li svg` block with:

```css
.ticketSection {
  position: relative;
  isolation: isolate;
  overflow: hidden;
  background: #08061a;
  color: #fff;
  padding: clamp(84px, 10vw, 140px) 24px clamp(84px, 12vw, 160px);
}

.ticketBackground,
.ticketOverlay {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.ticketBackground {
  z-index: -3;
}

.ticketBackgroundImage {
  object-fit: cover;
  object-position: center;
}

.ticketOverlay {
  z-index: -2;
  background:
    linear-gradient(90deg, rgba(5, 4, 18, .98) 0%, rgba(5, 4, 18, .9) 38%, rgba(5, 4, 18, .58) 100%),
    linear-gradient(180deg, rgba(6, 5, 24, .42), #08061a 100%);
}

.ticketGrid {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(360px, .8fr);
  gap: clamp(36px, 8vw, 132px);
  align-items: center;
}

.ticketLead {
  max-width: 620px;
}

.ticketKicker {
  margin: 0 0 20px;
  color: #c3a3ff;
  font-family: var(--font-body);
  font-size: 12px;
  font-weight: 500;
  letter-spacing: .14em;
  text-transform: uppercase;
}

.ticketGrid h2 {
  max-width: 10ch;
  font-size: clamp(40px, 5.8vw, 82px);
  line-height: .94;
}

.ticketCopy {
  max-width: 47ch;
  margin: 28px 0 0;
  color: rgba(255, 255, 255, .72);
  font-size: clamp(16px, 1.45vw, 19px);
  line-height: 1.48;
}

.ticketFacts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px;
  margin-top: 42px;
  padding: 22px 0;
  border-top: 1px solid rgba(255, 255, 255, .2);
  border-bottom: 1px solid rgba(255, 255, 255, .2);
}

.ticketFact {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.ticketFact svg {
  flex: 0 0 auto;
  color: #bd8dff;
}

.ticketFact span {
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
}

.ticketFact strong,
.ticketFact small {
  font-family: var(--font-body);
  line-height: 1.2;
}

.ticketFact strong {
  font-size: 14px;
  font-weight: 500;
}

.ticketFact small {
  color: rgba(255, 255, 255, .62);
  font-size: 13px;
}

.ticketCta {
  width: min(100%, 340px);
  min-height: 54px;
  margin-top: 30px;
  justify-content: center;
  background: #9b54ff;
  color: #fff;
  font-size: 17px;
  box-shadow: 0 16px 44px rgba(128, 63, 255, .28);
}

.ticketCta:hover {
  background: #9b54ff;
  transform: none;
}

.ticketCta:disabled {
  cursor: not-allowed;
  opacity: .72;
}

.ticketPanel {
  position: relative;
  overflow: hidden;
  padding: clamp(24px, 3vw, 38px);
  border: 1px solid rgba(195, 163, 255, .55);
  border-radius: 30px;
  background: linear-gradient(145deg, rgba(38, 24, 88, .84), rgba(10, 8, 30, .86));
  box-shadow: 0 22px 80px rgba(2, 0, 20, .45), inset 0 1px 0 rgba(255, 255, 255, .14);
  backdrop-filter: blur(18px);
}

.ticketPanel::before {
  position: absolute;
  top: -18%;
  right: -18%;
  width: 62%;
  height: 42%;
  border-radius: 50%;
  background: rgba(156, 84, 255, .2);
  content: "";
  filter: blur(42px);
  pointer-events: none;
}

.ticketPanelHeader,
.ticketLaterPrice {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.ticketPanelHeader {
  position: relative;
  color: rgba(255, 255, 255, .72);
  font-size: 14px;
}

.ticketBadge {
  border-radius: 10px;
  background: rgba(86, 43, 179, .52);
  padding: 8px 12px;
  color: #e2ccff;
}

.ticketPrice {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-top: 22px;
}

.ticketPrice strong {
  color: #b687ff;
  font-family: var(--font-heading);
  font-size: clamp(56px, 7vw, 92px);
  font-weight: 400;
  letter-spacing: -.04em;
  line-height: .9;
}

.ticketPrice span {
  color: #d0b6ff;
  font-size: clamp(24px, 3vw, 38px);
}

.ticketPriceNote {
  margin-top: 12px;
  color: rgba(255, 255, 255, .56);
  font-size: 13px;
}

.ticketLaterPrice {
  margin-top: 28px;
  padding-top: 22px;
  border-top: 1px solid rgba(255, 255, 255, .18);
  color: rgba(255, 255, 255, .58);
  font-size: 14px;
}

.ticketLaterPrice strong {
  color: rgba(255, 255, 255, .84);
  font-family: var(--font-heading);
  font-size: clamp(30px, 4vw, 48px);
  font-weight: 400;
  line-height: .9;
}

.ticketIncluded {
  margin-top: 30px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, .18);
}

.ticketIncluded > p {
  margin: 0;
  color: rgba(255, 255, 255, .62);
  font-size: 13px;
  text-transform: uppercase;
  letter-spacing: .08em;
}

.ticketIncluded ul {
  display: grid;
  gap: 15px;
  margin: 20px 0 0;
  padding: 0;
  list-style: none;
}

.ticketIncluded li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: rgba(255, 255, 255, .82);
  font-size: 15px;
  line-height: 1.4;
}

.ticketIncluded li svg {
  flex: 0 0 auto;
  margin-top: 2px;
  color: #bf8dff;
}
```

- [ ] **Step 2: Remove conflicting ticket grid media rules and add responsive overrides**

Remove the existing `.ticketGrid { grid-template-columns: 1fr 1fr; ... }` rule inside `@media (max-width: 900px)` and the old one-column rule inside `@media (max-width: 1100px)`. Add the tablet rules in a `901px–1100px` range so they cannot override the mobile stack:

```css
@media (min-width: 901px) and (max-width: 1100px) {
  .ticketGrid {
    grid-template-columns: minmax(0, 1fr) minmax(320px, .82fr);
    gap: 48px;
  }

  .ticketPanel {
    padding: 28px;
  }
}

@media (max-width: 900px) {
  .ticketGrid {
    grid-template-columns: 1fr;
    gap: 54px;
  }

  .ticketLead,
  .ticketPanel {
    max-width: 720px;
  }
}

@media (max-width: 640px) {
  .ticketSection {
    padding-right: 16px;
    padding-left: 16px;
  }

  .ticketBackgroundImage {
    object-position: 68% center;
  }

  .ticketOverlay {
    background:
      linear-gradient(180deg, rgba(5, 4, 18, .84) 0%, rgba(5, 4, 18, .92) 54%, #08061a 100%),
      linear-gradient(90deg, rgba(5, 4, 18, .95), rgba(5, 4, 18, .62));
  }

  .ticketGrid h2 {
    max-width: 9ch;
    font-size: clamp(38px, 12vw, 58px);
  }

  .ticketFacts {
    grid-template-columns: 1fr;
    gap: 18px;
    margin-top: 34px;
  }

  .ticketCta {
    width: 100%;
    min-height: 48px;
  }

  .ticketPanel {
    padding: 24px 20px;
    border-radius: 24px;
  }

  .ticketPanelHeader {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}
```

- [ ] **Step 3: Run the focused test, lint, and TypeScript**

Run:

```bash
node --test tests/case-lab-3-tickets-editorial.test.mjs
npm run lint
npx tsc --noEmit --incremental false
```

Expected: all three commands pass with no new warnings or type errors.

- [ ] **Step 4: Commit the editorial styling**

```bash
git add app/case-lab-3/case-lab-3.module.css
git commit -m "feat(case-lab-3): style editorial ticket section"
```

### Task 5: Run Final Verification

**Files:**
- Verify: `app/components/CaseLab3Page.tsx`
- Verify: `app/sections/CaseLab3Tickets.tsx`
- Verify: `app/case-lab-3/case-lab-3.module.css`
- Verify: `public/case-lab-3-tickets-bg.png`
- Verify: `tests/case-lab-3-tickets-editorial.test.mjs`

**Interfaces:**
- Consumes: all implementation changes from Tasks 1–4.
- Produces: verified ticket section with a clean worktree except for any intentionally unrelated user changes.

- [ ] **Step 1: Run the focused ticket test**

```bash
node --test tests/case-lab-3-tickets-editorial.test.mjs
```

Expected: all focused ticket tests pass.

- [ ] **Step 2: Run TypeScript and lint**

```bash
npx tsc --noEmit --incremental false
npm run lint
```

Expected: both commands pass.

- [ ] **Step 3: Run the production build**

```bash
npm run build
```

Expected: Next.js production build completes successfully without type, CSS Module, or asset errors.

- [ ] **Step 4: Inspect the final diff and status**

```bash
git diff --check
git status --short
git diff --stat
```

Expected: no whitespace errors; only the planned ticket files and generated asset are changed, plus any unrelated changes that were already present before implementation.

- [ ] **Step 5: Commit the verified feature**

```bash
git add app/components/CaseLab3Page.tsx app/sections/CaseLab3Tickets.tsx app/case-lab-3/case-lab-3.module.css public/case-lab-3-tickets-bg.png tests/case-lab-3-tickets-editorial.test.mjs
git commit -m "feat(case-lab-3): redesign ticket section"
```
