# Case Lab Design System

This document is the visual and interaction source of truth for Case Lab. It applies to every new page, section, component, and material change to an existing interface in this repository.

The public website uses an expressive editorial marketing system. The internal `/crm` interface uses a quieter utility variant defined below. Both variants share the same brand, typography, color, accessibility, and interaction principles.

## Precedence

When design guidance conflicts, use this order:

1. Accessibility, usability, and content clarity
2. This `DESIGN.md`
3. Approved feature specifications in `docs/superpowers/specs/`
4. Existing component patterns

Existing code is implementation context, not automatic design precedent. Do not reproduce an inconsistency merely because it already exists.

The approved mobile navigation direction remains `docs/superpowers/specs/2026-05-12-mobile-menu-editorial-cobalt-design.md`.

## Brand Character

Case Lab is a strategic marketing diagnostics practice for business leaders and teams. The interface should feel:

- decisive, analytical, and experienced
- editorial rather than software-template driven
- premium without appearing luxurious or ornamental
- energetic through scale, contrast, and cobalt color
- clear enough for serious business decisions

The visual metaphor is a focused strategy session: a bright working surface, strong statements, structured evidence, and a few concentrated moments of cobalt depth.

Avoid generic agency styling, interchangeable SaaS layouts, excessive decoration, and visual effects that compete with the argument of the page.

## Core Palette

Use the established tokens from `app/globals.css`.

| Role | Value | Usage |
| --- | --- | --- |
| Brand cobalt | `#040082` | Primary actions, branded sections, active states, key emphasis |
| Cobalt light | `#1a1a9e` | Controlled depth, subtle gradients, hover states |
| Cobalt dark | `#020060` | Darkened brand surfaces and pressed states |
| Ink | `#0a0a0a` | Primary text and high-contrast UI |
| White | `#ffffff` | Main canvas, inverse text, clean surfaces |
| Gray | `#6d6d6d` | Secondary text when contrast remains sufficient |
| Light gray | `#f5f5f5` | Quiet utility backgrounds and subtle separation |

### Color Rules

- Public pages should primarily alternate white editorial space with committed cobalt or near-black/cobalt moments.
- Cobalt is the only default accent color. Do not introduce unrelated accent colors without a feature-specific design decision.
- Use pure or near-pure neutrals. Do not shift the site toward beige, cream, warm paper, or blue-gray SaaS palettes.
- Use gradients only to create depth inside an already branded cobalt/dark surface. Gradients must stay within the cobalt, near-black, and white families.
- Never use gradient text.
- Status colors are permitted in CRM when they communicate state. They are semantic, not decorative.
- Body text must meet WCAG AA contrast: at least `4.5:1`; large text must meet at least `3:1`.
- Do not use very low-opacity text for information users need to read.

## Typography

### Families

- Display and headings: `Benzin`, using `var(--font-heading)`.
- Body and interface text: `Gilroy`, using `var(--font-body)`.
- Keep the existing fallbacks defined in `app/globals.css`.
- Do not introduce a third type family for decoration.

### Heading Style

- Headings are concise, uppercase, and structurally direct.
- Use Benzin at regular or bold weight depending on hierarchy.
- Default letter spacing is `0.02em`, matching the established brand treatment.
- Use fluid `clamp()` sizing for prominent headings.
- Keep display headings at or below `96px` unless an approved composition explicitly requires oversized typographic artwork.
- Balance heading lines and prevent isolated final words where practical.
- Do not force long headings onto one line when doing so risks overflow.

Suggested public-page scale:

| Role | Size guidance | Line height |
| --- | --- | --- |
| Hero title | `clamp(32px, 5vw, 72px)` | `1-1.05` |
| Section title | `clamp(24px, 4vw, 48px)` | `1.1-1.18` |
| Card title | `18-32px` | `1.1-1.2` |
| Body lead | `18-24px` | `1.35-1.5` |
| Body | `15-18px` | `1.45-1.65` |
| Caption/label | `11-13px` | `1.4-1.6` |

### Body Copy

- Use sentence case and Gilroy.
- Prefer short paragraphs with a maximum readable width of approximately `65-75ch`.
- Use medium weight for emphasis rather than all caps.
- Keep marketing language concrete, diagnostic, and outcome-oriented.
- Avoid vague superlatives and decorative jargon.

### Labels

Small uppercase labels may identify categories, stages, or metadata. They must carry information. Do not automatically place a tiny tracked eyebrow above every section heading.

## Layout And Rhythm

### Page Frame

- Public horizontal padding: `24px` on mobile and `40px` from tablet/desktop unless a full-bleed composition requires otherwise.
- Standard content maximum: approximately `1078px` for reading-focused sections.
- Wide composition maximum: approximately `1400-1440px` for heroes, media, and complex grids.
- Center the page frame, not every element within it. Internal compositions may be asymmetric.

