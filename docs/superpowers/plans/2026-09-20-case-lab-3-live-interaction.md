# Case Lab III Live Interaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the checked-in guest answer flow, AI-assisted shortlist, human awards, and cumulative live leaderboard approved in `docs/superpowers/specs/2026-09-20-case-lab-3-live-interaction-design.md`.

**Architecture:** Supabase Postgres remains authoritative for eligibility, claims, case state, submissions, shortlists, awards, and score derivation. Next.js Route Handlers expose bounded no-store participant/public APIs and CRM-protected operator mutations; native server-side `fetch` calls OpenRouter with anonymized answers and strict structured output. Client components are limited to the interactive participant, operator, and projection surfaces and use short polling rather than a new realtime dependency.

**Tech Stack:** Next.js 16.2 App Router, React 19, strict TypeScript, Supabase Postgres/RLS, native `fetch`, Node test runner with `tsx`, CSS Modules, existing CRM auth and Case Lab III server utilities.

## Global Constraints

- Reuse the existing Case Lab III visual language, typography, security utilities, CRM auth, ticket data, and check-in data.
- Do not install or update dependencies.
- Only checked-in, non-cancelled current ticket revisions may claim a live participant.
- Public identity is `Имя Ф.`; ticket numbers and full surnames remain operator-only.
- Answer length is 30-300 visible trimmed characters; one current answer per participant and case; edits stop at the authoritative server deadline.
- Participation points are 10; published placement bonuses are 50, 35, and 25 for first, second, and third.
- AI selects candidates only. It never writes award records or leaderboard points.
- AI input contains no names, email, phone, company, position, ticket numbers, ticket IDs, participant IDs, or submission UUIDs.
- Primary model is `google/gemini-3-flash-preview`; fallback is `openai/gpt-5-mini`; model IDs remain server-configurable.
- OpenRouter credentials remain server-only and are never logged or returned.
- New tables use `environment = test | live`, RLS, no anon/authenticated grants, and service-role access.
- Use async `cookies()` only in Route Handlers or request-time Server Components, following local Next.js 16 docs.
- Live pages and APIs are dynamic/no-store. Do not rely on process memory for authoritative state.
- Preserve reduced-motion behavior, keyboard focus, accessible labels, and polite state announcements.
- Browser visual verification remains with the user unless explicitly requested.

---

## File Map

### Database

- Create `supabase/migrations/20260920000000_add_case_lab_3_live_interaction.sql`: tables, constraints, indexes, RLS/grants, claim/save/transition/award/tie-break RPCs, and leaderboard query function.
- Create `supabase/tests/case_lab_3_live.test.sql`: pgTAP coverage for eligibility, claims, deadlines, points, state transitions, and RLS.
- Modify `scripts/run-case-lab-3-db.mjs`: include the live suite.
- Modify `app/lib/case-lab-3/database.types.ts`: typed rows and RPC contracts.

### Domain and server infrastructure

- Create `app/lib/case-lab-3/live/contracts.ts`: public/admin API contracts and state unions.
- Create `app/lib/case-lab-3/live/validation.ts`: name, answer, case, shortlist, and award validation.
- Create `app/lib/case-lab-3/live/session.server.ts`: signed live participant cookie parsing/issuance/authorization.
- Create `app/lib/case-lab-3/live/repository.server.ts`: service-role queries and RPC adapters.
- Create `app/lib/case-lab-3/live/leaderboard.ts`: pure scoring/order/public-label helpers.
- Create `app/lib/case-lab-3/live/openrouter.server.ts`: configuration, anonymization, prompt, fetch, schema validation, fallback, and persisted run result.
- Modify `.env.example`: server-only OpenRouter variable names.

### Participant/public API and UI

- Create `app/api/case-lab-3/live/session/route.ts`.
- Create `app/api/case-lab-3/live/state/route.ts`.
- Create `app/api/case-lab-3/live/cases/[id]/submission/route.ts`.
- Create `app/api/case-lab-3/live/leaderboard/route.ts`.
- Create `app/case-lab-3/live/page.tsx`.
- Create `app/case-lab-3/live/LiveParticipantClient.tsx`.
- Create `app/case-lab-3/live/live.module.css`.
- Create `app/case-lab-3/live/leaderboard/page.tsx`.
- Create `app/case-lab-3/live/leaderboard/LeaderboardClient.tsx`.
- Create `app/case-lab-3/live/leaderboard/leaderboard.module.css`.

### Operator API and UI

