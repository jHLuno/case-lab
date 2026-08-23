# Case Lab 3 Scroll Cases Design

## Goal

Turn the second block on `/case-lab-3` into a scroll-led case showcase for desktop and tablet. The visual composition stays pinned to the viewport while the featured image, two supporting images, and the case description change together as the visitor scrolls.

## Current Context

The `CaseLab3Speakers` section currently renders three case images in a large-left/two-small-right grid and then renders three separate case rows below it. The page already uses Lenis and registers GSAP `ScrollTrigger` globally through `SmoothScrollProvider`.

## Experience

The section keeps its introductory heading. The case showcase below it becomes a three-step scroll scene:

1. Featured: Invictus GO. Supporting images: Qara Studios, then Forte Bank x GForce Grey.
2. Featured: Qara Studios. Supporting images: Forte Bank x GForce Grey, then Invictus GO.
3. Featured: Forte Bank x GForce Grey. Supporting images: Invictus GO, then Qara Studios.

The large image remains on the left. The two supporting images remain in the upper-right rail. The active case copy moves into the open area below the supporting images. The copy includes the case title and description, but does not repeat the numeric index or company name from the current lower rows. Image captions may continue to identify the company so the visual assets remain understandable.

## Layout

On desktop and tablet (`min-width: 768px`):

- The scroll scene provides approximately three viewport heights of progression.
- A single stage is pinned for the duration of the scene.
- The stage uses a two-part grid: a large feature image on the left and a two-image rail on the right, with the active description spanning the lower-right area.
- The existing Case Lab typography, colors, radii, overlays, and spacing tokens remain in use.
- Three image layers per visual slot are rendered so transitions can crossfade without changing image dimensions or waiting for a new layout.
- Three copy layers are rendered in the copy slot so the description can crossfade in sync with the images.

On mobile (`max-width: 767px`):

- No pinning or scroll-driven state changes are initialized.
- The section falls back to a normal stacked layout with the three case images and their descriptions in source order.
- The existing mobile image grid behavior is preserved as much as possible.

## Motion And Scroll Control

`CaseLab3Speakers` remains a client component and initializes GSAP in `useLayoutEffect` within a `gsap.context`.

- Use `gsap.matchMedia()` to initialize the scene only at `min-width: 768px`.
- Use a `ScrollTrigger` attached to the scene wrapper with `pin` on the stage, `start: "top top"`, and an end based on the scene height.
- Use a scrubbed GSAP timeline with a short hold on each state and a crossfade between neighboring states.
- Animate opacity and a restrained scale/translate on image and copy layers; do not animate layout dimensions.
- When the active state changes, update `aria-hidden` on inactive copy layers and keep one active description available to assistive technology.
- Respect `prefers-reduced-motion`: keep the pinned scene and scroll states, but switch transitions to immediate state changes without crossfade, scale, or translate.
- Clean up all triggers and timelines through the GSAP context when the component unmounts or the media query stops matching.

## Content And Accessibility

- Keep the existing case data and image assets.
- Remove the current lower `caseList` rows because their content is represented in the pinned copy slot.
- The active copy uses a semantic heading and paragraph structure.
- Decorative image layers use `aria-hidden`; only the active copy is exposed to screen readers.
- The section heading and active copy remain readable with keyboard zoom and at tablet widths.
- No autoplay, focus trap, or click-only interaction is introduced.

## Scope

Modify only:

- `app/sections/CaseLab3Speakers.tsx`
- `app/case-lab-3/case-lab-3.module.css`

Do not add dependencies, change page order, alter the other Case Lab 3 sections, or change public API/data contracts.

## Verification

- Run `npx tsc --noEmit --incremental false`.
- Run `npm run lint`.
- Run `npm run build`.
- Review the final diff to confirm only the speakers component, its CSS module, and this design document are involved.
