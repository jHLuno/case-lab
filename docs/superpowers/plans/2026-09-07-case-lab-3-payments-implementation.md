# Case Lab III Payments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete server-authoritative Case Lab III purchase, fiscal receipt, QR/PDF ticket, CRM refund, and mobile check-in flow described in `docs/superpowers/specs/2026-09-07-case-lab-3-payments-design.md`.

**Architecture:** Next.js Route Handlers and narrow Client Components run on Vercel, while Supabase Postgres owns all durable state, atomic inventory transitions, and the persistent job queue. TipTop Pay, Kassir, Mail.ru SMTP, and GA4 are adapters behind server-only modules; Supabase Cron invokes a bounded Vercel worker every minute.

**Tech Stack:** Next.js 16.2.10 App Router, React 19.2.4, strict TypeScript, Supabase/Postgres/pgTAP, TipTop Pay widget and HTTP APIs, Kassir HTTP API, Nodemailer, PDFKit, QRCode, ZXing Browser, GA4 Measurement Protocol, Node test runner through `tsx`.

## Global Constraints

- Preserve all unrelated working-tree changes. At plan creation, `app/case-lab-3/case-lab-3.module.css` and `tests/case-lab-3-tickets-editorial.test.mjs` already contain user changes.
- Never inspect, print, commit, or log real credentials, IIN/BIN, SMTP passwords, provider payloads containing personal data, or `.env*` values.
- Keep every new Supabase table under RLS with no anonymous policy. Service-role access remains server-only.
- Keep money as integer minor units internally: Early Bird `789000`, Standard `1500000`, currency `KZT`.
- Initial online sales limit is `70`, hard venue capacity is `100`, and Early Bird confirmed-sale quota is `20`.
- Sales use the exclusive cutoff `2026-09-24 00:00:00 Asia/Almaty` and remain disabled until live fiscal policy is accountant-approved.
- Checkout is card-only, `Single`, non-recurrent, `tokenize: false`, `retryPayment: false`, and sends no receipt object through the widget.
- The widget hides its built-in email field with `emailBehavior: "Hidden"`; the server-authoritative checkout email is passed as `receiptEmail` and `userInfo.email`.
- Browser callbacks never authorize ticket, receipt, email, inventory, GA purchase, or refund effects.
- Use HMAC verification on the exact test-proven provider representation before webhook parsing.
- Do not use `after()`, unawaited promises, process memory, localStorage, or browser callbacks as durable work/state.
- Preserve visible focus, dialog semantics, reduced-motion behavior, mobile layout, and current Case Lab III visual language.
- Commit commands below are checkpoints required by this plan, but execute them only after the user explicitly authorizes commits.
- Read the relevant local Next.js guide in `node_modules/next/dist/docs/` before changing Route Handlers, cookies, CSP, dynamic params, or headers.

## Execution Prerequisite

