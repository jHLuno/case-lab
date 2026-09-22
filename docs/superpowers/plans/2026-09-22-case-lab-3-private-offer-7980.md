# Case Lab III 7,980 KZT Private Offer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a one-time live Case Lab III private checkout link for 7,980 ₸ without changing the public live price or the existing 5,000 ₸ private-offer behavior.

**Architecture:** Extend the server-authoritative private-offer allowlist to support both 500,000 and 798,000 minor units. Make the existing creation script accept an explicit private amount, and load the private offer amount on the token route so the private page copy matches the server offer while the existing checkout/order/payment/email pipeline remains unchanged.

**Tech Stack:** Next.js App Router, strict TypeScript, Supabase PostgreSQL migrations/RPCs, Node test runner, Supabase CLI.

## Global Constraints

- Keep the public live price unchanged at 1,500,000 minor units.
- Keep the existing 5,000 ₸ private offer compatible.
- Keep private-offer amounts server-authoritative and single-use.
- Do not commit or expose the raw private token anywhere except the final handoff.
- Do not add dependencies or change payment/email pipeline contracts.

### Task 1: Add server support for 7,980 ₸ private offers

**Files:**
- Create: `supabase/migrations/20260922020000_allow_case_lab_3_private_offer_prices.sql`
- Test: `tests/case-lab-3-payments/private-offer.test.ts`

- [ ] **Step 1: Write the failing migration contract test**

Assert that the new migration allows 500000 and 798000, and that the private-offer creation function rejects other amounts.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npx tsx --test tests/case-lab-3-payments/private-offer.test.ts`

Expected: FAIL because the new migration does not exist.

- [ ] **Step 3: Add the forward-only migration**

Drop the old `amount_minor = 500000` constraint, add an allowlist for `500000` and `798000`, and replace `case_lab_3_create_private_offer` with the same server-authoritative logic and the expanded allowlist.

- [ ] **Step 4: Run the focused test and confirm it passes**

Run: `npx tsx --test tests/case-lab-3-payments/private-offer.test.ts`

Expected: PASS.

### Task 2: Make private offer creation and display amount-aware

**Files:**
- Modify: `scripts/create-case-lab-3-private-offer.mjs`
- Modify: `app/case-lab-3/private/[token]/page.tsx`
- Modify: `app/components/CaseLab3Page.tsx`
- Modify: `app/sections/CaseLab3Hero.tsx`
- Modify: `app/sections/CaseLab3Tickets.tsx`
- Modify: `app/components/CaseLab3Footer.tsx`
- Test: `tests/case-lab-3-payments/private-offer.test.ts`

- [ ] **Step 1: Write the failing script/page contract tests**

Assert that the creation script accepts an amount argument and that the private route/page passes a server-resolved amount into the private copy components.

- [ ] **Step 2: Run the focused test and confirm it fails**

Run: `npx tsx --test tests/case-lab-3-payments/private-offer.test.ts`

Expected: FAIL on the new script/page assertions.

- [ ] **Step 3: Implement the smallest amount-aware changes**

Keep the default script amount at 500000, accept 798000 explicitly, resolve the token's private availability server-side, and format the amount in the private hero/ticket/footer copy. Keep the public page behavior unchanged.

- [ ] **Step 4: Run focused tests and confirm they pass**

Run: `npx tsx --test tests/case-lab-3-payments/private-offer.test.ts`

Expected: PASS.

### Task 3: Apply, create, and verify the live offer

**Files:**
- No source files beyond Tasks 1–2.

- [ ] **Step 1: Apply the private-offer migration to the production Supabase project**

Run the migration against project `wilksbazxvlsztuzawew` only and mark that migration version applied in its migration history.

- [ ] **Step 2: Deploy the route/script changes**

Commit the source and migration changes and push `main` so the private route supports the new amount.

- [ ] **Step 3: Create one live offer**

Generate a random token, store only its SHA-256 hash via `case_lab_3_create_private_offer('live', hash, 798000)`, and hand off the raw URL once.

- [ ] **Step 4: Verify the offer contract**

Check the private availability response is `available: true`, `tier: early_bird`, and `amountMinor: 798000`; confirm public availability still uses the existing live price; run the full test suite; and verify the working tree is clean.