- Create `app/api/admin/case-lab-3/live/route.ts`.
- Create `app/api/admin/case-lab-3/live/cases/[id]/transition/route.ts`.
- Create `app/api/admin/case-lab-3/live/cases/[id]/rubric/route.ts`.
- Create `app/api/admin/case-lab-3/live/cases/[id]/analyze/route.ts`.
- Create `app/api/admin/case-lab-3/live/cases/[id]/shortlist/route.ts`.
- Create `app/api/admin/case-lab-3/live/cases/[id]/awards/route.ts`.
- Create `app/api/admin/case-lab-3/live/participants/[id]/reset/route.ts`.
- Create `app/api/admin/case-lab-3/live/tie-breaks/route.ts`.
- Create `app/crm/case-lab-3/live/page.tsx`.
- Create `app/crm/case-lab-3/live/LiveOperatorClient.tsx`.
- Create `app/crm/case-lab-3/live/live-operator.module.css`.
- Modify `app/crm/components/CrmSectionNav.tsx`: add the live control link without changing existing destinations.

### Tests

- Create `tests/case-lab-3-live/leaderboard.test.ts`.
- Create `tests/case-lab-3-live/validation.test.ts`.
- Create `tests/case-lab-3-live/session.test.ts`.
- Create `tests/case-lab-3-live/participant-api.integration.test.ts`.
- Create `tests/case-lab-3-live/openrouter.test.ts`.
- Create `tests/case-lab-3-live/operator-api.integration.test.ts`.
- Create `tests/case-lab-3-live/pages.test.ts`.
- Create `tests/fixtures/case-lab-3/live/openrouter-valid.json`.
- Create `tests/fixtures/case-lab-3/live/openrouter-invalid-id.json`.
- Create `scripts/benchmark-case-lab-3-live.mjs`.
- Modify `package.json`: add `test:case-lab-3-live` and include it in `test`.

---

### Task 1: Database schema and atomic state transitions

**Files:**
- Create: `supabase/migrations/20260920000000_add_case_lab_3_live_interaction.sql`
- Create: `supabase/tests/case_lab_3_live.test.sql`
- Modify: `scripts/run-case-lab-3-db.mjs`
- Modify: `tests/case-lab-3-payments/schema-migration.test.ts`

**Interfaces:**
- Produces RPCs `case_lab_3_live_claim_participant`, `case_lab_3_live_save_submission`, `case_lab_3_live_transition_case`, `case_lab_3_live_publish_awards`, `case_lab_3_live_resolve_tie`, and `case_lab_3_live_get_leaderboard`.
- Produces seven tables and constraints consumed by every later task.

- [ ] **Step 1: Add failing migration source-contract tests**

Add assertions that the new migration defines all seven tables, enables RLS, revokes public/anon/authenticated access, enforces unique case order, unique ticket claim, unique participant/case submission, unique place/case award, answer length, bonus values, and audited tie decisions.

```ts
test("live interaction migration defines protected authoritative tables", async () => {
  const source = await readFile(
    "supabase/migrations/20260920000000_add_case_lab_3_live_interaction.sql",
    "utf8",
  );
  for (const table of [
    "case_lab_3_live_cases",
    "case_lab_3_live_participants",
    "case_lab_3_live_submissions",
    "case_lab_3_live_ai_runs",
    "case_lab_3_live_shortlist_entries",
    "case_lab_3_live_awards",
    "case_lab_3_live_tie_breaks",
  ]) {
    assert.match(source, new RegExp(`create table public\\.${table}`, "iu"));
    assert.match(source, new RegExp(`alter table public\\.${table} enable row level security`, "iu"));
  }
  assert.match(source, /case_lab_3_live_claim_participant/iu);
  assert.match(source, /case_lab_3_live_save_submission/iu);
  assert.match(source, /case_lab_3_live_publish_awards/iu);
  assert.match(source, /case_lab_3_live_resolve_tie/iu);
});
```

- [ ] **Step 2: Run the source-contract test and confirm failure**

Run: `npx tsx --test tests/case-lab-3-payments/schema-migration.test.ts`  
Expected: FAIL because the migration does not exist.

- [ ] **Step 3: Create the migration with explicit enums-as-checks and indexes**

Use text checks consistent with the existing schema. The core columns and constraints must include:

```sql
create table public.case_lab_3_live_cases (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  case_number integer not null check (case_number between 1 and 3),
  speaker_label text not null check (char_length(speaker_label) between 1 and 120),
  title text not null check (char_length(title) between 1 and 200),
  question text not null check (char_length(question) between 1 and 1000),
  speaker_reference_answer text not null check (char_length(speaker_reference_answer) between 1 and 4000),
  context text,
  key_insight text,
  generated_rubric jsonb not null default '{}'::jsonb,
  approved_rubric jsonb not null default '{}'::jsonb,
  state text not null default 'draft' check (state in ('draft','ready','open','analyzing','shortlist_ready','awarded','closed')),
  opens_at timestamptz,
  closes_at timestamptz,
  state_version integer not null default 1 check (state_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (environment, case_number)
);

create table public.case_lab_3_live_participants (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  ticket_id uuid not null,
  ticket_revision_id uuid not null,
  normalized_first_name text not null,
  normalized_last_name text not null,
  public_display_name text not null check (char_length(public_display_name) between 2 and 120),
  session_token_version integer not null default 1 check (session_token_version > 0),
  claim_status text not null default 'active' check (claim_status in ('active','reset')),
  claimed_at timestamptz not null default now(),
  reset_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (environment, ticket_id)
);
```

