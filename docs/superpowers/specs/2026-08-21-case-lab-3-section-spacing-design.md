# Case Lab 3 Section Spacing

## Goal

Create a consistent vertical rhythm on `/case-lab-3` across desktop, tablet, and mobile:

- Keep the distance from each section headline to its main content moderate and consistent.
- Make the second section's visual content start close to its headline instead of being pushed down by parent layout rules.
- Make the distance from one section's content to the next section headline 1.5 times the headline-to-content gap.

## Current Cause

The second section is not separated by `margin-top` alone. `.speakerScene` reserves `300svh`, while `.speakerStage` vertically centers the stage and applies an additional vertical transform. This makes the first visual content appear far below the section headline even when `.speakerScene` has no top margin.

Other sections use different fixed and responsive values (`64px`/`42px`, `56px`, and `100px`), so their headline-to-content and section handoff rhythm is inconsistent.

## Design

Use two shared spacing values in `case-lab-3.module.css`:

- `48px` headline-to-content gap on every viewport size.
- `72px` content-to-next-headline handoff gap, calculated as `48px * 1.5`.

Apply the headline-to-content gap to the proof grid, desktop speakers scene, mobile speakers list, and archive cards. For the speakers section, keep the existing scroll-driven case states, use native sticky positioning instead of JavaScript pinning, center the stage grid in the viewport, and size it to leave a `48px` inset at both ends of the viewport. Use the remaining `24px` as the section transition so the next proof headline begins `72px` after the visible photo and description content on desktop/tablet; mobile keeps a normal `72px` section handoff because it uses the fallback list.

Because the shared global stylesheet makes `body` a horizontal-hidden scroll container, scope `overflow-x: clip` and `overflow-y: visible` to the Case Lab 3 route via `:has(#case-lab-3-speakers)` so native sticky can operate without changing other pages.

The desktop/tablet case timeline must give each photo/description state the same stable scroll hold. Use the same `0.8` hold before the first transition, between transitions, and after the last transition, with the same `0.32` crossfade duration for both transitions.

The stage grid remains visible while it approaches the viewport in normal flow. The scroll timeline still starts at the `top top` boundary, and its equal stable holds remain unchanged.

Use the handoff gap for the transition from the speakers content to the proof headline and for subsequent section boundaries where the next headline follows the preceding section content. Do not change the React structure, copy, animation timeline, image assets, or unrelated pages.

## Constraints

- CSS-only implementation in the Case Lab 3 module.
- Preserve the desktop/tablet sticky speakers interaction and reduced-motion behavior.
- Preserve the existing mobile fallback list.
- Do not modify existing unrelated worktree changes.

## Verification

- Run `npx tsc --noEmit --incremental false`.
- Run `npm run build`.
- Inspect the resulting diff to confirm only the intended Case Lab 3 spacing rules and this specification are changed.
