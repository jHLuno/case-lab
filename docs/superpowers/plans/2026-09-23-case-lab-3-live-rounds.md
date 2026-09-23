# Case Lab III Live Rounds Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add one-to-three sequential three-minute questions to each Case Lab III case, accept exactly one answer per participant/question with timeout auto-submit up to 350 characters, generate an AI shortlist of five, award top-three points per question, and aggregate the live leaderboard across all Case Lab III questions and cases.

**Architecture:** Reuse `case_lab_3_live_cases` as the round table by adding `question_number`; existing child rows remain attached to a round through `case_id`, so each round gets independent submissions, AI runs, shortlist entries, and awards. The CRM remains open during the live event and polls the authoritative deadline; after a round expires it invokes the existing authenticated analyze route, which transitions the round once and runs the private OpenRouter evaluation. The public participant page derives its timer from `closesAt`, submits once, and locks the answer.

**Tech Stack:** Next.js App Router, strict TypeScript, React client components, Supabase SQL migrations/RPCs, existing CRM auth/CSRF/idempotency guards, OpenRouter structured output, Node test runner with `tsx`.

## Global Constraints

- Use only the `live` environment for the operator flow; do not change payment, ticket, receipt, email, or order behavior.
- Preserve RLS, service-role server boundaries, no-store responses, CRM mutation guards, and sanitized public responses.
- Manual submissions are 30–350 Unicode characters; timeout submissions are 1–350 non-empty Unicode characters.
- A participant may create exactly one submission per question; repeated writes return a safe conflict and never add points.
- The authoritative round deadline is stored in Supabase; client timers are display/trigger helpers only.
- AI shortlist output is capped at five candidates; award bonuses remain 50/35/25.
- Preserve the unrelated untracked ticket/PDF files already in the workspace.

---

### Task 1: Add round identity and server-side timeout rules

**Files:**
- Create: `supabase/migrations/20260923000000_add_case_lab_3_live_rounds.sql`
- Modify: `app/lib/case-lab-3/database.types.ts`
- Test: `supabase/tests/case_lab_3_live.test.sql`
- Test: `tests/case-lab-3-live/validation.test.ts`

**Interfaces:** `case_lab_3_live_cases.question_number` is 1–3, existing rows become question 1, and `case_lab_3_live_save_submission` returns `already_submitted` rather than updating an existing answer.

- [ ] Write failing tests for the 350-character limit, question-number column, three-question unique key, and one submission per question.
- [ ] Run `npx tsx --test tests/case-lab-3-live/validation.test.ts` and confirm the new assertions fail for the current 300-character parser/schema.
- [ ] Add `question_number integer not null default 1` with a 1–3 check; replace the case unique key with `(environment, case_number, question_number)`; change the submission column bound to 1–350.
- [ ] Replace the save-submission RPC so manual mode requires 30–350, timeout mode requires 1–350, the server clock controls the deadline, and a second write returns `already_submitted` without changing the first answer.
- [ ] Require `closes_at <= clock_timestamp()` before an `open → analyzing` transition and update generated database types for all changed rows/RPC results.
- [ ] Run `npx tsc --noEmit --incremental false` and `git diff --check`.
- [ ] Commit with `git commit -m "feat(case-lab-3): add live question rounds"`.

### Task 2: Make participant sessions question-aware and add the timer

**Files:**
- Modify: `app/lib/case-lab-3/live/contracts.ts`
- Modify: `app/lib/case-lab-3/live/validation.ts`
- Modify: `app/lib/case-lab-3/live/repository.server.ts`
- Modify: `app/api/case-lab-3/live/cases/[id]/submission/route.ts`
- Modify: `app/case-lab-3/live/LiveParticipantClient.tsx`
- Modify: `app/case-lab-3/live/live.module.css`
- Test: `tests/case-lab-3-live/participant-api.integration.test.ts`
- Test: `tests/case-lab-3-live/pages.test.ts`

**Interfaces:** Public active-round state includes `questionNumber`, `closesAt`, and a locked-answer state. Submission requests carry `mode: "manual" | "timeout"`; the RPC remains the deadline authority.

