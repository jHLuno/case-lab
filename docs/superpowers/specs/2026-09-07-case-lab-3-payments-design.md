# Case Lab III: TipTop Pay, Kassir, Tickets, and Check-in Design

Date: 7 September 2026  
Status: approved; implementation paused pending user instruction  
Target: `https://caselab.kz/case-lab-3/`

## 1. Goal

Build a server-authoritative ticket sale flow for Case Lab III. In the normal flow, a successful purchase must admit one payment attempt and produce one valid ticket with a QR code and PDF, a durable ticket-email delivery, and the required fiscal receipt or receipts through Kassir. The organizer must be able to inspect and operate orders, refunds, receipts, email delivery, inventory, incidents, and event check-in from the existing CRM.

The system must remain correct when the buyer closes the browser, webhooks are duplicated or reordered, provider calls time out, or a serverless function restarts.

## 2. Confirmed Business Decisions

- Event: Case Lab III.
- Event time: 24 September 2026, 10:00-14:00, `Asia/Almaty`.
- Venue: Narxoz Business School, Almaty, Zhandosova 55/10.
- Public sales remain available through 23 September 2026 at 23:59 in `Asia/Almaty` and close at the exclusive instant `2026-09-24 00:00:00 Asia/Almaty`.
- Physical venue capacity: 100 attendees.
- Initial online sales limit: 70 tickets.
- The organizer may raise the sales limit in CRM up to 100.
- Early Bird: 20 tickets at 7,890 KZT.
- Standard: all subsequent tickets at 15,000 KZT.
- Initial consumed inventory is zero. If this changes before launch, existing paid, invited, or reserved places must be imported before sales are enabled.
- One public order purchases one ticket for one attendee.
- Repeat purchases using the same email are allowed as separate orders.
- Full confirmed refunds return one place to Standard availability but do not restore Early Bird quota.
- Partial refunds leave the ticket valid unless the organizer cancels it separately.
- Seller: IP Case Lab.
- Taxation system: general established regime, Kassir code `0`.
- VAT: not subject to VAT, represented as omitted or `null`, never as `0`.
- Receipt labels:
  - `Участие в Case Lab III, 24.09.2026, Early Bird`
  - `Участие в Case Lab III, 24.09.2026, Стандарт`
- The planned fiscal model is one `Income` receipt immediately after confirmed payment and one `IncomeReturn` for each confirmed refund. Before live sales, an accountant must confirm whether payment before the event is treated as advance payment and requires an additional settlement receipt after service delivery. Live sales remain fail-closed until this decision is recorded in configuration.
- Legal documents: existing `/offer/` and `/privacy/` pages.
- Ticket delivery: protected web page, PDF attachment, and email from `hello@caselab.kz`.
- Email transport: `smtp.mail.ru`, port `465`, TLS.
- Check-in: QR scanning through a protected mobile web page in `/crm`, with manual entry as fallback.
- Administrator count for version one: one.
- Analytics: GA4, including server-confirmed purchase and refund events.
- Hosting: Vercel Hobby with Supabase Postgres and Supabase Cron/`pg_net`.
- Public payment method in version one: card. Wallets, installment, recurrent payment, tokenization, corporate orders, and promo codes are excluded.
- Mail delivery is at least once. Application idempotency suppresses normal duplicates, but SMTP cannot prove whether Mail.ru accepted a message when the connection fails after submission.

## 3. System Boundaries

### 3.1 Next.js on Vercel

Next.js renders the landing page, checkout dialog, protected order result page, CRM order screens, and mobile check-in screen. App Router Route Handlers expose the public order API, provider webhooks, admin operations, and a protected worker endpoint.

Vercel functions do not hold authoritative state between requests. No payment, receipt, ticket, email, or inventory state may live only in process memory, browser storage, or an unawaited background promise.

### 3.2 Supabase Postgres

Supabase Postgres is the sole source of truth. Atomic SQL functions own inventory allocation and state transitions. The Next.js server calls these functions with the existing service-role credential. New payment tables have RLS enabled and no anonymous access policies.

### 3.3 Durable Worker

A Postgres-backed jobs table stores all asynchronous work. Supabase Cron invokes a protected Vercel route every minute through `pg_net`. The worker claims a small batch with leases and `FOR UPDATE SKIP LOCKED`, performs bounded external calls, and persists the result before returning.

The same worker performs daily provider reconciliation. Vercel Cron is not required.

### 3.4 External Providers

- TipTop Pay widget handles card entry in the browser.
- TipTop Pay webhooks are the authority for payment state.
- TipTop Pay server API handles refunds and transaction reconciliation.
- Kassir server API handles income and income-return receipts.
- Kassir sends the fiscal receipt email.
- Case Lab sends the ticket email through Mail.ru SMTP.
- GA4 receives client funnel events and idempotent server-side purchase/refund events.

## 4. Environment Separation

Every order-side entity includes `environment = test | live`. Test and live callbacks use different URLs and secrets, for example:

- `/api/tiptoppay/test/check`
- `/api/tiptoppay/live/check`
- `/api/kassir/test/receipt`
- `/api/kassir/live/receipt`

Preview deployments create test orders only. Test payments do not consume live inventory, create live tickets, call the live KKT, or emit live GA4 purchase events. A documented test/live discriminator from the provider and the configured callback environment must agree where the provider includes `TestMode`.

The `Refund` and Kassir `Receipt` payloads do not document `TestMode`; their environment is established by callback URL and matched provider records.

Both environment rows start with `sales_enabled = false`. After the test fiscal policy and test offer/privacy versions exist and pass their configuration checks, a dedicated migration enables only the `test` row. The `live` row remains disabled until the controlled live-acceptance sequence. Missing provider credentials may still make the test API return `configuration_incomplete`; this database switch alone never enables live sales.

## 5. Data Model

Exact SQL names may be shortened during implementation, but the following independent records and constraints are required.

### 5.1 Event Settings

`case_lab_3_event_settings` stores one row per environment:

- Early Bird and Standard amounts in minor units: `789000` and `1500000`.
- Early Bird quota: `20`.
- Current sales limit: initially `70`.
- Hard venue limit: `100`.
- Exclusive sales cutoff `2026-09-24 00:00:00 Asia/Almaty`, stored as `timestamptz` and compared with `now() < cutoff`.
- Manual `sales_enabled` switch, false by default.
- Non-secret fiscal snapshot defaults: seller label, taxation system, VAT, receipt labels, and calculation place.
- Active accountant-approved fiscal policy version.
- Monotonic configuration version and update timestamp.

`case_lab_3_fiscal_policy_versions` stores an immutable, versioned sequence of required fiscal purposes such as `payment_income`, optional `service_settlement_income`, and `refund_income_return`. Each stage defines its trigger, dependency on an earlier receipt, provider receipt type, item/payload field policy including any accountant-required calculation-method values, and scheduling rule. The version also stores accountant approval timestamp, approver label, and policy hash. Database constraints prevent negative values, sales limit above venue capacity, or live sales activation without a complete active policy that has explicit accountant approval. Activation also rejects any policy purpose or payload field that the deployed application does not explicitly support and test.

`case_lab_3_inventory_allocations` stores imported paid, invited, and organizer-reserved places that are not represented by a public online payment. Active allocations include quantity, category, tier when applicable, whether they count toward the online sales limit, whether they temporarily occupy Early Bird quota, optional participant/ticket relation, reason, actor, and timestamps. Releasing an allocation is an audited action. A ticket cancellation by itself does not free a paid seat; only a confirmed full refund or explicit release of a non-payment allocation does.

`case_lab_3_legal_document_versions` stores immutable offer/privacy version records containing URL, publication label, full accepted text snapshot, SHA-256 content hash, and activation timestamp. Orders reference these records rather than only a mutable page URL.

### 5.2 Orders

`case_lab_3_orders` stores:

- Random internal UUID and human-readable public number.
- Environment and one-ticket order type.
- Current participant first name, last name, ticket email, optional phone, optional company, and optional position.
- Immutable purchaser/fiscal email and original contact snapshot captured at payment time.
- Tier, amount, currency, receipt label, taxation system, VAT, and configuration version snapshots.
- Offer/privacy versions, acceptance timestamp, and optional marketing consent.
- UTM fields, referrer, and non-PII GA client ID when available.
- Payment, ticket, receipt, and email summary statuses.
- Paid, refunded, and refundable amounts in minor units.
- Order access/session token version and revocation state.
- Created, updated, paid, refunded, and expiration timestamps.

The browser-supplied amount is never authoritative. Mutable event settings never rewrite a completed order snapshot.

### 5.3 Reservations

`case_lab_3_reservations` stores the order, tier, expiration, state, and currently admitted payment attempt. States are `active`, `processing`, `consumed`, `expired`, and `released`.

An `active` reservation expires after 15 minutes. Once an admitted TipTop Pay `Check` moves it to `processing`, the ordinary timer cannot release it. A processing reservation is released only after a confirmed final failure or provider reconciliation.

### 5.4 Payment Attempts and Provider Events

`case_lab_3_payment_attempts` stores a unique server-generated `externalId`, order, expected amount/currency/environment, provider transaction ID, status, reason fields, and timestamps.

Attempt states are `created`, `check_approved`, `completed`, `failed`, and `review_required`.

There is no separate `unknown` payment-attempt state. When a provider call or reconciliation cannot determine the authoritative result, the system atomically moves both the payment attempt and the order payment status to `review_required`, keeps the reservation in `processing`, and blocks buyer retry. Reconciliation may later move them to `completed`/`paid` or `failed`; otherwise they remain `review_required` for operator resolution.

`case_lab_3_provider_events` stores webhook type, environment, provider identifiers, body hash, verified timestamp, a sanitized field snapshot, processing result, and incident link. Raw webhook bodies and personal/card data are not written to ordinary logs.

