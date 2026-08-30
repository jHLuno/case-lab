# Case Lab III Responsive Fixes

## Goal

Make `/case-lab-3` stable and readable from 320px through large desktop widths while preserving the current Case Lab visual language, content order, navigation, and desktop speaker interaction.

## Responsive Behavior

### Hero

- Keep the event details as a shared date component at every viewport width.
- Render `24` as the dominant date value and make the adjacent three-line details column stretch to the value's content box.
- Align the first detail line to the top of `24` and the last detail line to its bottom using a flex column with `justify-content: space-between`.
- Reserve enough top space inside the hero for the fixed navigation on mobile and tablet.
- Use a readable mobile headline and body measure without allowing headline or venue text to overflow.
- Align the early-bird price copy with the CTA start edge below 768px. Center the copy vertically against the CTA from 768px upward.
- Increase the three case-question sizes only from 1080px upward.

### Speakers and How It Works

- On desktop, let the right speaker description use the full available card width minus its established inner padding while keeping the existing heading scale.
- Increase the description measure and type size on large screens so it reads as primary supporting content rather than a small note.
- Align the `ТОП-3` reward copy to the bottom of the scoreboard number.

### Tickets

- From 768px upward, give the ticket heading a wider measure and slightly stronger scale.
- Increase the visual hierarchy of date, location, and capacity facts with existing Benzin/Gilroy tokens, weight, and contrast only.
- Add catering and a chance to win gifts/prizes to the existing included list.
- Keep mobile tickets readable and contained.
- Between 768px and 1023px, retain a two-column composition but constrain the artwork and its overlap so the ticket visuals do not become a tall, clipped stack.
- Keep the existing larger desktop artwork treatment from 1024px upward.

### Participant Testimonials

- Keep the existing three-column desktop/tablet grid.
- From 320px through 767px, use a horizontal one-card-at-a-time carousel.
- Support native touch scrolling and touch swipes without hiding content from assistive technology.
- Auto-advance every 3 seconds while the section is visible and the page is visible.
- Pause while the carousel or its controls have focus, during touch interaction, and while the document is hidden. Resume after touch interaction has been idle for 3 seconds or when focus leaves the carousel.
- Provide an accessible previous/next control and a current slide status.
- Disable auto-advance when reduced motion is requested unless the page's existing Case Lab force-motion behavior intentionally overrides it.

### Footer

- On 320px through 767px, keep the logo, email, and social links aligned to one left edge.
- Preserve the existing centered CTA area and desktop three-column footer arrangement.

## Implementation Boundaries

- Keep page composition and public route unchanged.
- Keep all responsive styling in `app/case-lab-3/case-lab-3.module.css` except the existing utility-class footer, which will receive narrowly scoped mobile alignment classes.
- Add only the carousel state/effects required to `CaseLab3Proof.tsx`; do not alter the desktop testimonial data model.
- Reuse existing fonts, colors, imagery, and icon package.
- Preserve existing keyboard focus styles and add controls with 44px minimum touch targets.

## Verification

- Run the repository TypeScript check and production build.
- Run the existing Case Lab tests.
- Inspect the final diff for scope and verify each of the twelve requested behaviors against the relevant source rules.
- Visual verification in real browsers/devices remains a user responsibility because browser inspection is not being run in this environment.
