# Case Lab 3: Tickets Before Cases

## Goal

On `/case-lab-3`, show the ticket purchase block before the existing cases block.

## Current and Target Order

Current order:

`Proof -> Cases -> Tickets -> FAQ`

Target order:

`Proof -> Tickets -> Cases -> FAQ`

## Implementation

Update only `app/components/CaseLab3Page.tsx` by moving the existing
`<CaseLab3Tickets />` element above `<Cases alignToCaseLab />`.

Do not change section content, styles, IDs, checkout links, or the behavior of
the cases carousel.

## Verification

Run the repository's TypeScript check and production build:

- `npx tsc --noEmit --incremental false`
- `npm run build`
