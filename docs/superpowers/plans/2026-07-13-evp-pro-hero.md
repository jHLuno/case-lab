# EVP Pro Hero Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first, conversion-focused EVP Pro event hero at `/evp-pro`, using the existing Case Lab navigation, footer, and lead popup.

**Architecture:** Keep the route server-rendered for route-specific metadata. Add a focused client page-composition component because the existing `Navbar`, `LeadPopupProvider`, `LeadPopup`, and CTA interaction require client context. Keep the event hero as a separate presentational section so future approved sections can be composed without expanding the route file.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Framer Motion, existing Case Lab components.

## Global Constraints

- Route: `/evp-pro`.
- Reuse existing `Navbar`, `Footer`, `LeadPopupProvider`, `LeadPopup`, and `BackToTop`.
- Hero facts: 17 September, 11:00-17:00, Almaty, Narxoz Business School.
- CTA text: `Записаться на EVP Pro`; it opens the existing lead popup.
- Use `Benzin` for display and `Gilroy` for body/interface copy.
- Use only Case Lab white, ink, cobalt, cobalt-dark, and cobalt-light color families.
- Hero content and CTA must fit in the initial viewport on desktop and mobile.
- Do not add unconfirmed price, capacity, agenda, speaker biography, or claims.
- Motion must respect `prefers-reduced-motion`; content remains visible without JavaScript-driven animation.
- Preserve existing main-page navbar and footer behavior.

---

### Task 1: Prove the EVP Pro route is absent

**Files:**
- Test: development server integration check for `/evp-pro`

**Interfaces:**
- Consumes: `npm run dev`
- Produces: a verified failing route check before feature code exists

- [ ] **Step 1: Start the development server**

Run:

```bash
npm run dev
```

Expected: Next starts a local development server.

- [ ] **Step 2: Request the route and verify the failing state**

Run:

```bash
curl --fail --silent --show-error http://localhost:3000/evp-pro
```

Expected: failure because `/evp-pro` has not been implemented and returns HTTP 404.

### Task 2: Create the server route and event-page composition

**Files:**
- Create: `app/evp-pro/page.tsx`
- Create: `app/components/EVPProPage.tsx`
- Create: `app/sections/EVPProHero.tsx`

**Interfaces:**
- Consumes: `Navbar`, `Footer`, `BackToTop`, `LeadPopup`, `LeadPopupProvider`, and `useLeadPopup`.
- Produces: the `/evp-pro` page with route-specific metadata and a client composition that activates the existing lead popup.

- [ ] **Step 1: Add route metadata and compose the client page**

Create `app/evp-pro/page.tsx`:

```tsx
import type { Metadata } from "next";
import EVPProPage from "../components/EVPProPage";

export const metadata: Metadata = {
  title: "EVP Pro - Практическая сессия по EVP | Case Lab",
  description:
    "EVP Pro - практическая сессия для руководителей, HR, PR и маркетинг-команд о ценностном предложении работодателя.",
  alternates: {
    canonical: "/evp-pro/",
  },
};

export default function Page() {
  return <EVPProPage />;
}
```

- [ ] **Step 2: Add the client composition that reuses existing shared UI**

Create `app/components/EVPProPage.tsx`:

```tsx
"use client";

import Navbar from "./Navbar";
import Footer from "./Footer";
import BackToTop from "./BackToTop";
import LeadPopup from "./LeadPopup";
import { LeadPopupProvider } from "../lib/LeadPopupContext";
import EVPProHero from "../sections/EVPProHero";

export default function EVPProPage() {
  return (
    <LeadPopupProvider>
      <div className="relative">
        <Navbar />
        <EVPProHero />
        <Footer />
        <BackToTop />
        <LeadPopup />
      </div>
    </LeadPopupProvider>
  );
}
```

- [ ] **Step 3: Add the approved hero section**

Create `app/sections/EVPProHero.tsx`:

```tsx
"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { useLeadPopup } from "../lib/LeadPopupContext";

const eventFacts = [
  { label: "Дата", value: "17 сентября" },
  { label: "Время", value: "11:00-17:00" },
  { label: "Место", value: "Алматы, Narxoz Business School" },
];

export default function EVPProHero() {
  const { openPopup } = useLeadPopup();
  const shouldReduceMotion = useReducedMotion();
  const initial = shouldReduceMotion ? false : { opacity: 0, y: 24 };

  return (
    <section
      aria-labelledby="evp-pro-title"
      className="relative isolate flex min-h-[100dvh] items-end overflow-hidden bg-[#020060] text-white"
    >
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(78,78,215,0.52),transparent_20%),radial-gradient(circle_at_15%_95%,rgba(255,255,255,0.13),transparent_25%),linear-gradient(145deg,#020060_0%,#040082_48%,#010132_100%)]"
      />
      <div aria-hidden="true" className="absolute inset-0 opacity-30">
        <div className="absolute right-[8%] top-[18%] h-[64%] w-px bg-white/35" />
        <div className="absolute right-[18%] top-[8%] h-[78%] w-px bg-white/20" />
        <div className="absolute right-[28%] top-[30%] h-[52%] w-px bg-white/15" />
        <span
          className="absolute right-[5%] top-[12%] text-[clamp(120px,22vw,340px)] font-bold leading-none text-white/[0.07]"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          EVP
        </span>
      </div>

      <div className="relative z-10 mx-auto w-full max-w-[1440px] px-6 pb-10 pt-32 md:px-10 md:pb-24 md:pt-36">
        <div className="grid items-end gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(280px,0.46fr)] lg:gap-20">
          <div className="max-w-[780px] -translate-y-10 md:-translate-y-16">
            <motion.h1
              id="evp-pro-title"
              initial={initial}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0, ease: [0.16, 1, 0.3, 1] }}
              className="max-w-[16ch] text-[clamp(30px,5.4vw,76px)] font-bold uppercase leading-[1.02] tracking-[0.02em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              EVP Pro: Как <span className="whitespace-nowrap">хантить лучших?</span>
            </motion.h1>
            <motion.p
              initial={initial}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: shouldReduceMotion ? 0 : 0.16, ease: [0.16, 1, 0.3, 1] }}
              className="mt-6 max-w-[62ch] text-[16px] leading-[1.5] text-white/82 md:mt-8 md:text-[19px]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Практическая сессия о EVP: как собрать единое предложение работодателя, чтобы HR, маркетинг, PR и руководители говорили с рынком труда одним голосом.
            </motion.p>
            <motion.button
              type="button"
              onClick={openPopup}
              initial={initial}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: shouldReduceMotion ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
              whileTap={shouldReduceMotion ? undefined : { scale: 0.98 }}
              className="mt-8 inline-flex min-h-11 items-center gap-3 rounded-full bg-white px-6 py-3 text-[14px] font-medium text-[#040082] transition-[gap,background-color,transform] duration-200 hover:gap-4 hover:bg-white/90 md:mt-10 md:px-8 md:text-[15px]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Записаться на EVP Pro
              <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
            </motion.button>
          </div>

          <motion.dl
            initial={initial}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: shouldReduceMotion ? 0 : 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="border-t border-white/30 pt-5"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {eventFacts.map((fact) => (
              <div key={fact.label} className="grid grid-cols-[88px_1fr] gap-4 border-b border-white/20 py-4 md:grid-cols-[96px_1fr]">
                <dt className="text-[12px] uppercase tracking-[0.12em] text-white/55">{fact.label}</dt>
                <dd className="text-[15px] leading-[1.35] text-white md:text-[17px]">{fact.value}</dd>
              </div>
            ))}
          </motion.dl>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Run TypeScript validation**

Run:

```bash
npx tsc --noEmit --incremental false
```

Expected: exits with code 0.

### Task 3: Verify the completed route and production build

**Files:**
- Test: development server integration check for `/evp-pro`

**Interfaces:**
- Consumes: `/evp-pro` route created in Task 2.
- Produces: a verified public event hero route.

- [ ] **Step 1: Request the completed route**

Run:

```bash
curl --fail --silent http://localhost:3000/evp-pro | grep -q "КОМПАНИЯ, В КОТОРУЮ"
```

Expected: exits with code 0.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: build succeeds and lists `/evp-pro` as a static route.

- [ ] **Step 3: Perform responsive browser checks**

Verify at desktop and 320px wide:

```text
- Navbar remains usable and single-line on desktop.
- Hero title, date, venue, and CTA are visible without horizontal overflow.
- CTA opens the lead popup.
- Reduced-motion preference removes movement while preserving all hero content.
```
