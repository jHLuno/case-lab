# Case Lab 3 Mobile Scoreboard Removal

## Goal

Remove the `ТОП-3` scoreboard from the Case Lab 3 process section on phone widths, including its divider and prize copy.

## Scope

The change applies only at the existing mobile breakpoint `max-width: 767px`. At `768px` and above, the scoreboard remains unchanged. JSX, copy, desktop/tablet layout, and other routes remain unchanged.

## Design

Inside the existing `@media (max-width: 767px)` block in `app/case-lab-3/case-lab-3.module.css`, set `.howItWorksScoreboard` to `display: none`. Hiding the complete block removes its border, label, and text without leaving layout space or an accessible duplicate.

## Verification

Add a source-level regression assertion that the scoreboard is hidden inside the mobile media query. Run the full Node test suite, TypeScript check, lint, production build, and `git diff --check`.