Define the remaining tables with these concrete columns and invariants:

```sql
create table public.case_lab_3_live_submissions (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  case_id uuid not null,
  participant_id uuid not null,
  answer_text text not null check (char_length(btrim(answer_text)) between 30 and 300),
  content_version integer not null default 1 check (content_version > 0),
  validity_state text not null default 'valid' check (validity_state in ('valid','invalid')),
  invalid_reason text,
  participation_points integer not null default 10 check (participation_points in (0,10)),
  first_submitted_at timestamptz not null default now(),
  last_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, participant_id)
);

create table public.case_lab_3_live_ai_runs (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  case_id uuid not null,
  run_number integer not null check (run_number > 0),
  requested_models jsonb not null,
  served_model text,
  request_hash text not null check (request_hash ~ '^[0-9a-f]{64}$'),
  response_payload jsonb,
  usage_payload jsonb not null default '{}'::jsonb,
  latency_ms integer check (latency_ms is null or latency_ms >= 0),
  status text not null check (status in ('running','succeeded','failed')),
  error_category text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (case_id, run_number)
);

create table public.case_lab_3_live_shortlist_entries (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  case_id uuid not null,
  ai_run_id uuid,
  submission_id uuid not null,
  ai_order integer,
  ai_score integer check (ai_score is null or ai_score between 0 and 100),
  ai_reason text,
  approach_label text,
  candidate_type text check (candidate_type is null or candidate_type in ('strong','alternative','wildcard','manual')),
  included boolean not null default true,
  operator_reason text,
  final_order integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (case_id, submission_id)
);

create table public.case_lab_3_live_awards (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  case_id uuid not null,
  submission_id uuid not null,
  place integer not null check (place between 1 and 3),
  bonus_points integer not null,
  actor_id text not null,
  decision_reason text,
  corrected_from_id uuid,
  active boolean not null default true,
  awarded_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint case_lab_3_live_awards_place_points_check check (
    (place = 1 and bonus_points = 50) or
    (place = 2 and bonus_points = 35) or
    (place = 3 and bonus_points = 25)
  )
);

create unique index case_lab_3_live_awards_active_place_uidx
  on public.case_lab_3_live_awards (case_id, place) where active;
create unique index case_lab_3_live_awards_active_submission_uidx
  on public.case_lab_3_live_awards (case_id, submission_id) where active;

create table public.case_lab_3_live_tie_breaks (
  id uuid primary key default gen_random_uuid(),
  environment text not null check (environment in ('test', 'live')),
  participant_id uuid not null,
  resolved_rank integer not null check (resolved_rank > 0),
  actor_id text not null,
  reason text not null check (char_length(btrim(reason)) between 3 and 500),
  active boolean not null default true,
  decided_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```

Add composite environment foreign keys to cases, participants, tickets, current ticket revisions, submissions, AI runs, shortlist entries, awards, and tie-breaks. Add indexes for active-case lookup, checked-in name claim, case submissions, shortlist order, and leaderboard aggregation.

- [ ] **Step 4: Add atomic RPCs**

`case_lab_3_live_claim_participant` must lock candidate rows, require a check-in and current non-cancelled revision, return only `claimed | ambiguous | not_found | already_claimed`, and accept optional exact ticket-number disambiguation. `case_lab_3_live_save_submission` must lock the case, require `state='open'` and `now() < closes_at`, then upsert the one participant/case row. State transition, award, and tie-resolution RPCs must compare expected state versions or active decisions as appropriate and write `case_lab_3_audit_log`. The leaderboard RPC derives totals from valid submissions plus active awards and applies active tie resolutions only after points, first-place count, and podium count remain equal.

- [ ] **Step 5: Add pgTAP coverage and the suite runner entry**

Cover unique claims, unchecked/cancelled rejection, ambiguous names, ticket-number disambiguation, late submission rejection, one row per participant/case, fixed points, illegal state transitions, duplicate podium places, derived totals, shared ranks, explicit tie resolution, and no anon/authenticated privileges.

Add to `CASE_LAB_3_DB_SUITES`:

```js
{ name: "live", file: "supabase/tests/case_lab_3_live.test.sql" },
```

- [ ] **Step 6: Run source and database tests**

