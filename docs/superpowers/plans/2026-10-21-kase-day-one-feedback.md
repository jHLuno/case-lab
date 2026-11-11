# KASE Day One Feedback Implementation Plan

> **For agentic workers:** use test-driven-development for business rules and a scoped code review before completion. Work in the existing main checkout as explicitly requested by the user.

**Goal:** Collect event feedback at `/kase/`, then manually generate a review using an uploaded PDF/PPTX from `/crm/kase/`.

**Architecture:** Isolated KASE tables and RPCs store event state, feedback, private presentation files, immutable analysis snapshots, checkpoints and published reports. Authenticated CRM requests advance leased analysis tasks one step at a time; no AI request occurs during feedback submission or file upload. Existing CRM authentication and Supabase/OpenRouter configuration are reused.

**Tech Stack:** Next.js App Router, React, strict TypeScript, Supabase, existing OpenRouter HTTP API, fflate 0.8.3.

## Global Constraints

- Work in main; preserve all existing uncommitted NBS files.
- No automatic AI processing during collection or upload.
- All raw data and uploaded presentations remain private and server accessed; enable RLS on every new table.
- Feedback: nonempty, up to 5000 Unicode characters. PDF/PPTX: at most 3 MiB. Notes: at most 60000 Unicode characters.
- Only a manually published completed report is public. A failed replacement never removes an earlier report.
- No browser, dev server or screenshot verification. Run targeted tests, TypeScript and production build.

## Task 1 File processing and analysis

Files: `app/lib/kase/contracts.ts`, `presentation.ts`, `analysis.server.ts`, `tests/kase/presentation.test.ts`, `analysis.test.ts`.

- [x] Define serializable report, snapshot and checkpoint contracts.
- [x] Write and run failing tests for PDF/PPTX validation, slide ordering, expansion limits, analysis stages, bounded batching, invalid provider output and escaped report export.
- [x] Implement bounded PPTX text extraction, native PDF input to OpenRouter, source-grounded staged synthesis and strict output validation. Keep files server accessed and do not call AI on upload.
- [x] Run `node_modules/.bin/tsx --test tests/kase/presentation.test.ts tests/kase/analysis.test.ts` and inspect the results.

## Task 2 Durable storage and server API

Files: new `supabase/migrations/20261021000000_create_kase_feedback.sql`, `app/lib/kase/database.types.ts`, `repository.server.ts`, `http.server.ts`, `validation.ts`, `report.ts`; routes under `app/api/kase/` and `app/api/admin/kase/`; `tests/kase/validation.test.ts`, `report.test.ts`, `api.test.ts`; `supabase/tests/kase_feedback.test.sql`.

- [x] Write failing tests for validation and API access controls, and transactional SQL checks for collection, deduplication, isolation and task fencing.
- [x] Add test/live event rows, protected data tables and a private storage bucket. Implement atomic submit, operator commands, snapshot creation, lease claim, checkpoint completion and failure/retry RPCs. Revoke access from public/anon/authenticated roles.
- [x] Implement public state/submit/results APIs, authenticated CRM state/commands/upload/process/export APIs using existing CSRF and bounded-body helpers. Use deterministic upload paths, immutable snapshot references and safe error codes.
- [x] Run targeted tests. Run transactional database tests only against a local disposable database if available; never apply production migrations implicitly.

## Task 3 Participant and organizer flows

Files: `app/kase/page.tsx`, `KaseFeedbackForm.tsx`, `answers/page.tsx`, `app/components/kase/KaseTheme.module.css`, `KaseReport.tsx`, `app/crm/kase/page.tsx`, `KaseOperatorClient.tsx`, existing `CrmSectionNav.tsx`, `docs/kase-feedback-operations.md`.

- [x] Implement the single-field mobile form, local draft and stable retry key, submission confirmation and open/closed/error states.
- [x] Implement CRM controls, source comments, file upload, notes, queued progress with safe resumption, report preview, export and explicit publication.
- [x] Render only the published document at `/kase/answers/`. Escape all report content and include print styles in the downloadable HTML.
- [x] Run KASE tests, lint touched application files, `npx tsc --noEmit --incremental false`, `npm run build`, `git diff --check`.
- [x] Review the change for data exposure, stale task writes and unrelated modifications. Document release steps and verification limits.
