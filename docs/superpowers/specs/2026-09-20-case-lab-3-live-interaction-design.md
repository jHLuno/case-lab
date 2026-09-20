# Case Lab III Live Answers, AI Shortlist, and Leaderboard

Date: 20 September 2026  
Status: approved by user on 20 September 2026
Target event: Case Lab III, 24 September 2026

## 1. Goal

Add a live audience interaction system for the three Case Lab III speaker cases. Checked-in guests enter their first and last name, answer each speaker's open question from a phone, receive 10 points for a valid answer, and compete in a cumulative leaderboard. After submissions close, an AI service reduces roughly 80 answers to a diverse shortlist of 10. The speaker, assisted by the operator, selects first, second, and third place; only this human decision awards placement bonuses.

The experience must be fast enough for a live stage, continue to work when AI analysis fails, avoid sending attendee personal data to the AI provider, and preserve the existing Case Lab III ticket, check-in, CRM, RLS, and server-only secret boundaries.

## 2. Confirmed Product Decisions

- There are three cases, each with one open-text audience question.
- The participant does not choose from predefined answer options.
- An answer is limited to 30-300 visible characters after trimming.
- A checked-in ticket may have one current answer per case. The participant may edit it until the server closes that case.
- Every valid final answer receives 10 participation points.
- The speaker awards placement bonuses per case:
  - first place: 50 additional points;
  - second place: 35 additional points;
  - third place: 25 additional points.
- AI scores are internal shortlist signals. They never become leaderboard points and are not shown publicly.
- The AI receives all eligible answers for one case in one batch and returns 10 candidates.
- The operator may remove an AI candidate or add a missed answer before presenting the shortlist to the speaker.
- The speaker makes the final top-three decision. The operator records and publishes it.
- The leaderboard sums the 10 participation points and published placement bonuses across all three cases.
- Response speed is not a leaderboard tie-breaker. If prize positions remain tied after comparing first-place wins and total podium finishes, the operator records the speakers' final tie-break decision.
- The public name is the participant's first name plus the first letter of the last name, for example `Аружан К.`.
- The operator can see the full name and ticket number needed to distinguish or verify participants. Ticket numbers are never public.
- The live experience is separate from the marketing landing page:
  - participant: `/case-lab-3/live`;
  - projection leaderboard: `/case-lab-3/live/leaderboard`;
  - operator: `/crm/case-lab-3/live`.

## 3. Approaches Considered

### 3.1 Fully automatic judging

AI would rank every answer and award points without human review. This is fast but unacceptable for prizes because model calibration can overvalue polished wording, miss unconventional ideas, or overfit to the speaker's reference answer.

### 3.2 Audience voting

Participants would vote answers into the shortlist. This adds engagement but rewards popularity, introduces another time-limited interaction, and creates vote-abuse and moderation work.

### 3.3 AI shortlist with operator override and speaker decision

This is the selected design. AI performs the time-consuming reduction from approximately 80 answers to 10. The operator protects against AI mistakes and controls the stage flow. The speaker remains the authority for prize-bearing decisions.

## 4. Roles

### 4.1 Participant

- Enters a full first and last name after scanning the shared event QR code.
- Is matched to an eligible checked-in ticket and receives a secure participant session.
- Sees the current case state, question, server-derived timer, answer editor, submission result, personal score, and public leaderboard.
- Never sees another participant's full name, ticket number, AI score, or AI rationale.

### 4.2 Operator

- Uses the existing CRM administrator session and CSRF protection.
- Prepares questions and speaker reference answers before the event.
- Generates and reviews AI-authored evaluation guidance.
- Opens and closes cases.
- Monitors submission count and matching problems.
- Starts or retries AI analysis, edits the shortlist, records podium places, resolves ties, and publishes results.
- Can search by full name or ticket number, clear an incorrect participant claim, invalidate abusive content, and use a fully manual shortlist fallback.

### 4.3 Speaker

- Does not need a separate account in version one.
- Supplies the case question and a reference answer before the event.
- Reviews the final shortlist on the operator or projection screen.
- Selects first, second, and third place and may briefly explain the selections.

### 4.4 Public projection

- Shows the current case state and, after publication, the cumulative leaderboard.
- Displays only `Имя Ф.` and points.
- Does not expose ticket numbers, full last names, answer ownership before publication, or administrative controls.

