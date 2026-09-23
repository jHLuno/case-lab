# Case Lab III Live Rounds Design

## Goal

Extend the Case Lab III live interaction so each case can contain one to three sequential questions. Each question is a three-minute live round with automatic answer submission, an AI shortlist of the five strongest answers, speaker-selected top three awards, and a cumulative leaderboard for the whole Case Lab III event.

## Scope

- The feature runs only in the `live` environment.
- The leaderboard aggregates participation and award points across all questions and all three cases of Case Lab III.
- Scores do not carry into other events.
- Payment, ticket issuance, fiscal receipts, email delivery, and order flows remain unchanged.
- The current fixed award values remain authoritative: 50 points for first place, 35 for second, and 25 for third.

## Participant flow

1. The operator prepares one to three questions for a case before the event.
2. The operator opens one question round. Only one round may be active at a time.
3. The server stores the round deadline as the source of truth: `opensAt + 180 seconds`.
4. Every participant sees the same question and a countdown derived from the server deadline.
5. Before the deadline, a participant may submit a manual answer. The existing 30–300 character rule remains for manual submission.
6. At the deadline, the open page automatically submits the participant's current non-empty text. Timeout submissions accept 1–300 characters and receive 10 participation points.
7. The server rejects late writes after the deadline and never trusts a client-provided timer.
8. After the round closes, the system starts AI analysis and produces at most five shortlist candidates.
9. The speaker selects three distinct candidates from that round's shortlist.
10. The operator publishes the top three. The participant receives 10 participation points plus the award bonus for that round, and all public/operator leaderboards refresh from the database projection.
11. The operator starts the next question in the same case, then proceeds to the next case after all questions are awarded.

## Operator flow

- Case preparation displays a repeatable question editor with one to three question cards.
- Each question stores its own prompt, speaker reference answer, optional context, optional key insight, generated rubric, approved rubric, state, deadline, AI runs, shortlist, and awards.
- The operator view clearly identifies each shortlist answer with the participant's public name (`Имя Ф.`), answer text, AI score, and AI rationale.
- Award controls are scoped to the active question and require three different shortlist submissions.
- Publishing is idempotent and protected by the existing CRM authentication, CSRF, origin, idempotency-key, and optimistic state-version checks.

## Data model

- Add a live question/round table keyed by case and question number, with an environment-aware unique key and the same lifecycle currently used by live cases.
- Backfill one question row from each existing live case so existing data remains readable.
- Associate submissions, AI runs, shortlist entries, and awards with the question/round while retaining case and environment foreign-key boundaries.
- Enforce one participant submission per question, one active shortlist entry per submission/question, and one active award per place/submission/question.
- Keep leaderboard aggregation scoped to `environment = live` and sum all valid submissions and active awards across every Case Lab III question.

## Automatic analysis

- Closing a round must enqueue or otherwise trigger one idempotent AI-analysis job for that question.
- Repeated timer polls, browser retries, or operator refreshes must not create duplicate AI runs or duplicate awards.
- If the provider fails, the round remains available to the existing manual shortlist mode; the operator can promote candidates manually and still publish the top three.
- The AI request must retain the current private strict-schema validation and must cap the returned shortlist at five candidates.

## Error and edge-case behavior

- An empty answer at timeout is not stored and receives no participation points.
- A short non-empty timeout answer is valid for participation but is not used as an invalid AI candidate solely because it is short.
- A participant who submits before the deadline cannot receive a second participation award for editing; updates keep the round's single 10-point participation value.
- A stale operator state version returns a conflict and reloads the snapshot.
- A case cannot open its next question until the current question has reached the awarded/closed workflow required by the operator UI.
- Public responses expose only the public display name, points, rank, and awarded answers; ticket numbers, full surnames, submission IDs, and AI rationale remain private to CRM.

## Verification

- Unit tests cover timeout answer validation, the five-candidate AI cap, cumulative scoring across questions and cases, and fixed award values.
- Route tests cover authorization, deadline enforcement, idempotent timeout submission, question transitions, AI failure/manual mode, shortlist validation, and award publication.
- Database tests cover the new question relations, constraints, RLS, one-submission-per-question behavior, and cumulative live leaderboard aggregation.
- TypeScript, the Case Lab live test suite, the payment regression suite, and the production build must pass before deployment.
