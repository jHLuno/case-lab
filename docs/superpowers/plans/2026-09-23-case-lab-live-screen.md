# Case Lab III Live Screen Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task with verification checkpoints.

**Goal:** Ship adaptive `/case-lab-3/live` and `/case-lab-3/live/leaderboard` screens with sanitized top-five answers for every case question, protected touch selection for a speaker, and ticket-independent live access.

**Architecture:** Keep the existing service-role Supabase repository and awards RPC as the server authority. Extend the public leaderboard projection with question-level shortlist cards and add a short-lived HMAC speaker token issued only from CRM; the public selection route validates the token and delegates to the existing awards RPC. Keep UI state in the existing client components and reuse the Benzin/Gilroy brand tokens.

**Tech Stack:** Next.js App Router, strict TypeScript, React client components, CSS Modules, Supabase RPC/service-role repository, Node HMAC tokens, Node test runner via `tsx`.

## Global Constraints

- Public answer cards display only full participant name and answer text; AI scores/ranks/reasons and database identifiers are never rendered.
- Live participant entry is name-only with required first name and last name; no ticket, order, or check-in lookup is allowed in live authorization.
- Direct speaker awards require a CRM-issued short-lived token bound to live environment, case ID, current state version, and expiry.
- Existing CRM operator award selection remains available and server-authoritative.
- Use existing Benzin/Gilroy fonts and Case Lab black/white/blue design tokens; no new dependency.
- Preserve reduced-motion behavior, keyboard focus, 44px touch targets, and no horizontal overflow.

---

### Task 1: Harden the live identity path and define public question data

**Files:**
- Modify: `app/lib/case-lab-3/live/contracts.ts`
- Modify: `app/lib/case-lab-3/live/repository.server.ts`
- Modify: `app/lib/case-lab-3/live/session.server.ts`
- Modify: `app/lib/case-lab-3/live/operator.server.ts`
- Modify: `app/lib/case-lab-3/database.types.ts`
- Modify: `app/lib/case-lab-3/live/public.server.ts`
- Test: `tests/case-lab-3-live/session.test.ts`
- Test: `tests/case-lab-3-live/participant-api.integration.test.ts`

**Steps:**

- [ ] Add failing tests proving guest session authorization never requires ticket fields and public question cards contain only `id`, `displayName`, and `answer`.
- [ ] Remove ticket lookup from live participant authorization and operator participant projection; authorize the signed participant session against the live participant row only.
- [ ] Add `questionAnswers` to the public projection: case/question metadata plus at most five included shortlist entries ordered by final order, AI order, and creation order.
- [ ] Keep the top-10 points projection and awarded podium projection backward-compatible.
- [ ] Run `npm run test:case-lab-3-live` and confirm the new tests fail before implementation and pass after implementation.

### Task 2: Add protected speaker-mode token and selection API

**Files:**
- Create: `app/lib/case-lab-3/live/speaker.server.ts`
- Create: `app/api/admin/case-lab-3/live/speaker-session/route.ts`
- Create: `app/api/case-lab-3/live/selection/route.ts`
- Modify: `app/lib/case-lab-3/live/operator.server.ts`
- Modify: `app/lib/case-lab-3/database.types.ts`
- Test: `tests/case-lab-3-live/speaker-api.integration.test.ts`

**Steps:**

- [ ] Add tests for CRM-only token issuance, token expiry/version binding, valid three-answer selection, duplicate selection rejection, and non-shortlist rejection.
- [ ] Sign a compact speaker token with the existing `CASE_LAB_3_TOKEN_SECRET`; include purpose, environment, case ID, state version, expiry, and a random nonce.
- [ ] Add a CRM-authenticated endpoint that accepts a current `shortlist_ready` case ID and returns a short-lived `/case-lab-3/live/leaderboard?speakerToken=...` URL.
- [ ] Add a public selection endpoint that accepts the token and three distinct answer IDs, rechecks current case state/version and included shortlist membership, then calls `case_lab_3_live_publish_awards` with actor `speaker-mode`.
- [ ] Return generic conflict/unauthorized errors without exposing internal database details.

### Task 3: Build the touch-friendly adaptive live participant screen

**Files:**
- Modify: `app/case-lab-3/live/LiveParticipantClient.tsx`
- Modify: `app/case-lab-3/live/live.module.css`
- Test: `tests/case-lab-3-live/pages.test.ts`

**Steps:**

- [ ] Add page assertions for Benzin/Gilroy token usage, required full-name inputs, responsive single-column behavior, no ticket copy, and no horizontal overflow styles.
- [ ] Replace the dark-purple treatment with the main white/black/blue Case Lab language while retaining the live timer and answer states.
- [ ] Use bounded `clamp()` heading sizes, `minmax(0, 1fr)`, `overflow-wrap:anywhere`, and mobile breakpoints so names, questions, and 350-character answers stay inside the viewport.
- [ ] Keep the form and answer submission behavior unchanged, including automatic timeout submission and reduced-motion support.

### Task 4: Build the TV-first leaderboard and speaker selection UI

**Files:**
- Modify: `app/case-lab-3/live/leaderboard/LeaderboardClient.tsx`
- Modify: `app/case-lab-3/live/leaderboard/leaderboard.module.css`
- Modify: `app/api/case-lab-3/live/leaderboard/route.ts`
- Modify: `app/crm/case-lab-3/live/LiveOperatorClient.tsx`
- Modify: `tests/case-lab-3-live/pages.test.ts`
- Modify: `tests/case-lab-3-live/participant-api.integration.test.ts`

**Steps:**

- [ ] Add tests for question tabs, public answer sanitization, and speaker-mode selection controls being hidden without a valid token.
- [ ] Render a TV-readable question navigator and up to five answer cards per case/question; visible card content is only full name and answer text.
- [ ] When `speakerToken` is valid and the current question is selectable, make cards touch-selectable and submit exactly three cards in selection order; display only selection count/order, never AI rank.
- [ ] Add a CRM button that requests the speaker URL for the selected shortlist-ready question and lets the operator open/copy it; preserve the existing CRM award controls.
- [ ] Add clear loading, empty, analyzing, selection success, conflict, and error states.

### Task 5: Verify and ship

**Files:**
- No additional feature files; inspect all changed files and migration state.

**Steps:**

- [ ] Run `npm run test:case-lab-3-live`.
- [ ] Run `npx tsc --noEmit --incremental false`.
- [ ] Run targeted ESLint on every changed TypeScript/TSX file.
- [ ] Run `git diff --check` and `npm run build`.
- [ ] Run read-only production checks confirming the live authorization source contains no ticket lookup and public responses omit AI/internal fields.
- [ ] Commit only feature files, preserve unrelated PDFs/output/tmp artifacts, and push `main` for Vercel deployment.
