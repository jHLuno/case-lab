# Case Lab III Hero CTA

## Goal

Use the SpecularButton effect for the "Купить билет" CTA in the first-screen hero, keep the date, CTA, and price in one desktop row, and preserve the existing mobile stacking behavior.

## Design

Add the local `SpecularButton` client component backed by the existing `ogl` dependency. Render it in `CaseLab3Hero` with `76px` horizontal padding, `16px` text, and a `20px` arrow, preserving the checkout action. Keep the white button, use brand blue `#040082` for the moving highlight and lavender `#afa8ff` for the static edge, and set the highlight thickness to `3px`. Keep the date/place on the left and the button plus ticket-price text together in a right-hand horizontal group; retain the stacked layout below the responsive breakpoint. Disable the animation loop for reduced-motion users.

## Verification

Run lint, TypeScript, and production build checks. Visual confirmation remains a manual browser check.