Business idempotency is enforced by payment attempt and provider transaction constraints, not only by delivery-body equality.

### 5.5 Fiscal Operations

`case_lab_3_fiscal_operations` stores every operation required by the active fiscal policy. The base policy creates one payment `Income` and one `IncomeReturn` for each confirmed refund; an accountant-approved settlement stage adds another separately keyed operation:

- Order/payment/refund relation.
- Environment, fiscal-policy version/purpose, provider receipt type, and amount.
- Immutable receipt payload snapshot and request hash.
- Permanent application operation key used as `X-Request-ID`.
- Kassir receipt ID, state, URL, and fiscal fields.
- Attempt count, next attempt, last error, and timestamps.

States are `not_requested`, `queued`, `issued`, `error`, and `unknown`.

### 5.6 Tickets and Check-in

`case_lab_3_tickets` has a unique order relation, unique indexed public ticket number, current revision, state, and timestamps. States are `valid`, `used`, and `cancelled`.

`case_lab_3_ticket_revisions` stores immutable participant presentation data, token version, creation reason, and timestamp. The current revision is used for QR, HTML, PDF, email, and manual check-in; old revisions remain for audit but cannot be admitted.

Order-access and ticket credentials are deterministic HMAC-SHA256 values derived from the entity ID, a purpose label, token version, and a server-only secret. The database stores the identifier and version, never a clear token. The server can reproduce current credentials for links, email, and PDF generation. Incrementing the version revokes previous credentials.

The exact QR payload is `cl3:<ticket_uuid>:<revision_number>:<token>`. The canonical HMAC input is the UTF-8 byte sequence `ticket-qr\0<lowercase-canonical-ticket-uuid>\0<base-10-revision-number>` and `token` is its 32-byte HMAC-SHA256 encoded as 43-character unpadded base64url. The parser accepts only the `cl3` prefix, canonical UUID, positive decimal revision without leading zeroes, and base64url token within a bounded body. It looks up the indexed ticket UUID, requires the supplied revision to equal the current revision, derives the expected token, and compares equal-length bytes with `timingSafeEqual` before calling the check-in transaction. The QR contains no personal data.

The manual fallback is explicitly a pair of fields: the public ticket number and a ten-character uppercase RFC 4648 base32 code without padding. The code is the first ten characters of the HMAC-SHA256 over UTF-8 `ticket-manual-code\0<lowercase-canonical-ticket-uuid>\0<base-10-revision-number>`. The server uses the unique indexed ticket number to load the current ticket revision, normalizes the code by removing ASCII spaces/hyphens and uppercasing it, then performs constant-time comparison. The public ticket number alone never admits a participant. Transfer increments the revision and invalidates both old credentials without requiring searchable clear-token storage.

`case_lab_3_check_ins` records the first successful use, administrator identity, and timestamp. A unique ticket constraint makes concurrent duplicate scans safe.

### 5.7 Refunds, Jobs, Deliveries, Analytics, Audit, and Incidents

- `case_lab_3_refunds`: each requested/confirmed full or partial provider refund and remaining balance.
- `case_lab_3_jobs`: durable outbox with job type, payload reference, attempts, lease, schedule, result, and error.
- `case_lab_3_email_deliveries`: ticket/admin email operation key, transport result, provider response identifier, and retries.
- `case_lab_3_analytics_events`: unique order/refund event keys and GA4 delivery result.
- `case_lab_3_audit_log`: admin action, target, before/after summary, actor, and timestamp.
- `case_lab_3_incidents`: unexpected payment, unknown provider result, overdue receipt/email, reconciliation mismatch, and resolution.
- `case_lab_3_rate_limits`: database-backed fixed-window request buckets keyed by scope, time bucket, and a purpose-bound server HMAC of client IP, not raw IP.
- `case_lab_3_reconciliation_state`: durable provider high-water mark, pagination cursor, run/error timestamps, and environment.

The event settings row stores the latest worker heartbeat timestamp for each environment.

## 6. Inventory Algorithm

Availability and reservation creation run in one database transaction while locking the event settings row.

1. Expire eligible `active` reservations.
2. Count public online payments/reservations plus imported allocations marked as online-sale consumption against the adjustable sales limit.
3. Separately count every occupied seat, including invitations and organizer reservations, against physical capacity 100.
4. Reject if sales are disabled, accountant-approved fiscal policy is missing, cutoff has passed, the online sales limit is reached, or physical capacity is reached.
5. Count all historically confirmed online/imported Early Bird sales. A later refund does not decrement this count.
6. If confirmed Early Bird sales are below 20, offer Early Bird only when its remaining quota is not occupied by active online reservations or manual allocations explicitly marked as holding Early Bird quota. Invitations without a paid Early Bird tier do not consume its quota.
7. If temporary reservations occupy every remaining Early Bird place, report `early_bird_temporarily_reserved`; do not silently offer Standard.
8. Activate Standard only after 20 Early Bird sales are confirmed.
9. Create the order and reservation atomically, returning the server amount and expiration.

