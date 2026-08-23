# Case Lab 3 Testimonials Layout

## Goal

Keep the testimonial block style already used on the main page, move that
composition to the fourth section of `/case-lab-3`, and leave the testimonial
content easy to replace for the Case Lab event.

## Design

- Keep three testimonial records in `CaseLab3Proof.tsx`.
- Use the main-page composition: a selectable list of names on the left and
  the active quote on the right.
- Add a compact, fixed-size circular author photo beside the active author
  metadata. Each record owns its `photo` path so event-specific content can be
  swapped without changing the component.
- Add a `Посмотреть видео-отзыв` button to the active quote.
- Keep video URLs optional. Before activation, render only the author photo
  and poster state; after activation, mount one external iframe for the active
  record. Switching records removes the previous iframe.
- Keep the current Case Lab palette, typography, responsive behavior, and
  reduced-motion support.

## Performance And Accessibility

- Do not autoplay, preload, or mount all three video players.
- Use `loading="lazy"` on the activated iframe and provide a descriptive
  `title`.
- Use a real button for each testimonial selector and video action with
  visible focus styles, `aria-selected`/`aria-controls` where appropriate,
  and a specific accessible label.
- Keep the media/avatar box dimensions reserved to avoid layout shift.
- Restore focus to the video button when the inline player is closed.

## Scope

- Modify `app/sections/CaseLab3Proof.tsx`.
- Modify the testimonial styles in
  `app/case-lab-3/case-lab-3.module.css`.
- Do not change dependencies, video hosting, database state, or unrelated
  dirty worktree files.

## Verification

- Run `npx tsc --noEmit --incremental false`.
- Run `npm run lint`.
- Run `npm run build`.
- Inspect the diff for the three-record layout, lazy single-player behavior,
  and no unrelated changes. Visual browser verification remains with the
  user.