- Before Task 1, install and start a Docker-compatible runtime supported by the Supabase CLI: Docker Desktop, OrbStack, Colima, or a compatible Podman setup. Verify it with `docker info` (or the selected runtime's equivalent). After Task 1 creates `supabase/config.toml`, Task 3 verifies `npx supabase start` before any `db reset` or `test db` command.
- At plan revision time, `docker`, `orb`, `colima`, and `podman` are not installed in this workspace environment, so local database verification is blocked until the user provides one.
- A dedicated non-production Supabase test project is an allowed alternative only with explicit user approval. Never link, reset, seed, or run destructive tests against production.

## Delivery Checkpoints

1. Tasks 1-5: testable database, domain contracts, inventory, and state transitions with sales disabled.
2. Tasks 6-9, including Task 6A: complete test-mode public order and TipTop Pay flow without fiscal/email fulfilment.
3. Tasks 10-11: durable Kassir, QR/PDF ticket, SMTP, and protected buyer/participant pages.
4. Tasks 12-17: CRM, refunds, check-in, GA4, reconciliation, hardening, sandbox acceptance, and controlled live launch.

---

### Task 1: Test Tooling and Dependency Boundaries

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `supabase/config.toml`
- Create: `tests/case-lab-3-payments/dependency-boundaries.test.ts`

**Interfaces:**
- Produces: `npm run test:case-lab-3-payments`, `npm run test:case-lab-3-db`, and `npm test`.
- Produces: installed runtime packages `nodemailer`, `pdfkit`, `qrcode`, `@zxing/browser`.
- Produces: installed development packages `@types/nodemailer`, `@types/pdfkit`, `@types/qrcode`, `tsx`, `supabase`.
- Constraint: `@zxing/browser` may be imported only below `app/crm/check-in/`; SMTP/PDF/QR generation may be imported only by server modules.

- [ ] **Step 0: Satisfy the database-test runtime prerequisite**

Install/start one approved Docker-compatible runtime and verify `docker info` succeeds. If local containers are unavailable, stop and obtain explicit user approval for a dedicated non-production Supabase test project; do not silently skip database tests or connect to production. Run `npx supabase start` only after Step 5 creates local config.

- [ ] **Step 1: Write the failing dependency-boundary test**

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("payment dependencies stay in their intended runtime boundaries", async () => {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  assert.equal(typeof packageJson.scripts["test:case-lab-3-payments"], "string");
  assert.equal(typeof packageJson.scripts["test:case-lab-3-db"], "string");
  assert.equal(typeof packageJson.dependencies.nodemailer, "string");
  assert.equal(typeof packageJson.dependencies.pdfkit, "string");
  assert.equal(typeof packageJson.dependencies.qrcode, "string");
  assert.equal(typeof packageJson.dependencies["@zxing/browser"], "string");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/case-lab-3-payments/dependency-boundaries.test.ts`  
Expected: FAIL because the script and dependencies do not exist.

- [ ] **Step 3: Install only the approved packages**

Run:

```bash
npm install nodemailer pdfkit qrcode @zxing/browser
npm install --save-dev @types/nodemailer @types/pdfkit @types/qrcode tsx supabase
```

Expected: `package.json` and `package-lock.json` change; no other file changes.

- [ ] **Step 4: Add deterministic test scripts**

Set these script values in `package.json`:

```json
{
  "test": "node --test tests/*.test.mjs && npm run test:case-lab-3-payments",
  "test:case-lab-3-payments": "tsx --test tests/case-lab-3-payments/**/*.test.ts",
  "test:case-lab-3-db": "supabase test db"
}
```

- [ ] **Step 5: Initialize local Supabase config without linking or touching production**

Run: `npx supabase init`  
Expected: `supabase/config.toml` is created; existing migrations remain unchanged.

- [ ] **Step 6: Run the boundary test**

Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/dependency-boundaries.test.ts`  
Expected: PASS.

- [ ] **Step 7: Commit checkpoint after explicit authorization**

```bash
git add package.json package-lock.json supabase/config.toml tests/case-lab-3-payments/dependency-boundaries.test.ts
git commit -m "test(case-lab-3): add payment test tooling"
```

---

### Task 2: Domain Contracts, Money, Validation, and Tokens

**Files:**
- Create: `app/lib/case-lab-3/contracts.ts`
- Create: `app/lib/case-lab-3/money.ts`
- Create: `app/lib/case-lab-3/validation.ts`
- Create: `app/lib/case-lab-3/tokens.server.ts`
- Create: `tests/case-lab-3-payments/money.test.ts`
- Create: `tests/case-lab-3-payments/validation.test.ts`
- Create: `tests/case-lab-3-payments/tokens.test.ts`

**Interfaces:**
- Produces: `PaymentEnvironment = "test" | "live"`.
- Produces: `TicketTier = "early_bird" | "standard"`.
- Produces: `minorToMajor(amountMinor: number): number` and `formatKzt(amountMinor: number): string`.
- Produces: `parseOrderInput(value: unknown): OrderInput` and provider-specific parsers later consumed by adapters.
- Produces: `derivePurposeToken(secret, purpose, entityId, version)`, `verifyPurposeToken(...)`, `buildTicketQrPayload(...)`, `parseAndVerifyTicketQrPayload(...)`, and `deriveManualCheckInCode(...)`.
- Constraint: validation returns field-safe error codes, never raw exception details.

- [ ] **Step 1: Write failing money and token tests**

```ts
test("formats approved ticket amounts from integer minor units", () => {
  assert.equal(minorToMajor(789000), 7890);
  assert.equal(minorToMajor(789001), 7890.01);
  assert.equal(formatKzt(1500000), "15 000 ₸");
  assert.throws(() => minorToMajor(789000.5), /integer minor units/i);
});

test("purpose and version separate ticket credentials", () => {
  const secret = "s".repeat(32);
  const first = derivePurposeToken(secret, "ticket-access", "ticket-1", 1);
  const rotated = derivePurposeToken(secret, "ticket-access", "ticket-1", 2);
  const qr = derivePurposeToken(secret, "ticket-qr", "ticket-1", 1);
  assert.notEqual(first, rotated);
  assert.notEqual(first, qr);
  assert.equal(verifyPurposeToken(first, secret, "ticket-access", "ticket-1", 1), true);
});

test("QR payload carries the indexed ticket ID and current revision", () => {
  const ticketId = "018f4c5e-7e75-7a12-a123-123456789abc";
  const payload = buildTicketQrPayload(ticketId, 2, "s".repeat(32));
  assert.match(payload, /^cl3:[0-9a-f-]{36}:2:[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(parseAndVerifyTicketQrPayload(payload, "s".repeat(32)), {
    ticketId,
    revisionNumber: 2,
  });
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx tsx --test tests/case-lab-3-payments/money.test.ts tests/case-lab-3-payments/tokens.test.ts`  
Expected: FAIL because modules do not exist.

- [ ] **Step 3: Define exact public contracts**

Create `contracts.ts` with these exported shapes:

```ts
export type PaymentEnvironment = "test" | "live";
export type TicketTier = "early_bird" | "standard";
export type AvailabilityReason =
  | "available"
  | "early_bird_temporarily_reserved"
  | "sold_out"
  | "sales_closed"
  | "configuration_incomplete";

export type AvailabilityResponse = {
  available: boolean;
  reason: AvailabilityReason;
  tier: TicketTier | null;
  amountMinor: number | null;
  currency: "KZT";
  salesLimit: number;
};

export type OrderInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  expectedTier: TicketTier;
  expectedAmountMinor: number;
  offerVersionId: string;
  privacyVersionId: string;
  marketingConsent: boolean;
  attribution: Record<string, string>;
};

export type CreateOrderResult =
  | { kind: "created"; orderId: string; orderNumber: string; tier: TicketTier; amountMinor: number; reservationExpiresAt: string }
  | { kind: "offer_changed"; availability: AvailabilityResponse }
  | { kind: "unavailable"; availability: AvailabilityResponse };

export type PaymentAttemptResponse = {
  attemptId: string;
  externalId: string;
  reservationExpiresAt: string;
  widget: TipTopWidgetParams;
};

export type TipTopWidgetParams = {
  publicTerminalId: string;
  amount: number;
  currency: "KZT";
  paymentSchema: "Single";
  externalId: string;
  receiptEmail: string;
  emailBehavior: "Hidden";
  tokenize: false;
  retryPayment: false;
  userInfo: { accountId: string; firstName: string; lastName: string; email: string; phone?: string };
};

export type OrderStatusResponse = {
  orderNumber: string;
  paymentStatus: "pending" | "processing" | "paid" | "failed" | "refund_pending" | "partially_refunded" | "refunded" | "review_required";
  ticketStatus: "pending" | "valid" | "used" | "cancelled";
  receiptStatus: "not_requested" | "queued" | "issued" | "error" | "unknown";
  emailStatus: "pending" | "sent" | "failed" | "unknown";
  receiptUrl: string | null;
};
```

- [ ] **Step 4: Implement integer money and constant-time purpose tokens**

Use Node `createHmac`, `timingSafeEqual`, and unpadded base64url. Reject non-integers and negatives internally; permit every integer tiyn amount and emit at most two decimal places at the provider boundary.

Implement the exact QR contract `cl3:<ticket_uuid>:<revision_number>:<token>`. The canonical HMAC input is UTF-8 `ticket-qr\0<lowercase-canonical-ticket-uuid>\0<base-10-revision-number>`; `token` is its 32-byte HMAC-SHA256 as 43-character unpadded base64url. Parse with strict length/prefix/UUID/positive-integer-without-leading-zeroes/base64url bounds, query by the ticket UUID primary key, require the current revision, then compare equal-length token bytes with `timingSafeEqual`.

Derive the manual code as the first ten uppercase RFC 4648 base32 characters without padding from HMAC-SHA256 over UTF-8 `ticket-manual-code\0<lowercase-canonical-ticket-uuid>\0<base-10-revision-number>`. Manual check-in requires both the unique indexed public ticket number and this code; normalize only ASCII spaces/hyphens and case before constant-time verification. The ticket number or manual code alone must fail. Transfer increments the revision, invalidating both old credentials. Store identifiers and versions, never clear tokens/codes.

- [ ] **Step 5: Write and run validation tests**

Cover maximum lengths, trimmed names, normalized lowercase email, optional Kazakhstan phone normalization, invalid enum/money/version IDs, attribution allowlist, and rejection of unknown object keys.

Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/money.test.ts tests/case-lab-3-payments/validation.test.ts tests/case-lab-3-payments/tokens.test.ts`  
Expected: PASS.

- [ ] **Step 6: Run TypeScript**

Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

- [ ] **Step 7: Commit checkpoint after explicit authorization**

```bash
git add app/lib/case-lab-3/contracts.ts app/lib/case-lab-3/money.ts app/lib/case-lab-3/validation.ts app/lib/case-lab-3/tokens.server.ts tests/case-lab-3-payments/money.test.ts tests/case-lab-3-payments/validation.test.ts tests/case-lab-3-payments/tokens.test.ts
git commit -m "feat(case-lab-3): add payment domain contracts"
```

---

### Task 3: Persistent Schema, RLS, and Configuration Gates

**Files:**
- Create: `supabase/migrations/20260907000000_create_case_lab_3_payment_schema.sql`
- Create: `supabase/tests/case_lab_3_schema.test.sql`
- Create: `supabase/tests/case_lab_3_rls.test.sql`
- Create: `app/lib/case-lab-3/database.types.ts`

**Interfaces:**
- Produces every table and status constraint from design sections 5.1-5.7.
- Produces live/test rows in `case_lab_3_event_settings`, both with `sales_enabled = false`.
- Produces immutable `case_lab_3_fiscal_policy_versions`, `case_lab_3_legal_document_versions`, and `case_lab_3_ticket_revisions` with indexed ticket identifiers and versioned credentials.
- Produces no anonymous table policy.

- [ ] **Step 1: Write failing pgTAP schema assertions**

```sql
begin;
select plan(8);
select has_table('public', 'case_lab_3_orders');
select has_table('public', 'case_lab_3_payment_attempts');
select has_table('public', 'case_lab_3_fiscal_operations');
select has_table('public', 'case_lab_3_jobs');
select has_table('public', 'case_lab_3_ticket_revisions');
select col_is_unique('public', 'case_lab_3_tickets', 'order_id');
select col_not_null('public', 'case_lab_3_orders', 'amount_minor');
select results_eq(
  $$ select count(*)::bigint from public.case_lab_3_event_settings where sales_enabled $$,
  array[0::bigint]
);
select * from finish();
rollback;
```

- [ ] **Step 2: Start local Supabase and verify the tests fail**

Run: `npx supabase start`  
Run: `npm run test:case-lab-3-db`  
Expected: FAIL because the payment tables do not exist.

- [ ] **Step 3: Create the complete schema migration**

Use database enums or check constraints for these exact state sets:

```sql
payment_status: pending, processing, paid, failed, refund_pending, partially_refunded, refunded, review_required
reservation_status: active, processing, consumed, expired, released
payment_attempt_status: created, check_approved, completed, failed, review_required
fiscal_status: not_requested, queued, issued, error, unknown
ticket_status: valid, used, cancelled
email_status: pending, sent, failed, unknown
refund_status: requested, processing, confirmed, failed, unknown, review_required
job_status: pending, leased, completed, failed, unknown
```

Do not add an `unknown` attempt status. An indeterminate provider result atomically sets both `payment_attempt_status = review_required` and the order `payment_status = review_required`, leaves the reservation `processing`, and blocks new attempts. Reconciliation may resolve the pair to `completed`/`paid` or `failed`; otherwise it stays `review_required` for operator resolution.

Create these exact tables: `case_lab_3_event_settings`, `case_lab_3_fiscal_policy_versions`, `case_lab_3_inventory_allocations`, `case_lab_3_legal_document_versions`, `case_lab_3_orders`, `case_lab_3_reservations`, `case_lab_3_payment_attempts`, `case_lab_3_provider_events`, `case_lab_3_fiscal_operations`, `case_lab_3_tickets`, `case_lab_3_ticket_revisions`, `case_lab_3_check_ins`, `case_lab_3_refunds`, `case_lab_3_jobs`, `case_lab_3_email_deliveries`, `case_lab_3_analytics_events`, `case_lab_3_audit_log`, `case_lab_3_incidents`, `case_lab_3_rate_limits`, and `case_lab_3_reconciliation_state`. Store the latest worker heartbeat on the environment settings row.

Add foreign keys, `created_at`/`updated_at`, money checks (`amount_minor >= 0` and integer bigint), environment checks, unique provider transaction IDs scoped by environment, unique logical job/fiscal/email/analytics keys, unique public ticket number, indexed ticket UUID/current revision relation, and unique first check-in relation. Store no clear QR token or manual code.

Seed exact event settings:

```sql
insert into public.case_lab_3_event_settings
  (environment, early_bird_amount_minor, standard_amount_minor, early_bird_quota,
   online_sales_limit, venue_capacity, sales_cutoff, sales_enabled)
values
  ('test', 789000, 1500000, 20, 70, 100, '2026-09-24 00:00:00 Asia/Almaty'::timestamptz, false),
  ('live', 789000, 1500000, 20, 70, 100, '2026-09-24 00:00:00 Asia/Almaty'::timestamptz, false);
```

Seed an accountant-independent test-only fiscal policy containing `payment_income` and `refund_income_return`, mark it approved by `automated-test`, and attach it only to the test environment. Leave both sales switches false and the live active fiscal policy null so no environment is sellable before legal configuration and live cannot be enabled before real accountant approval.

Enable RLS on every new table and grant no `anon` or `authenticated` policy.

- [ ] **Step 4: Write the RLS denial assertions**

Use `set local role anon` and assert that direct select/insert/update/delete attempts affect zero rows or raise insufficient privilege for all payment tables.

- [ ] **Step 5: Apply reset and run database tests**

Run: `npx supabase db reset`  
Run: `npm run test:case-lab-3-db`  
Expected: all schema and RLS tests PASS.

- [ ] **Step 6: Add handwritten strict database/RPC types**

Define focused row and RPC return types in `database.types.ts`; do not widen them to `Record<string, unknown>` at route boundaries.

- [ ] **Step 7: Commit checkpoint after explicit authorization**

```bash
git add supabase/migrations/20260907000000_create_case_lab_3_payment_schema.sql supabase/tests/case_lab_3_schema.test.sql supabase/tests/case_lab_3_rls.test.sql app/lib/case-lab-3/database.types.ts
git commit -m "feat(case-lab-3): add payment persistence schema"
```

---

### Task 4: Atomic Availability, Orders, and Check-in Functions

**Files:**
- Create: `supabase/migrations/20260907010000_add_case_lab_3_atomic_functions.sql`
- Create: `supabase/tests/case_lab_3_inventory.test.sql`
- Create: `supabase/tests/case_lab_3_check_in.test.sql`

**Interfaces:**
- Produces RPCs `case_lab_3_get_availability`, `case_lab_3_create_order`, `case_lab_3_create_payment_attempt`, `case_lab_3_transfer_participant`, `case_lab_3_cancel_ticket`, `case_lab_3_check_in`, `case_lab_3_consume_rate_limit`, `case_lab_3_update_settings`, `case_lab_3_create_allocation`, `case_lab_3_release_allocation`.
- All RPCs use `security definer`, fixed `search_path`, explicit grants only to `service_role`, and event-row locking for capacity transitions.
- `case_lab_3_create_order` returns a JSON object with either an order/reservation or a stable rejection reason and current offer.

- [ ] **Step 1: Write failing concurrency and quota SQL tests**

Assert these exact cases:

```sql
-- 19 paid Early Bird + 1 active Early Bird reservation => temporary, not Standard.
-- 20 confirmed Early Bird => Standard at 1500000.
-- 70 online paid/reserved => online sold_out even when venue count is below 100.
-- 69 online seats + 31 invitations => physical sold_out at 100.
-- Full refund frees physical/online capacity but never Early Bird historical quota.
-- Raising online limit to 100 succeeds; 101 and reductions below committed online seats fail.
```

- [ ] **Step 2: Run database tests and verify failure**

Run: `npm run test:case-lab-3-db`  
Expected: FAIL because RPCs do not exist.

- [ ] **Step 3: Implement availability and order RPCs**

Use this lock and time discipline in every allocation-changing function:

```sql
select *
into strict v_settings
from public.case_lab_3_event_settings
where environment = p_environment
for update;

update public.case_lab_3_reservations
set status = 'expired', updated_at = clock_timestamp()
where environment = p_environment
  and status = 'active'
  and expires_at <= clock_timestamp();
```

Compute online sales consumption separately from physical occupancy. Require `now() < sales_cutoff`, active approved fiscal policy, active legal versions, and `sales_enabled`. Deduplicate order creation by `(environment, idempotency_key)` and return the same order for an exact repeat. Database tests install active test-only legal fixtures and enable only the test row inside rolled-back setup transactions; the persistent environment remains disabled until Task 6A.

- [ ] **Step 4: Implement safe payment-attempt creation**

Allow reuse only for a `created` attempt while the reservation remains active. Reject a new attempt when another is `check_approved` or `review_required`. Any unknown provider result must first atomically move both attempt and order to `review_required` while retaining the `processing` reservation; only reconciliation to confirmed `completed`/`paid` or `failed` can unblock the flow. Reacquire the same tier atomically after confirmed failure; return changed-offer status when that tier is no longer available.

- [ ] **Step 5: Implement ticket revision and check-in RPCs**

Transfer creates a new immutable revision and updates the current revision pointer. Check-in accepts ticket ID plus verified current token version, inserts once, and returns one of `admitted`, `already_used`, `cancelled`, `invalid` without leaking unrelated data.

- [ ] **Step 6: Implement atomic database rate limiting**

`case_lab_3_consume_rate_limit` atomically increments a fixed-window bucket keyed by `(scope, purpose-bound client-IP hash, bucket_start)`, returns `allowed`, remaining attempts, and reset time, and accepts only bounded server-selected limits. Grant execution only to `service_role`; store no raw IP. Cover concurrent consumption and expiry in pgTAP.

- [ ] **Step 7: Run database tests**

Run: `npm run test:case-lab-3-db`  
Expected: all inventory, transfer, and concurrent check-in tests PASS.

- [ ] **Step 8: Commit checkpoint after explicit authorization**

```bash
git add supabase/migrations/20260907010000_add_case_lab_3_atomic_functions.sql supabase/tests/case_lab_3_inventory.test.sql supabase/tests/case_lab_3_check_in.test.sql
git commit -m "feat(case-lab-3): add atomic ticket inventory"
```

---

### Task 5: Atomic Provider Events, Refunds, Fiscal Operations, and Jobs

**Files:**
- Create: `supabase/migrations/20260907020000_add_case_lab_3_provider_functions.sql`
- Create: `supabase/tests/case_lab_3_webhooks.test.sql`
- Create: `supabase/tests/case_lab_3_refunds.test.sql`
- Create: `supabase/tests/case_lab_3_jobs.test.sql`

**Interfaces:**
- Produces RPCs `case_lab_3_apply_check`, `case_lab_3_apply_pay`, `case_lab_3_apply_fail`, `case_lab_3_apply_refund`, `case_lab_3_apply_receipt`.
- Produces RPCs `case_lab_3_create_refund`, `case_lab_3_resolve_incident`.
- Produces RPCs `case_lab_3_claim_jobs`, `case_lab_3_complete_job`, `case_lab_3_retry_job`, `case_lab_3_mark_job_unknown`, `case_lab_3_run_maintenance`, `case_lab_3_record_worker_heartbeat`.
- Constraint: Pay transaction records payment, consumes reservation, creates ticket/revision, fiscal operations, email job, and analytics job before returning.

- [ ] **Step 1: Write failing replay and ordering tests**

Test duplicate Check, concurrent Check, Pay then Fail, Fail then Pay, duplicate Pay, an indeterminate provider result atomically setting attempt/order to `review_required` while retaining the `processing` reservation, reconciliation to completed or failed, Refund before/after Receipt, duplicate Refund, early Receipt before Kassir response storage, full/partial refund arithmetic, and unexpected real payment incident creation.

- [ ] **Step 2: Run database tests and verify failure**

Run: `npm run test:case-lab-3-db`  
Expected: FAIL because provider transition RPCs do not exist.

- [ ] **Step 3: Implement payment transitions**

`case_lab_3_apply_pay` must use one transaction and these unique logical keys:

```text
ticket:<order_id>
fiscal:payment_income:<payment_transaction_id>
email:ticket:<ticket_id>:<revision_id>
ga4:purchase:<order_id>
```

Known exact repeats return accepted without new effects. Valid but unexpected real payments create `case_lab_3_incidents` and organizer-alert jobs instead of tickets.

- [ ] **Step 4: Implement refund and fiscal transitions**

`case_lab_3_create_refund` validates `0 < amount <= paid - confirmed_refunds - pending_refunds`. A provider-confirmed full refund cancels the ticket, returns Standard capacity, creates one fiscal-policy return operation and buyer-notification job. Partial refunds retain the ticket.

- [ ] **Step 5: Implement leased job functions**

Claim at most five due jobs using `for update skip locked`, set `leased_until = clock_timestamp() + interval '2 minutes'`, and increment attempts. Complete/retry operations require the matching lease token. Maintenance expires only `active` reservations and requeues expired job leases.

- [ ] **Step 6: Run all database tests**

Run: `npm run test:case-lab-3-db`  
Expected: all schema, inventory, webhook, refund, job, check-in, and RLS tests PASS.

- [ ] **Step 7: Commit checkpoint after explicit authorization**

```bash
git add supabase/migrations/20260907020000_add_case_lab_3_provider_functions.sql supabase/tests/case_lab_3_webhooks.test.sql supabase/tests/case_lab_3_refunds.test.sql supabase/tests/case_lab_3_jobs.test.sql
git commit -m "feat(case-lab-3): add durable payment transitions"
```

---

### Task 6: Server Configuration, Database Client, HTTP Guards, and CRM Auth

**Files:**
- Modify: `.env.example`
- Modify: `app/lib/jwt.ts`
- Modify: `app/api/auth/login/route.ts`
- Modify: `app/api/auth/check/route.ts`
- Create: `app/lib/case-lab-3/config.server.ts`
- Create: `app/lib/case-lab-3/supabase-admin.server.ts`
- Create: `app/lib/case-lab-3/http.server.ts`
- Create: `app/lib/case-lab-3/provider-hmac.server.ts`
- Create: `app/lib/crm-auth.server.ts`
- Create: `tests/case-lab-3-payments/config.test.ts`
- Create: `tests/case-lab-3-payments/request-security.test.ts`
- Create: `tests/case-lab-3-payments/crm-auth.test.ts`

**Interfaces:**
- Produces `getCaseLab3Config(environment, source = process.env)` with separate test/live widget, TipTop, Kassir, seller, SMTP, session, worker, and GA values.
- Produces `getCaseLab3AdminClient()` with service-role access and no persisted auth.
- Produces `readBoundedBody(request, maxBytes)`, `requireJson`, `requireForm`, `requireSameOrigin`, `getHashedClientIp`, `noStoreJson`.
- Produces `verifyProviderHmac(rawBody, headers, secret, mode)`.
- Produces `requireCrmAdmin`, `issueCrmCsrfToken`, and `verifyCrmMutation`.
- Produces purpose-bound `OrderSession` and `TicketSession` types consumed by buyer routes.
- Produces a CRM login route protected by `case_lab_3_consume_rate_limit`, not the process-local `app/lib/rate-limit.ts` map.

- [ ] **Step 1: Write failing fail-closed configuration tests**

```ts
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SignJWT } from "jose";
import { getCaseLab3Config } from "../../app/lib/case-lab-3/config.server";
import { verifyToken } from "../../app/lib/jwt";

test("live configuration rejects missing fiscal and provider secrets", () => {
  assert.throws(() => getCaseLab3Config("live", {}), /configuration incomplete/i);
});

test("CRM verification rejects a valid JWT with the wrong role", async () => {
  process.env.JWT_SECRET = "s".repeat(32);
  const token = await new SignJWT({ role: "viewer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("caselab.kz")
    .setAudience("caselab-crm")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("s".repeat(32)));
  assert.equal(await verifyToken(token), false);
});

test("CRM login does not depend on process-local rate limiting", async () => {
  const source = await readFile("app/api/auth/login/route.ts", "utf8");
  assert.doesNotMatch(source, /lib\/rate-limit/);
  assert.match(source, /case_lab_3_consume_rate_limit/);
});
```

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx tsx --test tests/case-lab-3-payments/config.test.ts tests/case-lab-3-payments/request-security.test.ts tests/case-lab-3-payments/crm-auth.test.ts`  
Expected: FAIL because guards do not exist and JWT role is not enforced.

- [ ] **Step 3: Replace obsolete checkout variables in `.env.example`**

Document these variable names with empty example values:

```text
TIPTOP_TEST_TERMINAL_ID
TIPTOP_LIVE_TERMINAL_ID
CASE_LAB_3_PAYMENT_MODE
TIPTOP_TEST_PUBLIC_ID
TIPTOP_TEST_API_SECRET
TIPTOP_LIVE_PUBLIC_ID
TIPTOP_LIVE_API_SECRET
KASSIR_TEST_PUBLIC_ID
KASSIR_TEST_API_SECRET
KASSIR_LIVE_PUBLIC_ID
KASSIR_LIVE_API_SECRET
KASSIR_SELLER_INN
SMTP_HOST
SMTP_PORT
SMTP_SECURE
SMTP_USER
SMTP_PASSWORD
SMTP_FROM
CASE_LAB_3_ALERT_EMAIL
CASE_LAB_3_TOKEN_SECRET
CASE_LAB_3_CRON_SECRET
NEXT_PUBLIC_GA4_MEASUREMENT_ID
GA4_API_SECRET
```

Remove `NEXT_PUBLIC_CASE_LAB_3_CHECKOUT_URL` and `NEXT_PUBLIC_CASE_LAB_3_CHECKOUT_HOST` only after all code/tests stop referencing them.

- [ ] **Step 4: Implement server-only config and Supabase admin client**

Add `import "server-only"` to both modules. Reject missing values with non-secret messages and never expose API secrets through returned public contracts.

- [ ] **Step 5: Tighten CRM login, JWT, and CSRF behavior**

Verify `algorithms: ["HS256"]`, payload role `crm_admin`, fixed issuer `caselab.kz`, and audience `caselab-crm`. Return a session-bound CSRF token from `/api/auth/check` only to an authenticated request.

Replace the `checkRateLimit` import in `/api/auth/login` with the atomic Postgres RPC from Task 4. Hash the platform-normalized client IP using `CASE_LAB_3_TOKEN_SECRET` with purpose `rate-limit-ip` and scope `crm-login`; the login route loads only the Supabase and token-secret values it needs, not the complete payment-provider configuration. Reject a missing/untrusted client-IP source rather than putting all clients in an `unknown` bucket. Permit five attempts in a fifteen-minute fixed window, call the limiter before password evaluation, and fail closed with a generic `503` if the limiter is unavailable. Use constant-time password comparison for equal-length encoded values. Preserve the existing secure HttpOnly cookie behavior and generic `401` response. The existing process-local limiter may remain for unrelated legacy lead endpoints, but CRM login must not call it.

- [ ] **Step 6: Implement HTTP/body/HMAC guards**

Read body bytes once, cap provider bodies at 64 KiB and buyer JSON at 16 KiB, reject unexpected content type with 415, compare HMAC via `timingSafeEqual`, and hash client IP with a purpose-bound server secret before rate-limit storage.

- [ ] **Step 7: Run focused tests and static checks**

Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/config.test.ts tests/case-lab-3-payments/request-security.test.ts tests/case-lab-3-payments/crm-auth.test.ts`  
Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

- [ ] **Step 8: Commit checkpoint after explicit authorization**

```bash
git add .env.example app/lib/jwt.ts app/api/auth/login/route.ts app/api/auth/check/route.ts app/lib/case-lab-3/config.server.ts app/lib/case-lab-3/supabase-admin.server.ts app/lib/case-lab-3/http.server.ts app/lib/case-lab-3/provider-hmac.server.ts app/lib/crm-auth.server.ts tests/case-lab-3-payments/config.test.ts tests/case-lab-3-payments/request-security.test.ts tests/case-lab-3-payments/crm-auth.test.ts
git commit -m "feat(case-lab-3): add secure server foundations"
```

---

### Task 6A: Legal Copy and Immutable Document Versions

**Files:**
- Modify: `app/privacy/page.tsx`
- Modify: `tests/case-lab-3-p2.test.mjs`
- Create: `supabase/migrations/20260907030000_seed_case_lab_3_legal_versions.sql`
- Create: `tests/case-lab-3-payments/legal-versions.test.ts`

**Interfaces:**
- Produces active immutable offer/privacy versions for test and live order references.
- Produces a privacy page at the existing `/privacy/` URL that matches checkout data collection and processors.
- Produces stable version IDs, full canonical text snapshots, SHA-256 hashes, publication labels, and activation timestamps.
- Activates `sales_enabled` only for the `test` settings row after the test fiscal/legal gates are complete; the `live` row stays false.
- Constraint: a new legal revision inserts a new row; it never updates accepted historical text.

- [ ] **Step 1: Write failing privacy and legal-version tests**

Require privacy copy to name surname/email, optional phone/company/position, purchaser/participant separation, order/payment/refund/receipt/ticket/revision/check-in/email-delivery records, TipTop Pay, Kassir, Mail.ru, Supabase/Vercel, GA4, purposes, and retention basis. Parse the migration and assert that each active version has non-empty canonical text and a matching SHA-256 hash. Assert exactly one enabled settings row after migration: `test`; assert `live.sales_enabled = false`.

- [ ] **Step 2: Run tests and verify failure**

Run: `node --test tests/case-lab-3-p2.test.mjs`  
Run: `npx tsx --test tests/case-lab-3-payments/legal-versions.test.ts`  
Expected: FAIL because current privacy copy omits checkout fields and no immutable versions exist.

- [ ] **Step 3: Update privacy copy without changing its URL or layout**

Change only the legal text and visible revision date. Preserve current typography and navigation. Explicitly state that card details are entered at TipTop Pay and are never received by Case Lab; marketing consent is separate and optional.

- [ ] **Step 4: Add exact immutable snapshots and hashes**

Store canonical offer/privacy text in dollar-quoted SQL values. Compute each hash from the exact UTF-8 snapshot using Node before inserting it:

```ts
import { createHash } from "node:crypto";

export function legalTextHash(text: string) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}
```

Insert version IDs such as `offer-2026-09-07` and `privacy-2026-09-07`, their existing URLs, publication labels, full text, hashes, and active timestamps for both environments. Order creation selects these active IDs atomically.

At the end of the same migration, update only `environment = 'test'` to `sales_enabled = true` with an `exists` guard for its active `automated-test` fiscal policy and both active legal document kinds. Raise an exception if those gates are incomplete. Do not update the live row. This is the required test-only activation before Task 7; without it, Tasks 7-9 are expected to return `sales_closed` or `configuration_incomplete` rather than creating orders.

- [ ] **Step 5: Apply local migrations and run tests**

Run: `npx supabase db reset`  
Run: `npm run test:case-lab-3-db`  
Run: `node --test tests/case-lab-3-p2.test.mjs`  
Run: `npx tsx --test tests/case-lab-3-payments/legal-versions.test.ts`  
Expected: PASS; test availability passes database configuration gates and live sales remain disabled.

- [ ] **Step 6: Commit checkpoint after explicit authorization**

```bash
git add app/privacy/page.tsx tests/case-lab-3-p2.test.mjs supabase/migrations/20260907030000_seed_case_lab_3_legal_versions.sql tests/case-lab-3-payments/legal-versions.test.ts
git commit -m "feat(case-lab-3): version checkout legal terms"
```

---

### Task 7: Public Availability, Order, Session, Status, and Attempt APIs

**Files:**
- Create: `app/lib/case-lab-3/orders.server.ts`
- Create: `app/lib/case-lab-3/tiptoppay-widget.server.ts`
- Create: `app/api/case-lab-3/availability/route.ts`
- Create: `app/api/case-lab-3/orders/route.ts`
- Create: `app/api/case-lab-3/orders/[id]/payment-attempts/route.ts`
- Create: `app/api/case-lab-3/orders/[id]/status/route.ts`
- Create: `app/api/case-lab-3/orders/[id]/access/route.ts`
- Create: `app/api/case-lab-3/tickets/[number]/access/route.ts`
- Create: `tests/case-lab-3-payments/public-api.integration.test.ts`

**Interfaces:**
- Produces server-authoritative `AvailabilityResponse`.
- Produces the `CreateOrderResult` union from Task 2.
- Produces `buildWidgetParams(attempt, publicTerminalId): TipTopWidgetParams` and a safe widget-attempt response consumed by Task 8.
- Produces separate purchaser order cookie and participant ticket cookie.
- Every response containing order state uses `Cache-Control: no-store`.

- [ ] **Step 1: Write failing route integration tests**

Test no-store availability, 415/413 behavior, missing/duplicate idempotency key, 409 changed offer without insert, same-key same-order response, unauthorized status, wrong-order cookie, expired token version, clean redirect after bearer-token exchange, and widget output containing exactly `emailBehavior: "Hidden"` while omitting receipt/recurrent fields.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx --test tests/case-lab-3-payments/public-api.integration.test.ts`  
Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement thin RPC service wrappers**

`orders.server.ts` must expose:

```ts
export async function getAvailability(environment: PaymentEnvironment): Promise<AvailabilityResponse>;
export type OrderRequestContext = { environment: PaymentEnvironment; idempotencyKey: string; hashedClientIp: string };
export async function createOrder(input: OrderInput, context: OrderRequestContext): Promise<CreateOrderResult>;
export async function createPaymentAttempt(orderId: string, session: OrderSession): Promise<PaymentAttemptResponse>;
export async function getOrderStatus(orderId: string, session: OrderSession): Promise<OrderStatusResponse>;
```

Keep pricing and capacity decisions inside RPCs; wrappers only validate typed results.

- [ ] **Step 4: Implement exact widget parameters**

Create `tiptoppay-widget.server.ts` with this exact output and no receipt/recurrent fields:

```ts
return {
  publicTerminalId,
  amount: minorToMajor(attempt.amountMinor),
  currency: "KZT",
  paymentSchema: "Single",
  externalId: attempt.externalId,
  receiptEmail: attempt.receiptEmail,
  emailBehavior: "Hidden",
  tokenize: false,
  retryPayment: false,
  userInfo: {
    accountId: attempt.orderOpaqueId,
    firstName: attempt.firstName,
    lastName: attempt.lastName,
    email: attempt.receiptEmail,
    phone: attempt.phone ?? undefined,
  },
};
```

- [ ] **Step 5: Implement public routes and cookies**

Use random UUID `Idempotency-Key`, exact origin validation on POST, HttpOnly/Secure/SameSite=Lax purchaser cookie, purpose/version-bound bearer exchange, and no personal data in error bodies. Return 409 with current offer when the RPC reports changed tier/price.

- [ ] **Step 6: Run tests and TypeScript**

Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/public-api.integration.test.ts`  
Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

- [ ] **Step 7: Commit checkpoint after explicit authorization**

```bash
git add app/lib/case-lab-3/orders.server.ts app/lib/case-lab-3/tiptoppay-widget.server.ts app/api/case-lab-3 tests/case-lab-3-payments/public-api.integration.test.ts
git commit -m "feat(case-lab-3): add ticket order APIs"
```

---

### Task 8: Shared Checkout Dialog and All CTA Wiring

**Files:**
- Modify: `app/case-lab-3/page.tsx`
- Modify: `app/components/CaseLab3Page.tsx`
- Modify: `app/components/CaseLab3Navbar.tsx`
- Modify: `app/components/Navbar.tsx`
- Modify: `app/sections/CaseLab3Hero.tsx`
- Modify: `app/sections/CaseLab3Tickets.tsx`
- Modify: `app/components/CaseLab3Footer.tsx`
- Modify: `app/case-lab-3/case-lab-3.module.css`
- Modify: `proxy.ts`
- Modify: `tests/case-lab-3-p1.test.mjs`
- Modify: `tests/case-lab-3-p2.test.mjs`
- Modify: `tests/case-lab-3-tickets-editorial.test.mjs`
- Delete: `app/lib/caseLab3.ts`
- Create: `app/components/case-lab-3/checkout/CaseLab3CheckoutProvider.tsx`
- Create: `app/components/case-lab-3/checkout/CaseLab3CheckoutButton.tsx`
- Create: `app/components/case-lab-3/checkout/CaseLab3CheckoutDialog.tsx`
- Create: `app/components/case-lab-3/checkout/CaseLab3CheckoutDialog.module.css`
- Create: `app/components/case-lab-3/checkout/checkout-machine.ts`
- Create: `app/components/case-lab-3/checkout/tiptoppay-widget.client.ts`
- Create: `tests/case-lab-3-payments/checkout-machine.test.ts`

**Interfaces:**
- Produces `useCaseLab3Checkout().openCheckout(source)` where source is `navbar | hero | tickets | footer`.
- Produces pure `checkoutReducer(state, event)` for all approved UI states.
- Produces `loadTipTopWidget(nonce)` and `startTipTopPayment(params)`; callback yields only a polling trigger.
- Keeps Tickets and Footer as Server Components by using `CaseLab3CheckoutButton` as the leaf client island.

- [ ] **Step 1: Replace obsolete source assertions with failing checkout assertions**

Update existing source tests to require one provider/dialog, four CTA sources, server-rendered Tickets/Footer, dynamic server price in the dialog, and removal of `caseLab3CheckoutHref`. Keep current CTA shape/radius and unrelated visual assertions.

- [ ] **Step 2: Write failing reducer tests**

```ts
test("widget success enters server verification instead of paid", () => {
  const next = checkoutReducer(paymentOpenState, { type: "WIDGET_COMPLETE", result: "success" });
  assert.equal(next.phase, "verifying");
});

test("changed offer requires explicit confirmation", () => {
  const next = checkoutReducer(submittingState, {
    type: "OFFER_CHANGED",
    offer: { tier: "standard", amountMinor: 1500000 },
  });
  assert.equal(next.phase, "confirm_changed_offer");
});
```

- [ ] **Step 3: Run tests and verify failure**

Run: `node --test tests/case-lab-3-p1.test.mjs tests/case-lab-3-p2.test.mjs tests/case-lab-3-tickets-editorial.test.mjs`  
Run: `npx tsx --test tests/case-lab-3-payments/checkout-machine.test.ts`  
Expected: FAIL on missing checkout implementation.

- [ ] **Step 4: Implement the pure checkout reducer**

Cover `idle`, `loading_availability`, `form`, `submitting`, `confirm_changed_offer`, `reserved`, `loading_widget`, `payment_open`, `verifying`, `paid`, `failed`, `review_required`, `expired`, `temporarily_reserved`, `sold_out`, `closed`, and `script_error`.

- [ ] **Step 5: Implement accessible dialog behavior**

The provider owns a single dialog. On open, store opener; on close, restore focus. Use `role="dialog"`, `aria-modal="true"`, labelled title, initial focus, Tab containment, Escape, background inert/aria-hidden, and body scroll-lock cleanup. Disable repeat submits and add explicit reduced-motion CSS independent of `caseLabForceMotion`.

- [ ] **Step 6: Implement lazy widget loading and minimum TipTop CSP**

Use a nonced script from `https://widget.tiptoppay.kz/bundles/widget.js`, deduplicate concurrent loads, remove failed script nodes before retry, and reject any attempt params containing receipt, recurrent, or tokenization. Do not self-host or import a payment package. On Case Lab III page paths, preserve strict-dynamic nonce handling and add the official `https://widget.tiptoppay.kz` script/frame origin required for the iframe; do not loosen CSP globally.

- [ ] **Step 7: Wire every CTA through the provider**

Pass nonce from `app/case-lab-3/page.tsx` into `CaseLab3Page` and provider. Add optional `onCtaClick` to shared `Navbar`, preserving its existing lead-popup default for other callers. Mobile CTA closes the menu before opening checkout.

- [ ] **Step 8: Run focused and existing tests**

Run: `node --test tests/case-lab-3-p1.test.mjs tests/case-lab-3-p2.test.mjs tests/case-lab-3-tickets-editorial.test.mjs`  
Run: `npx tsx --test tests/case-lab-3-payments/checkout-machine.test.ts`  
Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

- [ ] **Step 9: Commit checkpoint after explicit authorization**

```bash
git add app/case-lab-3/page.tsx app/components/CaseLab3Page.tsx app/components/CaseLab3Navbar.tsx app/components/Navbar.tsx app/sections/CaseLab3Hero.tsx app/sections/CaseLab3Tickets.tsx app/components/CaseLab3Footer.tsx app/case-lab-3/case-lab-3.module.css app/components/case-lab-3/checkout proxy.ts tests/case-lab-3-p1.test.mjs tests/case-lab-3-p2.test.mjs tests/case-lab-3-tickets-editorial.test.mjs tests/case-lab-3-payments/checkout-machine.test.ts
git rm app/lib/caseLab3.ts
git commit -m "feat(case-lab-3): connect ticket checkout dialog"
```

---

### Task 9: TipTop Pay Adapter and Signed Webhook Routes

**Files:**
- Create: `app/lib/case-lab-3/tiptoppay.server.ts`
- Create: `app/api/tiptoppay/[environment]/check/route.ts`
- Create: `app/api/tiptoppay/[environment]/pay/route.ts`
- Create: `app/api/tiptoppay/[environment]/fail/route.ts`
- Create: `app/api/tiptoppay/[environment]/refund/route.ts`
- Create: `tests/case-lab-3-payments/tiptoppay-contract.test.ts`
- Create: `tests/fixtures/case-lab-3/tiptoppay/check-cyrillic.form`
- Create: `tests/fixtures/case-lab-3/tiptoppay/check-plus-space.form`
- Create: `tests/fixtures/case-lab-3/tiptoppay/check-percent-encoded.form`
- Create: `tests/fixtures/case-lab-3/tiptoppay/check-duplicate-parameters.form`
- Create: `tests/fixtures/case-lab-3/tiptoppay/pay-completed.form`
- Create: `tests/fixtures/case-lab-3/tiptoppay/fail-late.form`
- Create: `tests/fixtures/case-lab-3/tiptoppay/refund.form`

**Interfaces:**
- Produces typed `parseCheck`, `parsePay`, `parseFail`, `parseRefund`.
- Produces `refundPayment`, `getTransaction`, `findInvoiceOperations`, and paginated list reconciliation methods.
- Webhook routes always return TipTop JSON codes after durable RPC completion.

- [ ] **Step 1: Write independently anchored signed fixtures and failing contract tests**

Commit fake-secret fixtures, but do not generate every expected signature with the application helper under test. Pin at least this independently calculated OpenSSL control vector as literal fixture data:

```text
secret: fixture-secret-2026
raw body: TransactionId=12345&Amount=7890.00&Currency=KZT&InvoiceId=cl3-attempt-001&AccountId=order-001&Name=%D0%90%D0%B9%D0%B4%D0%B0%D0%BD
Content-HMAC (HMAC-SHA256/Base64): +rjISSRvuc7ezdUkFKVIrw45ExbSSJz+SxXjMoYWUEo=
independent command: printf '%s' '<raw body above>' | openssl dgst -sha256 -hmac 'fixture-secret-2026' -binary | openssl base64 -A
```

The contract test reads the pinned expected value and verifies both acceptance and one-byte body rejection. Other static fixture signatures may be produced by OpenSSL or a separate external implementation, never at test runtime by the helper being verified. Assert raw `Content-HMAC`, rejection of an unproven decoded variant, wrong signature, wrong environment/TestMode, amount/currency mismatch, unknown order, late Fail, duplicate Pay, and Refund transaction-ID distinction. The decoded `X-Content-HMAC` path remains disabled unless the real test callback in Task 17 proves its canonical representation.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx --test tests/case-lab-3-payments/tiptoppay-contract.test.ts`  
Expected: FAIL because the adapter/routes do not exist.

- [ ] **Step 3: Implement typed webhook parsers**

Parse only documented Check/Pay/Fail/Refund fields into strict internal types. Preserve `TransactionId` as the refund ID and `PaymentTransactionId` as the original payment ID. Reject missing required fields, non-finite amounts, unsupported currency, and malformed TestMode before calling a state-transition RPC.

- [ ] **Step 4: Implement signed webhook routes**

Await `params: Promise<{ environment: string }>` under Next.js 16. Read raw form bytes once, validate `test | live`, choose only that environment's secret, verify signature, parse, call one RPC, and return `{"code":0}` only after persistence. Check rejections map exactly to codes 10/11/12/13/20.

- [ ] **Step 5: Implement bounded server API methods**

Use Basic Auth, `X-Request-ID` for refund idempotency, ten-second abort signals, typed JSON validation, and no request/response payload logging. After a one-hour uncertain refund window, reconcile before retry.

- [ ] **Step 6: Run contract, DB, and TypeScript tests**

Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/tiptoppay-contract.test.ts`  
Run: `npm run test:case-lab-3-db`  
Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

- [ ] **Step 7: Commit checkpoint after explicit authorization**

```bash
git add app/lib/case-lab-3/tiptoppay.server.ts app/api/tiptoppay tests/case-lab-3-payments/tiptoppay-contract.test.ts tests/fixtures/case-lab-3/tiptoppay
git commit -m "feat(case-lab-3): handle signed tiptop payments"
```

---

### Task 10: Kassir Adapter and Durable Worker

**Files:**
- Create: `app/lib/case-lab-3/kassir.server.ts`
- Create: `app/lib/case-lab-3/jobs.server.ts`
- Create: `app/lib/case-lab-3/worker.server.ts`
- Create: `app/api/kassir/[environment]/receipt/route.ts`
- Create: `app/api/internal/case-lab-3/jobs/route.ts`
- Create: `tests/case-lab-3-payments/kassir-contract.test.ts`
- Create: `tests/case-lab-3-payments/worker.integration.test.ts`
- Create: `tests/fixtures/case-lab-3/kassir/receipt-queued.json`
- Create: `tests/fixtures/case-lab-3/kassir/receipt-issued.form`

**Interfaces:**
- Produces `buildFiscalPayload(operation, policy): KassirReceiptRequest`.
- Produces `queueReceipt`, `getReceiptStatus`, `getReceiptDetails`.
- Produces `runCaseLab3Worker({ environment, timeBudgetMs: 45000, maxJobs: 5 })`.
- Worker handles fiscal stages, receipt polling, maintenance, alerts, email, GA, refunds, and reconciliation through registered handlers.

- [ ] **Step 1: Write failing Kassir payload tests**

Assert Early Bird/Standard labels, `TaxationSystem: 0`, VAT omitted/null, one item, cash zero, electronic total, `CalculationPlace: caselab.kz`, partial return amount on Price/Amount/Electronic, stable operation key, and unsupported fiscal policy rejection.

- [ ] **Step 2: Write failing worker lease tests**

Assert max five jobs, two-minute lease, ten-second external timeout, no new work after 45 seconds, retry classification, expired lease recovery, and receipt timeout becoming `unknown` after the one-hour idempotency window.

- [ ] **Step 3: Run tests and verify failure**

Run: `npx tsx --test tests/case-lab-3-payments/kassir-contract.test.ts tests/case-lab-3-payments/worker.integration.test.ts`  
Expected: FAIL because adapters and worker do not exist.

- [ ] **Step 4: Implement Kassir HTTP methods**

Use Basic Auth and JSON UTF-8. Treat only `Success:true`, `Message:"Queued"`, and a non-empty `Model.Id` as queued. Inspect status `Model` even when `Success:true`; handle `Processed`, `Queued`, `Error`, `NotFound`. Fetch details after Processed.

- [ ] **Step 5: Implement Receipt webhook**

Verify the test-proven signature before parsing. Persist an early receipt even when create response has not been stored, then match by environment, Kassir ID, order/InvoiceId, type, and amount. Return `{"code":0}` only after durable storage.

- [ ] **Step 6: Implement bounded worker dispatch**

Register handlers by job type, claim through RPC, pass lease token on completion/retry, persist sanitized errors, and create incidents for overdue/unknown operations. Do not import client UI or run work after returning the HTTP response.

- [ ] **Step 7: Run focused, database, and TypeScript tests**

Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/kassir-contract.test.ts tests/case-lab-3-payments/worker.integration.test.ts`  
Run: `npm run test:case-lab-3-db`  
Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

- [ ] **Step 8: Commit checkpoint after explicit authorization**

```bash
git add app/lib/case-lab-3/kassir.server.ts app/lib/case-lab-3/jobs.server.ts app/lib/case-lab-3/worker.server.ts app/api/kassir app/api/internal/case-lab-3/jobs tests/case-lab-3-payments/kassir-contract.test.ts tests/case-lab-3-payments/worker.integration.test.ts tests/fixtures/case-lab-3/kassir
git commit -m "feat(case-lab-3): add durable fiscal worker"
```

---

### Task 11: Protected Order/Ticket Pages, QR/PDF, and Mail.ru Delivery

**Files:**
- Create: `app/lib/case-lab-3/ticket.server.ts`
- Create: `app/lib/case-lab-3/pdf.server.ts`
- Create: `app/lib/case-lab-3/mail.server.ts`
- Create: `app/components/case-lab-3/TicketView.tsx`
- Create: `app/case-lab-3/order/[id]/page.tsx`
- Create: `app/case-lab-3/order/[id]/OrderStatusClient.tsx`
- Create: `app/case-lab-3/order/[id]/order.module.css`
- Create: `app/case-lab-3/ticket/[number]/page.tsx`
- Create: `app/case-lab-3/ticket/[number]/ticket.module.css`
- Create: `app/api/case-lab-3/orders/[id]/ticket.pdf/route.ts`
- Create: `tests/case-lab-3-payments/ticket-pdf.test.ts`
- Create: `tests/case-lab-3-payments/mail.test.ts`
- Create: `tests/case-lab-3-payments/protected-pages.integration.test.ts`

**Interfaces:**
- Produces `getPurchaserOrderView(session, orderId)` and `getParticipantTicketView(session, ticketNumber)` with separate field sets.
- Produces `renderTicketPdf(ticketRevision): Promise<Buffer>`.
- Produces `sendTicketEmail`, `sendRefundEmail`, `sendAdminAlert`.
- Participant page never exposes payment, purchaser, fiscal, refund, or email-delivery fields.

- [ ] **Step 1: Write failing access-separation and PDF tests**

Assert exact current QR payload `cl3:<ticket_uuid>:<revision_number>:<token>`, visible public ticket number plus ten-character manual code, Cyrillic participant/event text in PDF, no card/provider secrets, old revision invalid after transfer, purchaser can download PDF, participant can download current PDF, participant cannot read order/fiscal data, and all protected responses are no-store/noindex.

- [ ] **Step 2: Write failing SMTP tests**

Use a fake Nodemailer transport. Assert `smtp.mail.ru`, port 465, secure TLS, from `hello@caselab.kz`, stable Message-ID, PDF attachment, ticket-only participant link, full-refund notification, and no personal data in thrown/logged errors.

- [ ] **Step 3: Run focused tests and verify failure**

Run: `npx tsx --test tests/case-lab-3-payments/ticket-pdf.test.ts tests/case-lab-3-payments/mail.test.ts tests/case-lab-3-payments/protected-pages.integration.test.ts`  
Expected: FAIL because ticket fulfilment modules/pages do not exist.

- [ ] **Step 4: Implement ticket presentation and PDF**

Build one presentation model consumed by HTML, email, and PDF. Register local Gilroy WOFF2 fonts with PDFKit, generate QR PNG through `qrcode` from the exact identifier-bearing payload, print the public ticket number beside the ten-character manual code, and never include purchaser/fiscal data in the participant model.

- [ ] **Step 5: Implement separate protected pages**

Await dynamic params. Verify order or ticket-session purpose/version server-side before data fetch. Result page polls only non-final states and shows the approved Russian status copy. Ticket page renders current revision only.

- [ ] **Step 6: Implement SMTP adapter and worker handlers**

Use injected transport in tests and real Mail.ru config in production. Record accepted/rejected recipients without logging addresses. Classify timeout-after-submit as `unknown`, surface it in CRM, and avoid automatic repeated sends after the configured retry ceiling.

- [ ] **Step 7: Run focused tests, TypeScript, and build**

Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/ticket-pdf.test.ts tests/case-lab-3-payments/mail.test.ts tests/case-lab-3-payments/protected-pages.integration.test.ts`  
Run: `npx tsc --noEmit --incremental false`  
Run: `npm run build`  
Expected: PASS.

- [ ] **Step 8: Commit checkpoint after explicit authorization**

```bash
git add app/lib/case-lab-3/ticket.server.ts app/lib/case-lab-3/pdf.server.ts app/lib/case-lab-3/mail.server.ts app/components/case-lab-3/TicketView.tsx app/case-lab-3/order app/case-lab-3/ticket app/api/case-lab-3/orders tests/case-lab-3-payments/ticket-pdf.test.ts tests/case-lab-3-payments/mail.test.ts tests/case-lab-3-payments/protected-pages.integration.test.ts
git commit -m "feat(case-lab-3): deliver qr and pdf tickets"
```

---

### Task 12: CRM Orders, Inventory, and CSV

**Files:**
- Modify: `app/crm/page.tsx`
- Create: `app/lib/case-lab-3/csv.server.ts`
- Create: `app/crm/components/CrmSectionNav.tsx`
- Create: `app/crm/case-lab-3/page.tsx`
- Create: `app/crm/case-lab-3/OrdersClient.tsx`
- Create: `app/crm/case-lab-3/orders/[id]/page.tsx`
- Create: `app/crm/case-lab-3/orders/[id]/OrderActionsClient.tsx`
- Create: `app/api/admin/case-lab-3/orders/route.ts`
- Create: `app/api/admin/case-lab-3/orders/export/route.ts`
- Create: `app/api/admin/case-lab-3/orders/[id]/route.ts`
- Create: `app/api/admin/case-lab-3/orders/[id]/resend-ticket/route.ts`
- Create: `app/api/admin/case-lab-3/orders/[id]/send-receipt-link/route.ts`
- Create: `app/api/admin/case-lab-3/orders/[id]/transfer/route.ts`
- Create: `app/api/admin/case-lab-3/orders/[id]/cancel-ticket/route.ts`
- Create: `app/api/admin/case-lab-3/settings/route.ts`
- Create: `app/api/admin/case-lab-3/allocations/route.ts`
- Create: `app/api/admin/case-lab-3/allocations/[id]/release/route.ts`
- Create: `tests/case-lab-3-payments/admin-orders.integration.test.ts`
- Create: `tests/case-lab-3-payments/csv.test.ts`

**Interfaces:**
- Produces paginated/filterable admin order summaries and protected details.
- Produces audited sales-limit/switch/allocation actions.
- Produces audited participant transfer with token rotation and revised ticket email.
- Produces UTF-8 CSV with spreadsheet-formula neutralization and `Cache-Control: no-store`.

- [ ] **Step 1: Write failing admin and CSV tests**

Test unauthorized/CSRF/origin/idempotency rejection, exact-email search, filters, audited export, settings bounds 70-100, manual allocation capacity, transfer rotation, and CSV values beginning `=`, `+`, `-`, `@` prefixed with a single quote.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx tsx --test tests/case-lab-3-payments/admin-orders.integration.test.ts tests/case-lab-3-payments/csv.test.ts`  
Expected: FAIL because admin routes and CSV helper do not exist.

- [ ] **Step 3: Implement CRM navigation and read views**

Keep lead CRM behavior intact. Add links to `/crm/case-lab-3/` and `/crm/check-in/`. Server pages require CRM role; client components receive only necessary initial data and CSRF token.

- [ ] **Step 4: Implement admin mutations and CSV**

Require CRM role, same origin, session CSRF, and Idempotency-Key on every mutation. Audit actor/action/before/after. Never let ticket cancellation free paid capacity. Export only selected participant/order columns, neutralize formulas, set no-store, and record export audit.

- [ ] **Step 5: Run focused, DB, TypeScript, and build checks**

Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/admin-orders.integration.test.ts tests/case-lab-3-payments/csv.test.ts`  
Run: `npm run test:case-lab-3-db`  
Run: `npx tsc --noEmit --incremental false`  
Run: `npm run build`  
Expected: PASS.

- [ ] **Step 6: Commit checkpoint after explicit authorization**

```bash
git add app/crm app/lib/case-lab-3/csv.server.ts app/api/admin/case-lab-3 tests/case-lab-3-payments/admin-orders.integration.test.ts tests/case-lab-3-payments/csv.test.ts
git commit -m "feat(case-lab-3): add ticket order administration"
```

---

### Task 13: Refunds and Unexpected-Payment Incident Resolution

**Files:**
- Create: `app/api/admin/case-lab-3/orders/[id]/refunds/route.ts`
- Create: `app/api/admin/case-lab-3/incidents/[id]/resolve/route.ts`
- Modify: `app/crm/case-lab-3/orders/[id]/OrderActionsClient.tsx`
- Modify: `app/lib/case-lab-3/worker.server.ts`
- Create: `tests/case-lab-3-payments/refunds.integration.test.ts`

**Interfaces:**
- Produces idempotent full/partial refund requests through durable jobs.
- Produces safe incident actions `attach_payment`, `refund_payment`, `record_fiscal_resolution`.
- Produces buyer full-refund email and dependent fiscal return operation.
- No route marks a refund confirmed from the initial API response alone when the result is uncertain.

- [ ] **Step 1: Write failing refund and incident tests**

Test over-refund, duplicate click, concurrent partial refunds, API timeout within one hour, timeout after one hour requiring reconciliation, dashboard-originated Refund, full refund ticket cancellation/capacity, partial refund ticket validity, original-receipt dependency, buyer notification, and unknown-payment attach/refund decisions.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx tsx --test tests/case-lab-3-payments/refunds.integration.test.ts`  
Expected: FAIL because admin refund/incident routes do not exist.

- [ ] **Step 3: Implement refund request route and CRM confirmation**

Display paid amount, confirmed refunds, pending refunds, remaining refundable amount, and requested amount. Require an explicit second confirmation. Create one durable operation keyed by Idempotency-Key; worker calls TipTop with the persisted operation key.

- [ ] **Step 4: Implement uncertain-result reconciliation**

Within one hour reuse the same `X-Request-ID`. After one hour call transaction and invoice-operation lookup before any retry. Mark `unknown/review_required` when provider data cannot prove safety. Never issue return receipt before confirmed money refund.

- [ ] **Step 5: Implement controlled incident resolution**

Recheck provider transaction, amount, environment, capacity, existing tickets, and fiscal effects inside the resolution RPC. Attaching creates fulfilment once; refunding creates one refund operation; fiscal-only resolution records the accountant-approved action without issuing a ticket.

- [ ] **Step 6: Run focused, DB, and TypeScript tests**

Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/refunds.integration.test.ts`  
Run: `npm run test:case-lab-3-db`  
Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

- [ ] **Step 7: Commit checkpoint after explicit authorization**

```bash
git add app/api/admin/case-lab-3/orders app/api/admin/case-lab-3/incidents app/crm/case-lab-3/orders app/lib/case-lab-3/worker.server.ts tests/case-lab-3-payments/refunds.integration.test.ts
git commit -m "feat(case-lab-3): add controlled ticket refunds"
```

---

### Task 14: Mobile QR Check-in

**Files:**
- Modify: `next.config.ts`
- Create: `app/crm/check-in/page.tsx`
- Create: `app/crm/check-in/CheckInClient.tsx`
- Create: `app/api/admin/case-lab-3/check-ins/route.ts`
- Create: `tests/case-lab-3-payments/check-in.integration.test.ts`

**Interfaces:**
- Produces camera scanner loaded only on `/crm/check-in/` after explicit user action.
- Produces manual current-revision fallback requiring both public ticket number and ten-character code.
- Produces API outcomes `admitted`, `already_used`, `cancelled`, `invalid`.
- Route-specific header permits `camera=(self)` while global `payment=()` remains unchanged.

- [ ] **Step 1: Write failing scanner and API tests**

Assert protected page, no static ZXing import outside check-in, user-triggered camera permission, camera cleanup on unmount, exact QR prefix/UUID/revision/token parsing, malformed/oversized QR rejection, current QR success, old revision rejection, duplicate scan timestamp, cancelled ticket rejection, ticket-number-plus-current-code success, code-only rejection, ticket-number-only rejection, wrong-code rejection, and no unrelated PII response.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npx tsx --test tests/case-lab-3-payments/check-in.integration.test.ts`  
Expected: FAIL because check-in page/route do not exist.

- [ ] **Step 3: Add route-specific camera policy**

Keep the global Permissions-Policy. Add a later `headers()` rule for `/crm/check-in/:path*` with the same security directives except `camera=(self)` and unchanged `payment=()`.

- [ ] **Step 4: Implement mobile scanner and fallback**

Dynamically import `@zxing/browser` after the administrator presses `Включить камеру`. Stop tracks and decoder on pause/unmount. The scan request posts the bounded `cl3:<ticket_uuid>:<revision_number>:<token>` string; the manual request posts a separate discriminated payload containing public `ticketNumber` and normalized ten-character `code`. The route resolves QR input by indexed ticket UUID and manual input by unique indexed public ticket number, requires the current revision, verifies HMAC-derived credentials in constant time, and only then calls the atomic check-in RPC. Require CRM session, same-origin CSRF, and idempotency key. Use distinct accessible status copy/colors for all four outcomes.

- [ ] **Step 5: Run focused, TypeScript, lint, and build checks**

Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/check-in.integration.test.ts`  
Run: `npx tsc --noEmit --incremental false`  
Run: `npm run lint`  
Run: `npm run build`  
Expected: PASS.

- [ ] **Step 6: Commit checkpoint after explicit authorization**

```bash
git add next.config.ts app/crm/check-in app/api/admin/case-lab-3/check-ins tests/case-lab-3-payments/check-in.integration.test.ts
git commit -m "feat(case-lab-3): add mobile ticket check-in"
```

---

### Task 15: GA4, CSP, and Truthful Event Metadata

**Files:**
- Modify: `proxy.ts`
- Modify: `app/case-lab-3/page.tsx`
- Modify: `tests/case-lab-3-p2.test.mjs`
- Create: `app/components/case-lab-3/CaseLab3Analytics.tsx`
- Create: `app/lib/case-lab-3/analytics.server.ts`
- Create: `tests/case-lab-3-payments/analytics.test.ts`

**Interfaces:**
- Produces client events with CTA source and no personal fields.
- Produces server `purchase` keyed by public order number and `refund` keyed by order/refund IDs.
- Extends the existing Case Lab III TipTop CSP with GA origins without weakening site-wide base restrictions.
- JSON-LD omits dynamic offers rather than advertising stale tariff or availability data.

- [ ] **Step 1: Write failing analytics/CSP/metadata tests**

Assert no name/email/phone in event payloads, server purchase only after paid, refund value per confirmed operation, stable transaction identifiers, no retry effect on payment, nonce on GA/widget scripts, explicit TipTop frame origin, only test-observed connect origins, and removal of obsolete external checkout metadata.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/case-lab-3-p2.test.mjs`  
Run: `npx tsx --test tests/case-lab-3-payments/analytics.test.ts`  
Expected: FAIL because GA adapter/CSP changes do not exist.

- [ ] **Step 3: Implement server analytics outbox handler**

Send Measurement Protocol through native `fetch` with ten-second timeout. Use public order number as `transaction_id`, stored/derived non-PII client ID, actual value in major KZT, and unique refund operation ID. Mark best-effort result without affecting fulfilment.

- [ ] **Step 4: Implement client funnel events**

Emit CTA click, checkout open, form submit, payment start, widget error, and visible failure. Never include form values. If GA is blocked or absent, calls become no-ops.

- [ ] **Step 5: Update strict CSP and Event JSON-LD**

Pass nonce to GA scripts. Add GA origins and any additional TipTop connection origins proven during sandbox browser/network inspection for `script-src`, `connect-src`, and GA image/beacon traffic. Preserve the TipTop frame rule from Task 8 plus `object-src 'none'`, `base-uri 'self'`, `form-action 'self'`, and `frame-ancestors 'none'`. Omit Event offers from JSON-LD; the static page must not claim dynamic tariff availability and social descriptions must not promise an exhausted tariff.

- [ ] **Step 6: Run tests, lint, TypeScript, and build**

Run: `node --test tests/case-lab-3-p2.test.mjs`  
Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/analytics.test.ts`  
Run: `npm run lint`  
Run: `npx tsc --noEmit --incremental false`  
Run: `npm run build`  
Expected: PASS.

- [ ] **Step 7: Commit checkpoint after explicit authorization**

```bash
git add proxy.ts app/case-lab-3/page.tsx app/components/case-lab-3/CaseLab3Analytics.tsx app/lib/case-lab-3/analytics.server.ts tests/case-lab-3-p2.test.mjs tests/case-lab-3-payments/analytics.test.ts
git commit -m "feat(case-lab-3): add checkout analytics and csp"
```

---

### Task 16: Supabase Cron, Catch-up Reconciliation, and Operational Alerts

**Files:**
- Create: `supabase/migrations/20260907040000_schedule_case_lab_3_worker.sql`
- Modify: `app/lib/case-lab-3/worker.server.ts`
- Modify: `app/crm/case-lab-3/page.tsx`
- Create: `tests/case-lab-3-payments/reconciliation.integration.test.ts`

**Interfaces:**
- Produces `case_lab_3_install_worker_schedules()` that reads worker URL/secret only from Supabase Vault and fails when absent.
- Produces one-minute worker schedule and daily reconciliation seed job.
- Produces durable provider high-water mark and pagination cursor.
- Produces CRM blocking warning when heartbeat is older than three minutes.

- [ ] **Step 1: Write failing catch-up and heartbeat tests**

Assert absent Vault values cannot install schedules, worker auth rejection, one-minute maintenance, stale three-minute heartbeat warning, provider outage longer than two days catches up from last successful timestamp, pages are at most 100 operations, cursor persists before next page, and overlap window resumes only after catch-up.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `npx tsx --test tests/case-lab-3-payments/reconciliation.integration.test.ts`  
Run: `npm run test:case-lab-3-db`  
Expected: FAIL because scheduling/reconciliation completion is absent.

- [ ] **Step 3: Create fail-closed schedule installer**

Enable `pg_cron`/`pg_net`, define a security-restricted installer that reads `case_lab_3_worker_url` and `case_lab_3_cron_secret` from Vault, and create named jobs only after both exist. Do not put URL or secret literals in the migration.

- [ ] **Step 4: Implement durable reconciliation cursor**

Persist environment, last successful provider timestamp, current page cursor, run start/end, and error. Request an overlap beginning two days before high-water mark during normal operation; after failure resume from stored cursor/timestamp until caught up.

- [ ] **Step 5: Implement heartbeat and alert surfaces**

Record heartbeat on every invocation. Show stale heartbeat, overdue receipt/email, unknown fiscal/refund, and reconciliation failure in CRM. Send organizer alerts through the existing durable email job path without logging recipient address.

- [ ] **Step 6: Run focused, DB, TypeScript, and build checks**

Run: `npm run test:case-lab-3-payments -- tests/case-lab-3-payments/reconciliation.integration.test.ts`  
Run: `npm run test:case-lab-3-db`  
Run: `npx tsc --noEmit --incremental false`  
Run: `npm run build`  
Expected: PASS.

- [ ] **Step 7: Commit checkpoint after explicit authorization**

```bash
git add supabase/migrations/20260907040000_schedule_case_lab_3_worker.sql app/lib/case-lab-3/worker.server.ts app/crm/case-lab-3/page.tsx tests/case-lab-3-payments/reconciliation.integration.test.ts
git commit -m "feat(case-lab-3): add payment reconciliation schedule"
```

---

### Task 17: Full Verification, Sandbox Acceptance, and Controlled Live Launch

**Files:**
- Modify: `docs/superpowers/plans/2026-09-07-case-lab-3-payments-implementation.md` only to check completed execution boxes and record non-secret acceptance evidence.
- Modify: `tests/case-lab-3-payments/tiptoppay-contract.test.ts`
- Create: `tests/fixtures/case-lab-3/tiptoppay/real-test-callback.form`
- Create: `docs/case-lab-3-payment-operations.md`

**Interfaces:**
- Produces operator runbook for sales switch, limit increase, refund, resend, transfer, check-in, incident handling, reconciliation recovery, and emergency shutdown.
- Produces non-secret environment-variable inventory and exact callback URL list.
- Produces recorded sandbox/live acceptance results without personal data or credentials.

- [ ] **Step 1: Run the complete automated suite from a clean local build state**

Run:

```bash
npm test
npm run test:case-lab-3-db
npx tsc --noEmit --incremental false
npm run lint
npm run build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 2: Review the final diff and secret boundary**

Run: `git status --short` and `git diff --stat` and inspect every intended diff.  
Expected: no `.env*`, Supabase temp metadata, credentials, personal data, generated PDFs, provider payloads, or unrelated files are staged.

- [ ] **Step 3: Complete provider/accounting prerequisites before enabling live sales**

Confirm all items with evidence outside the repository:

```text
Separate test terminal or provider-confirmed test mode
KKT belongs to IP Case Lab and is linked to the intended terminal
Automatic provider-side fiscalization disabled for this flow
Accountant-approved versioned fiscal sequence, including advance/settlement decision
Card-only terminal configuration
Mail.ru app password and successful test delivery
GA4 property, web stream, Measurement ID, and Measurement Protocol API secret
Vercel test/live secrets and Supabase Vault worker URL/secret
Exact test/live Check, Pay, Fail, Refund, and Receipt callback URLs
Test fiscal policy and offer/privacy versions active; only test sales row enabled before sandbox
Initial consumed/manual allocation count confirmed immediately before launch
```

- [ ] **Step 4: Verify test-only activation and add a real callback fixture**

Before creating a sandbox order, query environment settings through the protected admin path and prove `test.sales_enabled = true` while `live.sales_enabled = false`. Verify the preview deployment selects `CASE_LAB_3_PAYMENT_MODE=test` and has complete test provider/fiscal configuration. If any condition fails, stop: Tasks 7-9 must remain `configuration_incomplete` or `sales_closed`, and no live switch may be changed.

Create one provider test transaction using synthetic, non-personal buyer values. Capture its exact raw callback bytes and signature through approved test tooling outside ordinary application logs, verify the original signature once with the real test secret from the environment, and record only non-secret success evidence. Commit the non-personal raw body as `real-test-callback.form`, then independently calculate and pin a fake-secret OpenSSL HMAC for automated tests. Do not commit the real signature, real secret, card metadata, or personal data. This fixture must preserve the provider's actual field order/encoding and cover the verified `Content-HMAC` or `X-Content-HMAC` representation; remove support for any signature representation not proven by this callback.

- [ ] **Step 5: Perform sandbox acceptance without enabling live inventory**

Execute and record: Early Bird success, Standard success with seeded quota state, bank failure, widget close, cancelled/long 3-D Secure, duplicate Check, reordered Pay/Fail, invalid HMAC, wrong amount/currency/order, browser close after payment, Kassir timeout/early Receipt, SMTP failure/retry, PDF, participant transfer, old QR rejection, first/duplicate check-in, partial/full refund, dashboard refund, worker restart, stale lease, and test/live isolation.

- [ ] **Step 6: Verify supported browsers manually**

Verify checkout and result page in iPhone Safari, Android Chrome, and desktop Chrome/Safari/Firefox. Verify camera permission, scan, duplicate scan, manual ticket-number-plus-current-code fallback, focus trapping, keyboard operation, and reduced-motion dialog behavior. Visual verification remains a manual user responsibility.

- [ ] **Step 7: Write the operations runbook**

Document exact CRM actions, expected statuses, when not to retry, how to inspect unknown receipt/refund/payment, how to disable new sales without stopping callbacks/worker, how to raise limit from 70 to 100, how to resend existing assets, and how to verify Cron health.

- [ ] **Step 8: Perform one controlled live purchase and full refund**

In an agreed low-traffic window, enable live sales only long enough to create the controlled order, then disable them while fulfilment and refund checks continue. Verify one completed payment, valid ticket page, QR, PDF, Mail.ru ticket email, every accountant-required receipt, CRM visibility, first/duplicate scan behavior, full refund, buyer notification, return receipt, ticket cancellation, and restored Standard capacity. Count the controlled purchase/refund correctly in inventory history.

- [ ] **Step 9: Enable and schedule production sales**

Only after Step 8 passes, set live `sales_enabled = true`. Confirm the database closes order creation exactly at `2026-09-24 00:00:00 Asia/Almaty`. Do not disable callbacks, worker, receipts, emails, ticket access, check-in, refunds, or reconciliation at cutoff.

- [ ] **Step 10: Final commit checkpoint after explicit authorization**

```bash
git add docs/case-lab-3-payment-operations.md docs/superpowers/plans/2026-09-07-case-lab-3-payments-implementation.md tests/case-lab-3-payments/tiptoppay-contract.test.ts tests/fixtures/case-lab-3/tiptoppay/real-test-callback.form
git commit -m "docs(case-lab-3): add payment operations runbook"
```
