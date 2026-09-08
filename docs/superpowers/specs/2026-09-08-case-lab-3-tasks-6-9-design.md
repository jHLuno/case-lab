# Case Lab III Tasks 6-9 Design

## Goal

Finish the server configuration/legal acceptance, public order APIs, shared checkout integration, and TipTop Pay adapter required for a non-production test payment. Production and live payment behavior remain disabled.

## Boundaries

- Test and live credentials are read only from server-side environment configuration.
- No provider secret, terminal secret, seller credential, SMTP credential, or token is hardcoded in application code, fixtures used by deployed code, or committed environment files.
- Synthetic HMAC fixtures may contain a clearly fake secret and fake provider payloads for deterministic unit and contract tests only.
- Existing database migrations and pgTAP behavior for Tasks 3-5 remain the source of truth for durable transitions.
- No linked-project reset is allowed.

## Architecture

Task 6/6A keeps configuration, legal snapshots, and activation gates server-side. Task 7 exposes thin, authenticated route wrappers around the existing service-role RPCs and validates every public response before returning it. Task 8 keeps the checkout UI as a narrow client island: the browser creates an order, requests a payment attempt, loads the provider widget, and only starts server verification after the provider callback; it never authorizes payment state.

Task 9 adds a server-only TipTop adapter. Webhook routes read and authenticate the raw request body before parsing, select the secret from the route environment, parse only the documented fields, call one durable transition RPC, and return the provider response code only after persistence. Refund/query methods use Basic Auth, bounded timeouts, request IDs, and no payload logging.

## Data Flow

1. The Case Lab page receives a CSP nonce and server-rendered availability.
2. A CTA opens the shared checkout dialog.
3. The server creates an order using an idempotency key and authoritative inventory/legal state.
4. The server creates or reuses a payment attempt and returns only safe widget parameters.
5. The client loads the nonced TipTop widget and receives no authority from its browser callback.
6. TipTop calls the environment-specific signed Check/Pay/Fail/Refund route.
7. The route verifies the raw HMAC, validates the parsed payload, calls the corresponding database RPC, and returns the exact provider code mapping.
8. The client polls the server status endpoint and renders paid/review/failed outcomes from server state.

## Error Handling

- Invalid environment, content type, body size, origin, signature, form payload, amount, currency, TestMode, or identifier is rejected before any state-transition RPC.
- Provider callback failures never expose stack traces, secrets, raw bodies, card data, or unnecessary personal data.
- Duplicate callbacks remain durable and replay-safe through the existing RPCs.
- Unknown or contradictory provider outcomes remain reviewable incidents rather than being silently accepted.
- Configuration failures are generic to public clients; detailed diagnostics stay server-side and are not logged with personal data.

## Acceptance

- Task 6/6A config/legal tests pass, `.env.example` contains no credential-like values, test activation is isolated from live, and legal snapshots are explicit about their source and revision.
- Task 7 route tests cover no-store responses, exact origin and body guards, idempotency, changed-offer behavior, sessions, bearer exchange, safe responses, and runtime response validation.
- Task 8 tests cover all CTA sources, dialog semantics, focus restoration, Escape, inertness, scroll locking, reduced motion, nonce propagation, widget retry, and server verification states.
- Task 9 tests use independently pinned synthetic HMAC fixtures and cover all four callback routes, duplicate/reordered callbacks, malformed payloads, environment separation, provider codes, refund idempotency, and bounded Basic Auth methods.
- A real non-production payment is attempted only after the code acceptance passes and a separate TipTop test terminal, secrets, HTTPS callbacks, and `CASE_LAB_3_PAYMENT_MODE=test` are configured outside the repository.

## Verification Limits

- Browser/device acceptance, real provider callbacks, external credentials, and multi-session concurrency are separate acceptance activities.
- Live credentials, live callbacks, production sales, and linked-project reset are out of scope.
