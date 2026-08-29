# Case Lab III: Ticket Asset Replacement

## Goal

Replace the ticket artwork in the `/case-lab-3` tickets section with the two
supplied ticket images, optimized for the web while preserving full image
quality. Give the ticket section more room for its left-hand event copy and
make the ticket artwork visually smaller.

## Approved Design

- Convert `public/early bird.png` to `public/case-lab-3-ticket-early-bird.webp`.
- Convert `public/standard.png` to `public/case-lab-3-ticket-standard.webp`.
- Resize both assets to exactly `2400x1200` pixels.
- Encode both WebP assets at quality `100`.
- Replace the existing `case-lab-3-ticket-early-bird-v4.webp` and
  `case-lab-3-ticket-standard-v5.webp` references in the tickets section.
- Use a desktop ticket grid ratio of `65% / 35%`, with the copy in the wider
  left column and artwork in the narrower right column.
- Increase the left heading scale within the wider column and keep the ticket
  artwork slightly enlarged, angled, and tightly overlapped.
- Display desktop artwork at the full width of its right column with a
  `scale(1.3)` image scale. At mobile, reduce the images to `scale(.92)` and
  use a small `-6%` overlap so they stay within the narrow layout.
- Preserve the current event copy, image alt text, `next/image` usage, disabled
  checkout CTA, and mobile stacked reading order.

## Responsive Behavior

- Desktop uses the approved `65% / 35%` split.
- Tablet reduces both columns proportionally while keeping the copy readable.
- Mobile stacks the copy before the ticket artwork and keeps the artwork within
  the content width.

## Scope

Update only the ticket image assets, ticket section source, focused ticket CSS,
and the focused source-level tests. Do not change checkout behavior, event
data, navigation, schema, or other Case Lab sections.

## Verification

- Confirm both converted files are WebP and `2400x1200`.
- Run `node --test tests/case-lab-3-tickets-editorial.test.mjs`.
- Run `npx tsc --noEmit --incremental false`.
- Run `npm run build`.