## 5. Participant Identification

### 5.1 Eligibility

Only the current revision of a non-cancelled Case Lab III ticket with a recorded check-in may claim a live participant session. The ticket and ticket revision remain the source of truth for the attendee's full name.

### 5.2 Name-first claim flow

1. The guest enters first and last name in two fields.
2. The server normalizes whitespace, Unicode case, and `ё`/`е` only for lookup; stored ticket values are not rewritten.
3. The server searches current ticket revisions belonging to checked-in, non-cancelled tickets in the active environment.
4. If there is exactly one exact normalized match and that ticket is not claimed by another active live participant, the server issues a live participant session.
5. If no exact match exists, the page asks the guest to check the spelling or contact the operator. Fuzzy matching may suggest candidates only to the operator; it never authenticates automatically.
6. If multiple exact matches exist, or the matching ticket is already claimed, the participant enters the ticket number as a second factor or asks the operator to resolve the claim.
7. The operator sees the full name, ticket number, claim state, check-in timestamp, and public display name. The operator may clear and reassign an incorrect claim with an audit reason.

Name-only entry is intentionally a low-friction event identification mechanism rather than strong account authentication. Restricting it to checked-in tickets, allowing only one active claim per ticket, rate-limiting attempts, and escalating collisions to ticket-number verification bound the accepted risk.

### 5.3 Session

The successful claim creates an HttpOnly, Secure, SameSite=Lax cookie scoped to the live experience. The cookie contains a purpose-bound signed opaque credential tied to the live participant record and current ticket revision. It contains no clear personal data. Ticket transfer, cancellation, operator claim reset, or token-version rotation invalidates the prior session.

### 5.4 Public identity collisions

Two participants may legitimately produce the same public label such as `Алина К.`. The public label remains unchanged. The operator distinguishes them by full name and hidden ticket number. If both occupy prize positions, the projection may append neutral podium labels such as `Алина К. · 1 место` and `Алина К. · 3 место`; it never reveals the ticket number.

## 6. Case Preparation

Each case stores:

- speaker label;
- case title;
- open question;
- speaker reference answer;
- optional key insight;
- optional context or constraint;
- AI-generated evaluation guidance;
- operator-approved evaluation guidance version;
- answer minimum and maximum lengths, fixed to 30 and 300 for version one;
- state and timestamps.

The speaker is required to provide only the question and their own answer. The same AI model generates a draft rubric before the event. The default rubric is:

- problem understanding: 40%;
- solution specificity and practicality: 30%;
- reasoning quality: 20%;
- originality: 10%.

The speaker reference answer is one strong perspective, not a canonical phrase-match answer. Generated guidance explicitly instructs the live shortlist model to accept well-reasoned alternatives.

The operator reviews and approves the guidance before a case can enter `ready`. AI rubric generation is preparation support and may be replaced by the default rubric if it fails.

## 7. Case State Machine

The authoritative state is stored in Postgres and changed only by audited CRM operations:

```text
draft -> ready -> open -> analyzing -> shortlist_ready -> awarded -> closed
```

- `draft`: preparation is incomplete; participants see the waiting state.
- `ready`: content and evaluation guidance are approved.
- `open`: submissions and edits are accepted until the server deadline.
- `analyzing`: submissions are frozen and an AI run is in progress or awaiting operator action.
- `shortlist_ready`: the operator can review and edit the candidate set.
- `awarded`: podium places and points are committed atomically but not yet hidden from later display.
- `closed`: the case is final; only an explicitly audited administrator correction can change awards.

Only one case may be `open` or `analyzing` at a time. All transitions validate the expected prior state to make repeated clicks and concurrent operator requests safe.

## 8. Participant Experience

### 8.1 Waiting

The page shows the participant's public display name, total points, and `Ждём следующий вопрос`. It polls a no-store state endpoint with visibility-aware backoff; version one does not require WebSockets or Supabase Realtime.

### 8.2 Open case

The page shows:

- case number and speaker;
- question;
- countdown calculated from the server deadline;
- textarea with a visible 300-character counter;
- concise scoring explanation;
- save/update action;
- connectivity and submission state.

The browser timer is advisory. The server accepts or rejects by its own timestamp. Repeated requests use an idempotency key, and the unique `(case_id, participant_id)` constraint preserves one current answer.

