# Case Lab III Ticket Reference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the `/case-lab-3` ticket section to match the supplied dark reference composition while preserving the existing event data and unavailable checkout behavior.

**Architecture:** Keep `CaseLab3Tickets` as the single ticket section component and keep all presentation in the existing CSS module. Use the current ticket WebP assets as real images, with semantic HTML for event details, benefits, pricing, and the disabled CTA. The section remains in its current page position and keeps the `#tickets` anchor.

**Tech Stack:** Next.js 16, React 19, TypeScript, CSS Modules, `next/image`, Node test runner, existing Benzin/Gilroy fonts, Lucide icons already installed in the project.

## Global Constraints

- Preserve the existing `#tickets` anchor, section order, checkout behavior, event schema, API routes, navigation, and unrelated Case Lab sections.
- Use a near-black solid ticket-section background with no decorative photo layer.
- Use the existing `case-lab-3-ticket-early-bird.webp` and `case-lab-3-ticket-standard.webp` assets with explicit `2400x1200` dimensions and `quality={100}`.
- Keep the CTA as a native disabled button until checkout is connected.
- Keep the section readable on desktop, tablet, and mobile, with a mobile CTA height of at least `44px`.
- Do not add dependencies, new client boundaries, or new motion behavior.

---

### Task 1: Update Ticket Contract Tests

**Files:**
- Modify: `tests/case-lab-3-tickets-editorial.test.mjs:23-75`

**Interfaces:**
- Consumes: `app/sections/CaseLab3Tickets.tsx` and `app/case-lab-3/case-lab-3.module.css` source text.
- Produces: focused assertions for the reference heading, content, solid dark section, overlapped artwork, and disabled CTA.

- [ ] **Step 1: Replace the old editorial-background expectations**

Keep assertions for `id="tickets"`, the two ticket WebP names, explicit alt text, event data, included content, and disabled button semantics. Remove expectations for the old `ticketBackground`, `ticketOverlay`, `ticketKicker`, and `ticketPriceSummary` implementation details. Add assertions for:

```js
assert.match(ticketSource, /БИЛЕТЫ НА CASE LAB III/);
assert.match(ticketSource, /Разборы Invictus, OYU Fest и ForteBank/);
assert.match(ticketSource, /Купить билет за 7 890 ₸/);
assert.match(ticketSource, /Один билет — вся программа Case Lab III/);
assert.match(ticketStylesBlock, /background:\s*#080811/);
assert.doesNotMatch(ticketSource, /ticketBackground|ticketOverlay/);
```

- [ ] **Step 2: Add layout assertions for the reference composition**

Assert that the focused styles define a two-column grid, an artwork overlap, and the light purchase panel:

```js
assert.match(ticketStylesBlock, /grid-template-columns:\s*minmax\(0, 52fr\)\s+minmax\(0, 48fr\)/);
assert.match(ticketStylesBlock, /\.ticketArtwork\s*\{[\s\S]*?position:\s*relative;/);
assert.match(ticketStylesBlock, /\.ticketImage:first-child\s*\{[\s\S]*?rotate\(-6deg\)/);
assert.match(ticketStylesBlock, /\.ticketPurchaseArea\s*\{[\s\S]*?background:\s*transparent;/);
assert.match(ticketStylesBlock, /\.ticketCta\s*\{[\s\S]*?background:\s*#f5f4fb;/);
```

- [ ] **Step 3: Run the focused test before implementation**

Run: `node --test tests/case-lab-3-tickets-editorial.test.mjs`

Expected: FAIL because the current component and CSS still implement the previous background-led layout and do not contain the reference-specific markup/classes.

### Task 2: Implement the Reference Ticket Markup and Styles

**Files:**
- Modify: `app/sections/CaseLab3Tickets.tsx:6-121`
- Modify: `app/case-lab-3/case-lab-3.module.css:1071-1290` and ticket responsive overrides near `1408-1480`

**Interfaces:**
- Consumes: the existing `CaseLab3Tickets` props-free component, ticket WebP assets, shared `contentShell`, `ScrollReveal`, and `--font-heading`/`--font-body` tokens.
- Produces: a semantic two-column ticket block with `.ticketMeta`, `.ticketFacts`, `.ticketIncluded`, `.ticketArtwork`, `.ticketPurchaseArea`, `.ticketPurchaseMeta`, `.ticketCta`, and responsive CSS classes.

- [ ] **Step 1: Replace the section markup with the approved reference hierarchy**

Remove the decorative background image and overlay. Keep `section id="tickets" tabIndex={-1}` and render:

```tsx
<div className={styles.contentShell}>
  <div className={styles.ticketGrid}>
    <ScrollReveal forceMotion>
      <div className={styles.ticketLead}>
        <p className={styles.ticketMeta}>24 сентября · Алматы</p>
        <h2 id="case-lab-3-tickets-title">БИЛЕТЫ НА CASE LAB III</h2>
        <p className={styles.ticketCopy}>
          Три кейса изнутри. Ваши решения.
          <br />
          Ответы тех, кто их принимал.
        </p>
        <div className={styles.ticketFacts} aria-label="Детали мероприятия">
          <div className={styles.ticketFact}>
            <CalendarDays size={22} strokeWidth={1.5} aria-hidden="true" />
            <span>
              <strong>24 сентября 2026</strong>
              <small>10:00–14:00</small>
            </span>
          </div>
          <div className={styles.ticketFact}>
            <MapPin size={22} strokeWidth={1.5} aria-hidden="true" />
            <span>
              <strong>Narxoz Business School</strong>
              <small>Алматы</small>
            </span>
          </div>
        </div>
        <div className={styles.ticketIncluded}>
          <p>В билет входит</p>
          <ul>
            {included.map((item) => (
              <li key={item}>
                <Check size={16} strokeWidth={2.2} aria-hidden="true" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.ticketCapacity}>
          <UsersRound size={17} strokeWidth={1.5} aria-hidden="true" />
          <span><strong>100 мест</strong> в зале</span>
        </div>
      </div>
    </ScrollReveal>
    <ScrollReveal delay={0.12} forceMotion>
      <div className={styles.ticketPurchaseArea}>
        <div className={styles.ticketArtwork}>
          {tickets.map((ticket) => (
            <Image
              key={ticket.src}
              src={ticket.src}
              alt={ticket.alt}
              width={ticket.width}
              height={ticket.height}
              quality={100}
              sizes="(max-width: 767px) 100vw, 46vw"
              className={styles.ticketImage}
            />
          ))}
        </div>
        <div className={styles.ticketPurchaseMeta}>
          <span>Первые 20 билетов</span>
          <span>Затем — <strong>15 000 ₸</strong></span>
        </div>
        <button type="button" className={styles.ticketCta} disabled aria-disabled="true">
          <span>Купить билет за 7 890 ₸</span>
          <ArrowUpRight size={23} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <p className={styles.ticketPurchaseNote}>Один билет — вся программа Case Lab III</p>
      </div>
    </ScrollReveal>
  </div>
</div>
```

Use the existing `CalendarDays`, `MapPin`, `UsersRound`, `Check`, and
`ArrowUpRight` imports. Use the four approved reference-aligned benefits and
retain the explicit image dimensions, `quality={100}`, and meaningful image alt
text.

- [ ] **Step 2: Replace only the ticket-specific base CSS**

Make `.ticketSection` a solid `#080811` block with white text and no image
layers. Set `.ticketGrid` to `minmax(0, 52fr) minmax(0, 48fr)` with a moderate
gap. Style the heading as a large two-line Benzin display, the facts as a
divider-separated two-item row, and the benefits as a quiet check-list.

Style `.ticketArtwork` as a contained relative stack. Keep the standard ticket
behind the Early Bird ticket, rotate the front image `-6deg`, and use a small
negative overlap so the artwork reads like the supplied reference without
overflowing the section.

Keep `.ticketPurchaseArea` transparent so the ticket artwork and purchase
metadata float on the dark section. Style `.ticketCta` as a full-width, minimum
`70px`, off-white purchase row with blue text and the arrow pushed to the right.
Keep the purchase metadata and note readable on the dark background, along with
disabled cursor/opacity behavior and visible focus styles.

- [ ] **Step 3: Add explicit tablet and mobile fallbacks**

At tablet widths, reduce the grid gap and heading scale. At `max-width: 767px`,
stack `.ticketGrid`, keep `.ticketLead` and `.ticketPurchaseArea` at full width,
reduce `.ticketImage` scale, and preserve the front/back overlap. Ensure the CTA
is at least `44px` tall and no ticket image causes horizontal overflow.

- [ ] **Step 4: Run the focused ticket tests**

Run: `node --test tests/case-lab-3-tickets-editorial.test.mjs tests/case-lab-3-assets.test.mjs`

Expected: PASS with all ticket markup, CSS, asset, and disabled CTA assertions green.

### Task 3: Verify the Page and Final Diff

**Files:**
- Verify: `app/sections/CaseLab3Tickets.tsx`
- Verify: `app/case-lab-3/case-lab-3.module.css`
- Verify: `tests/case-lab-3-tickets-editorial.test.mjs`
- Verify: `docs/superpowers/specs/2026-09-06-case-lab-3-ticket-reference-design.md`
- Verify: `docs/superpowers/plans/2026-09-06-case-lab-3-ticket-reference.md`

**Interfaces:**
- Consumes: the implemented reference ticket block and focused tests.
- Produces: verified source-level behavior, type-safe React code, lint-clean CSS/TS, and a successful production build.

- [ ] **Step 1: Run the complete Case Lab source tests**

Run: `node --test tests/case-lab-3-*.test.mjs`

Expected: all tests pass with zero failures.

- [ ] **Step 2: Run TypeScript validation**

Run: `npx tsc --noEmit --incremental false`

Expected: exit code `0`.

- [ ] **Step 3: Run lint**

Run: `npm run lint`

Expected: exit code `0` with no ESLint errors.

- [ ] **Step 4: Run the production build**

Run: `npm run build`

Expected: exit code `0` and a successful Next.js production build.

- [ ] **Step 5: Inspect the final diff without reverting unrelated worktree changes**

Run: `git status --short && git diff -- app/sections/CaseLab3Tickets.tsx app/case-lab-3/case-lab-3.module.css tests/case-lab-3-tickets-editorial.test.mjs docs/superpowers/specs/2026-09-06-case-lab-3-ticket-reference-design.md docs/superpowers/plans/2026-09-06-case-lab-3-ticket-reference.md`

Expected: the diff contains only the approved ticket-block implementation,
focused tests, and planning documents; unrelated pre-existing worktree changes
remain untouched.
