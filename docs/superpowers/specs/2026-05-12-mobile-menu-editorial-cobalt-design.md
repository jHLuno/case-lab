## Mobile Menu Design: Editorial Cobalt

Date: 2026-05-12
Project: Case Lab mobile navigation menu
Status: Approved for spec review

### Goal

Replace the current dark mobile fullscreen menu with a branded, premium blue menu that feels native to the Case Lab visual language while keeping the existing navigation structure and accessibility behavior.

### Context

Current mobile menu behavior in `app/components/Navbar.tsx`:
- fullscreen overlay
- nearly black background
- white text
- inverted logo
- simple staggered link animation

Problems to solve:
- feels too dark and heavy
- feels disconnected from the white/blue Case Lab brand language
- logo treatment is generic instead of brand-led

### Chosen Direction

Direction: Editorial Cobalt

This direction uses a firm brand-blue fullscreen canvas, large editorial navigation typography, the original logo, a clean white CTA, and restrained motion.

### Layout

The mobile menu remains a fullscreen overlay.

Structure:
1. Top bar
2. Primary navigation block
3. Bottom CTA and supporting brand text

#### Top Bar

- left: original `Logo.png`
- right: circular close button with `X`
- no logo inversion
- no separate dark header strip

#### Primary Navigation Block

Menu items remain:
- Кейсы
- Подход
- Процесс
- Результаты

Presentation:
- single vertical column
- large text treatment
- generous vertical spacing
- no cards, tiles, or icons on each link

#### Bottom CTA Block

- primary CTA: `Записаться`
- visual treatment: white pill button with blue text/icon
- supporting line below CTA:
  `Диагностика маркетинга для команд, которым нужен ясный следующий шаг.`

### Visual Style

#### Background

- base color anchored to the Case Lab blue family, centered on `#040082`
- subtle gradient so the background is not flat
- optional soft blurred light areas for depth
- no black-heavy overlay tone
- no neon effects

#### Logo Treatment

- use the original logo asset
- keep original colors
- if separation is needed, use a very subtle translucent white backing or soft glow behind the logo
- do not invert the logo

#### Typography

- links should feel like editorial navigation, not utility nav
- color: near-white
- size: large mobile display scale, roughly in the 30-36px range
- calm, premium rhythm
- no unnecessary decorative treatments

#### CTA

- white rounded pill
- blue text and icon
- strongest action emphasis on the screen

#### Close Button

- circular, lightly translucent light surface
- visually aligned with the CTA style
- simple `X`, not oversized

### Motion

Opening sequence:
- overlay fades in quickly
- top bar appears first
- nav items animate upward with short stagger
- CTA appears last

Closing sequence:
- reverse quickly without feeling abrupt

Motion tone:
- restrained and premium
- no elastic movement
- no flashy glow animation

### Interaction

- preserve current focus trap and Escape handling
- preserve keyboard accessibility
- preserve click-to-close on nav item tap
- return focus to the toggle button on explicit close actions such as the close button and Escape
- do not force focus back to the toggle after activating a navigation link or CTA
- keep section-link semantics unchanged: on the homepage they behave as section anchors, and on non-home pages they route to the matching homepage section
- lock document scroll while the fullscreen menu is open

Tap states:
- links can brighten slightly and shift a few pixels horizontally
- CTA can use a subtle press state
- avoid heavy hover-like effects on mobile

### Implementation Scope

Target file:
- `app/components/Navbar.tsx`

Expected change scope:
- mobile menu overlay styling
- mobile logo treatment
- mobile close button styling
- mobile nav item typography and spacing
- CTA styling inside mobile menu
- supporting brand text block
- motion tuning for overlay and links

Do not change:
- desktop navbar layout
- the intended section destinations of the existing nav items
- existing accessibility behaviors unless required for the new layout

### Acceptance Criteria

- mobile menu uses a brand-blue fullscreen treatment instead of the current dark overlay
- original logo is visible in the menu and is not inverted
- menu feels visually aligned with Case Lab branding
- primary nav remains clear and readable on small screens
- CTA remains prominent and easy to tap
- desktop navbar remains unchanged
- current focus trap and close behavior still work

### Non-Goals

- redesigning desktop navigation
- changing information architecture
- introducing tile/grid navigation
- adding new menu sections or social links

### Recommendation

Implement the mobile menu as a fullscreen `Editorial Cobalt` overlay in the existing `Navbar.tsx`, keeping behavior intact and replacing only the visual language and motion details.