### Vertical Rhythm

- Mobile sections generally use `64-96px` vertical padding.
- Desktop sections generally use `120-160px` vertical padding.
- Tighten spacing inside one conceptual group; expand spacing between different ideas.
- Avoid applying one identical section template throughout a page.
- One dominant message or visual event per viewport is preferred on public pages.

### Grids

- Use flexbox for linear relationships and grid for true two-dimensional layouts.
- Two-column editorial compositions should collapse to one clear reading order on mobile.
- Cards must represent genuinely discrete choices, packages, people, cases, or records. Do not turn ordinary prose into card grids.
- Avoid nested cards.

### Dividers

Use whitespace first. When a boundary is needed, use a subtle neutral rule or the established restrained cobalt divider. Dividers should organize content, not decorate every transition.

## Surfaces And Shape

- Page backgrounds are primarily white, cobalt, or near-black with a cobalt cast.
- Standard content-card radius: `12-20px`.
- Buttons, compact tags, filters, and navigation containers may use full pill shapes.
- Avoid oversized rounding on large sections and containers.
- Prefer either a border or a restrained shadow. Do not routinely combine a thin border with a large diffuse shadow.
- Glass and blur are reserved for functional overlay separation, such as the floating desktop navbar. Do not use glassmorphism as a general surface style.
- Decorative stars, grids, glows, and noise require a specific compositional reason and should not become a repeated page motif.

## Navigation

### Desktop

- Preserve the compact floating white pill navigation.
- Keep the original Case Lab logo, direct anchor labels, and one cobalt primary CTA.
- Navigation should remain visually lighter than the page hero.

### Mobile

- Use the approved fullscreen Editorial Cobalt direction.
- Preserve the original logo, large vertical navigation, white pill CTA, safe-area padding, focus trap, Escape handling, focus restoration, inert background, and scroll lock.
- Keep navigation destinations consistent between homepage anchors and non-home routes.
- Do not replace links with cards, icon tiles, or a generic drawer.

## Buttons And Links

### Primary Actions

- On white: cobalt fill with white text.
- On cobalt or dark surfaces: white fill with cobalt text.
- Use a pill shape, clear action verb, and optional simple directional arrow.
- Minimum target size is `44px` in both dimensions.

### Secondary Actions

- Use a quiet border, text treatment, or contextual link.
- Secondary controls must not visually compete with the primary CTA.

### Interaction States

- Hover may shift color, arrow position, or gap slightly.
- Press feedback should be immediate and restrained.
- Do not use elastic, bouncy, or attention-seeking button motion.
- Every interactive element needs a visible keyboard focus state.
- Icon-only buttons require an accessible name.

## Forms And Dialogs

- Inputs use white surfaces, dark text, a subtle neutral border, and a cobalt focus state.
- Labels remain visible; placeholders never replace labels.
- Required fields, validation constraints, and errors must be explicit.
- Errors should appear near the affected control and be announced to assistive technology.
- Preserve user input after recoverable submission failures.
- Keep forms short and explain what happens after submission.

Dialogs must provide:

- semantic dialog markup and an accessible name
- initial focus inside the dialog
- keyboard focus containment
- Escape and explicit close behavior
- focus restoration to the opener
- inert background content and reliable scroll lock
- mobile-safe scrolling when content exceeds the viewport

Lead-generation UI must link to the privacy policy and must not introduce unnecessary fields.

## Imagery And Brand Assets

- Prefer real assets from `public/`: Case Lab branding, partner logos, team portraits, testimonial identities, and case imagery.
- Preserve image proportions and avoid arbitrary crops of logos.
- Use meaningful alt text for informative images; mark decorative imagery appropriately.
- One decisive visual is better than several generic assets.
- Do not use placeholder illustrations, random stock-office photography, or hand-drawn decorative SVGs as substitutes for real project material.
- WebGL or generated visual surfaces may support a hero when they remain branded, performant, and readable beneath content.

## Motion

Motion should support hierarchy, continuity, and brand atmosphere.

### Motion Language

- Preferred entrance: short opacity and vertical translation using an exponential ease-out curve.
- Use stagger only for elements that belong to one sequence.
- Scroll-linked motion should explain progression or reveal relationships, not merely prove that the page can animate.
- Keep hover and tap feedback around `150-250ms`.
- Keep section entrances around `400-800ms`.
- Avoid bounce, elastic easing, excessive parallax, and continuous decorative motion without a clear benefit.
- Content must be visible and usable if animation initialization fails.

### Reduced Motion