- [ ] Write failing tests for one-save-only behavior, 350-character validation, timeout mode, question number, countdown, compact textarea, and locked answer.
- [ ] Run the focused participant/page tests and confirm RED.
- [ ] Update state loading to select the highest active `(case_number, question_number)`, read submissions by round ID, and map `already_submitted` to a safe conflict.
- [ ] Implement a one-second countdown from `Date.parse(closesAt)`, one timeout submission of current non-empty text, and a lock after the first successful save.
- [ ] Set `maxLength={350}`, `rows={4}`, keep manual submit disabled below 30 characters, and remove the current update/resubmit behavior.
- [ ] Run `npx tsx --test tests/case-lab-3-live/participant-api.integration.test.ts tests/case-lab-3-live/pages.test.ts` and `npx tsc --noEmit --incremental false`.

### Task 3: Support three questions per case in CRM and cap AI at five

**Files:**
- Modify: `app/lib/case-lab-3/live/openrouter.server.ts`
- Modify: `app/lib/case-lab-3/live/operator.server.ts`
- Modify: `app/api/admin/case-lab-3/live/route.ts`
- Modify: `app/api/admin/case-lab-3/live/cases/[id]/rubric/route.ts`
- Modify: `app/api/admin/case-lab-3/live/cases/[id]/analyze/route.ts`
- Modify: `app/crm/case-lab-3/live/LiveOperatorClient.tsx`
- Test: `tests/case-lab-3-live/openrouter.test.ts`
- Test: `tests/case-lab-3-live/operator-api.integration.test.ts`
- Test: `tests/case-lab-3-live/pages.test.ts`

**Interfaces:** Operator drafts use `{ caseNumber, questionNumber }`; case save upserts a round without replacing another question; analysis and awards use the selected round ID.

- [ ] Write failing tests for saving question 2, question-specific rubric/transition, deadline-aware analysis, five candidates, and participant names in CRM submissions.
- [ ] Run the focused operator/OpenRouter/page tests and confirm RED.
- [ ] Add `questionNumber` to operator snapshots, repository queries, save/rubric/analyze contracts, and use the participant public display name beside each submission without exposing it publicly.
- [ ] Change OpenRouter schema, prompt, validation, and tests from a maximum of 10 to a maximum of 5 candidates.
- [ ] Make analyze idempotent and reject early calls before the server deadline; let the CRM five-second poll invoke it once after expiry.
- [ ] Add CRM case tabs and question tabs 1–3, use exactly 180 seconds when opening a question, show compact question-specific controls, and render shortlist/award choices with `Имя Ф.`, answer, score, and reason.
- [ ] Reload the snapshot after each top-three publication so the cumulative leaderboard is visible immediately.
- [ ] Run focused tests, `npx tsc --noEmit --incremental false`, and `npm run build`.

### Task 4: Verify cumulative scoring and deploy safely

**Files:**
- Modify: `supabase/tests/case_lab_3_live.test.sql`
- Modify: `tests/case-lab-3-live/leaderboard.test.ts`
- Modify: `tests/case-lab-3-live/operator-api.integration.test.ts`

- [ ] Add tests covering two questions in case 1 plus one question in case 2, asserting one participation award per question, 50/35/25 bonuses per question, and cumulative live ranking.
- [ ] Run `npm run test:case-lab-3-live`, `npm run test:case-lab-3-payments`, `npx tsc --noEmit --incremental false`, `npm run build`, and `git diff --check`.
- [ ] Dry-run and apply only the new migration to Supabase project `wilksbazxvlsztuzawew`; verify existing live rows remain and have `question_number = 1`.
- [ ] Commit with `git commit -m "feat(case-lab-3): add timed live question rounds"` and push `main`.
- [ ] Smoke-test with one operator-owned live case: save question 1, approve rubric, open for three minutes, submit one answer, verify 10 points, wait for automatic AI top-5, publish top-3, and confirm the cumulative leaderboard. Leave the other cases untouched until this passes.
