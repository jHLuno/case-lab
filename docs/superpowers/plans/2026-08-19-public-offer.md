# Public Offer Implementation Plan

**Goal:** Add a public offer page and link to it from the homepage footer.

**Architecture:** Create the `/offer/` App Router page as a server component, following the existing `/privacy/` legal-page layout and typography. Add a second legal-document link beside the privacy link in the shared `Footer` component.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, `lucide-react`.

## Global Constraints

- Reuse the existing legal-page visual language and footer patterns.
- Do not add dependencies or alter unrelated worktree changes.
- Preserve the supplied offer text and its Russian-language content.

### Task 1: Add Footer Link

**Files:**
- Modify: `app/components/Footer.tsx:121-129`

- [ ] Add an anchor with `href="/offer/"` and label `Договор оферты` beside the existing privacy-policy link.
- [ ] Preserve the existing spacing, typography, hover state, and responsive behavior.

### Task 2: Add Public Offer Page

**Files:**
- Create: `app/offer/page.tsx`

- [ ] Add page metadata for the public offer.
- [ ] Render the supplied 20-section offer text as readable headings, paragraphs, lists, email links, and organizer details.
- [ ] Match `/privacy/` page layout, back link, typography, spacing, and responsive behavior.

### Task 3: Verify

**Files:**
- None.

- [ ] Run `npx tsc --noEmit --incremental false`.
- [ ] Run `npm run build`.
- [ ] Confirm the new route and footer link are included without changing unrelated files.
