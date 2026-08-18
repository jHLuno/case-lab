# Case Lab III Hero Handoff

## Scope

This document records the current implementation of the Case Lab III hero block. Treat the values below as the visual source of truth for future edits.

## Hero Structure

- Component: `app/sections/CaseLab3Hero.tsx`
- Main styles: `app/case-lab-3/case-lab-3.module.css`
- The hero has a white outer background with preserved spacing: `8px` by default and `12px` at `min-width: 1024px`.
- The blue shape uses a rounded `28px` frame and `min-height: min(74svh, 900px)`.
- Mobile shape height is `min(76svh, 680px)`.
- The animated `Grainient` canvas is the only visual background layer inside the blue shape.
- The shape itself has no visible border, outline, shadow, or solid blue background while animation is active.
- Reduced-motion users receive a solid `#040082` fallback through `.caseRoomShapeStatic`.

## Hero Copy

- Kicker: `Case Lab III`
- Headline:

  `Как это было`

  `сделано на самом деле`

- Description:

  `Внутренняя кухня трёх казахстанских маркетинговых кейсов. Что происходило внутри, какие решения принимали и к чему они привели.`

- Description width is intentionally fixed at `54ch` in `.caseRoomCopy` so the desktop copy stays in two lines.
- The content is lowered with `padding-top: clamp(28px, 4vw, 56px)`.

## Grainient

- Component: `app/components/Grainient.jsx`
- Styles: `app/components/Grainient.css`
- Loaded dynamically with `ssr: false`.
- Current hero colors:
  - `color1`: `#eb9ae9`
  - `color2`: `#040082`
  - `color3`: `#ab6ae9`
- The canvas fills the entire blue shape and is rendered behind the hero content.
- Do not add another decorative background layer underneath the canvas.

## Purchase Row

- Date and venue stay on the left:
  - `24`
  - `СЕНТЯБРЯ / NARXOZ BUSINESS SCHOOL`
- The purchase group stays on the right and contains the CTA beside the price copy.
- Price copy:

  `Первые 20 билетов — 7 890 ₸.`

  `Далее — 15 000 ₸.`

- Desktop layout uses a two-column footer grid.
- At `max-width: 900px`, the footer stacks vertically.

## Ticket CTA

- Component: `app/components/SpecularButton.tsx`
- Styles: `app/components/SpecularButton.module.css`
- OGL dependency: `ogl` is already installed in `package.json`.
- The CTA keeps a white pill surface and uses:
  - Text: `#160f43`
  - Moving specular line: `#040082`
  - Base edge color: `#afa8ff`
  - Highlight thickness: `3px`
  - Horizontal padding: `76px`
  - Font size: `16px`
  - Arrow size: `20px`
- The label and arrow are locked to one line with `white-space: nowrap` and an inline-flex label.
- Reduced-motion handling is implemented in the component.

## Tiles

- Tiles are rendered in `.caseRoomCases` with:
  - `3` columns on desktop
  - `8px` gap
  - `10px` top margin
  - `16px` internal padding
  - `18px` border radius
- Tiles have no border, outline, or shadow.
- The tile base is transparent; the left text panel is the only lavender overlay.
- Panel color: `#EEE6FD`, fading toward the photo on the right.
- Each tile uses `next/image` with `fill` and `sizes="(max-width: 640px) 100vw, 33vw"`.
- Generated image assets:
  - `public/case-lab-invictus.webp`
  - `public/case-lab-oyu-fest.webp`
  - `public/case-lab-forte-dog.webp`
- Each tile has a white circular arrow affordance without a shadow or border.
- At `max-width: 640px`, tiles collapse to one column and use `min-height: 84px`.

## Files To Touch Carefully

- `app/sections/CaseLab3Hero.tsx`
- `app/case-lab-3/case-lab-3.module.css`
- `app/components/SpecularButton.tsx`
- `app/components/SpecularButton.module.css`
- `app/components/Grainient.jsx`
- `public/case-lab-invictus.webp`
- `public/case-lab-oyu-fest.webp`
- `public/case-lab-forte-dog.webp`

## Guardrails

- Do not reintroduce a solid background behind the active `Grainient` canvas.
- Do not add borders or shadows to the blue shape or tiles.
- Preserve the outer hero spacing.
- Preserve the `54ch` description width unless the copy changes substantially.
- Keep tile text as HTML, not baked into generated images.
- Keep generated photos optimized as WebP.

## Verification

The current implementation has been checked with:

- `npm run lint`
- `npx tsc --noEmit --incremental false`
- Desktop browser checks at `1440x900`

The production build passed earlier during the hero and tile integration. Run `npm run build` again before release after any further visual changes.
