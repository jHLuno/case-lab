# Case Lab 3 Scroll Cases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the static Case Lab 3 speakers gallery and lower case rows with a pinned, scroll-driven three-state case showcase on desktop and tablet, while preserving a normal mobile fallback.

**Architecture:** Keep the existing `CaseLab3Speakers` client component and case data. Render one fixed stage with three image slots and one copy slot; each slot contains three layers so GSAP can crossfade the correct case without changing layout. A `ScrollTrigger`-scrubbed timeline controls the three cyclic arrangements, and `gsap.matchMedia()` limits initialization to `min-width: 768px`; mobile renders the same content in normal flow.

**Tech Stack:** Next.js App Router, React 19, TypeScript, CSS Modules, GSAP 3 `ScrollTrigger`, existing Lenis smooth-scroll integration, `next/image`.

## Global Constraints

- Keep the existing Case Lab visual language, content, anchors, and responsive behavior.
- Use only the current GSAP dependency; do not add packages or assets.
- Do not modify unrelated worktree changes.
- Desktop/tablet breakpoint is `min-width: 768px`; mobile must not initialize ScrollTrigger.
- Keep `prefers-reduced-motion` behavior: preserve state changes and pinning, but remove crossfade, scale, and translate animation.
- Remove the old lower `caseList` rows; do not repeat numeric indexes or company names in the active case copy.
- Preserve semantic heading/paragraph structure and expose only the active copy layer to assistive technology.
- Do not change `app/components/CaseLab3Page.tsx` or page order.

---

### Task 1: Replace the static gallery markup with the scroll-stage structure

**Files:**
- Modify: `app/sections/CaseLab3Speakers.tsx:1-90`

**Interfaces:**
- Consumes: existing `cases` data, `Image`, and CSS module classes.
- Produces: a stage wrapper ref, a pinned stage ref, three visual slots, three copy layers, and three scroll-step markers for the GSAP task.

- [ ] **Step 1: Define the cyclic slot states beside the existing case data**

Keep the current `cases` objects and add this mapping after them:

```tsx
const caseStates = [
  [0, 1, 2],
  [1, 2, 0],
  [2, 0, 1],
] as const;
```

Each inner tuple maps `[featuredSlot, supportingSlotOne, supportingSlotTwo]` to an index in `cases`.

- [ ] **Step 2: Add React refs and GSAP imports**

At the top of the client component, import `useLayoutEffect` and `useRef` from React, plus GSAP and `ScrollTrigger`:

```tsx
import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);
```

The component will use `sceneRef` for the scroll range, `stageRef` for the pinned stage, and arrays of element refs for image/copy layers.

- [ ] **Step 3: Render the stage and layer arrays**

Replace the current `speakerVisualGrid` map and `caseList` map with this structure inside `contentShell` after the intro:

```tsx
<div ref={sceneRef} className={styles.speakerScene}>
  <div ref={stageRef} className={styles.speakerStage}>
    <div className={styles.speakerStageGrid}>
      <div className={`${styles.speakerStageSlot} ${styles.speakerStageFeature}`}>
        {cases.map((item, caseIndex) => (
          <figure
            key={`feature-${item.company}`}
            ref={(element) => {
              featureLayersRef.current[caseIndex] = element;
            }}
            className={styles.speakerStageCard}
            aria-hidden={caseIndex !== 0}
          >
            <Image src={item.image} alt="" fill sizes="(max-width: 1100px) 55vw, 58vw" className="object-cover" />
            <div className={styles.speakerVisualShade} aria-hidden="true" />
            <figcaption>
              <span>{item.company}</span>
            </figcaption>
          </figure>
        ))}
      </div>

      <div className={styles.speakerStageRail}>
        {[supportingLayersOneRef, supportingLayersTwoRef].map((layerRefs, slotIndex) => (
          <div key={slotIndex} className={styles.speakerStageSlot}>
            {cases.map((item, caseIndex) => (
              <figure
                key={`${slotIndex}-${item.company}`}
                ref={(element) => {
                  layerRefs.current[caseIndex] = element;
                }}
                className={styles.speakerStageCard}
                aria-hidden="true"
              >
                <Image src={item.image} alt="" fill sizes="(max-width: 1100px) 22vw, 24vw" className="object-cover" />
                <div className={styles.speakerVisualShade} aria-hidden="true" />
                <figcaption>
                  <span>{item.company}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        ))}
      </div>

      <div className={styles.speakerStageCopy}>
        {cases.map((item, caseIndex) => (
          <article
            key={`${item.company}-copy`}
            ref={(element) => {
              copyLayersRef.current[caseIndex] = element;
            }}
            className={styles.speakerStageCopyLayer}
            aria-hidden={caseIndex !== 0}
          >
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </article>
        ))}
      </div>
    </div>
  </div>

  <div className={styles.speakerSceneSteps} aria-hidden="true">
    {caseStates.map((_, index) => <span key={index} />)}
  </div>
</div>
```