Raising the sales limit in CRM affects future availability only and is constrained to `70..100`. Lowering below already committed seats is rejected.

## 7. Public Checkout UX

All purchase CTAs open one shared checkout dialog. The dialog preserves the current Case Lab visual language and includes proper dialog semantics, focus containment, initial focus, Escape handling, focus restoration, background inertness, and scroll locking.

The form displays event, one ticket, current tier, and exact total before payment. Required fields are first name, last name, and valid email. Phone, company, and position are optional. Copy next to email states: `На этот email отправим билет и фискальный чек`.

Offer/privacy acceptance is required and records document versions and time. Marketing consent is separate, optional, and unchecked.

The UI handles:

- availability loading;
- form validation;
- order creation;
- changed-price reconfirmation;
- active reservation and countdown;
- widget script loading and retry;
- payment in progress;
- server verification;
- paid;
- failed attempt and explicit retry;
- expired reservation;
- temporary Early Bird reservation exhaustion;
- sold out;
- sales closed;
- `review_required` with `Не оплачивайте повторно` and support contact.

Repeated clicks are blocked while the request is active. The browser keeps no authoritative order registry in localStorage.

## 8. Public and Internal HTTP Routes

### 8.1 Buyer Routes

- `GET /api/case-lab-3/availability`: current public offer and reasoned availability, no personal data, no caching.
- `POST /api/case-lab-3/orders`: validated participant, consents, expected offer, attribution, and `Idempotency-Key`; creates one order/reservation.
- `POST /api/case-lab-3/orders/:id/payment-attempts`: protected by order session; creates a new attempt only when safe.
- `GET /api/case-lab-3/orders/:id/status`: protected by order session; returns payment, ticket, receipt, and email states.
- `GET /api/case-lab-3/orders/:id/ticket.pdf`: deterministic PDF download authorized by purchaser order session or current participant ticket session.
- `/case-lab-3/order/:id`: protected result page.
- `/case-lab-3/ticket/:number`: protected participant ticket-only page.

Order creation returns `409` with the new offer when the expected tier or amount changed. It does not create an order until the buyer confirms the new price.

The purchaser and participant have separate access boundaries. The purchaser receives an HttpOnly, Secure, SameSite order session scoped to one order and its current order-session version; it exposes payment, refund, fiscal, email, and ticket state. The participant receives a ticket-only session tied to the current ticket revision; it exposes only event/ticket data and PDF. Emailed bearer tokens are purpose-bound HMAC values, exchanged for the corresponding cookie, and removed from the visible URL by redirect. The public order/ticket number alone grants no access.

Participant transfer creates a new immutable ticket revision and rotates only ticket-page, QR, and manual check-in credentials. It produces a revised PDF and sends ticket-only access to the new ticket email. Purchaser order access and immutable payment/fiscal contact snapshots remain unchanged.

### 8.2 Provider Routes

- `POST /api/tiptoppay/:environment/check`
- `POST /api/tiptoppay/:environment/pay`
- `POST /api/tiptoppay/:environment/fail`
- `POST /api/tiptoppay/:environment/refund`
- `POST /api/kassir/:environment/receipt`

Only configured POST callbacks are accepted. Each handler reads the original body before parsing, validates size/content type, and verifies the signature variant proven by real test callbacks. Raw-body `Content-HMAC` is preferred because it has an unambiguous byte representation. If a configured endpoint supplies only `X-Content-HMAC`, its decoded canonicalization must first be captured and covered by fixtures for Cyrillic, spaces, plus signs, percent encoding, and duplicate parameters. The handler parses the form body only after signature verification and performs one atomic database transition.

### 8.3 Admin and Worker Routes

- Order list/detail and CSV export under `/api/admin/case-lab-3/orders`.
- Refund, resend, participant transfer, ticket cancellation, settings, and check-in actions under `/api/admin/case-lab-3/`.
- `POST /api/internal/case-lab-3/jobs` for Supabase Cron, protected by a dedicated bearer secret.

## 9. TipTop Pay Widget and Payment State

The widget script is loaded from `https://widget.tiptoppay.kz/bundles/widget.js` only when checkout needs it. It is not bundled or self-hosted.

The server returns widget parameters for a pre-created attempt:

- `publicTerminalId` for the selected environment;
- `amount` converted from minor units at the API boundary;
- `currency: KZT`;
- `paymentSchema: Single`;
- unique attempt `externalId`;
- opaque order `accountId` in `userInfo`;
- participant name/email/optional phone;
- `receiptEmail`;
- `emailBehavior: Hidden`;
- `tokenize: false`;
- no recurrent settings;
- no receipt object;
- `retryPayment: false`.

Card-only availability is confirmed in the provider account. Optional methods are not assumed to be disabled merely because the client requests a restriction.

The widget callback controls only the screen. Success, failure, cancel, or close always leads to server status polling. Fulfilment requires a verified `Pay` notification.