Run: `npx tsx --test tests/case-lab-3-payments/schema-migration.test.ts`  
Expected: PASS.

Run: `npm run test:case-lab-3-db`  
Expected: all suites PASS. If linked database credentials are unavailable, record the exact preflight failure and continue only with source tests until credentials are available.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/20260920000000_add_case_lab_3_live_interaction.sql supabase/tests/case_lab_3_live.test.sql scripts/run-case-lab-3-db.mjs tests/case-lab-3-payments/schema-migration.test.ts
git commit -m "feat(case-lab-3): add live interaction schema"
```

### Task 2: Typed live-domain contracts, validation, scoring, and session tokens

**Files:**
- Create: `app/lib/case-lab-3/live/contracts.ts`
- Create: `app/lib/case-lab-3/live/validation.ts`
- Create: `app/lib/case-lab-3/live/leaderboard.ts`
- Create: `app/lib/case-lab-3/live/session.server.ts`
- Modify: `app/lib/case-lab-3/database.types.ts`
- Create: `tests/case-lab-3-live/validation.test.ts`
- Create: `tests/case-lab-3-live/leaderboard.test.ts`
- Create: `tests/case-lab-3-live/session.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces `LiveCaseState`, `LiveParticipantStateResponse`, `PublicLeaderboardEntry`, `parseParticipantClaim`, `parseSubmission`, `formatPublicDisplayName`, `rankLeaderboard`, `issueLiveSession`, `parseLiveSession`, and `assertLiveSession`.
- Consumes `derivePurposeToken` and `verifyPurposeToken` from `tokens.server.ts`.

- [ ] **Step 1: Add the live test script**

```json
"test:case-lab-3-live": "tsx --test tests/case-lab-3-live/**/*.test.ts"
```

Append `&& npm run test:case-lab-3-live` to the existing `test` script.

- [ ] **Step 2: Write failing pure-domain tests**

Cover whitespace/Unicode normalization, `ё` lookup equivalence, public labels, 29/30/300/301-character answers, control-character rejection, fixed award points, tied ranks, and HMAC session tamper rejection.

```ts
it("formats only first name and last initial", () => {
  assert.equal(formatPublicDisplayName("Аружан", "Касымова"), "Аружан К.");
});

it("does not use response speed to break ties", () => {
  const ranked = rankLeaderboard([
    { participantId: "a", displayName: "Аян К.", points: 60, firstPlaces: 1, podiums: 1 },
    { participantId: "b", displayName: "Алия Н.", points: 60, firstPlaces: 1, podiums: 1 },
  ]);
  assert.deepEqual(ranked.map((entry) => entry.rank), [1, 1]);
});
```

- [ ] **Step 3: Run tests and confirm missing modules**

Run: `npm run test:case-lab-3-live`  
Expected: FAIL with module-not-found errors.

- [ ] **Step 4: Implement contracts and pure helpers**

Define the shared contracts without importing React or server-only modules:

```ts
export type LiveCaseState = "draft" | "ready" | "open" | "analyzing" | "shortlist_ready" | "awarded" | "closed";

export type PublicLeaderboardEntry = {
  participantId: string;
  displayName: string;
  points: number;
  firstPlaces: number;
  podiums: number;
  rank: number;
};

export type LiveParticipantStateResponse = {
  participant: { displayName: string; points: number; rank: number | null };
  activeCase: null | {
    id: string;
    caseNumber: number;
    speakerLabel: string;
    question: string;
    state: LiveCaseState;
    closesAt: string | null;
    answer: string | null;
  };
  leaderboard: PublicLeaderboardEntry[];
};
```

- [ ] **Step 5: Implement live session signing**

Use cookie `cl3_live_session`, serialized as `<participant_uuid>.<version>.<43-char-token>`, purpose `live-participant-session`, max age 48 hours, and options `{ httpOnly: true, secure: true, sameSite: "lax", path: "/case-lab-3/live", maxAge: 172800 }`. `assertLiveSession` must load the participant/ticket/current revision and reject reset, cancelled, transferred, or mismatched-environment sessions.

- [ ] **Step 6: Extend database types with exact new rows/RPC signatures**

Add all seven table entries and six RPCs to `Database["public"]`, keeping nullable columns and JSON payloads aligned with migration SQL.

- [ ] **Step 7: Run tests and TypeScript**

