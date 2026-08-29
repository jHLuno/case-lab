# Case Lab 3 Speaker Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Anuar and Perizat speaker visuals on `/case-lab-3` with supplied WebP assets while leaving Forte unchanged.

**Architecture:** Convert the two source JPEG files directly into WebP files in `public/` with `cwebp -q 100`; the existing `CaseLab3Speakers` data array will reference those public paths. No component structure, layout, copy, or other page assets change.

**Tech Stack:** Next.js 16, React 19, TypeScript, `next/image`, WebP assets, Node test runner.

## Global Constraints

- Convert `/Users/arney/Downloads/Anuar.jpg` to `public/Anuar.webp`.
- Convert `/Users/arney/Downloads/Perizat.jpeg` to `public/Perizat.webp`.
- Preserve the source dimensions and use WebP quality `100`.
- Update only the first two `item.image` paths in `app/sections/CaseLab3Speakers.tsx`.
- Leave speaker names, copy, Forte assets, hero assets, and all other page sections unchanged.
- Do not add dependencies or modify unrelated worktree changes.
- Do not commit changes unless the user explicitly requests a commit.

---

### Task 1: Convert Speaker Photos

**Files:**
- Create: `public/Anuar.webp`
- Create: `public/Perizat.webp`

**Interfaces:**
- Consumes: `/Users/arney/Downloads/Anuar.jpg` and `/Users/arney/Downloads/Perizat.jpeg`.
- Produces: browser-ready public assets at `/Anuar.webp` and `/Perizat.webp`, retaining source dimensions.

- [ ] **Step 1: Convert the Anuar source photo**

Run from the repository root:

```bash
cwebp -q 100 "/Users/arney/Downloads/Anuar.jpg" -o "public/Anuar.webp"
```

Expected: `public/Anuar.webp` is created without changing the source file.

- [ ] **Step 2: Convert the Perizat source photo**

Run:

```bash
cwebp -q 100 "/Users/arney/Downloads/Perizat.jpeg" -o "public/Perizat.webp"
```

Expected: `public/Perizat.webp` is created without changing the source file.

- [ ] **Step 3: Verify file formats and dimensions**

Run:

```bash
file "public/Anuar.webp" "public/Perizat.webp"
magick identify "public/Anuar.webp" "public/Perizat.webp"
```

Expected: both files are identified as WebP, with dimensions `1707x2560` for Anuar and `1280x1280` for Perizat.

### Task 2: Point the Speaker Data at the New Assets

**Files:**
- Modify: `app/sections/CaseLab3Speakers.tsx:14,23`

**Interfaces:**
- Consumes: `public/Anuar.webp` and `public/Perizat.webp` from Task 1.
- Produces: all existing desktop, motion, and accessible responsive speaker render paths use the new images through the shared `cases` data array.

- [ ] **Step 1: Replace only the first two image paths**

Change the first two entries in the existing `cases` array to:

```tsx
    image: "/Anuar.webp",
```

and:

```tsx
    image: "/Perizat.webp",
```

Keep the third entry exactly as:

```tsx
    image: "/ForteXGForce.webp",
```

Do not change the names, captions, roles, descriptions, motion setup, markup, or CSS.

- [ ] **Step 2: Review the focused diff**

Run:

```bash
git diff -- app/sections/CaseLab3Speakers.tsx
```

Expected: the diff contains only the two speaker image path replacements.

### Task 3: Run Verification

**Files:**
- Test: `tests/case-lab-3-assets.test.mjs`
- Check: `app/sections/CaseLab3Speakers.tsx`

**Interfaces:**
- Consumes: the generated assets and updated speaker data from Tasks 1 and 2.
- Produces: evidence that the existing Case Lab 3 asset invariants and TypeScript compile check remain valid.

- [ ] **Step 1: Verify the speaker references directly**

Run:

```bash
node -e 'const fs=require("fs"); const source=fs.readFileSync("app/sections/CaseLab3Speakers.tsx","utf8"); for (const path of ["/Anuar.webp","/Perizat.webp","/ForteXGForce.webp"]) if (!source.includes(`image: "${path}"`)) throw new Error(`Missing ${path}`); console.log("speaker image references verified")'
```

Expected: prints `speaker image references verified` and exits with status 0.

- [ ] **Step 2: Run the focused Case Lab 3 asset tests**

Run:

```bash
node --test tests/case-lab-3-assets.test.mjs
```

Expected: all tests pass with zero failures.

- [ ] **Step 3: Run the TypeScript check**

Run:

```bash
npx tsc --noEmit --incremental false
```

Expected: command exits with status 0.

- [ ] **Step 4: Run lint and production build**

Run:

```bash
npm run lint
npm run build
```

Expected: both commands exit with status 0 without ESLint or TypeScript errors.
