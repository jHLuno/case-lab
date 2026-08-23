# Case Lab 3 Testimonial Cards

## Goal

Rewrite the fourth section of `/case-lab-3` to match the approved reference: a
large heading, supporting copy, and a three-card testimonial gallery with
  video-style poster media, author metadata, and quotes.

## Approved Design

- Keep the existing Case Lab light background, heading font, body font, and
  purple accent.
- Replace the selectable left list and single active quote with three equal
  cards in one desktop row.
- Each card contains a square poster area with a compact video link and a
  followed by the author name, role, accent rule, and quote.
- Use the reference copy exactly:
  - Екатерина Щипачёва, `CMO Intertop & Pandora`.
  - Елена Афонина, `Управляющий директор Centras Group`.
  - Аида Нурсултанова, `Директор по маркетингу дистрибуции Li Auto`.
- Use the reference quotes exactly, including Russian quotation marks.
- Use the supplied speaker portraits converted to WebP as the poster sources:
  `testimonial-ekaterina.webp`, `testimonial-elena.webp`, and
  `testimonial-aida.webp`.
- Keep the portrait crop anchored at `center 20%` inside the square poster
  frame.
- Keep one static set only. Do not render carousel arrows or pagination dots.
- On smaller screens, stack cards into one column while preserving the same
  poster, metadata, and quote hierarchy.

## Video Behavior

- Keep optional `embedUrl` values on each testimonial record.
- A poster play button remains visible when an URL is unavailable, but is
  disabled and does not mount an iframe.
- When a future URL is present, clicking the play button mounts only that
  card's lazy iframe in the poster frame.
- Closing the player removes the iframe and restores focus to its play button.
- Do not autoplay, preload, or mount all video players.

## Accessibility And Motion

- Use real buttons for play and close actions with visible focus styles.
- Give active players descriptive iframe titles and keep `loading="lazy"`.
- Preserve responsive image dimensions to avoid layout shift.
- No carousel auto-rotation or card entrance dependency is needed for the
  static set.

## Scope

- Modify `app/sections/CaseLab3Proof.tsx`.
- Replace the testimonial-specific rules in
  `app/case-lab-3/case-lab-3.module.css`.
- Do not change dependencies, video hosting, database state, or unrelated
  dirty worktree files.

## Verification

- Run `npx tsc --noEmit --incremental false`.
- Run the component lint command available in the repository.
- Run `git diff --check` and `npm run build`.
- Visual browser verification remains with the user.