The final implementation should remove numeric indexes, company headings, and the company-bearing `role` string from the copy layers. Company names may remain only in image captions; active copy must contain only the case title and description.

- [ ] **Step 4: Keep the mobile fallback in source order**

Render a separate `.speakerMobileCases` list after the desktop stage, using the existing case data and semantic copy. Hide it on desktop and show it below `768px`. Each mobile item includes its image, company caption, title, and description. This avoids initializing GSAP or relying on desktop absolute layers on mobile.

- [ ] **Step 5: Run TypeScript before adding animation logic**

Run: `npx tsc --noEmit --incremental false`

Expected: no TypeScript errors. If the callback ref type is rejected, use `(element: HTMLElement | null) => { ... }` on the relevant refs without changing the public component interface.

### Task 2: Add the ScrollTrigger timeline and reduced-motion state handling

**Files:**
- Modify: `app/sections/CaseLab3Speakers.tsx` after the component refs and before the JSX return

**Interfaces:**
- Consumes: `sceneRef`, `stageRef`, `featureLayersRef`, `supportingLayersOneRef`, `supportingLayersTwoRef`, `copyLayersRef`, and `caseStates` from Task 1.
- Produces: a cleaned-up GSAP media-query context that pins the stage and synchronizes all four slots across three scroll states.

- [ ] **Step 1: Create stable refs for all layers**

Use these refs in the component:

```tsx
const sceneRef = useRef<HTMLDivElement>(null);
const stageRef = useRef<HTMLDivElement>(null);
const featureLayersRef = useRef<(HTMLElement | null)[]>([]);
const supportingLayersOneRef = useRef<(HTMLElement | null)[]>([]);
const supportingLayersTwoRef = useRef<(HTMLElement | null)[]>([]);
const copyLayersRef = useRef<(HTMLElement | null)[]>([]);
```

- [ ] **Step 2: Initialize only for tablet and desktop**

Create a `useLayoutEffect` that returns immediately when `sceneRef.current` or `stageRef.current` is missing. Inside `gsap.context`, create `const media = gsap.matchMedia()` and call `media.add("(min-width: 768px)", () => { ... })`. Return `() => { media.revert(); }` from the effect, with no trigger created for mobile.

- [ ] **Step 3: Set the initial state and helper functions**

Inside the media-query callback, define the slot layers in this order:

```tsx
const slots = [
  featureLayersRef.current,
  supportingLayersOneRef.current,
  supportingLayersTwoRef.current,
];

const setState = (stateIndex: number) => {
  const state = caseStates[stateIndex];
  slots.forEach((slot, slotIndex) => {
    slot.forEach((layer, caseIndex) => {
      if (layer) gsap.set(layer, { opacity: caseIndex === state[slotIndex] ? 1 : 0, scale: 1 });
    });
  });
  copyLayersRef.current.forEach((layer, caseIndex) => {
    if (!layer) return;
    gsap.set(layer, { opacity: caseIndex === stateIndex ? 1 : 0, y: 0 });
    layer.setAttribute("aria-hidden", String(caseIndex !== stateIndex));
  });
};
```

Call `setState(0)` before creating the timeline. The initial state is Invictus GO featured, with Qara Studios and Forte Bank supporting it.

- [ ] **Step 4: Build the scrubbed three-state timeline**

Create a timeline with `defaults: { ease: "power2.inOut" }`. Add a short hold for state 0, then for each transition from state `i` to `i + 1` fade the outgoing and incoming layers over `0.32` timeline units. Keep a hold after the final state. Use the state tuples to identify the outgoing and incoming case layer for every slot:

```tsx
const timeline = gsap.timeline({ defaults: { ease: "power2.inOut" } });
timeline.to({}, { duration: 0.8 });

caseStates.slice(1).forEach((state, transitionIndex) => {
  const fromState = caseStates[transitionIndex];
  slots.forEach((slot, slotIndex) => {
    const outgoing = slot[fromState[slotIndex]];
    const incoming = slot[state[slotIndex]];
    if (outgoing) timeline.to(outgoing, { opacity: 0, scale: 1.035, duration: 0.32 }, "<");
    if (incoming) timeline.fromTo(incoming, { opacity: 0, scale: 0.985 }, { opacity: 1, scale: 1, duration: 0.32 }, "<");
  });
  const outgoingCopy = copyLayersRef.current[transitionIndex];
  const incomingCopy = copyLayersRef.current[transitionIndex + 1];
  if (outgoingCopy) timeline.to(outgoingCopy, { opacity: 0, y: 10, duration: 0.24 }, "<");
  if (incomingCopy) timeline.fromTo(incomingCopy, { opacity: 0, y: -10 }, { opacity: 1, y: 0, duration: 0.24 }, "<");
  timeline.to({}, { duration: 0.8 });
});
```

Attach the timeline to a ScrollTrigger with `trigger: sceneRef.current`, `start: "top top"`, `end: "bottom bottom"`, `pin: stageRef.current`, `scrub: 1`, and `invalidateOnRefresh: true`.

- [ ] **Step 5: Add reduced-motion handling**

Inside the single `media.add("(min-width: 768px)", (context) => { ... })` callback, read `window.matchMedia("(prefers-reduced-motion: reduce)").matches`. For reduced motion, create a pinned ScrollTrigger without the scrubbed tween timeline; its `onUpdate` computes the active state using `Math.min(caseStates.length - 1, Math.floor(self.progress * caseStates.length))` and calls `setState` only when the state index changes. For normal motion, create the scrubbed timeline and its ScrollTrigger. This avoids two overlapping desktop triggers when reduced motion is enabled, and both branches clean up through `media.revert()`.

- [ ] **Step 6: Run lint and TypeScript**

Run: `npx tsc --noEmit --incremental false && npm run lint`

Expected: both commands exit with status 0 and no React hooks, GSAP, or ref warnings.

### Task 3: Style the pinned stage and responsive fallback

**Files:**
- Modify: `app/case-lab-3/case-lab-3.module.css` around the existing `.speakerVisualGrid` and `.caseList` rules and the media queries

**Interfaces:**
- Consumes: the class names rendered by Task 1.
- Produces: desktop/tablet two-column stage, layered visual/copy transitions, and mobile stacked fallback.

- [ ] **Step 1: Replace the old desktop gallery rules**

Replace `.speakerVisualGrid`, `.speakerVisualFeature`, `.speakerVisual`, `.speakerVisualFeature .speakerVisual`, and the old `.caseList`/`.caseRow` rules with these layout primitives:

```css
.speakerScene {
  position: relative;
  min-height: 300svh;
  margin-top: 68px;
}

.speakerStage {
  display: flex;
  min-height: 100svh;
  align-items: center;
}

.speakerStageGrid {
  display: grid;
  width: 100%;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, .85fr);
  grid-template-rows: minmax(0, 1fr) minmax(0, .58fr);
  gap: 12px;
  min-height: min(72svh, 680px);
}

.speakerStageRail {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.speakerStageSlot,
.speakerStageCopy {
  position: relative;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border-radius: 26px;
}

.speakerStageFeature {
  grid-row: 1 / span 2;
}

.speakerStageCard,
.speakerStageCopyLayer {
  position: absolute;
  inset: 0;
  margin: 0;
}

.speakerStageCard {
  overflow: hidden;
  border-radius: inherit;
  background: #161433;
  opacity: 0;
  transform: scale(.985);
}

.speakerStageCard:first-child,
.speakerStageCopyLayer:first-child {
  opacity: 1;
}

.speakerStageCard figcaption {
  position: absolute;
  z-index: 2;
  right: 16px;
  bottom: 16px;
  left: 16px;
  color: #fff;
  font-family: var(--font-heading);
  font-size: clamp(16px, 1.5vw, 22px);
  line-height: 1;
}

.speakerStageCopy {
  grid-column: 2;
  padding: clamp(22px, 3vw, 42px);
  border: 1px solid rgba(10, 10, 22, .12);
  background: #f7f7fb;
}

.speakerStageCopyLayer {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: inherit;
  background: #f7f7fb;
  opacity: 0;
}

.speakerStageCopyLayer h3 {
  max-width: 14ch;
  margin: 14px 0 0;
  font-family: var(--font-heading);
  font-size: clamp(24px, 3vw, 44px);
  font-weight: 400;
  line-height: .98;
  letter-spacing: -.03em;
}

.speakerStageCopyLayer > p:last-child {
  max-width: 40ch;
  margin: 18px 0 0;
  color: #676672;
  font-size: 15px;
  line-height: 1.45;
}

.speakerSceneSteps,
.speakerMobileCases {
  display: none;
}
```

