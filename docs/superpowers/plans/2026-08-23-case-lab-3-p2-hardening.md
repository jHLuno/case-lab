# Case Lab 3 P2 Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Close all applicable P2 findings for Case Lab 3 while preserving the GSAP speaker animation, leaving legal pages untouched, and restoring the visual testimonial CTA.

**Architecture:** Keep the existing page visual language, but separate semantic content from decorative motion layers. The speaker section keeps its GSAP choreography and lazy-loads it near the viewport; one semantic speaker list powers the mobile/accessibility presentation. Static metadata, event footer markup, fonts, and schema move out of unnecessary client boundaries, while interactive menu and popup behavior remain client islands.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Framer Motion, GSAP/ScrollTrigger, Tailwind CSS, CSS Modules, Node test runner.

## Global Constraints

- Do not modify `app/offer/**` or `app/privacy/**`.
- Do not restore video, iframe, video promise, or fabricated testimonial URLs.
- Preserve the existing GSAP speaker image/description transition as the primary visual hook.
- Keep the third speaker copy as `Спикер уточняется` until confirmed data exists.
- Keep checkout disabled when its validated HTTPS URL is absent.
- Do not add dependencies or expose environment secrets.
- Use `apply_patch` for manual edits and verify each task before continuing.

---

### Task 1: Add P2 Regression Contracts

**Files:**
- Modify: `tests/case-lab-3-p1.test.mjs`
- Modify: `tests/case-lab-3-process-and-testimonials.test.mjs`
- Create: `tests/case-lab-3-p2.test.mjs`

**Interfaces:**
- Consumes the existing source-contract test helpers.
- Produces regression assertions for focus, motion, semantic speakers, CTA semantics, metadata, CSP, fonts, tokens, and legal-file boundaries.

- [ ] **Step 1: Write failing P2 tests**

Add tests that read the current source and assert:

```js
test("testimonial cards expose the requested visual review CTA without video", () => {
  assert.match(proofSource, /Посмотреть отзыв/);
  assert.match(proofSource, /ArrowUpRight/);
  assert.doesNotMatch(proofSource, /video|видео|iframe|embedUrl/i);
});

test("hero checkout is an anchor and archive cards are not false buttons", () => {
  assert.match(heroSource, /<a[^>]+href=\{checkoutHref\}/s);
  assert.doesNotMatch(heroSource, /window\.location\.assign/);
  assert.doesNotMatch(casesSource, /cursor-pointer/);
});

test("speaker animation stays present but semantic content is single-source", () => {
  assert.match(speakersSource, /gsap|ScrollTrigger/);
  assert.match(speakersSource, /IntersectionObserver|import\("gsap"\)/);
  assert.match(speakersSource, /speakerAccessibleCases/);
  assert.doesNotMatch(speakersSource, /speakerMobileCases/);
});

test("route metadata and CSP are hardened", () => {
  assert.match(pageSource, /twitter/);
  assert.match(nextConfigSource, /object-src 'none'/);
  assert.match(nextConfigSource, /base-uri 'self'/);
  assert.match(nextConfigSource, /frame-ancestors 'none'/);
  assert.match(proxySource, /nonce/);
});

test("legal pages are not part of the P2 change surface", () => {
  assert.equal(await read("app/offer/page.tsx"), await readGitHead("app/offer/page.tsx"));
  assert.equal(await read("app/privacy/page.tsx"), await readGitHead("app/privacy/page.tsx"));
});
```

Use a `readGitHead` helper that runs `git show HEAD:<path>` through `execFile`, so the test compares only legal files and does not duplicate their contents.