Run: `npm run test:case-lab-3-live`  
Expected: PASS.

Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add package.json app/lib/case-lab-3/database.types.ts app/lib/case-lab-3/live tests/case-lab-3-live
git commit -m "feat(case-lab-3): add live domain foundation"
```

### Task 3: Participant claim, state, and submission APIs

**Files:**
- Create: `app/lib/case-lab-3/live/repository.server.ts`
- Create: `app/api/case-lab-3/live/session/route.ts`
- Create: `app/api/case-lab-3/live/state/route.ts`
- Create: `app/api/case-lab-3/live/cases/[id]/submission/route.ts`
- Create: `tests/case-lab-3-live/participant-api.integration.test.ts`

**Interfaces:**
- Consumes Task 1 RPCs and Task 2 validation/session helpers.
- Produces participant session `POST/DELETE`, state `GET`, and submission `PUT` route contracts for the participant client.

- [ ] **Step 1: Write failing route tests with injected dependencies**

Cover unique claim success and cookie issue, generic ambiguous/no-match responses, ticket-number disambiguation, rate-limit failure, no-store headers, missing/invalid session, valid state sanitation, save/update success, late close conflict, oversized body, and database outage.

```ts
const response = await handleClaim(request({ firstName: "Аружан", lastName: "Касымова" }), {
  claimParticipant: async () => ({ kind: "claimed", participantId: PARTICIPANT_ID, tokenVersion: 1 }),
  consumeRateLimit: async () => undefined,
  issueSession: () => "serialized-session",
});
assert.equal(response.status, 200);
assert.match(response.headers.get("set-cookie") ?? "", /cl3_live_session=/u);
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx tsx --test tests/case-lab-3-live/participant-api.integration.test.ts`  
Expected: FAIL because routes do not exist.

- [ ] **Step 3: Implement repository adapters**

Expose exact server-only functions:

```ts
export async function claimLiveParticipant(input: ClaimInput): Promise<ClaimResult>;
export async function authorizeLiveParticipant(session: ParsedLiveSession): Promise<AuthorizedParticipant | null>;
export async function loadParticipantState(participant: AuthorizedParticipant): Promise<LiveParticipantStateResponse>;
export async function saveParticipantSubmission(input: SaveSubmissionInput): Promise<SaveSubmissionResult>;
```

All Supabase errors map to a generic service error; no lookup details enter responses or logs.

- [ ] **Step 4: Implement Route Handlers**

Use `readBoundedBody`, `requireJson`, `parseJsonBody`, `noStoreJson`, same-origin validation for mutations, database-backed rate limits, async `cookies()`, and `runtime = "nodejs"`. Dynamic params are awaited as `Promise<{ id: string }>` per local Next.js 16 docs.

Return stable codes:

```ts
type ClaimApiResult =
  | { status: "claimed"; displayName: string }
  | { status: "needs_ticket_number" }
  | { status: "not_available" };
```

Do not distinguish unchecked, cancelled, absent, transferred, or reset tickets publicly.

- [ ] **Step 5: Run focused and full live tests**

Run: `npx tsx --test tests/case-lab-3-live/participant-api.integration.test.ts`  
Expected: PASS.

Run: `npm run test:case-lab-3-live`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/lib/case-lab-3/live/repository.server.ts app/api/case-lab-3/live tests/case-lab-3-live/participant-api.integration.test.ts
git commit -m "feat(case-lab-3): add live participant APIs"
```

### Task 4: Mobile participant experience

**Files:**
- Create: `app/case-lab-3/live/page.tsx`
- Create: `app/case-lab-3/live/LiveParticipantClient.tsx`
- Create: `app/case-lab-3/live/live.module.css`
- Create: `tests/case-lab-3-live/pages.test.ts`

**Interfaces:**
- Consumes participant APIs from Task 3.
- Produces the mobile interaction at `/case-lab-3/live`.

- [ ] **Step 1: Write page source-contract tests**

Assert the route is dynamic/no-store, keeps the client boundary in `LiveParticipantClient`, has named form controls, visible character count, status live region, reduced-motion styles, and no direct Supabase/OpenRouter imports.

- [ ] **Step 2: Run the page test and confirm failure**

Run: `npx tsx --test tests/case-lab-3-live/pages.test.ts`  
Expected: FAIL because participant page files do not exist.

- [ ] **Step 3: Implement the Server Component shell**

Export metadata with `robots: { index: false, follow: false }`, `dynamic = "force-dynamic"`, `revalidate = 0`, `fetchCache = "force-no-store"`, and `runtime = "nodejs"`. Render one semantic `<main>` and the client component; do not widen the existing `/case-lab-3` landing client boundary.

- [ ] **Step 4: Implement the participant state machine**

Use states `claiming | waiting | open | saved | analyzing | results | error`. Poll every 2 seconds during active transitions and 5 seconds while waiting; pause polling when `document.visibilityState === "hidden"`. Preserve the textarea value across transient network failures and reconcile with the server answer after successful saves.

The UI copy must include:

```text
Введите имя и фамилию как в билете
От 30 до 300 символов
Ответ сохранён — 10 баллов после закрытия кейса
Спикер выбирает лучшие решения
```

