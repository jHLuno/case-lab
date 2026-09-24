# Case Lab 3 Direct Speaker Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the speaker choose three answers directly on `/live/leaderboard` without a link, code, or separate activation step.

**Architecture:** The public leaderboard will expose answer positions only while the current question is in `shortlist_ready`; the page will make those cards selectable immediately. The selection endpoint will resolve the submitted positions against the single live case currently in `shortlist_ready`, validate that all three entries belong to its included shortlist, and publish awards through the existing server-side RPC. The CRM will retain its manual top-3 fallback and no longer render the speaker-link control.

**Tech Stack:** Next.js App Router, React, strict TypeScript, Supabase admin repository, Node test runner.

## Global Constraints

- Keep the event environment hard-coded to `live` in CRM code.
- Do not add a migration or expose participant/submission UUIDs in the public leaderboard response.
- Preserve the existing `shortlist_ready` state guard and server-side award publication.
- Preserve the operator's manual top-3 fallback.
- Do not touch payment, ticket, roster, or unrelated CRM behavior.

---

### Task 1: Define the direct public selection contract

**Files:**
- Modify: `tests/case-lab-3-live/speaker-api.integration.test.ts`
- Modify: `tests/case-lab-3-live/participant-api.integration.test.ts`
- Modify: `tests/case-lab-3-live/pages.test.ts`

**Interfaces:**
- Public selection request: `{ candidateIndexes: number[] }` with exactly three distinct zero-based shortlist positions.
- Public leaderboard answer cards remain `{ displayName, answer }`; no internal candidate ID is returned.

- [ ] **Step 1: Write failing tests**

  Replace the token-required selection assertion with a request containing only `candidateIndexes`, assert the dependency receives those indexes, and assert that a shortlist-ready answer projection has no internal identifier while the page contains no speaker-link flow and does contain direct selection behavior.

- [ ] **Step 2: Run the focused tests and confirm failure**

  Run `node --test tests/case-lab-3-live/speaker-api.integration.test.ts tests/case-lab-3-live/participant-api.integration.test.ts tests/case-lab-3-live/pages.test.ts`.

  Expected result: failures because the route still requires `speakerToken`, the selection dependency still expects a token, and the current client still contains the link/token flow.

### Task 2: Implement server-side direct selection

**Files:**
- Modify: `app/api/case-lab-3/live/selection/route.ts`
- Modify: `app/lib/case-lab-3/live/operator.server.ts`
- Modify: `app/lib/case-lab-3/live/public.server.ts`
- Modify: `app/api/case-lab-3/live/leaderboard/route.ts`

**Interfaces:**
- `POST /api/case-lab-3/live/selection` accepts only `candidateIndexes`.
- `selectSpeakerAwards({ candidateIndexes })` finds the current `live` case in `shortlist_ready`, sorts included shortlist entries using the same final/AI order as the public projection, and calls `publishLiveAwards` with the resulting submission IDs.

- [ ] **Step 1: Implement the smallest route validation change**

  Validate an array of exactly three distinct integer indexes, reject negative or out-of-range values, and return `invalid_selection` for malformed input.

- [ ] **Step 2: Implement current-round resolution**

  Query the live case in `shortlist_ready`, load its included shortlist entries, sort them by `final_order`, then `ai_order`, then `created_at`, resolve the three indexes to submission IDs, and return `conflict` if no current shortlist-ready case exists.

- [ ] **Step 3: Make public answer positions available without identifiers**

  Remove token-dependent candidate exposure from the public projection. Keep answer cards as display name and answer text only; the client will submit their visible zero-based positions.

- [ ] **Step 4: Run the focused tests and confirm green**

  Run the same focused command from Task 1. Expected result: all focused tests pass.

### Task 3: Make `/live/leaderboard` directly selectable and remove the CRM link UI

**Files:**
- Modify: `app/case-lab-3/live/leaderboard/LeaderboardClient.tsx`
- Modify: `app/crm/case-lab-3/live/LiveOperatorClient.tsx`

**Interfaces:**
- In `shortlist_ready`, the selected question's answer cards are buttons immediately; no speaker token, URL, or activation control is needed.
- The CRM shows that the speaker should choose on `/live/leaderboard` and keeps `Опубликовать топ-3 вручную`.

- [ ] **Step 1: Remove token and URL state from the leaderboard client**

  Delete fragment/query/sessionStorage token parsing and send `{ candidateIndexes }` to the selection endpoint.

- [ ] **Step 2: Enable direct selection for the shortlist-ready question**

  Use `selectedQuestion.state === "shortlist_ready"` as the selection mode guard, track selected indexes, enforce a maximum of three cards, and require exactly three before publishing.

- [ ] **Step 3: Remove the CRM speaker-link action**

  Delete the link-opening handler, URL state, and `Открыть выбор спикера` UI. Add a short status message explaining that selection happens on `/live/leaderboard`.

- [ ] **Step 4: Run focused tests**

  Run `node --test tests/case-lab-3-live/speaker-api.integration.test.ts tests/case-lab-3-live/participant-api.integration.test.ts tests/case-lab-3-live/pages.test.ts`.

  Expected result: all focused tests pass.

### Task 4: Full verification and handoff

**Files:**
- No additional source files.

- [ ] **Step 1: Run live and payment test suites**

  Run `npm test -- --runInBand` only if supported by the repository scripts; otherwise use the repository's configured test command and confirm the live and payment suites pass.

- [ ] **Step 2: Run static checks**

  Run `npx tsc --noEmit --incremental false`, `npm run build`, and `git diff --check`.

- [ ] **Step 3: Inspect the diff**

  Confirm no payment, ticket, roster, environment, or migration files changed and that only the intended public selection and CRM UI behavior changed.

- [ ] **Step 4: Commit and push**

  Commit with `feat(case-lab-3): enable direct speaker selection` and push the commit to `main` after all checks pass.
