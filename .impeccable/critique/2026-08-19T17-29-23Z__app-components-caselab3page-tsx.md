---
target: Hero to Speakers transition on /case-lab-3/
total_score: 28
p0_count: 0
p1_count: 2
timestamp: 2026-08-19T17-29-23Z
slug: app-components-caselab3page-tsx
---
#### Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---:|---|
| 1 | Visibility of System Status | 3/4 | Navigation and CTA are visible, but no active section state. |
| 2 | Match System / Real World | 4/4 | Event language and content order are understandable. |
| 3 | User Control and Freedom | 3/4 | Anchors and back-to-top exist; proof cards still imply unavailable playback. |
| 4 | Consistency and Standards | 3/4 | Hero and section gutters differ, but the difference is small and explainable. |
| 5 | Error Prevention | 3/4 | Primary ticket path is clear; inactive video affordances create uncertainty. |
| 6 | Recognition Rather Than Recall | 3/4 | Case companies, roles, and topics are visible without recall. |
| 7 | Flexibility and Efficiency | 2/4 | The long page has limited shortcuts beyond anchor navigation. |
| 8 | Aesthetic and Minimalist Design | 3/4 | Strong brand composition, with some repeated case presentation. |
| 9 | Error Recovery | 2/4 | Inert proof affordances do not communicate what happens next. |
| 10 | Help and Documentation | 2/4 | FAQ is not yet present on this route. |
| **Total** | | **28/40** | **Good foundation; address interaction and repetition before release.** |

#### Anti-Patterns Verdict

The Hero-to-Speakers inset is not an AI-slop problem. It is a valid editorial transition from a small-gutter poster object to a page content grid. The risk is not the offset itself, but whether the grid shift feels intentional and repeats elsewhere. The current page has some repeated case imagery and all-caps display treatment, but real case assets and specific copy keep it distinctive.

#### Overall Impression

The transition is canonically acceptable. At a 960px CSS viewport, the Hero shell starts at x=8, the Hero headline at x=37, and the Speakers headline at x=24. The Speakers headline is not actually farther left than the Hero headline. The vertical gap from the Hero bottom to the Speakers headline is approximately 101px, which gives the loud Hero enough room to resolve before the next section begins.

#### What's Working

- The Hero behaves like a contained campaign object, while Speakers behaves like the page's editorial grid.
- The current Speakers heading spans 3 lines at both 960px desktop and 500px mobile test widths.
- The page has no horizontal overflow at either tested width.

#### Priority Issues

- **[P2] Repeated case presentation**: the same three cases appear in Hero tiles, Speakers visuals, and Speakers rows. This weakens progression. Make Hero tiles an index or remove repeated descriptions.
- **[P1] Inert proof video affordances**: play icons and “видеоотзыв” imply playback while the cards are not interactive. Connect real media or remove the play affordance and implementation note.
- **[P1] Mobile hero/nav collision**: the fixed navigation can overlap the Hero identity on narrow screens. Reserve safe space or alter the mobile nav flow.
- **[P2] Unexplained English micro-labels**: “speaker case” and “case room” add register noise beside Russian copy. Use one language or make the English labels a deliberate system.

#### Persona Red Flags

- **Jordan, first-timer**: understands the event and speakers, but may not know whether the Hero tiles are clickable or decorative.
- **Riley, stress tester**: can discover that proof cards look playable but do nothing; this reads as unfinished rather than intentional.
- **Casey, mobile user**: benefits from the 3-line heading and no horizontal overflow, but the fixed nav still competes with the Hero top edge.

#### Questions to Consider

- Is the Hero case strip an index users should click, or purely visual proof?
- Should one horizontal keyline be repeated across Hero cards and section content, or is the nested-frame transition part of the brand language?
- Are the previous-stream videos ready to become real interactions, or should the page present them as static testimonials for now?