- [ ] **Step 5: Implement responsive accessible styles**

Use existing Case Lab III CSS variables/colors and typography. Ensure 44px controls, visible `:focus-visible`, label/error association, `aria-live="polite"` only for meaningful state changes, and `@media (prefers-reduced-motion: reduce)` for result motion.

- [ ] **Step 6: Run tests, lint, and TypeScript**

Run: `npx tsx --test tests/case-lab-3-live/pages.test.ts`  
Expected: PASS.

Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

Run: `npm run lint -- app/case-lab-3/live`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/case-lab-3/live tests/case-lab-3-live/pages.test.ts
git commit -m "feat(case-lab-3): add live participant page"
```

### Task 5: OpenRouter shortlist client and validation

**Files:**
- Create: `app/lib/case-lab-3/live/openrouter.server.ts`
- Create: `tests/case-lab-3-live/openrouter.test.ts`
- Create: `tests/fixtures/case-lab-3/live/openrouter-valid.json`
- Create: `tests/fixtures/case-lab-3/live/openrouter-invalid-id.json`
- Modify: `.env.example`

**Interfaces:**
- Consumes valid closed-case answers from `repository.server.ts`.
- Produces `generateEvaluationRubric(input)` and `generateShortlist(input, dependencies?)` with validated typed results.

- [ ] **Step 1: Write failing OpenRouter contract tests**

Cover anonymization, shuffled ephemeral IDs, no PII fields, strict JSON schema request, primary/fallback model order, timeout, valid 10-item response, fewer than 10 answers, duplicate IDs, unknown IDs, invalid score, malformed JSON, and privacy routing.

```ts
assert.equal(requestBody.models[0], "google/gemini-3-flash-preview");
assert.equal(requestBody.models[1], "openai/gpt-5-mini");
assert.equal(requestBody.provider.data_collection, "deny");
assert.equal(requestBody.provider.zdr, true);
assert.equal(requestBody.provider.require_parameters, true);
assert.equal(requestBody.response_format.type, "json_schema");
assert.equal(JSON.stringify(requestBody).includes("CL3-000123"), false);
```

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx tsx --test tests/case-lab-3-live/openrouter.test.ts`  
Expected: FAIL because the client does not exist.

- [ ] **Step 3: Add server-only environment variables**

Append names without values:

```dotenv
# Case Lab III live AI shortlist (server-side only).
OPENROUTER_API_KEY=
OPENROUTER_MODEL=google/gemini-3-flash-preview
OPENROUTER_FALLBACK_MODEL=openai/gpt-5-mini
```

- [ ] **Step 4: Implement native fetch and strict validation**

POST to `https://openrouter.ai/api/v1/chat/completions` with `Authorization`, `Content-Type`, `HTTP-Referer: https://caselab.kz`, `X-Title: Case Lab III Live`, `models`, privacy/provider fields, low reasoning, and strict JSON schema. Use `AbortSignal.timeout(20000)` or an equivalent explicit controller. Parse only `choices[0].message.content`; reject missing, fenced, or schema-invalid content.

The returned application object must be:

```ts
export type ValidatedShortlist = {
  candidates: Array<{
    submissionId: string;
    score: number;
    reason: string;
    approach: string;
    candidateType: "strong" | "alternative" | "wildcard";
  }>;
  model: string;
  latencyMs: number;
  usage: { promptTokens: number; completionTokens: number; cost: number | null };
};
```

Map ephemeral IDs back to internal submission IDs only after complete validation.

- [ ] **Step 5: Run tests and TypeScript**