### 9.1 Check

The `Check` transition verifies known attempt, `InvoiceId/externalId`, opaque `AccountId`, environment/TestMode, amount, `KZT`, order state, reservation state, and cutoff rules. Repetition of the same Check returns the same decision. A competing attempt for a processing order is rejected.

Accepted Check returns `{"code":0}`. Rejections use documented codes `10`, `11`, `12`, `13`, or `20`. If the database is unavailable, payment is not admitted.

### 9.2 Pay

After HMAC verification, successful automatic fulfilment requires `Status: Completed`, `OperationType: Payment`, expected environment/TestMode, amount, currency, order, and attempt.

One database transaction records the payment, consumes the reservation, updates the order, creates the ticket, and inserts fiscal/email/analytics jobs. The webhook returns `{"code":0}` only after durable persistence.

A valid webhook carrying real money but an unknown order, unexpected amount, or second capture is persisted as an incident and marked for review. It does not issue another ticket automatically. CRM offers controlled incident resolution: link a verified payment to the intended order when safe, issue the legally required fiscal operation for the actual movement, or initiate a refund. Capacity and ticket issuance are rechecked atomically before a payment can be attached.

No new attempt is created while any earlier attempt is `check_approved` or `review_required`. An unknown provider result uses the explicit `review_required` transition defined in section 5.4 and is reconciled first. This prevents normal retry races, while still treating a provider-side duplicate capture as a real-money incident requiring a controlled refund.

### 9.3 Fail

Fail atomically marks the matching attempt failed only when no later authoritative state prevents it. A late Fail never changes a paid order to failed. A confirmed failure releases `processing`; if the original 15-minute deadline remains, the reservation becomes `active`, otherwise it expires. A cancelled widget with no Fail keeps a `created` attempt and active reservation until expiry; a `check_approved` attempt is reconciled before any retry. Since widget retry is disabled, a safe buyer retry creates a new server attempt. If the original tariff can no longer be reserved, the buyer receives a changed-offer response and must create/confirm a new order.

### 9.4 Refund

`TransactionId` identifies the refund and `PaymentTransactionId` identifies the original payment. Each refund transaction is unique. Confirmed provider state updates refunded totals and creates one dependent income-return fiscal operation.

TipTop Pay API idempotency uses the same application refund operation key in `X-Request-ID` and documents a one-hour retention window. Within that window an uncertain call may repeat with the same key. After that window, the worker must query the original payment and related refund operations before deciding whether another call is safe. It never blindly repeats an old uncertain refund.

## 10. Kassir Fiscal Flow

Only the server calls `POST https://api.tiptoppay.kz/kkt/receipt`. Automatic receipt creation in the widget/provider account must be disabled to avoid duplicates.

The current design assumes one `Income` receipt at confirmed payment. Live payment admission remains disabled until an accountant records whether this pre-event payment is an advance and whether a separate settlement receipt is required after 24 September. If another fiscal stage is required, its approved policy defines a separate trigger, payload-field set, receipt dependency, fiscal operation, and job; the original receipt is never reused or overwritten. Live activation fails if the selected policy contains a stage or field not implemented and covered by contract tests.

Income receipt payload:

- `Inn`: configured seller IIN/BIN.
- `Type: Income`.
- `InvoiceId`: order public/internal reference.
- `AccountId`: opaque order reference, not email.
- one immutable item using the approved tier label.
- `Price`, `Amount`, and `Amounts.Electronic`: actual paid amount converted at the API boundary.
- `Quantity: 1`.
- `Vat`: omitted or `null`.
- `TaxationSystem: 0`.
- `Email`: buyer email for Kassir delivery.
- `CalculationPlace: caselab.kz`.
- cash amount zero.

`Success:true`, `Message:"Queued"`, and `Model.Id` mean queued, not issued. Issuance is confirmed by Receipt or by status `Processed` followed by receipt detail retrieval.

The application operation key remains constant across retries and is sent as `X-Request-ID`. Kassir retains idempotency for one hour. Within that window an uncertain request repeats with the same key. If the window expires without a known Kassir ID or result, the operation becomes `unknown`; the system reconciles instead of blindly creating another receipt.

Receipt webhooks may arrive before the worker stores its create response. They are persisted and matched again using Kassir ID, environment, order, type, and amount.

An `IncomeReturn` is created only after a confirmed monetary refund. It uses the original immutable tax/item snapshot and actual refund amount. For a partial refund of this one-item order, `Quantity` remains `1`, while item `Price`, item `Amount`, and `Amounts.Electronic` all equal the actual partial refund amount. When available, it references the original issued receipt through `TinyUrlRefundTarget`. If the original receipt is still pending, the return receipt waits on that dependency.

## 11. Ticket, PDF, and Email

Payment confirmation creates the ticket independently from Kassir and SMTP. The protected order page exposes the ticket immediately even if the receipt or email is delayed.

