# Case Lab III: Reference Ticket Block

## Goal

Recreate the supplied ticket reference on `/case-lab-3` as a focused, dark
event-purchase section. The block should match the reference composition while
preserving the existing event data, ticket assets, disabled checkout behavior,
`#tickets` anchor, and accessible HTML content.

## Approved Design

The section uses a near-black solid background (`#080811`) with no decorative
photo layer. The layout is a two-column editorial composition on desktop:

- Left column: small date/location label, large two-line `БИЛЕТЫ НА CASE LAB
  III` heading, short value proposition, a divider-separated date/location
  row, an included-benefits list, and the `100 мест` capacity detail.
- Right column: the two supplied ticket images overlap at a slight angle, with
  Early Bird in front. They float directly on the dark section. Below them are
  the first-20-ticket label and the later price, followed by a wide light CTA
  row with the arrow aligned to the right.
- A small note below the CTA clarifies that one ticket includes the full Case
  Lab III program.

Use the existing Benzin heading font and Gilroy body font. Keep the established
blue accent for icons, ticket artwork, and CTA text. The CTA surface is a light
off-white so its blue label remains high contrast.

## Content

Keep the verified event data:

- 24 сентября 2026 года, 10:00–14:00
- Narxoz Business School, Алматы
- 100 мест в зале
- Early Bird: 7 890 ₸ for the first 20 tickets
- Later price: 15 000 ₸

Use the reference-aligned included list:

- Разборы Invictus, OYU Fest и ForteBank
- Обсуждение решений и вопросы спикерам
- Знакомства с коллегами и кейтеринг
- Участие в рейтинге и призы для топ-3

The CTA remains a native disabled button until checkout is connected. It must
not become a fake link or expose an invented checkout destination.

## Responsive Behavior

- Desktop: retain the two-column split, with the copy occupying about 52% and
  the artwork/purchase area about 48%; keep the ticket overlap contained.
- Tablet: reduce the gap and heading scale while preserving the same reading
  order; allow the facts row to wrap if needed.
- Mobile: stack the copy before the artwork and CTA; keep ticket images within
  the viewport, reduce their scale, and preserve at least a 44px CTA height.

The layout must remain readable with a keyboard and under reduced-motion
preferences. Hover and active styling may be subtle, but no new motion is
required.

## Implementation Scope

- Update `app/sections/CaseLab3Tickets.tsx` to match the approved content and
  markup hierarchy.
- Replace only the ticket-specific CSS rules in
  `app/case-lab-3/case-lab-3.module.css`.
- Keep the existing ticket image assets and `next/image` dimensions/quality.
- Update focused source-level tests for the new heading, reference-aligned
  benefits, solid dark treatment, ticket overlap, and disabled CTA semantics.
- Do not change checkout integration, API routes, schema, navigation, section
  order, or unrelated page sections.

## Verification

Run:

- `node --test tests/case-lab-3-tickets-editorial.test.mjs tests/case-lab-3-assets.test.mjs`
- `npx tsc --noEmit --incremental false`
- `npm run lint`
- `npm run build`
