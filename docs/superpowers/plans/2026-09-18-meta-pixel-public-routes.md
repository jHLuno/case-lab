# Meta Pixel Public Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send one Meta Pixel `PageView` on initial loads and client-side visits to `/` and `/case-lab-3`, while never loading the pixel on other routes.

**Architecture:** A route-aware Client Component lives in the root layout and uses `usePathname` to enforce an exact two-route allowlist. It bootstraps Meta once through `next/script`, sends `PageView` after the inline bootstrap is ready, and sends another event on eligible App Router navigation without duplicate events from React effect re-runs. The proxy applies Meta CSP origins to the same two-route allowlist.

**Tech Stack:** Next.js 16 App Router, React 19, strict TypeScript, `next/script`, Node test runner.

## Global Constraints

- Track only `/` and `/case-lab-3`, with an optional trailing slash.
- Do not load or invoke Meta Pixel on any other page.
- Use pixel ID `1317409210320189`.
- Emit `PageView` on an eligible initial load and on later eligible client-side navigations.
- Initialize Meta Pixel once and prevent duplicate events from effect re-runs.
- Keep Meta CSP origins scoped to the two eligible routes.
- Do not add dependencies or expose personal data.

---

### Task 1: Route-aware Meta Pixel tracking

**Files:**
- Create: `app/components/MetaPixel.tsx`
- Delete: `app/components/CaseLab3MetaPixel.tsx`
- Modify: `app/layout.tsx`
- Modify: `app/case-lab-3/page.tsx`
- Modify: `proxy.ts`
- Modify: `tests/case-lab-3-p2.test.mjs`
- Include: `docs/superpowers/plans/2026-09-18-meta-pixel-public-routes.md`

**Interfaces:**
- Consumes: `nonce?: string` from the root layout and `usePathname(): string` from Next.js.
- Produces: `MetaPixel({ nonce }: { nonce?: string })`, which renders the Meta bootstrap only for eligible paths and calls `fbq("track", "PageView")` once per eligible visit.
- Produces: `isMetaPixelPath(pathname: string): boolean` in `proxy.ts`, used by CSP construction.

- [x] **Step 1: Write the failing regression test**

Update the test fixture to read `app/components/MetaPixel.tsx`, then replace the existing scoped-pixel test with assertions equivalent to:

```js
test("Meta Pixel tracks PageView only on the home and Case Lab 3 landing routes", () => {
  assert.match(layoutSource, /import\s+MetaPixel\s+from\s+["']\.\/components\/MetaPixel["']/);
  assert.match(layoutSource, /<MetaPixel\s+nonce=\{nonce\}\s*\/>/);
  assert.doesNotMatch(pageSource, /MetaPixel|CaseLab3MetaPixel/);
  assert.match(metaPixelSource, /["']use client["']/);
  assert.match(metaPixelSource, /1317409210320189/);
  assert.match(metaPixelSource, /new Set\(\[["']\/["'],\s*["']\/case-lab-3["']\]\)/);
  assert.match(metaPixelSource, /usePathname\(\)/);
  assert.match(metaPixelSource, /fbq\(["']track["'],\s*["']PageView["']\)/);
  assert.match(metaPixelSource, /lastTrackedPathname/);
  assert.match(proxySource, /isMetaPixelPath/);
  assert.match(proxySource, /normalizedPathname === ["']\/["']/);
  assert.match(proxySource, /normalizedPathname === ["']\/case-lab-3["']/);
  assert.match(proxySource, /connect\.facebook\.net/);
  assert.match(proxySource, /www\.facebook\.com/);
});
```

- [x] **Step 2: Run the targeted test and verify RED**

Run:

```bash
node --test --test-name-pattern='Meta Pixel' tests/case-lab-3-p2.test.mjs
```

Expected: FAIL because `app/components/MetaPixel.tsx` does not exist and the root layout does not mount `MetaPixel`.

- [x] **Step 3: Implement the route-aware Client Component**

Create `app/components/MetaPixel.tsx` with:

```tsx
"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const META_PIXEL_ID = "1317409210320189";
const META_PIXEL_PATHS = new Set(["/", "/case-lab-3"]);

type MetaPixelWindow = Window & {
  fbq?: (...args: unknown[]) => void;
};

const metaPixelBootstrap = `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');`;

function normalizePathname(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
}

export default function MetaPixel({ nonce }: { nonce?: string }) {
  const pathname = usePathname();
  const normalizedPathname = normalizePathname(pathname);
  const enabled = META_PIXEL_PATHS.has(normalizedPathname);
  const [ready, setReady] = useState(false);
  const lastTrackedPathname = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      lastTrackedPathname.current = null;
      return;
    }

    if (!ready || lastTrackedPathname.current === normalizedPathname) return;

    const fbq = (window as MetaPixelWindow).fbq;
    if (typeof fbq !== "function") return;

    fbq("track", "PageView");
    lastTrackedPathname.current = normalizedPathname;
  }, [enabled, normalizedPathname, ready]);

  if (!enabled) return null;

  return (
    <Script
      id="meta-pixel"
      nonce={nonce}
      strategy="afterInteractive"
      onReady={() => setReady(true)}
      dangerouslySetInnerHTML={{ __html: metaPixelBootstrap }}
    />
  );
}
```

Mount `<MetaPixel nonce={nonce} />` once in `app/layout.tsx`. Remove the old import and render from `app/case-lab-3/page.tsx`, then delete `app/components/CaseLab3MetaPixel.tsx`.

In `proxy.ts`, replace `isCaseLab3LandingPath` with:

```ts
function isMetaPixelPath(pathname: string): boolean {
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  return normalizedPathname === "/" || normalizedPathname === "/case-lab-3";
}
```

Use the resulting boolean for the existing Meta script, connect, and image CSP origin strings.

- [x] **Step 4: Run the targeted test and verify GREEN**

Run:

```bash
node --test --test-name-pattern='Meta Pixel' tests/case-lab-3-p2.test.mjs
```

Expected: 1 test passes, 0 tests fail.

- [x] **Step 5: Run full relevant verification**

Run:

```bash
node --test tests/case-lab-3-p2.test.mjs
npx tsc --noEmit --incremental false
npm run build
git diff --check
```

Expected: all tests pass, TypeScript exits 0, the production build exits 0, and `git diff --check` prints no errors.

- [x] **Step 6: Commit the implementation**

```bash
git add app/components/MetaPixel.tsx app/components/CaseLab3MetaPixel.tsx app/layout.tsx app/case-lab-3/page.tsx proxy.ts tests/case-lab-3-p2.test.mjs docs/superpowers/plans/2026-09-18-meta-pixel-public-routes.md
git commit -m "feat(analytics): track Meta PageView on public landings"
```