The ticket contains event name, participant, ticket number, date, time, venue, support email, state, and QR. The QR uses the exact `cl3:<ticket_uuid>:<revision_number>:<token>` contract from section 5.6. The visible manual fallback prints the public ticket number beside its current ten-character code.

The PDF is generated deterministically on the server from the immutable order/ticket snapshot. It embeds an existing Case Lab Cyrillic font and the same QR. It is attached to the email and regenerated by the protected download route when requested; no public object-storage URL is required.

SMTP uses TLS on `smtp.mail.ru:465`. Mail credentials exist only in Vercel server environment variables. The delivery record has its own operation key. Retries are bounded and exponential. A resend action sends the existing ticket again and never creates a new ticket. Message headers include a stable application message identifier to reduce duplicate display, but SMTP timeout-after-acceptance remains an at-least-once edge case and is visible in CRM.

Kassir sends the fiscal email. Case Lab sends the ticket email. A ticket email may include the existing fiscal URL once known, but retrying that email must never re-fiscalize.

A confirmed full refund queues a buyer notification stating that the ticket is cancelled and funds were returned. It links to the existing refund receipt when issued; resending the notification never creates another refund or fiscal operation.

## 12. Mobile Check-in

`/crm/check-in` is optimized for a phone and protected by existing CRM authentication. It requests camera permission only after a user action and uses a QR decoder with iPhone Safari and Android Chrome support. Scanning submits the exact bounded QR payload. Manual fallback requires both the unique public ticket number and the ten-character code derived for the current ticket revision; neither value alone is sufficient. Transfer invalidates the old code together with the old QR.

The first valid scan atomically records check-in and changes the ticket to `used`. A repeated scan displays the original check-in time and does not add a second record. A cancelled ticket is rejected. An unknown token changes nothing. The screen never exposes unrelated order personal data.

Check-in requires a network connection so concurrent devices cannot admit the same ticket independently.

## 13. CRM and Refund Operations

The existing CRM gains a Case Lab III section with:

- order list and detail;
- payment, receipt, ticket, email, refund, and incident filters;
- search by order/ticket number or exact email;
- participant CSV export;
- sales switch and sales limit control from 70 through 100;
- resend ticket/existing receipt link;
- participant transfer with audit;
- ticket cancellation with audit;
- full and partial refunds;
- controlled resolution of unexpected real-payment incidents;
- mobile check-in entry point.

Refund confirmation displays original amount, previously refunded amount, requested amount, and remaining refundable balance. The admin request first creates an idempotent refund operation and durable job. The worker calls `POST /payments/refund` with a persistent request key.

An API response alone does not finalize a refund if the outcome is uncertain. Refund webhook or provider reconciliation is authoritative. Refunds created directly in the TipTop Pay dashboard enter through the same webhook and state machine.

After a full confirmed refund the ticket is cancelled and one Standard place returns to availability. A partial refund leaves the ticket valid by default.

## 14. Worker Jobs and Reconciliation

Supported job classes include:

- issue a fiscal-policy operation;
- poll/get receipt;
- send ticket email;
- send refund notification;
- initiate refund;
- reconcile one ambiguous payment/refund;
- send GA4 event;
- send organizer alert;
- daily provider reconciliation.

Each fiscal job references a fiscal-policy purpose rather than assuming only `Income` and `IncomeReturn`, allowing an approved settlement stage without overwriting an earlier receipt. Each invocation claims at most five jobs, uses a two-minute lease, gives each external request a ten-second timeout, and stops starting work after a 45-second invocation budget. Expired leases are reclaimable. Long reconciliation is paginated in batches of at most 100 provider operations and persists its cursor before scheduling the next page. Validation/fiscal configuration errors do not retry forever.

Every minute the worker also detects expired active reservations, processing attempts requiring reconciliation, paid orders without receipt jobs, unsent tickets, overdue receipt/email states, and expired job leases.

At five minutes without an issued receipt or sent ticket email, the system creates an incident and emails the organizer. Reconciliation stores a durable last-successful provider timestamp and pagination cursor. After an outage it catches up from that high-water mark before returning to an overlapping two-day safety window, so an outage longer than two days cannot create a permanent gap. A worker heartbeat is stored on every invocation; CRM shows a blocking warning when it is older than three minutes, and Supabase Cron run history remains the external source for diagnosing scheduler failure.

Disabling new sales never disables callbacks, worker execution, refunds, receipts, ticket access, email retries, or reconciliation.

## 15. Analytics

Client GA4 events cover CTA click, checkout open, form submission, payment start, widget error, and user-visible failure without personal data.

`purchase` and `refund` are emitted server-side through GA4 Measurement Protocol only after confirmed provider state. Purchase uses the public order number as GA `transaction_id`; refund includes that transaction ID and the unique refund operation ID. The stored GA client ID is used when available, otherwise a stable non-PII server client ID is derived for the order. A unique analytics row suppresses normal duplicates. On timeout, a retry uses the same identifiers so GA can deduplicate where supported; analytics remains best-effort and never affects payment or ticket fulfilment.