### 8.3 Submission result

A successful save confirms that the answer is recorded and provisionally worth 10 points if it remains valid at close. The participant may edit until the deadline. After closure, the saved answer becomes immutable to the participant.

### 8.4 Results

Before publication, the participant sees `Спикер выбирает лучшие решения`. After publication, the page shows podium answers, the participant's current score, and the cumulative leaderboard.

## 9. Answer Validity and Moderation

A submission qualifies for participation points when it:

- belongs to an eligible participant session;
- is the participant's current answer for the case;
- was last saved before the authoritative deadline;
- contains 30-300 visible characters after trimming;
- contains no control characters or invalid encoding;
- has not been manually invalidated as spam, abuse, or an accidental duplicate claim.

The server does not attempt to determine intellectual quality for participation points. Basic validation rejects empty or obviously malformed input. The operator may invalidate abuse with an audit reason before awards are published.

## 10. AI Shortlist

### 10.1 Model strategy

Primary model: `google/gemini-3-flash-preview`.  
Fallback model: `openai/gpt-5-mini`.

Both are accessed through OpenRouter with native `fetch`; no OpenRouter SDK or new dependency is required. The model IDs are configurable server-side so a benchmark result can change the primary model without a code deployment.

The live request uses:

- one batch containing all valid answers for the closed case;
- low reasoning effort;
- temperature near `0.1` where supported;
- strict JSON Schema structured output;
- provider parameter enforcement;
- throughput-oriented provider routing;
- a bounded request timeout;
- one automatic model fallback on provider/model failure;
- server-only `OPENROUTER_API_KEY`;
- provider `data_collection: deny` and `zdr: true` when compatible endpoints are available.

Before production, the organizer runs a representative Russian-language benchmark. If `zdr: true` removes every endpoint for a selected fallback, the application fails to manual mode rather than weakening the configured privacy requirement during the event.

### 10.2 Prompt inputs

The model receives only:

- question;
- speaker reference answer;
- approved evaluation guidance;
- optional context and key insight;
- shuffled anonymous answer records such as `{ id: "A017", text: "..." }`.

It never receives a name, email, phone, company, position, ticket number, internal ticket ID, or participant ID.

Answers are marked as untrusted quoted data. The system instruction says that text inside an answer cannot change the evaluation instructions, request secrets, or cause tool use.

### 10.3 Output

The strict response contains exactly 10 unique existing anonymous IDs when at least 10 valid answers exist, or every eligible ID when fewer exist. Each candidate has:

- anonymous answer ID;
- internal relevance score from 0 to 100;
- concise Russian-language rationale;
- approach cluster label;
- candidate type: `strong`, `alternative`, or `wildcard`.

The intended mix is eight strongest answers, one credible alternative approach, and one wildcard. The application validates the schema, ID membership, uniqueness, score bounds, and candidate count before persisting the shortlist.

### 10.4 Audit and failure handling

Each AI run stores model ID, provider-reported model, request hash, response payload, token/cost metadata when returned, latency, status, error category, and timestamps. It does not duplicate participant personal data in AI run records.

On timeout, provider error, invalid JSON, or invalid candidate IDs:

1. the configured fallback is attempted within the total stage budget;
2. if no valid shortlist exists, the case stays in `analyzing` with a visible operator error;
3. the operator may retry or enter manual shortlist mode;
4. participant submissions and participation points remain intact.

## 11. Shortlist and Awards

The operator shortlist screen shows 10 candidate cards with anonymous answer text, AI rationale, internal score, and approach label. The operator can:

- remove a candidate;
- search all valid answers and add a replacement;
- mark an answer invalid with a reason;
- project selected cards for the speaker;
- assign first, second, and third place.

The speaker's decision is recorded by the operator. Award publication is one atomic server operation that:

- validates three distinct eligible submissions;
- enforces one place per case;
- creates immutable award records;
- applies fixed bonus points;
- records the CRM actor and timestamp;
- advances the case state;
- updates what participant and projection endpoints return.

Corrections require a dedicated audited CRM action; records are not silently overwritten.

## 12. Leaderboard

The leaderboard is derived from valid submissions and published awards rather than stored as an independently editable total.

Ordering is:

1. total points descending;
2. first-place count descending;
3. total podium count descending;
4. unresolved ties share the same visible rank until the operator records a final event tie-break decision.

The participant endpoint returns the current participant's rank even when outside the visible top list. The projection displays at least the top 10 and visually emphasizes the top three only after final publication.

## 13. Data Model

All new tables include `environment = test | live`, timestamps, RLS, and service-role-only access. Exact SQL names are:

### 13.1 `case_lab_3_live_cases`

Question content, speaker reference answer, optional context, generated and approved rubric snapshots, state, deadline, version, and lifecycle timestamps.

### 13.2 `case_lab_3_live_participants`

One row per claimed ticket and environment: ticket/revision relation, normalized lookup snapshot, public display name, session token version, claim state, claim/reset timestamps, and operator metadata. Unique constraints prevent more than one active live participant per current ticket.

### 13.3 `case_lab_3_live_submissions`

Case, participant, final answer text, validity state/reason, content version, first/last submission timestamps, and participation points. Unique `(case_id, participant_id)`.

### 13.4 `case_lab_3_live_ai_runs`

Case, run number, model selection, anonymized request hash, validated structured response, usage/cost/latency metadata, status, and sanitized error fields.

### 13.5 `case_lab_3_live_shortlist_entries`

AI run, case, submission, initial AI order/score/rationale/type, operator inclusion state, operator reason, and final shortlist order.

### 13.6 `case_lab_3_live_awards`

Case, submission, place, fixed bonus points, CRM actor, decision timestamp, correction lineage, and reason. Constraints enforce distinct places and submissions for active awards.

### 13.7 `case_lab_3_live_tie_breaks`

Optional final-event tie resolution between tied participants, with ordered decision, actor, reason, and timestamp.

No personal data is copied from ticket revisions into submissions, AI runs, shortlist entries, awards, or leaderboard payloads. Full names are loaded server-side only where the operator needs them.

## 14. Server Boundaries and Routes

### 14.1 Participant routes

- `POST /api/case-lab-3/live/session`: claim by first/last name, with ticket number only for collision resolution.
- `DELETE /api/case-lab-3/live/session`: clear the current device session.
- `GET /api/case-lab-3/live/state`: current case, deadline, participant answer/score/rank, and public leaderboard snapshot.
- `PUT /api/case-lab-3/live/cases/:id/submission`: idempotent create/update before deadline.

All participant responses are no-store, bounded, schema-validated, rate-limited, and disclose no ticket lookup details that would enable name enumeration.

### 14.2 Public projection route

- `GET /api/case-lab-3/live/leaderboard`: sanitized event state and leaderboard only.

### 14.3 CRM routes

- case creation/update and rubric generation;
- ready/open/close state transitions;
- submission count and moderated answer list;
- AI analysis start/retry/status;
- shortlist override;
- award preview/publication/correction;
- participant claim lookup/reset;
- final tie-break resolution.

Every mutation requires the existing CRM administrator session, CSRF token, and idempotency key. Public and participant routes never expose the OpenRouter key or service-role client.

## 15. Security and Privacy

- `OPENROUTER_API_KEY` and model settings are server-only environment values. `.env.example` documents names without secrets.
- The OpenRouter call runs only in a Node.js server boundary.
- Ticket matching is rate-limited by a purpose-bound hash of client IP plus normalized name, never a raw IP log.
- Session cookies are HttpOnly, Secure, SameSite=Lax, signed, versioned, and bounded to the event duration.
- Participant errors use generic copy for no match, duplicate claim, and ineligible ticket to limit enumeration.
- AI output is untrusted input: it is schema-validated and cannot directly write points or awards.
- RLS remains enabled; anon/authenticated roles receive no direct table grants.
- Ordinary logs contain no answer text, full names, ticket numbers, emails, phone numbers, secrets, or complete AI prompts.
- The public leaderboard contains only approved display labels and points.

## 16. Performance and Reliability

- Participant and leaderboard pages use short no-store polling with increasing intervals while no case is active and faster polling during transitions.
- Submissions are normal synchronous writes; AI processing never blocks answer submission.
- The operator starts analysis only after closure. Approximately 80 answers of at most 300 characters fit comfortably in one model context.
- The live analysis target is a valid shortlist within 30 seconds. The UI shows elapsed time and never promises an exact completion second.
- The system remains operable without AI through manual shortlist mode.
- Duplicate requests, double operator clicks, late submissions, and concurrent award publication are rejected or made idempotent by database constraints and expected-state checks.
- A pre-event dry run uses at least 80 synthetic Russian answers and records p50/p95 duration, schema success, shortlist diversity, estimated cost, and fallback behavior.
- Because OpenRouter documents extra credit checks at low balances, the event runbook requires a healthy balance rather than relying on only the estimated request cost.

