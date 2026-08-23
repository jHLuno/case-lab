# Case Lab 3 Tickets Before Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render the ticket purchase section before the cases section on `/case-lab-3`.

**Architecture:** Keep the existing section components unchanged and update only their composition order in `CaseLab3Page`. The DOM order will match the requested visual order, preserving accessibility and all existing section behavior.

**Tech Stack:** Next.js App Router, React, TypeScript, CSS Modules.

## Global Constraints

- Modify only `app/components/CaseLab3Page.tsx` for the implementation.
- Do not change section content, styles, IDs, checkout links, or cases carousel behavior.
- Do not add dependencies or new client boundaries.

---

### Task 1: Reorder Case Lab 3 Sections

**Files:**
- Modify: `app/components/CaseLab3Page.tsx:19-23`

**Interfaces:**
- Consumes: Existing `CaseLab3Proof`, `CaseLab3Tickets`, `Cases`, and `CaseLab3FAQ` components.
- Produces: Page composition order `Proof -> Tickets -> Cases -> FAQ`.

- [ ] **Step 1: Move the ticket component above the cases component**

Change the returned section sequence from:

```tsx
<CaseLab3Proof />
<Cases alignToCaseLab />
<CaseLab3Tickets />
<CaseLab3FAQ />
```

to:

```tsx
<CaseLab3Proof />
<CaseLab3Tickets />
<Cases alignToCaseLab />
<CaseLab3FAQ />
```

Keep every import and every prop unchanged.

- [ ] **Step 2: Verify the source order**

Run:

```bash
rg -n "CaseLab3Proof|CaseLab3Tickets|<Cases|CaseLab3FAQ" app/components/CaseLab3Page.tsx
```

Expected order in the output: `CaseLab3Proof`, `CaseLab3Tickets`, `Cases`, `CaseLab3FAQ`.

- [ ] **Step 3: Run static verification**

Run:

```bash
npx tsc --noEmit --incremental false
npm run build
```

Expected: both commands exit successfully without TypeScript or build errors.

## Plan Self-Review

- Spec coverage: The target order is implemented in Task 1, while content, styling, links, IDs, and carousel behavior remain untouched.
- Placeholder scan: No TODO, TBD, or unspecified implementation steps are present.
- Type consistency: No new types, functions, or interfaces are introduced.