Do not keep the old lower `caseList` styles unless another component uses them; remove unused `.caseIndex`, `.caseRow h3`, `.caseTitle`, `.caseRole`, and `.caseDescription` rules only if they are no longer referenced elsewhere in this module.

- [ ] **Step 2: Add tablet sizing**

Inside `@media (max-width: 900px)`, make the stage fit shorter tablet viewports without collapsing the rail:

```css
.speakerStageGrid {
  grid-template-columns: minmax(0, 1.12fr) minmax(250px, .88fr);
  min-height: min(70svh, 600px);
}

.speakerStageCopyLayer h3 {
  font-size: clamp(22px, 3.2vw, 34px);
}
```

- [ ] **Step 3: Add the mobile non-pinned fallback**

Inside `@media (max-width: 767px)`, hide `.speakerScene` and show `.speakerMobileCases`. Use the existing mobile spacing and rounded image treatment:

```css
.speakerScene { display: none; }

.speakerMobileCases {
  display: grid;
  gap: 12px;
  margin-top: 42px;
}

.speakerMobileCase {
  display: grid;
  gap: 18px;
  padding: 16px;
  border: 1px solid rgba(10, 10, 22, .12);
  border-radius: 22px;
  background: #f7f7fb;
}

.speakerMobileImage {
  position: relative;
  min-height: 280px;
  overflow: hidden;
  border-radius: 16px;
  background: #161433;
}

.speakerMobileCase h3 {
  margin: 0;
  font-family: var(--font-heading);
  font-size: 26px;
  font-weight: 400;
  line-height: 1;
}

.speakerMobileCase p:last-child {
  margin: 12px 0 0;
  color: #676672;
  font-size: 14px;
  line-height: 1.4;
}
```

- [ ] **Step 4: Keep reduced motion CSS compatible**

Do not add a CSS animation. Keep the existing reduced-motion block and add:

```css
@media (prefers-reduced-motion: reduce) {
  .speakerStageCard,
  .speakerStageCopyLayer {
    transition: none;
  }
}
```

The actual state jump is handled by the reduced-motion ScrollTrigger branch in Task 2.

- [ ] **Step 5: Run the static checks**

Run: `npx tsc --noEmit --incremental false && npm run lint`

Expected: both commands pass with no CSS module or JSX class-name errors.

### Task 4: Verify the complete change and inspect the diff

**Files:**
- Verify: `app/sections/CaseLab3Speakers.tsx`
- Verify: `app/case-lab-3/case-lab-3.module.css`
- Verify: `docs/superpowers/specs/2026-08-19-case-lab-3-scroll-cases-design.md`
- Verify: `docs/superpowers/plans/2026-08-19-case-lab-3-scroll-cases.md`

**Interfaces:**
- Consumes: all implementation changes from Tasks 1-3.
- Produces: a type-safe, lint-clean, production-buildable Case Lab 3 page without changes to unrelated worktree files.

- [ ] **Step 1: Run the required TypeScript check**

Run: `npx tsc --noEmit --incremental false`

Expected: exit status 0.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit status 0.

- [ ] **Step 3: Run the production build**

Run: `npm run build`

Expected: exit status 0 with the `/case-lab-3` route included in the build.

- [ ] **Step 4: Inspect only the intended diff**

Run: `git diff -- app/sections/CaseLab3Speakers.tsx app/case-lab-3/case-lab-3.module.css docs/superpowers/specs/2026-08-19-case-lab-3-scroll-cases-design.md docs/superpowers/plans/2026-08-19-case-lab-3-scroll-cases.md`

Expected: the implementation diff is limited to the scroll-stage component/CSS and the two planning documents. Existing changes in other files remain untouched.

- [ ] **Step 5: Check worktree status without staging or committing unrelated files**

Run: `git status --short`

Expected: only the intended implementation/spec/plan files appear as new or modified in addition to the pre-existing worktree changes. Do not stage or commit unless explicitly requested.
