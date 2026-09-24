# Case Lab III Live Archive Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close Case Lab III live pages and APIs in production while preserving data and retaining an authenticated read-only CRM archive.

**Architecture:** Add a server-only production archive policy and reuse it in public pages, public APIs, CRM UI, and every CRM mutation API. Keep the existing CRM snapshot GET and database leaderboard untouched; hide operator actions in the CRM and reject direct write requests server-side.

**Tech Stack:** Next.js App Router, strict TypeScript, React, Supabase server-side API handlers, Node test runner, npm.

## Global Constraints

- Production-only behavior: `process.env.NODE_ENV === "production"`; non-production stays enabled.
- Public pages use `notFound()` in production; public live APIs return `410` with `Cache-Control: no-store`.
- CRM snapshot reads stay authenticated and unchanged; every mutation path must be rejected in production.
- No SQL, migration, database, payment, dependency, environment-variable, or data changes.
- Preserve unrelated untracked files and stage only task files.

---

### Task 1: Define and test the archive policy

**Files:**
- Create: `app/lib/case-lab-3/live/archive.server.ts`
- Test: `tests/case-lab-3-live/archive.test.ts`

**Interfaces:**
- Produces `isCaseLab3LiveArchived(environment?: string): boolean` and `caseLab3LiveArchivedResponse(): Response`.
- Archive policy is true only when the requested event environment is `live` and `NODE_ENV` is `production`.
- The response is a no-store JSON body with `error: "event_ended"` and HTTP 410.

- [x] Write tests for production/live true, production/test false, and development/live false.
- [x] Run `npx tsx --test tests/case-lab-3-live/archive.test.ts` and confirm the missing module causes the intended failure.
- [x] Implement only the helper functions needed by those tests.
- [x] Re-run the test and confirm it passes.

### Task 2: Close public pages and API routes

**Files:**
- Modify: `app/case-lab-3/live/page.tsx`
- Modify: `app/case-lab-3/live/leaderboard/page.tsx`
- Modify: `app/api/case-lab-3/live/state/route.ts`
- Modify: `app/api/case-lab-3/live/leaderboard/route.ts`
- Modify: `app/api/case-lab-3/live/session/route.ts`
- Modify: `app/api/case-lab-3/live/selection/route.ts`
- Modify: `app/api/case-lab-3/live/cases/[id]/submission/route.ts`
- Test: `tests/case-lab-3-live/participant-api.integration.test.ts`
- Test: `tests/case-lab-3-live/speaker-api.integration.test.ts`
- Test: `tests/case-lab-3-live/pages.test.ts`

**Interfaces:**
- Production page requests call `notFound()`; non-production pages continue rendering.
- Public API handlers use the common archive response when the configured environment is live and production is active.
- The session `DELETE` behavior stays unchanged.

- [x] Add failing tests for the public production-off behavior and preserve the logout test.
- [x] Run the targeted tests to confirm they fail for the missing behavior.
- [x] Add archive checks before public data loads or writes.
- [x] Re-run the targeted tests and confirm they pass.

### Task 3: Make the authenticated CRM archive read-only

**Files:**
- Modify: `app/crm/case-lab-3/live/page.tsx`
- Modify: `app/crm/case-lab-3/live/LiveOperatorClient.tsx`
- Modify: `app/api/admin/case-lab-3/live/route.ts`
- Modify: `app/api/admin/case-lab-3/live/speaker-session/route.ts`
- Modify: `app/api/admin/case-lab-3/live/tie-breaks/route.ts`
- Modify: `app/api/admin/case-lab-3/live/cases/[id]/analyze/route.ts`
- Modify: `app/api/admin/case-lab-3/live/cases/[id]/awards/route.ts`
- Modify: `app/api/admin/case-lab-3/live/cases/[id]/reset-timer/route.ts`
- Modify: `app/api/admin/case-lab-3/live/cases/[id]/rubric/route.ts`
- Modify: `app/api/admin/case-lab-3/live/cases/[id]/shortlist/route.ts`
- Modify: `app/api/admin/case-lab-3/live/cases/[id]/transition/route.ts`
- Modify: `app/api/admin/case-lab-3/live/participants/[id]/reset/route.ts`
- Test: `tests/case-lab-3-live/operator-api.integration.test.ts`
- Test: `tests/case-lab-3-live/pages.test.ts`

**Interfaces:**
- CRM page passes a server-derived `readOnly` flag to the client.
- The client still loads and presents the same CRM snapshot, but hides all mutation controls and automatic analysis when archived.
- The authenticated snapshot `GET` remains unchanged; every CRM write handler returns the common 410 response in production.

- [x] Add failing tests for archived API writes being rejected and snapshot reads remaining available.
- [x] Run the targeted tests to confirm they fail for the missing guard.
- [x] Hide archive-unsafe controls and add server guards to all CRM live mutation routes.
- [x] Re-run tests and confirm both the archive and existing non-production operator workflows pass.

### Task 4: Verify and release

**Files:**
- Review all modified files and the full Git diff; do not stage unrelated untracked files.

- [x] Run `npm run test:case-lab-3-live`.
- [x] Run `npx tsc --noEmit --incremental false`.
- [x] Run `npm run build`.
- [x] Confirm no migration or production data change is present.
- [ ] Commit only the implementation, tests, and these task documents with a lowercase Conventional Commit.
- [ ] Push the intended production branch to trigger the deployment.
- [ ] Confirm production pages return 404, public live APIs return 410, CRM snapshot GET remains available after CRM authentication, and CRM write APIs return 410.