## 17. Accessibility and UI Constraints

- Reuse the Case Lab III visual language and existing typography/tokens.
- Mobile participant interaction is operable with a keyboard and screen reader.
- The textarea has a persistent label, described character limit, error association, and visible focus.
- Countdown changes do not announce every second to assistive technology; only meaningful state transitions use a polite live region.
- Reduced-motion preferences disable nonessential leaderboard and result animations.
- Color is never the only indicator for submission, rank, error, or case state.
- Operator dialogs, if used, preserve focus containment, Escape handling, focus restoration, background inertness, and scroll locking.

## 18. Observability and Event Runbook

The operator dashboard exposes:

- current state and state version;
- submission and valid-answer counts;
- duplicate/ambiguous participant claims;
- AI model, status, elapsed time, validated candidate count, and retry/manual controls;
- unpublished and published awards;
- OpenRouter cost/usage metadata when available.

The event runbook includes:

- OpenRouter balance and API-key health check;
- one full test-environment rehearsal;
- browser/device test for participant, operator, and projection views;
- manual-shortlist rehearsal;
- operator instructions for ambiguous names, duplicate claims, invalid answers, AI timeout, award correction, and final tie resolution.

## 19. Verification

Implementation verification must include:

- database tests for constraints, RLS, state transitions, one answer per participant/case, awards, derived points, and tie ordering;
- unit tests for name normalization, public display labels, validation, session signing, anonymization, AI schema validation, and leaderboard calculation;
- route tests for authorization, CSRF, rate limiting, body bounds, deadline enforcement, idempotency, and sanitized responses;
- mocked OpenRouter tests for valid output, timeout, HTTP failure, malformed JSON, duplicate/unknown IDs, fewer than 10 answers, and fallback/manual mode;
- component tests where existing tooling supports them;
- `npx tsc --noEmit --incremental false`;
- relevant Case Lab III tests;
- `npm run lint`;
- `npm run build`;
- `git diff --check`;
- a test-environment database run;
- a non-production OpenRouter benchmark with 80 synthetic Russian answers.

Browser-based visual verification is not part of automated implementation verification unless explicitly requested; final UI visual review remains with the user.

## 20. Implementation Sequence

1. Add migration, database tests, and generated/hand-maintained database types.
2. Add live-domain validation, session, repository, scoring, and leaderboard modules.
3. Add participant session and submission APIs.
4. Add the mobile participant page.
5. Add CRM case preparation and state controls.
6. Add the server-only OpenRouter client, rubric generation, shortlist analysis, validation, and fallbacks.
7. Add shortlist override, award publication/correction, and operator participant resolution.
8. Add projection leaderboard and final tie handling.
9. Complete static, database, API, failure-mode, performance, and test-environment verification.

## 21. Explicit Non-goals for Version One

- AI directly awarding prize points.
- Audience voting or reactions.
- A separate speaker account or speaker mobile application.
- WebSockets, Supabase Realtime, or a new queue dependency.
- Public display of full surnames, ticket numbers, companies, positions, emails, or phones.
- Automatic fuzzy-name authentication.
- Multiple simultaneous open cases.
- Post-event social profiles, chat, comments, or answer editing after case closure.

## 22. External References

- OpenRouter Gemini 3 Flash Preview model page: <https://openrouter.ai/google/gemini-3-flash-preview/>
- OpenRouter GPT-5 Mini model page: <https://openrouter.ai/openai/gpt-5-mini/apps>
- OpenRouter structured outputs: <https://openrouter.ai/docs/guides/features/structured-outputs>
- OpenRouter model fallbacks: <https://openrouter.ai/docs/guides/routing/model-fallbacks>
- OpenRouter privacy controls: <https://openrouter.ai/docs/guides/get-started/sovereign-ai>
- OpenRouter latency guidance: <https://openrouter.ai/docs/features/latency-and-performance>
