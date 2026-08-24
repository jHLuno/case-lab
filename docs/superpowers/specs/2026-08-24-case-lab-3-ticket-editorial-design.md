# Case Lab III: Editorial Ticket Section

## Goal

Move the ticket section two positions earlier on `/case-lab-3` and redesign it
as a conversion-focused editorial section inspired by the supplied reference.
The section should make the event value, Early Bird price, and ticket contents
easy to scan without introducing checkout behavior yet.

## Approved Order

Current order:

`Hero -> Speakers -> How It Works -> Proof -> Cases -> Tickets -> FAQ`

Target order:

`Hero -> Speakers -> How It Works -> Tickets -> Proof -> Cases -> FAQ`

The existing `#tickets` anchor remains stable so the Case Lab navigation does
not need a new URL or link.

## Visual Direction

Use one full-bleed, generated horizontal background image with a dark navy and
violet event-room atmosphere. The reviewed image has a deliberately quiet,
near-black left third for copy and a lit stage with audience seating on the
right. The image will be stored as `public/case-lab-3-tickets-bg.png` and used
with a responsive dark overlay/vignette so text contrast remains reliable.

The section is an editorial split rather than a generic two-column card grid:

- Left side: small `БИЛЕТ` kicker, the existing headline
  `Прийти за кейсом. Уйти с решением.`, concise event description, event facts,
  and the primary ticket CTA.
- Right side: a large ticket-style panel with a restrained translucent surface,
  Early Bird label, `7 890 ₸` price, `Первые 20 билетов`, the later `15 000 ₸`
  price, and the included benefits list.
- The panel uses thin dividers, a single violet accent, generous internal
  spacing, and no decorative ticket illustration that would compete with the
  generated background.

Keep the current verified event data:

- 24 сентября 2026 года, 10:00–14:00
- Narxoz Business School, Алматы
- 100 мест
- Early Bird: 7 890 ₸ for the first 20 tickets
- Later price: 15 000 ₸

Do not invent a remaining-ticket counter, attendee avatars, or payment-brand
marks because there is no live inventory or checkout source for them.

## Interaction And Accessibility

The CTA remains visually complete but unavailable until checkout is connected.
Use native disabled-button semantics rather than a fake link or placeholder
destination. The button must remain visibly identifiable in both desktop and
mobile layouts, with no misleading promise that payment is currently possible.

The section keeps its existing `id="tickets"`, heading association, and
keyboard-focus target. The generated image is decorative and gets an empty alt
value when rendered as a background-like image. Text and ticket data remain
real HTML, not part of the image. Existing `ScrollReveal` behavior may remain,
but no new motion is required; all transitions must remain quiet under reduced
motion.

## Responsive Behavior

- Desktop: two-column editorial composition, with the ticket panel occupying
  the narrower right column and the background image visible around both
  columns.
- Tablet: reduce the panel width and gap while preserving the left-side copy
  safe area; allow event facts to wrap.
- Mobile: stack copy and ticket panel in reading order, crop the background
  toward the stage, increase the overlay strength, and keep the CTA at least
  44px tall.

## Implementation Scope

- Reorder `CaseLab3Tickets` in `app/components/CaseLab3Page.tsx`.
- Update the ticket markup in `app/sections/CaseLab3Tickets.tsx`.
- Replace the existing ticket rules and responsive overrides in
  `app/case-lab-3/case-lab-3.module.css` with the approved editorial layout.
- Add the generated background at `public/case-lab-3-tickets-bg.png`.
- Update or add focused source-level tests for the target section order,
  ticket data, disabled CTA semantics, and generated asset reference.

No checkout integration, API, database, pricing logic, or navigation contract
changes are part of this work.

## Verification

Run the focused Case Lab tests, TypeScript, lint, and production build:

- `node --test tests/case-lab-3-*.test.mjs`
- `npx tsc --noEmit --incremental false`
- `npm run lint`
- `npm run build`
