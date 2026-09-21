# Meta Pixel Lead Event Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Meta Pixel `1317409210320189` emit a reliable `PageView` on `/` and `/case-lab-3`, and emit `Lead` after a successful main lead-form submission.

**Architecture:** Keep the existing route allowlist and CSP scoping. Move the initial `PageView` into the inline Meta bootstrap so it is queued immediately, use a window marker plus pathname ref to avoid duplicate client-navigation page views, and export a small client-side event helper that the lead form calls only after a successful API response.

**Tech Stack:** Next.js 16 App Router, React 19, `next/script`, strict TypeScript, Node test runner.

## Global Constraints

- Track Meta Pixel only on `/` and `/case-lab-3`, with optional trailing slashes.
- Use pixel ID `1317409210320189`.
- Do not send Meta events from `/evp-pro` or excluded routes.
- Send `Lead` only after the lead API responds successfully.
- Do not add dependencies, expose form data, or change API behavior.

---

### Task 1: Add regression coverage for reliable PageView and Lead tracking

**Files:**
- Modify: `tests/case-lab-3-p2.test.mjs`
- Read: `app/components/MetaPixel.tsx`
- Read: `app/components/LeadPopup.tsx`

**Interfaces:**
- The test reads the existing client tracker and form handler source.
- The test verifies the bootstrap contains the initial `PageView`, the tracker retains route de-duplication, and `Lead` is called between the successful response check and the success UI state.

- [x] **Step 1: Write the failing test**

Extend the fixture Promise with `leadPopupSource = read("app/components/LeadPopup.tsx")`, then add these assertions to the existing Meta Pixel test:

```js
assert.match(metaPixelSource, /fbq\(['"]track['"],\s*['"]PageView['"]\)/);
assert.match(metaPixelSource, /__caseLabMetaPixelPageViewPath/);

const leadHandlerSource = extractEnclosingBraceBlock(leadPopupSource, "const handleSubmit");
const responseCheckIndex = leadHandlerSource.indexOf("if (!res.ok)");
const leadEventIndex = leadHandlerSource.indexOf('trackMetaPixelEvent("Lead")');
const successStateIndex = leadHandlerSource.indexOf('setStatus("success")');

assert.match(leadPopupSource, /import\s+LeadPopup.*from|trackMetaPixelEvent/);
assert.ok(responseCheckIndex >= 0);
assert.ok(leadEventIndex > responseCheckIndex);
assert.ok(leadEventIndex < successStateIndex);
```

Use the direct helper import assertion instead of the broad import expression if the implementation uses a named import:

```js
assert.match(leadPopupSource, /import\s+\{\s*trackMetaPixelEvent\s*\}\s+from\s+["']\.\/MetaPixel["']/);
```

- [x] **Step 2: Run the targeted test to verify RED**

Run:

```bash
node --test --test-name-pattern='Meta Pixel' tests/case-lab-3-p2.test.mjs
```

Expected: the existing route assertions pass, but the new bootstrap or lead-event assertion fails because the current implementation does not include the required reliable bootstrap marker and form event.

---

### Task 2: Implement reliable Meta Pixel events

**Files:**
- Modify: `app/components/MetaPixel.tsx`
- Modify: `app/components/LeadPopup.tsx`

**Interfaces:**
- Produces `trackMetaPixelEvent(eventName: "Lead"): void` from `app/components/MetaPixel.tsx`.
- The helper checks the current pathname against the existing exact route allowlist before calling `window.fbq`.

- [x] **Step 1: Replace readiness-dependent initial tracking**

Keep the existing pixel ID and route allowlist. Add the initial page view and a global path marker to the inline bootstrap:

```js
fbq('init', '${META_PIXEL_ID}');
window.__caseLabMetaPixelPageViewPath = window.location.pathname.length > 1
  ? window.location.pathname.replace(/\\/+$/, '')
  : window.location.pathname;
fbq('track', 'PageView');
```

Remove the `ready` state and `onReady` prop. In the pathname effect, skip the initial event when the bootstrap marker already matches the current eligible pathname; otherwise call `fbq("track", "PageView")`, update the marker, and retain the existing ref-based duplicate guard.

Add the exported helper:

```tsx
export function trackMetaPixelEvent(eventName: "Lead"): void {
  if (typeof window === "undefined") return;

  const pathname = normalizePathname(window.location.pathname);
  if (!META_PIXEL_PATHS.has(pathname)) return;

  const fbq = (window as MetaPixelWindow).fbq;
  if (typeof fbq === "function") fbq("track", eventName);
}
```

Extend `MetaPixelWindow` with the marker property. The helper must not log or pass form values.

- [x] **Step 2: Emit Lead only after the successful form response**

Import the named helper in `LeadPopup.tsx`:

```tsx
import { trackMetaPixelEvent } from "./MetaPixel";
```

In `handleSubmit`, after the `!res.ok` error branch and before `setStatus("success")`, call:

```tsx
trackMetaPixelEvent("Lead");
```

Leave validation, API endpoints, error handling, reset behavior, and success UI unchanged.

- [x] **Step 3: Run targeted tests to verify GREEN**

Run:

```bash
node --test --test-name-pattern='Meta Pixel' tests/case-lab-3-p2.test.mjs
```

Expected: 1 test passes and 0 tests fail.

---

### Task 3: Run repository verification

**Files:**
- Verify: `app/components/MetaPixel.tsx`
- Verify: `app/components/LeadPopup.tsx`
- Verify: `tests/case-lab-3-p2.test.mjs`

- [x] **Step 1: Run the focused regression test**

```bash
node --test tests/case-lab-3-p2.test.mjs
```

- [x] **Step 2: Run TypeScript validation**

```bash
npx tsc --noEmit --incremental false
```

- [x] **Step 3: Run the production build**

```bash
npm run build
```

- [x] **Step 4: Check patch whitespace**

```bash
git diff --check
```

The final report must state that production deployment and live browser verification remain outside this local change unless separately performed.
