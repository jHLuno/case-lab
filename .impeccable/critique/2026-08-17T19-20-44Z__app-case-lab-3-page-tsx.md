---
target: Case Lab 3 landing page
total_score: 20
p0_count: 1
p1_count: 3
timestamp: 2026-08-17T19-20-44Z
slug: app-case-lab-3-page-tsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|---:|---|
| 1 | Visibility of System Status | 2/4 | Menu state is communicated, but ticket clicks have no purchase progress or confirmation. |
| 2 | Match System / Real World | 3/4 | Local event language, venue, date, price, and case framing fit the audience; logistics are incomplete. |
| 3 | User Control and Freedom | 2/4 | Menu escape works, but marquee has no pause control and ticket CTAs have no real next step. |
| 4 | Consistency and Standards | 3/4 | Palette and CTA patterns are cohesive; play affordances and naming are inconsistent. |
| 5 | Error Prevention | 1/4 | Checkout is unavailable in the inspected build and no fallback is communicated. |
| 6 | Recognition Rather Than Recall | 3/4 | Price, date, venue, and inclusions are visible; audience fit and logistics must be inferred. |
| 7 | Flexibility and Efficiency | 2/4 | Anchor navigation helps, but mobile has no persistent purchase action or alternate path. |
| 8 | Aesthetic and Minimalist Design | 2/4 | Hero is focused, but lower sections repeat rounded cards, kickers, rings, and placeholder content. |
| 9 | Error Recovery | 1/4 | Dead purchase links fail silently. |
| 10 | Help and Documentation | 1/4 | No FAQ, arrival, refund, accessibility, or post-purchase guidance. |
| **Total** | | **20/40** | **Acceptable; significant improvements needed.** |

#### Anti-Patterns Verdict

The hero has an authored idea: one blue live case room and three named Kazakhstan cases. The page partially fails the AI-slop test below the hero because it repeats purple glow, concentric orbit motifs, rounded containers, tracked kickers, and placeholder proof copy. No gradient text, decorative CSS grid background, or meaningless giant numeral was detected.

The deterministic detector returned zero findings. Browser review found real issues that the detector cannot identify: mobile hero H1 overflow, desktop proof H2 overflow, insufficient ticket kicker contrast, non-functional play controls, and purchase links resolving to `#tickets`.

#### Overall Impression

The first impression is distinctive on desktop, but the conversion argument breaks at the two moments that matter most: mobile readability and purchase. The single biggest opportunity is to finish the proof and checkout path before adding more visual decoration.

#### What's Working

- The C-style blue stage is a clear visual signature and maps to the event format.
- The named Invictus Go, Qara Studios, and Forte Bank × GForce Grey cases make the event specific and locally relevant.
- Shared navigation has accessible mobile dialog behavior, focus trapping, Escape handling, and background inertness.

#### Priority Issues

1. **[P0] Purchase CTAs do not reach checkout.** `app/lib/caseLab3.ts:1` falls back to `#tickets`; hero, navbar, ticket, and footer CTAs therefore do not complete a purchase. Provide and validate a real checkout URL or replace the CTA with a working registration state.

2. **[P1] Mobile hero headline is clipped.** Browser evidence at 390px found `scrollWidth: 425px` against `clientWidth: 294px`; overflow is hidden. Rework the mobile type scale and line breaks at 320, 360, 390, and 428px.

3. **[P1] Proof cards advertise videos but do nothing.** `CaseLab3Proof.tsx:40-61` renders play affordances without links or buttons and exposes “Видеоотзывы ... подключаются” to visitors. Add real video/link behavior or remove the section until assets exist.

4. **[P1] Ticket decision lacks logistics.** The page does not provide event time, exact address, duration, audience fit, refund terms, arrival guidance, or what happens after payment. Add a compact logistics block beside the first CTA and price.

5. **[P2] Lower-page visual language drifts into a generic event template.** Repeated orbit rings, purple glow, kickers, pill treatments, and rounded white cards dilute the bespoke stage. Keep the stage and three case tiles; flatten or vary lower sections and let real proof imagery carry the identity.

#### Persona Red Flags

**Jordan, first-timer:** “CMO,” “Early Bird,” and “case room” are not explained; there is no visible time, exact location, audience definition, or FAQ; CTA labels vary between “Забрать билет” and “Купить билет”; proof cards look clickable but are not.

**Riley, stress tester:** Every purchase link resolves to `#tickets`; play controls are no-ops; archive items duplicate in the accessibility tree; there is no checkout-unavailable state or recovery path.

**Casey, mobile user:** The primary headline is clipped at 390px; the first CTA does not purchase; ticket content is far below the hero; there is no persistent mobile purchase action.

#### Minor Observations

- Event mobile menu still contains generic diagnostics copy from the shared Navbar.
- Speaker image alt text is generic and does not identify the case.
- Marquee duplicates should be hidden from assistive technology when repeated.
- ScrollReveal starts content at opacity 0 without a clear reduced-motion branch.
- Public naming alternates between “Case Lab III” and “Case Lab 3”; choose one convention.
- Footer repeats the CTA without adding logistics or reassurance.

#### Questions to Consider

- Which proof should be completed first: real attendee video, one case clip, or a static testimonial quote?
- Should the page block purchase until the checkout URL is available, or use a temporary registration fallback?
- Should the next pass focus on conversion-critical issues only, or also flatten the generic rounded-card language below the hero?
