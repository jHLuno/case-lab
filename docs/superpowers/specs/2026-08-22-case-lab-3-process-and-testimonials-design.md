# Case Lab 3 Process And Testimonials

## Goal

Reshape the middle of `/case-lab-3` into a clearer event story:

- add a dedicated third block, `Как проходит Case Lab`;
- move the existing testimonial block to fourth position;
- remove the vague `До этого уже было` kicker;
- prepare the testimonial block for three or four vertical 9:16 video reviews;
- keep video delivery outside the application host and avoid loading all players on page load.

## Page Order

The page order becomes:

1. Hero
2. Speaker cases
3. How Case Lab works
4. Video testimonials
5. Case Lab archive
6. Tickets
7. Footer

`CaseLab3Page` owns the order. The new process section is a server-rendered component because it has no client interaction. The testimonial section remains a small client boundary because it needs one active player state.

## How Case Lab Works

Create `CaseLab3HowItWorks.tsx` as a dedicated section with the heading `Как проходит Case Lab` and the supplied content expressed as five sequential steps:

1. A CMO brings a real case and presents the context, starting point, problem, and team constraints.
2. The audience proposes solutions and tries to predict what the team actually did.
3. The CMO reveals the real sequence: decisions, what worked, mistakes, and the result.
4. Correct answers earn points that go into the shared scoreboard, updated throughout the evening.
5. The event ends with the top three Case Lab III participants and prizes for the people who most accurately recognised the teams' real decisions.

Use the exact meaning and terminology from the supplied copy, but split it into short paragraphs so it remains scannable. The section uses the existing cobalt and white Case Lab palette. On desktop, place the heading and a compact event outcome marker in a left column, with the process rail in a wider right column. On mobile, stack the heading followed by the five steps. The numbered markers are part of the actual ordered process, not decorative section labels.

## Video Testimonials

Keep `CaseLab3Proof` as the fourth section but turn it into a testimonial rail:

- remove `До этого уже было`;
- use a specific heading such as `Что участники уносят с собой`;
- explain that the following videos are participant reflections from previous Case Lab events;
- support three or four testimonial items with 9:16 posters and optional external player URLs;
- preserve a poster-only state when a URL has not yet been supplied, so the page never requests a broken or empty media source.

On desktop, use an asymmetric text-and-rail composition. The first testimonial can be visually featured through its position and metadata, while all media preserves the 9:16 ratio. On mobile, use horizontal scroll-snap so the vertical video format remains large enough to read without producing a long stack of full-screen cards.

Each testimonial card must have:

- an accessible button with a specific label;
- a poster loaded through `next/image`;
- a play affordance only when a player URL exists;
- an inline player created only after the user activates that card;
- an iframe title and `allow` attributes when the external player is active.

Do not autoplay, preload, or mount three or four iframes at once. Add `loading="lazy"` to the activated iframe as an extra browser hint. Respect reduced motion by avoiding decorative reveal transitions for the player state.

## Video Delivery

Recommend Cloudflare Stream or Mux for production video storage and adaptive delivery. The application stores only public poster paths and provider embed URLs or IDs. Original video files do not enter `public/`, the Git repository, or the primary application host.

The first implementation should keep the data provider-neutral at the component boundary: each item accepts an optional `embedUrl`. When the team has Cloudflare Stream IDs, the values can be filled with `https://iframe.videodelivery.net/<VIDEO_UID>` URLs without changing the UI. YouTube or Vimeo URLs remain possible through the same facade if the provider is chosen later.

## Accessibility And Performance

- Keep section headings and card content semantic.
- Use `aria-expanded` and `aria-controls` for the play buttons.
- Give each active iframe a descriptive `title`.
- Use `playsInline` only if a native video implementation is introduced later; do not add a native player dependency now.
- Reserve the 9:16 media box to prevent layout shift.
- Keep all video network requests user-initiated.
- Keep existing reduced-motion behavior and do not add scroll hijacking to either section.

## Files In Scope

- `app/components/CaseLab3Page.tsx`
- `app/sections/CaseLab3HowItWorks.tsx`
- `app/sections/CaseLab3Proof.tsx`
- `app/case-lab-3/case-lab-3.module.css`

No dependency, environment variable, database, or public video asset changes are required for the first pass.

## Verification

- Run `npx tsc --noEmit --incremental false`.
- Run `npm run lint`.
- Run `npm run build`.
- Inspect the diff to confirm only the intended Case Lab 3 page order, new process section, testimonial facade, and module styles changed.
- Visual browser verification remains with the user unless explicitly requested.
