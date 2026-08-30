# Case Lab 3 Mobile Process Spacing

## Goal

Add the same vertical breathing room before the first process-step divider that each process step uses between its description and the next divider.

## Scope

Only the mobile process layout at `max-width: 767px` changes. The desktop/tablet layout, step content, scoreboard behavior, and other routes remain unchanged.

## Design

The mobile `.howItWorksSteps` list receives `margin-top: 20px`. This matches the existing mobile `.howItWorksStep` bottom padding of `20px`, so the first divider aligns with the spacing rhythm between later step descriptions and dividers. The list's internal `gap: 0` and each step's existing `padding: 20px 0` remain unchanged.

## Verification

Add a source-level regression assertion that the mobile `.howItWorksSteps` rule uses `margin-top: 20px`. Run the full Node test suite, TypeScript check, lint, production build, and `git diff --check`.