Before acceptance, the organizer creates a GA4 property and web stream and supplies the Measurement ID and Measurement Protocol API secret through Vercel environment variables.

## 16. Security and Privacy

- Verify the test-proven `Content-HMAC` or `X-Content-HMAC` representation with HMAC-SHA256/Base64 and constant-time comparison before parsing.
- Test Cyrillic, spaces, plus signs, percent encoding, duplicate delivery, and reordered events.
- Keep provider, SMTP, Supabase service-role, worker, session, and GA API secrets server-only.
- Never store card number, CVV, payment token, or unnecessary provider card metadata.
- Do not log participant details, secrets, raw provider payloads, order bearer tokens, or QR tokens.
- Derive purpose-bound order access and ticket credentials by HMAC, use the explicit identifier-bearing QR and manual contracts from section 5.6, store no clear credential, and support explicit rotation.
- Enable RLS on every new table with no anonymous policies.
- Validate request content type, body size, field lengths, email, phone, enum values, UUIDs, money ranges, and origin.
- Apply atomic database-backed rate limits to CRM login, availability, and order creation. CRM login is limited to five attempts per fifteen-minute bucket keyed by a purpose-bound HMAC of the client IP, fails closed when the limiter is unavailable, and does not use the existing process-local `Map` limiter.
- Require CRM session, role, same-origin request, session-bound CSRF token, and idempotency key for financial/admin mutations.
- Tighten CRM token verification to require the expected role for new financial routes.
- Preserve strict CSP. Add only the official TipTop widget/frame and GA origins actually observed during test integration.
- Keep browser `Permissions-Policy: payment=()` while version one uses the card iframe and excludes browser wallets.
- Update `/privacy/` at its existing URL before checkout ships so it explicitly lists email, optional company, purchase/ticket/check-in records, provider recipients, and retention purposes. Store the exact activated text and hash in legal-document versions.
- Generate authenticated CSV exports with `Cache-Control: no-store`, audit each export, and neutralize values beginning with `=`, `+`, `-`, or `@` to prevent spreadsheet formula injection.

## 17. Configuration Contract

The implementation documents variable names in `.env.example` without real values. Expected groups are:

- TipTop widget terminal ID for test/live.
- TipTop server Public ID and API Secret for test/live.
- Kassir Public ID and API Secret for test/live when different.
- Seller IIN/BIN.
- SMTP host, port, secure flag, username, app password, sender, and organizer alert address.
- Dedicated order-session secret.
- Dedicated worker/cron secret.
- GA4 Measurement ID and Measurement Protocol API secret.
- Payment mode for each deployment.
- Existing Supabase URL, anon key, and service-role key.
- Existing CRM password and JWT secret.

The IIN/BIN and all credentials are entered directly into Vercel or Supabase Vault, not chat, source files, commits, or client variables. Only the widget terminal ID and GA Measurement ID are public.

Supabase Vault must contain the production worker URL and bearer secret before the minute schedule is enabled.

## 18. Expected Dependency Changes

The approved implementation adds the smallest direct dependencies for the new behavior:

- `nodemailer` and `@types/nodemailer` for Mail.ru SMTP;
- `pdfkit` and `@types/pdfkit` for PDF generation with the existing Gilroy WOFF2 Cyrillic font;
- `qrcode` and `@types/qrcode` for server QR images;
- `@zxing/browser` for mobile browser QR decoding;
- `tsx` as a development dependency for TypeScript tests using Node's test runner.
- `supabase` as a development dependency for reproducible local migration and pgTAP execution.

The QR decoder is loaded only by the protected check-in client route. PDF, SMTP, and QR generation remain server-only. No payment SDK package is needed because the official widget is loaded remotely and server APIs use native `fetch`.

## 19. Test Strategy

### 19.1 Unit and Contract Tests

- minor-unit conversion and amount formatting;
- HMAC verification for raw and malformed bodies, including at least one expected signature computed independently with OpenSSL and an anonymized real test callback after provider setup;
- widget parameter construction with `emailBehavior: "Hidden"` and without receipt/recurrent/tokenization;
- provider payload parsing and validation;
- state-transition guards and late Fail behavior;
- Kassir payloads for both tiers and partial/full returns;
- access token, exact identifier-bearing QR parsing, ticket-number-plus-manual-code lookup, CSRF, and idempotency behavior;
- deterministic PDF/ticket content;
- email and GA event sanitization.
- participant transfer token rotation and invalidation of old QR/session versions;
- CSV formula neutralization and non-cacheable export responses.

### 19.2 Database and Concurrency Tests

- two buyers competing for the last Early Bird;
- temporary Early Bird reservations do not open Standard;
- two buyers competing for the final sales place;
- duplicate order idempotency key;
- duplicate/concurrent Check;
- duplicate and reordered Pay/Fail/Refund/Receipt;
- reservation expiration before and after admitted Check;
- confirmed Fail atomically releases or expires processing inventory;
- full and partial refund arithmetic;
- imported/invited/manual allocations participate in capacity;
- raising sales limit to 100 and rejecting invalid reductions;
- concurrent duplicate check-in.