Run: `npx tsx --test tests/case-lab-3-live/openrouter.test.ts`  
Expected: PASS.

Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .env.example app/lib/case-lab-3/live/openrouter.server.ts tests/case-lab-3-live/openrouter.test.ts tests/fixtures/case-lab-3/live
git commit -m "feat(case-lab-3): add AI shortlist service"
```

### Task 6: CRM operator APIs

**Files:**
- Create: `app/api/admin/case-lab-3/live/route.ts`
- Create: `app/api/admin/case-lab-3/live/cases/[id]/transition/route.ts`
- Create: `app/api/admin/case-lab-3/live/cases/[id]/rubric/route.ts`
- Create: `app/api/admin/case-lab-3/live/cases/[id]/analyze/route.ts`
- Create: `app/api/admin/case-lab-3/live/cases/[id]/shortlist/route.ts`
- Create: `app/api/admin/case-lab-3/live/cases/[id]/awards/route.ts`
- Create: `app/api/admin/case-lab-3/live/participants/[id]/reset/route.ts`
- Create: `app/api/admin/case-lab-3/live/tie-breaks/route.ts`
- Create: `tests/case-lab-3-live/operator-api.integration.test.ts`

**Interfaces:**
- Consumes CRM auth/CSRF utilities, Task 1 RPCs, Task 3 repository, and Task 5 OpenRouter service.
- Produces the full operator mutation/read surface.

- [ ] **Step 1: Write failing operator route tests**

For every mutation, cover missing CRM session, missing/invalid CSRF, missing idempotency key, malformed body, wrong expected state version, success, and sanitized 503. Specifically test rubric generation, analyze storing a validated run/shortlist, AI failure preserving submissions and exposing manual mode, awards requiring three distinct valid shortlist submissions, and tie resolution requiring an explicit reason.

- [ ] **Step 2: Run tests and confirm failure**

Run: `npx tsx --test tests/case-lab-3-live/operator-api.integration.test.ts`  
Expected: FAIL because admin routes do not exist.

- [ ] **Step 3: Implement the dashboard snapshot route**

`GET` returns three cases, current counts, participant claims, current shortlist, awards, tie decisions, AI run status/usage, and derived leaderboard. `PUT` upserts case preparation fields and approved rubric only in `draft|ready`. The rubric endpoint calls `generateEvaluationRubric`, validates the returned criteria, and stores only the draft until the operator approves it.

- [ ] **Step 4: Implement state, analysis, shortlist, award, and reset mutations**

Every handler uses `requireCrmAdmin`, `verifyCrmMutation(..., { requireIdempotencyKey: true })`, bounded JSON parsing, expected-state/version checks, `noStoreJson`, and `runtime = "nodejs"`. The analyze handler may call OpenRouter only after the atomic close/transition has frozen submissions; it persists a sanitized failure and leaves a manual path. The tie-break endpoint writes explicit ordered decisions through `case_lab_3_live_resolve_tie`; it never edits point totals.

- [ ] **Step 5: Run focused and full tests**

Run: `npx tsx --test tests/case-lab-3-live/operator-api.integration.test.ts`  
Expected: PASS.

Run: `npm run test:case-lab-3-live`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/case-lab-3/live tests/case-lab-3-live/operator-api.integration.test.ts
git commit -m "feat(case-lab-3): add live operator APIs"
```

### Task 7: CRM operator interface

**Files:**
- Create: `app/crm/case-lab-3/live/page.tsx`
- Create: `app/crm/case-lab-3/live/LiveOperatorClient.tsx`
- Create: `app/crm/case-lab-3/live/live-operator.module.css`
- Modify: `app/crm/components/CrmSectionNav.tsx`
- Modify: `tests/case-lab-3-live/pages.test.ts`

**Interfaces:**
- Consumes Task 6 admin APIs.
- Produces the authenticated preparation, stage-control, moderation, shortlist, awards, and participant-resolution interface.

- [ ] **Step 1: Extend failing page tests**

Assert the CRM page requires admin auth, receives an issued CSRF token, exposes case preparation fields, controls for every legal transition, AI retry/manual mode, all-answer search, shortlist override, distinct podium selectors, publication confirmation, claim reset with reason, and no OpenRouter key/client import.

- [ ] **Step 2: Run the page test and confirm failure**

Run: `npx tsx --test tests/case-lab-3-live/pages.test.ts`  
Expected: FAIL on missing CRM live files/link.

- [ ] **Step 3: Implement the protected server page and nav link**

Use `requireCrmAdmin`; render the same signed-out pattern as existing CRM pages. Add `live` to `CrmSection` and a `Эфир` link to `/crm/case-lab-3/live/`.

- [ ] **Step 4: Implement the operator client**

Separate visible panels for preparation, rubric generation/approval, live status, participant claims, submissions, AI run, shortlist, awards, tie resolution, and leaderboard. Every mutation sends `X-CSRF-Token` and a fresh `Idempotency-Key`. Disable buttons while pending and show server conflict messages without optimistic state transitions.

- [ ] **Step 5: Implement accessible confirmation UI**

Award publication and participant reset require confirmation with proper dialog semantics, initial focus, focus containment, Escape, focus restoration, inert background, and scroll lock. Do not use `window.confirm`.

- [ ] **Step 6: Run page tests, TypeScript, and lint**

Run: `npx tsx --test tests/case-lab-3-live/pages.test.ts`  
Expected: PASS.

Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

