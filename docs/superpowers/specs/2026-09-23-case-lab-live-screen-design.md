# Case Lab III live screens and speaker selection

## Goal

Bring `/case-lab-3/live` and `/case-lab-3/live/leaderboard` into the main Case Lab visual system, make both screens readable on phones and touch TVs, show the five selected answers for every case question, and offer a protected direct speaker-selection path while preserving the existing CRM fallback.

## Approved product behavior

### Participant screen

- Use the existing brand tokens: Benzin for headings, Gilroy for body copy, white/black surfaces, and Case Lab blue `#040082`.
- Keep the participant flow simple: first name and required last name, question, answer, three-minute timer, saved answer, and leaderboard.
- Use responsive `clamp()` typography and single-column mobile layout. Long names, questions, and answers must wrap inside the viewport.
- The participant entry path remains name-only. It must not match tickets, orders, or check-ins anywhere in the request/authorization chain.

### Public leaderboard screen

- Keep the top-10 points leaderboard.
- Add a question navigator for every configured case/question in the live environment.
- For each selected question, show up to five answers from the server shortlist. The public answer card renders only:
  - full participant name;
  - answer text.
- Do not render AI rank, AI score, AI reason, candidate type, submission ID, or other internal evaluation fields.
- Empty, analyzing, and unavailable states must be explicit and readable from a distance.
- The layout must support touch targets of at least 44px and retain keyboard focus states.

### Speaker selection

- The default public screen remains read-only; the existing CRM selection flow remains available as a fallback.
- A CRM-authenticated operator can request a short-lived speaker URL for the currently selected `shortlist_ready` question.
- The URL contains a signed, case-specific token derived from `CASE_LAB_3_TOKEN_SECRET`. The token is bound to environment, case ID, current state version, and expiry. Once awards are published, the state version changes and the token cannot be reused.
- Opening that URL enables touch selection on the public leaderboard. The speaker selects exactly three different visible answer cards; the selection order becomes places 1–3.
- The public selection endpoint revalidates the signed token, current case state/version, candidate membership in the included shortlist, and distinctness of the three submissions before calling the existing server-authoritative awards RPC.
- No unauthenticated public request can publish awards.

## Data flow

1. The public leaderboard server loads the sanitized top-10 projection, all live case/question metadata, and up to five included shortlist entries joined to their submission and public participant name.
2. The API returns question metadata and answer cards with opaque selection IDs only when needed by the protected speaker mode; the UI never displays those IDs or internal AI fields.
3. The CRM speaker-mode endpoint signs a short-lived token and returns a URL for the current shortlist-ready question.
4. The speaker page submits three candidate IDs to a dedicated public selection endpoint. The endpoint performs all authorization and validation server-side and delegates award points to the existing awards RPC.
5. The regular CRM operator workflow remains unchanged and can be used instead.

## Failure and security rules

- Missing/expired/mismatched speaker tokens return an unauthorized response and leave awards unchanged.
- Selections for a non-`shortlist_ready` case, another question, non-shortlisted answers, duplicate answers, or fewer/more than three answers return a conflict/validation response.
- Public API responses contain no ticket number, ticket status, order data, check-in data, AI scores, or rationale.
- Existing participant sessions are authorized by the live participant record and signed session token only; no ticket or check-in lookup is part of live access.

## Verification

- Add route and data-shaping tests for the sanitized top-five question payload.
- Add tests for speaker token issuance, invalid/expired token rejection, valid three-answer selection, and duplicate/non-shortlisted selection rejection.
- Add a regression assertion that live entry does not send or query ticket data and that a missing last name remains invalid.
- Run the Case Lab live test suite, TypeScript, targeted ESLint, `git diff --check`, and production build.
- Perform a read-only production check that live name-only access paths contain no ticket/check-in lookup and do not expose internal answer metadata.
