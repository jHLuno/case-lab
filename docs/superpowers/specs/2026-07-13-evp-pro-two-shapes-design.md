# EVP Pro Two-Shape Hero Design

## Goal

Replace the desktop Hero cutout composition with two independent rounded surfaces, matching the supplied reference's primary-and-secondary shape hierarchy.

## Composition

- The page canvas remains white.
- The primary shape is a large, rounded Grainient surface. It contains the hero title, description, CTA, and decorative signal layer.
- The secondary shape is a separate white rounded panel overlapping the lower-right edge of the primary shape. It contains only date, time, and place.
- The two surfaces must remain visually distinct. The secondary panel must not be represented by clipping the primary background or by exposing the section background.
- On mobile, retain one full-width rounded primary surface and show event facts beneath the CTA inside that surface. Do not force the floating desktop panel into a narrow layout.

## Constraints

- Retain existing Grainient dynamic loading and reduced-motion fallback.
- Preserve Hero text, CTA behavior, semantic heading, and existing event facts.
- Use existing Case Lab palette, Benzin/Gilroy typography, and restrained rounded geometry.
- Avoid new dependencies and JavaScript layout measurements.

## Verification

- `npx tsc --noEmit --incremental false`
- `npm run build`
- Inspect `/evp-pro` at desktop and mobile widths to confirm the two independent shapes and readable content.
