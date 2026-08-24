# Task 3 Report

## Status

Implemented the complete semantic ticket markup from `task-3-brief.md` in `app/sections/CaseLab3Tickets.tsx`.

The component change was committed independently. CSS, tests, the plan, the public asset, and unrelated files were not modified or staged.

## Commit Hashes

- `7942050` - `feat(case-lab-3): add ticket editorial content`

## Commands and Results

1. `node --test tests/case-lab-3-tickets-editorial.test.mjs` before the component change
   - Exit code: `1`
   - Result: 1 passed, 2 failed. The generated background, native disabled CTA, event facts, and CSS layout classes were not yet present.

2. `npx tsc --noEmit --incremental false`
   - Exit code: `0`
   - Result: `TypeScript: No errors found`

3. `node --test tests/case-lab-3-tickets-editorial.test.mjs` after the component change
   - Exit code: `1`
   - Result: 1 passed, 2 failed.
   - The semantic test fails its source-level `/7 890 ₸/` assertion because the required implementation renders the amount as separate `<strong>7 890</strong>` and `<span>₸</span>` elements.
   - The editorial CSS test fails on the missing `.ticketBackground` class assertion. The remaining `.ticketOverlay`, `.ticketPanel`, and `.ticketFacts` assertions are expected to be supplied by Task 4.

4. `git diff --check`
   - Exit code: `0`
   - Result: no whitespace errors.

5. `git add -- app/sections/CaseLab3Tickets.tsx && git commit -m "feat(case-lab-3): add ticket editorial content"`
   - Exit code: `0`
   - Result: commit `7942050` created with 1 file changed.

## Concerns

- The focused test has one non-CSS failure caused by a source-regex mismatch with the exact component code in the brief. No test or component deviation was made to hide it.
- The CSS-only failures remain until Task 4 adds the specified classes.
- Visual/browser verification was not performed.

## Review Fix

- Updated the visible event date to `24 сентября 2026 года` in `app/sections/CaseLab3Tickets.tsx`.
- Replaced the contiguous early-bird price assertion with separate assertions for `<strong>7 890</strong>` and `<span>₸</span>` while retaining the `15 000 ₸` assertion in `tests/case-lab-3-tickets-editorial.test.mjs`.

## Review Fix Verification

1. `npx tsc --noEmit --incremental false`
   - Exit code: `0`
   - Result: `TypeScript: No errors found`

2. `node --test tests/case-lab-3-tickets-editorial.test.mjs`
   - Exit code: `1`
   - Result: 2 passed, 1 failed.
   - The two semantic tests pass. The remaining failure is the expected CSS class assertion for `.ticketBackground`; CSS remains unchanged for Task 4.