Run: `npm run lint -- app/crm/case-lab-3/live app/crm/components/CrmSectionNav.tsx`  
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add app/crm/case-lab-3/live app/crm/components/CrmSectionNav.tsx tests/case-lab-3-live/pages.test.ts
git commit -m "feat(crm): add case lab live controls"
```

### Task 8: Public leaderboard API and projection page

**Files:**
- Create: `app/api/case-lab-3/live/leaderboard/route.ts`
- Create: `app/case-lab-3/live/leaderboard/page.tsx`
- Create: `app/case-lab-3/live/leaderboard/LeaderboardClient.tsx`
- Create: `app/case-lab-3/live/leaderboard/leaderboard.module.css`
- Modify: `tests/case-lab-3-live/pages.test.ts`
- Modify: `tests/case-lab-3-live/participant-api.integration.test.ts`

**Interfaces:**
- Consumes the derived leaderboard function/RPC and published awards.
- Produces sanitized public polling and the projection route.

- [ ] **Step 1: Add failing API and page tests**

Assert only display name, points, rank, current case number/state, and published podium answer text are returned. Assert full surname, ticket number, internal participant/submission IDs, AI score, and AI rationale are absent.

- [ ] **Step 2: Run focused tests and confirm failure**

Run: `npx tsx --test tests/case-lab-3-live/participant-api.integration.test.ts tests/case-lab-3-live/pages.test.ts`  
Expected: FAIL on missing leaderboard route/page.

- [ ] **Step 3: Implement the no-store public route**

Return a stable `PublicLeaderboardResponse` with `Cache-Control: no-store`. Limit the default list to top 10; preserve shared ranks. Do not accept mutation methods.

- [ ] **Step 4: Implement the projection page**

Poll every 2 seconds while a case is changing and every 5 seconds otherwise. Render the top 10, a clear waiting/analyzing state, published podium answers, and final top-three emphasis. Motion is nonessential and disabled under reduced motion.

- [ ] **Step 5: Run tests, TypeScript, and lint**

Run: `npm run test:case-lab-3-live`  
Expected: PASS.

Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

Run: `npm run lint -- app/case-lab-3/live/leaderboard app/api/case-lab-3/live/leaderboard`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add app/api/case-lab-3/live/leaderboard app/case-lab-3/live/leaderboard tests/case-lab-3-live
git commit -m "feat(case-lab-3): add live leaderboard"
```

### Task 9: Benchmark, runbook safeguards, and complete verification

**Files:**
- Create: `scripts/benchmark-case-lab-3-live.mjs`
- Modify: `docs/superpowers/specs/2026-09-20-case-lab-3-live-interaction-design.md` only if implementation reveals a factual mismatch; do not silently change approved product behavior.

**Interfaces:**
- Consumes the OpenRouter client through a safe test entry point and synthetic data only.
- Produces a JSON benchmark summary without prompts, answers, or secrets.

- [ ] **Step 1: Add a synthetic benchmark script**

Generate 80 deterministic Russian marketing answers across strong, generic, alternative, duplicate, and malformed categories. Require an explicit `CASE_LAB_3_LIVE_BENCHMARK=1`; use the configured test model/key; print only model, candidate count, schema validity, latency, token usage, and cost.

```js
if (process.env.CASE_LAB_3_LIVE_BENCHMARK !== "1") {
  throw new Error("Set CASE_LAB_3_LIVE_BENCHMARK=1 to run the paid benchmark");
}
```

- [ ] **Step 2: Run all non-paid verification**

Run: `npm run test:case-lab-3-live`  
Expected: PASS.

Run: `npm run test:case-lab-3-payments`  
Expected: PASS.

Run: `node --test tests/*.test.mjs`  
Expected: PASS.

Run: `npx tsc --noEmit --incremental false`  
Expected: PASS.

Run: `npm run lint`  
Expected: PASS.

Run: `npm run build`  
Expected: PASS.

Run: `git diff --check`  
Expected: no output.

- [ ] **Step 3: Run database verification**

Run: `npm run test:case-lab-3-db`  
Expected: all suites PASS against the linked test project. Do not apply the new migration to the live project as part of code implementation without an explicit deployment instruction.

- [ ] **Step 4: Run the paid synthetic benchmark only when the OpenRouter key is configured**

Run: `CASE_LAB_3_LIVE_BENCHMARK=1 node scripts/benchmark-case-lab-3-live.mjs`  
Expected: 10 valid unique candidates, no schema errors, total elapsed time under 30 seconds. Record actual latency/model/cost in the final handoff without printing answer text or secrets.

- [ ] **Step 5: Inspect the final diff and security boundaries**

Confirm no `.env` file, credential, lead/ticket record, generated artifact, raw AI prompt, full participant data, dependency, or lockfile change is present. Confirm the OpenRouter import path is server-only and the participant/public payloads contain no ticket identifiers.

- [ ] **Step 6: Final commit**

```bash
git add scripts/benchmark-case-lab-3-live.mjs docs/superpowers/specs/2026-09-20-case-lab-3-live-interaction-design.md
git commit -m "test(case-lab-3): add live event benchmark"
```

If the spec was not modified, commit only the benchmark script. If every changed file is already committed by earlier tasks, do not create an empty commit.