- [ ] **Step 2: Run the focused tests and confirm they fail for missing P2 behavior**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs
```

Expected: failures for the missing testimonial CTA, anchor checkout, speaker lazy-loading, route Twitter metadata, CSP directives, and legal-file helper until the helper is implemented.

- [ ] **Step 3: Implement only the test helper and correct source imports**

Add `execFile`-based `readGitHead` and source reads for `heroSource`, `nextConfigSource`, `proxySource`, and `speakersSource`. Re-run to ensure remaining failures are production-contract failures rather than test setup errors.

---

### Task 2: Fix Accessibility, Motion, Archive Semantics, and Landmarks

**Files:**
- Modify: `app/components/Navbar.tsx`
- Modify: `app/components/ScrollReveal.tsx`
- Modify: `app/components/BackToTop.tsx`
- Modify: `app/components/CaseLab3Navbar.tsx`
- Modify: `app/components/CaseLab3Page.tsx`
- Modify: `app/components/HomePage.tsx`
- Modify: `app/page.tsx`
- Modify: `app/evp-pro/page.tsx`
- Modify: `app/components/EVPProPage.tsx`
- Modify: `app/insights/diagnostics-vs-audit/page.tsx`
- Modify: `app/insights/indrive-brand-kazakhstan/page.tsx`
- Modify: `app/insights/smb-channel-blind-spot/page.tsx`
- Modify: `app/insights/meetup-positioning-crisis/page.tsx`
- Modify: `app/sections/Cases.tsx`
- Modify: `app/sections/CaseLab3FAQ.tsx`
- Modify: `app/sections/CaseLab3Tickets.tsx`
- Modify: `app/sections/CaseLab3Proof.tsx`
- Modify: `app/sections/CaseLab3Speakers.tsx`
- Modify: `app/case-lab-3/case-lab-3.module.css`
- Modify: `app/globals.css`

**Interfaces:**
- `NavbarProps` gains `menuDescription?: string` and `onNavLinkClick` behavior remains internal.
- Every route gets exactly one `main` target with `id="main"` or an equivalent focusable main target.
- Case sections that are hash targets use `tabIndex={-1}` so keyboard focus can be restored after navigation.

- [ ] **Step 1: Add failing assertions for hash focus, reduced motion, and landmark structure**

Assert that Navbar contains a hash-target focus helper, `useReducedMotion`, and route-specific menu copy; BackToTop contains reduced-motion handling; root layout no longer wraps all page children in a global `main`; site pages add their own main landmarks.

- [ ] **Step 2: Implement hash focus restoration**

Add a click handler for mobile links that closes the menu, then focuses the hash target on the next animation frame:

```ts
const focusHashTarget = (href: string) => {
  const hash = href.startsWith("#") ? href : new URL(href, window.location.origin).hash;
  if (!hash) return;

  requestAnimationFrame(() => {
    document.querySelector<HTMLElement>(hash)?.focus({ preventScroll: true });
  });
};
```

Use it only for same-page hash links. Keep `Escape` returning focus to `toggleRef`.

- [ ] **Step 3: Apply reduced-motion behavior**

Use `useReducedMotion()` in `ScrollReveal`, `Navbar`, and `BackToTop`. For reduced motion, use opacity-only/instant transitions, remove scale/rotation/stagger, and call `window.scrollTo({ top: 0, behavior: "auto" })`.

- [ ] **Step 4: Make archive and section semantics honest**

Remove `cursor-pointer`, hover scale, and hover shadow from non-link archive cards. Add `tabIndex={-1}` to hash-target sections. Mark marquee clone content `aria-hidden` and use `alt=""` for all repeated portraits.

- [ ] **Step 5: Separate root landmark from navigation/footer**

Replace the root layout wrapper `<main id="main">` with a focusable non-landmark wrapper. Add one `<main id="main" tabIndex={-1}>` around the content of homepage, Case Lab 3, EVP Pro, and insight routes. Leave `app/offer/**` and `app/privacy/**` unchanged because they already provide their own main landmark.

- [ ] **Step 6: Verify Task 2**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs tests/case-lab-3-p1.test.mjs
```

Expected: all accessibility/landmark contracts pass; remaining P2 tests still fail.

---

### Task 3: Preserve and Harden Speaker Animation

**Files:**
- Modify: `app/sections/CaseLab3Speakers.tsx`
- Modify: `app/case-lab-3/case-lab-3.module.css`
- Modify: `tests/case-lab-3-p2.test.mjs`

**Interfaces:**
- `cases` remains the single source of speaker/case data.
- Decorative GSAP layers remain internal to the section and are not exposed to assistive technology.
- `speakerAccessibleCases` is the only semantic speaker content tree and powers the mobile presentation.

- [ ] **Step 1: Preserve the existing GSAP choreography while marking visual layers decorative**

Keep the current slot/state transition logic and `caseStates`, but set `aria-hidden="true"` on the visual scene and remove interactive semantics from visual-only layers.

- [ ] **Step 2: Remove the duplicate semantic mobile tree**

Delete the separate `speakerMobileCases` render. Add the case image, company, role, title, and description to `speakerAccessibleCases`; style this one list as the mobile layout. Keep the visual desktop scene hidden below the mobile breakpoint.

- [ ] **Step 3: Lazy-load GSAP near the section**

Replace top-level GSAP imports with an `IntersectionObserver`-guarded dynamic import:

```ts
const loadSpeakerMotion = async () => {
  const [{ default: gsap }, { ScrollTrigger }] = await Promise.all([
    import("gsap"),
    import("gsap/ScrollTrigger"),
  ]);
  gsap.registerPlugin(ScrollTrigger);
  return { gsap, ScrollTrigger };
};
```

If the observer is not intersecting, reduced motion is enabled, or the import/registration fails, leave the first static state visible.

- [ ] **Step 4: Remove pre-paint-only dependency**

Use `useEffect` for the lazy motion setup because the semantic list and CSS fallback must be available before the animation bundle loads. Clean up observer, GSAP context, and ScrollTrigger instances on unmount.

- [ ] **Step 5: Verify Task 3**

Run the speaker-focused tests and TypeScript:

```bash
node --test tests/case-lab-3-p2.test.mjs
npx tsc --noEmit --incremental false
```

Expected: GSAP remains detected, no mobile duplicate source tree remains, and TypeScript passes.

---

### Task 4: Restore Testimonial CTA and Fix Route Interaction Copy

**Files:**
- Modify: `app/sections/CaseLab3Proof.tsx`
- Modify: `app/case-lab-3/case-lab-3.module.css`
- Modify: `app/components/Navbar.tsx`
- Modify: `app/components/CaseLab3Navbar.tsx`
- Modify: `app/sections/CaseLab3Hero.tsx`
- Modify: `app/sections/Cases.tsx`
- Modify: `app/sections/CaseLab3Tickets.tsx`
- Modify: `app/sections/CaseLab3FAQ.tsx`

**Interfaces:**
- Testimonial cards keep static quotes and add a decorative `reviewLabel`.
- `CaseLab3Navbar` passes event-specific menu description.
- Hero checkout remains `string | null` and renders no CTA when null.

- [ ] **Step 1: Add the visual testimonial CTA**

Import `ArrowUpRight` and render at the bottom of every card:

```tsx
<span className={styles.testimonialReviewLabel} aria-hidden="true">
  Посмотреть отзыв
  <ArrowUpRight size={16} strokeWidth={2} />
</span>
```

Do not add `href`, `button`, `video`, `iframe`, or `embedUrl`.

- [ ] **Step 2: Convert hero checkout to a real anchor**

Replace the `SpecularButton` block with:

```tsx
<a href={checkoutHref} className={styles.heroCta}>
  Купить билет
  <ArrowUpRight size={20} strokeWidth={2} aria-hidden="true" />
</a>
```

Keep the existing `checkoutHref ? ... : unavailable` branch.

- [ ] **Step 3: Remove false archive interaction and route-inappropriate copy**

Use the existing `/#news` link as the only archive action. Add `menuDescription="Событие для маркетологов и команд, которым важны реальные решения."` to `CaseLab3Navbar`; render it in Navbar instead of the generic diagnostics copy.

- [ ] **Step 4: Fix contrast and CTA styles**

Set testimonial role/footer metadata to a measured minimum 4.5:1 token and add `.testimonialReviewLabel` with the same spacing and arrow treatment as other route CTAs. Do not reintroduce disabled video controls.

- [ ] **Step 5: Verify Task 4**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs tests/case-lab-3-process-and-testimonials.test.mjs
```

Expected: visual review CTA is present, no video promise exists, and checkout is anchor-based.

---

### Task 5: Reduce Client Boundaries, OGL, and Font Loading

**Files:**
- Modify: `app/components/JsonLd.tsx`
- Create: `app/components/ServiceJsonLd.tsx`
- Modify: `app/page.tsx`
- Modify: `app/sections/CaseLab3Tickets.tsx`
- Modify: `app/sections/CaseLab3Hero.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `app/case-lab-3/page.tsx`
- Modify: `tests/case-lab-3-p2.test.mjs`

**Interfaces:**
- `JsonLd` becomes a Server Component containing only Organization and WebSite schemas.
- `ServiceJsonLd` is rendered only from `app/page.tsx`.
- Case Lab 3 tickets and event metadata remain server-rendered.

- [ ] **Step 1: Make schema server-side and homepage-specific**

Remove `"use client"` and `usePathname` from `JsonLd`. Move the current Service object into `ServiceJsonLd.tsx`, and render it only in `app/page.tsx` beside `HomePage`.

- [ ] **Step 2: Remove unnecessary client directives**

Remove `"use client"` from `CaseLab3Tickets.tsx`. Keep client behavior inside imported `ScrollReveal`; do not widen the client boundary.

- [ ] **Step 3: Remove OGL from the hero checkout path**

Delete the `SpecularButton` import and use the CSS anchor from Task 4. Keep `SpecularButton.tsx` untouched unless the final dependency scan proves it is unused everywhere; do not delete unrelated shared code in this task.

- [ ] **Step 4: Remove duplicate Google font loading**

Delete `Inter` and `Bebas_Neue` imports/configuration and manual font preloads from `layout.tsx`. Update global font variables to use the local `Gilroy` and `Benzin` faces with system fallbacks only.

- [ ] **Step 5: Add route-specific Twitter and OG metadata**

Add `twitter` metadata to Case Lab 3 using the same event title, description, and image. Add `app/case-lab-3/opengraph-image.tsx` with `ImageResponse` output at 1200x630, displaying `Case Lab III`, the confirmed date/time, and location. Set the route metadata image to the generated route asset with explicit dimensions and alt.

- [ ] **Step 6: Verify Task 5**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs
npx tsc --noEmit --incremental false
```

Expected: no route import of OGL/SpecularButton, no Google font variables/preloads, homepage-only Service schema, and route Twitter/OG contracts pass.

---

### Task 6: Harden CSP and WebGL Fallbacks

**Files:**
- Create: `proxy.ts`
- Modify: `next.config.ts`
- Modify: `app/layout.tsx`
- Modify: `app/components/JsonLd.tsx`
- Modify: `app/case-lab-3/page.tsx`
- Modify: `app/sections/CaseLab3Hero.tsx`
- Create: `app/components/GrainientBoundary.tsx`
- Modify: `tests/case-lab-3-p2.test.mjs`

**Interfaces:**
- `proxy.ts` emits a request nonce and CSP for page requests.
- Server JSON-LD scripts accept the `x-nonce` request header.
- `GrainientBoundary` renders children and falls back to an empty decorative layer after a renderer error.

- [ ] **Step 1: Add failing CSP/fallback tests**

Assert that `proxy.ts` generates a nonce, `next.config.ts` no longer owns a wildcard CSP, and the layout no longer contains the MutationObserver inline script.

- [ ] **Step 2: Implement nonce proxy**

Create a Next 16 `proxy.ts` using `NextRequest`/`NextResponse`, `crypto.randomUUID()`, and a matcher excluding API/static/image/prefetch requests. Set both request and response `Content-Security-Policy` headers and pass `x-nonce` downstream.

- [ ] **Step 3: Add strict directives**

Use `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'` plus development-only `unsafe-eval`, `style-src 'self' 'unsafe-inline'`, `img-src 'self' blob: data:`, `font-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, `frame-ancestors 'none'`, and `upgrade-insecure-requests`. Build `connect-src` from the configured Supabase origin rather than `https://*.supabase.co`.

- [ ] **Step 4: Remove the extension script and pass nonce to JSON-LD**

Delete only the `bis_skin_checked` MutationObserver script from `layout.tsx`. Read `(await headers()).get("x-nonce")` in server JSON-LD/page components and pass it to JSON-LD `<script nonce={nonce}>` tags.

- [ ] **Step 5: Add Grainient error boundary**

Wrap the dynamic Grainient client component with a small error boundary. Keep `.caseRoomShape` background as the base layer and render the boundary fallback as `null`, so renderer failure cannot remove readable hero content.

- [ ] **Step 6: Verify Task 6**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs
npx tsc --noEmit --incremental false
npm run build
```

Expected: CSP/fallback contracts pass and the build completes with dynamic rendering only where nonce headers require it.

---

### Task 7: Finish Tokens, Metadata, and Regression Coverage

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css`
- Modify: `app/globals.css`
- Modify: `app/components/JsonLd.tsx`
- Modify: `app/sections/CaseLab3Proof.tsx`
- Modify: `tests/case-lab-3-p2.test.mjs`
- Modify: `tests/case-lab-3-assets.test.mjs`
- Modify: `tests/case-lab-3-process-and-testimonials.test.mjs`

- [ ] **Step 1: Introduce route semantic tokens**

Define route tokens at the Case Lab root:

```css
.hero,
.proofSection,
.speakersSection,
.ticketSection,
.faqSection {
  --cl-accent: #040082;
  --cl-accent-strong: #020060;
  --cl-muted: #4f4e5b;
  --cl-focus: #040082;
  --cl-focus-contrast: #ffffff;
}
```

Replace repeated testimonial/footer/focus values with these semantic tokens where the touched P2 styles use them.

- [ ] **Step 2: Correct responsive Cases hierarchy**

Raise the mobile Cases heading floor to `24px`, use the same `alignToCaseLab` shell for heading, marquee, and CTA, and keep the real `/#news` destination.

- [ ] **Step 3: Add tests for exclusions and final contracts**

Assert no changed Case Lab source contains `video`, `видео`, `iframe`, or `embedUrl`; assert the testimonial label exists; assert legal files match `HEAD`; assert no source imports `ogl` from the Case Lab route.

- [ ] **Step 4: Run the full verification suite**

Run:

```bash
node --test tests/*.mjs
npx tsc --noEmit --incremental false
npm run lint
npm run build
git diff --check
```

Expected: all Node tests pass, TypeScript passes, ESLint has no errors, production build succeeds, and the diff has no whitespace errors.

---

## Review Checklist

- [ ] P2-01 through P2-21 and P2-23 through P2-27 have an implementation or an explicit verification limitation.
- [ ] P2-07 and P2-17 remain video-free by design.
- [ ] P2-22 is explicitly excluded by the user constraint and no legal file changed.
- [ ] The speaker GSAP animation remains visible for normal-motion users.
- [ ] `Посмотреть отзыв` is visible in every testimonial card but is not a dead interactive control.
- [ ] Checkout remains disabled without its configured URL.
