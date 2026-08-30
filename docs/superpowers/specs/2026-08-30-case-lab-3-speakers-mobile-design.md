# Case Lab 3 Speakers Mobile Refinement

## Goal

Improve the mobile speaker cards shown below the speakers section intro:

- Reduce the case title size so long titles do not dominate the card.
- Reposition all three speaker photos to reveal the tops of their heads.

## Scope

Only the mobile accessible card presentation is in scope. The desktop sticky speaker stage, JSX structure, copy, image assets, and other routes remain unchanged.

## Design

At the existing `max-width: 767px` breakpoint:

- Set `.speakerAccessibleCase h3` to `font-size: clamp(18px, 5vw, 22px)` and `line-height: 1.02`.
- Set `.speakerAccessibleVisual > img` to `object-position: center top` so the crop preserves the upper part of every photo.
- Keep the current visual container height, spacing, card treatment, and body copy sizing.

## Verification

Add source-level regression assertions for the mobile title scale and image position. Run the existing test suite, TypeScript check, lint, production build, and `git diff --check`.