### 19.3 Integration Tests

- widget script load failure and retry;
- successful/declined/cancelled/3-D Secure payment;
- browser close immediately after payment;
- Kassir queued, processed, error, timeout, unknown, and early Receipt;
- SMTP failure/retry and protected PDF download;
- refund through CRM and provider dashboard;
- refund timeout inside and outside the provider's one-hour idempotency window;
- full-refund buyer notification;
- server restart/expired job lease;
- test callback cannot mutate live inventory;
- GA blocker cannot affect payment.
- exact cutoff behavior: available immediately before, closed at `2026-09-24 00:00:00 Asia/Almaty`.

### 19.4 Verification Commands

The final implementation must pass the repository's existing Case Lab tests, new payment tests, SQL/database tests, `npx tsc --noEmit --incremental false`, `npm run lint`, and `npm run build`.

Local database checks require a running Docker-compatible runtime supported by the Supabase CLI, such as Docker Desktop, OrbStack, Colima, or a compatible Podman setup. The current development machine has none detected. The alternative is a dedicated non-production Supabase test project approved by the user; tests and resets must never target production.

Manual acceptance covers iPhone Safari, Android Chrome, desktop browsers, phone camera check-in, sandbox operations, and a controlled live purchase/refund.

## 20. Delivery Sequence

1. Add the configuration contract and test foundation.
2. Add database migrations, constraints, RLS, atomic RPCs, and job claiming.
3. Add server-only validation, HMAC, provider, session, money, logging, and database-backed CRM-login rate limiting.
4. Activate only the test sales row after test fiscal/legal configuration, then add availability, order creation, order session, status, and payment-attempt routes.
5. Connect every landing CTA to the shared checkout dialog and TipTop widget.
6. Add Check, Pay, Fail, deduplication, incidents, and payment reconciliation.
7. Add worker invocation through Supabase Cron and Kassir income flow.
8. Add protected order page, QR, PDF, and SMTP ticket delivery.
9. Add CRM order operations, inventory controls, participant transfer, and CSV.
10. Add refund API/jobs/webhook state and income-return receipts.
11. Add the mobile QR check-in flow.
12. Add GA4 client and server events.
13. Add minute monitoring, daily reconciliation, alerts, and recovery paths.
14. Run static, unit, database, integration, security, and acceptance checks.
15. Configure provider test callbacks and complete sandbox acceptance.
16. Configure live callbacks/secrets and perform one controlled live purchase and full refund.
17. Enable live sales only after payment, ticket, PDF, email, income receipt, refund, return receipt, CRM, check-in, and inventory are all verified.

## 21. Inputs Required Before Integration Acceptance

- Confirm or obtain a separate TipTop Pay test terminal and test behavior.
- Enter test/live TipTop Pay and Kassir credentials directly in Vercel.
- Enter seller IIN/BIN directly in Vercel.
- Confirm in the merchant dashboard or with TipTop Pay that the registered KKT belongs to IP Case Lab and is linked to the intended live terminal.
- Obtain accountant confirmation of the prepayment/settlement fiscal sequence and partial/full return receipt treatment.
- Confirm automatic provider-side fiscalization is disabled for this flow.
- Confirm the live terminal is configured for card-only version-one checkout.
- Create a Mail.ru app password for `hello@caselab.kz` and enter SMTP credentials in Vercel.
- Create GA4 property/web stream and Measurement Protocol API secret.
- Add the worker URL and secret to Supabase Vault and enable schedules.
- Register exact HTTPS Check, Pay, Fail, Refund, and Receipt callback URLs in provider dashboards.
- Enable only the test sales row after its fiscal policy and legal versions pass validation; verify the live row remains disabled before Tasks 7-9 acceptance.
- Confirm initial consumed inventory is still zero immediately before enabling sales.
- Reserve an acceptance window for a real purchase and full refund, including accountant verification of every receipt required by the approved fiscal policy.

## 22. Completion Criterion

A controlled live purchase produces one completed payment, one valid QR/PDF ticket, a successfully accepted Case Lab ticket email, and every accountant-confirmed fiscal receipt. CRM displays each independent state. The first QR scan admits the attendee and a repeated scan is rejected as already used. A full confirmed refund cancels the ticket, returns one Standard place, sends the buyer notification, and produces one income-return receipt.

Duplicate/reordered webhooks, browser closure, provider timeouts, worker restart, SMTP failure, GA blocking, and database unavailability do not create duplicate application-side tickets, seats, fiscal operations, refunds, or check-ins and do not lose a confirmed provider event. The system blocks buyer retry while a payment result is uncertain. Any provider-side unexpected capture is preserved as a visible incident and resolved through verified attachment/fiscalization or a controlled refund.
