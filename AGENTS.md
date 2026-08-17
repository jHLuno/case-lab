<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version may differ from your training data. Before changing behavior that depends on Next.js-specific APIs or conventions—such as routing, caching, Server/Client Components, metadata, middleware, data fetching, or Next.js configuration—read the relevant local guide in `node_modules/next/dist/docs/` and heed deprecation notices. Do not read Next.js documentation for changes that do not depend on Next.js behavior.
<!-- END:nextjs-agent-rules -->

# Repository Guidelines

## Working Protocol

Follow `Inspect -> Plan -> Implement -> Verify` for every task:

1. Inspect the existing implementation and relevant files before editing. Identify the smallest set of files required by the task.
2. For non-trivial work, state a short implementation plan before making changes.
3. Implement the smallest change necessary. Follow existing patterns and abstractions; do not refactor, rename, reorganize, or "improve" unrelated code.
4. Verify the change with the relevant static or CLI checks before claiming completion. Report anything that could not be verified.

## Project Structure

- Case Lab is Russian-language marketing site for marketing diagnostics and growth strategy. Production domain: `caselab.kz`.
- Stack: Next.js App Router, React, strict TypeScript, Tailwind CSS, Framer Motion, GSAP/ScrollTrigger, React Three Fiber, Supabase.
- `app/components/HomePage.tsx` composes homepage. Individual sections live in `app/sections/`; shared interaction lives in `app/components/`; API routes live in `app/api/`.

## Source Of Truth And Context Economy

- Treat this `AGENTS.md` as the source of operating rules, `package.json`, the lockfile, configuration files, and the filesystem as the source of truth for the current repository, and database schema and migration files as the source of truth for database state. Verify current repository state instead of relying on duplicated facts.
- Read feature-specific docs or specs only when the task concerns that feature. Do not read the entire `docs/` directory without a task-specific reason.
- Read only files relevant to the task. Prefer targeted search over reading directories or large files wholesale; do not re-read unchanged files without need or load unrelated logs and documentation into context.

## Design And Accessibility

- Reuse existing components, layout and interaction patterns, design tokens, and assets from `public/` before introducing new visual primitives.
- Preserve the visual language already implemented in the repository. Do not introduce new colors, fonts, or a competing visual language unless the task explicitly requires it; derive styling decisions from existing code and assets rather than subjective interpretation.
- For any touched dialog or modal, preserve or add appropriate dialog semantics, focus containment and initial focus, Escape handling, focus restoration, background inertness where supported, and scroll locking.
- Preserve visible keyboard focus and keyboard operability for touched UI. When touching motion, animation, auto-rotation, WebGL, or RAF-driven effects, provide appropriate reduced-motion behavior.

## Commands And Conventions

- Use npm and verify available scripts in `package.json`. Common CLI checks are `npx tsc --noEmit --incremental false` and `npm run build`; use lint or test scripts only when the current repository configuration provides them.
- Follow strict TypeScript and existing component patterns. When asked to commit, use lowercase Conventional Commits, scoped where useful.

## Dependencies, Boundaries, And Performance

- Do not install new packages or update dependencies unless directly required by the task. Use the current stack and platform capabilities first; do not add a library for one-off or simple functionality that existing dependencies or native APIs can reasonably handle.
- Use Server Components by default. Keep `use client` as low in the component tree as practical, minimize Client Component boundaries, and do not widen existing homepage or other client-only boundaries without need.
- Never pass server secrets into client code. Keep heavy client-side and animation dependencies inside the smallest boundary that actually needs them.
- Avoid unnecessary growth in client JavaScript, new client-only boundaries, and heavy runtime effects. Prefer CSS or native browser behavior over additional JavaScript where practical. Do not perform performance refactors outside the task scope.

## Definition Of Done And Verification

A task is complete only when:

- The requested behavior is implemented without unrelated changes, existing behavior is preserved, and applicable accessibility and security invariants remain intact.
- Relevant static or CLI checks have passed, normally `npx tsc --noEmit --incremental false` and `npm run build`. Run only checks relevant to the change; do not claim checks that were not run. If a check cannot run or fails because of a pre-existing issue, report the exact limitation.
- No secrets, credentials, personal data, generated artifacts, or unintended dependency/configuration changes were introduced.

To conserve tokens, do not take screenshots or use browser-based verification, agent browsing, visual browsing, or any UI/browser inspection tools by default. Do not start a browser or dev server solely for visual verification. Use code inspection and relevant static/CLI checks instead. Visual verification of UI changes is intentionally left to the user unless the user explicitly requests browser-based verification.

## Final Response Contract

Keep the final response concise and use only:

- `Changed:` files and material behavior changed.
- `Verified:` checks actually run and their results.
- `Risks / not verified:` remaining risks, failed or skipped checks, and—for UI changes—a clear statement that visual verification was not performed and remains with the user.

## Data And Security

- Leads and CRM data are personal data. Never log, commit, expose, or copy `.env*` contents, lead records, CRM passwords, service-role keys, credentials, or other personal data.
- Keep authentication and authorization enforcement server-side. Supabase service-role access must remain server-only; never expose `SUPABASE_SERVICE_ROLE_KEY` through `NEXT_PUBLIC_*`, client code, responses, or logs.
- Preserve RLS on protected tables and preserve existing request validation and access controls when touching related code.
- When a task concerns rate limiting, CSP/security headers, dependency vulnerabilities, authentication, or data access, inspect the current implementation and configuration in the repository before making claims or changes. Do not perform unsolicited security refactors, hardening, dependency updates, or audit cleanup outside the requested scope.

## Database Migrations

- Make schema changes only through new migrations and only when directly required by the task. Never rewrite migrations that may already have been applied.
- Preserve RLS and existing security invariants. When a task changes the schema, synchronize the related types, queries, and contracts that are within that task's scope.

## Error Handling

- Follow the project's existing error response format and API conventions. Use HTTP status codes and validation behavior consistent with the current API pattern.
- Never return stack traces, credentials, secrets, or unnecessary internal details to users, and never log personal data or secrets.
- Do not introduce a new error abstraction unless the task requires it and the existing pattern cannot reasonably support the change.

## High-Risk Change Boundaries

Do not expand a task into changes to authentication, database schema or migrations, dependencies or lockfiles, environment variables or `.env*` files, security headers/CSP, deployment configuration, or public API contracts unless the user explicitly requires that area to change. If such a change is required, keep it narrowly scoped, preserve backwards compatibility where possible, verify the relevant security and data-flow implications, and call out the change and remaining risk in the final response. Never perform opportunistic cleanup or upgrades in these areas.