Every Framer Motion, GSAP, RAF, WebGL, marquee, carousel, and auto-rotation effect must respond to `prefers-reduced-motion`.

For reduced motion:

- remove translation, scaling, blur, parallax, and continuous movement
- show content immediately or use a brief crossfade
- stop automatic carousels and WebGL animation loops
- avoid smooth programmatic scrolling
- preserve all information and controls

## Responsive Behavior

Design mobile behavior deliberately; do not treat it as a compressed desktop layout.

- Primary supported range begins at `320px` viewport width.
- No heading, table, image, or control may create page-level horizontal overflow.
- Use fluid type and spacing, then add breakpoints only when composition changes.
- Maintain logical reading order when columns stack.
- Keep CTAs reachable and at least `44px` tall.
- Respect safe-area insets for fullscreen mobile interfaces.
- Horizontal scrolling is acceptable only for contained data structures such as the CRM table.
- Test long Russian words, realistic content lengths, zoom, and narrow devices.

## Accessibility Baseline

Accessibility is part of the visual system, not a later correction.

- Use one main landmark per page and semantic section structure.
- Maintain a logical heading hierarchy.
- All functionality must work with keyboard input.
- Preserve the global `:focus-visible` treatment or provide an equally visible contextual alternative.
- Do not encode meaning with color alone.
- Interactive carousels require semantic buttons, selected-state announcements, and user control over automatic movement.
- Dynamic status and error messages must be announced appropriately.
- Decorative SVGs and icons should be hidden from assistive technology.
- Respect browser zoom and text scaling without clipping content.

## Public Page Composition

Public marketing pages should tell a structured argument rather than repeat a template.

A typical page may include:

1. A decisive proposition and primary action
2. The business problem or tension
3. The diagnostic approach or process
4. Concrete deliverables, evidence, or cases
5. Social proof
6. A clear closing action

This is a narrative guide, not a mandatory section count. Vary composition, scale, and background treatment while preserving the brand system.

Public-page rules:

- Use real evidence and specific copy.
- Give each section one dominant purpose.
- Use cobalt moments strategically rather than coloring every section.
- Preserve generous white space.
- Keep CTA wording consistent with the action that follows.
- Do not create empty coming-soon experiences that imply complete editorial content.

## CRM Utility Variant

The `/crm` route is an internal working tool. It shares Case Lab identity but prioritizes density, speed, and legibility over marketing expression.

### CRM Rules

- Use a white or `#f5f5f5` canvas with cobalt for primary actions and active states.
- Use Benzin sparingly for the page title; use Gilroy for all records, controls, labels, and data.
- Use compact spacing and `8-16px` radii.
- Avoid WebGL, decorative gradients, reveal animations, large editorial typography, and marketing-style section pacing.
- Use semantic tables for tabular records and retain contained horizontal scrolling on narrow screens.
- Label search, filters, selects, notes, and password fields explicitly.
- Use semantic status colors with text labels.
- Provide clear loading, empty, success, error, destructive-confirmation, and expired-session states.
- Protect personal data visually and behaviorally: avoid accidental caching, unnecessary display, and uncontrolled bulk exposure.
- Keep editing controls predictable and keyboard accessible.

## Prohibited Patterns

Do not introduce:

- generic SaaS hero layouts or interchangeable agency templates
- beige/cream editorial palettes
- gradient text
- repeated icon-card grids for ordinary content
- cards nested inside cards
- repeated tiny uppercase eyebrows above every section
- arbitrary numbered section labels unless the content is an actual sequence
- decorative glassmorphism
- oversized soft shadows paired with borders
- excessive rounding on large containers
- random accent colors
- stock-office imagery or placeholder illustrations
- motion that hides essential content or ignores reduced-motion preferences
- unlabeled controls, inaccessible custom interactions, or click-only non-button elements
- desktop layouts merely scaled down for mobile

## Implementation Checklist

Before considering a page or component complete, verify:

- The composition communicates one clear hierarchy.
- Benzin and Gilroy are used according to their roles.
- Colors come from the established palette and meet contrast requirements.
- Spacing follows the public or CRM rhythm as appropriate.
- Components use restrained shapes and effects.
- Real project assets are used where imagery is required.
- Desktop, tablet, and mobile layouts are intentional.
- Content works at `320px` and with longer Russian text.
- Keyboard, focus, semantic markup, and screen-reader behavior are correct.
- All motion has a reduced-motion alternative.
- Content remains visible if animation or client JavaScript fails.
- Loading, empty, error, and success states are designed where relevant.
- The result looks recognizably Case Lab rather than generically premium.

When a new design requirement does not fit this system, document the intentional exception in the relevant feature specification before implementation.
