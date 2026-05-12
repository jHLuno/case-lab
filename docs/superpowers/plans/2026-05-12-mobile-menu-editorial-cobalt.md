# Editorial Cobalt Mobile Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current dark mobile fullscreen menu with a brand-blue Editorial Cobalt menu that uses the original Case Lab logo and preserves existing accessibility behavior.

**Architecture:** Keep the change isolated to the mobile portion of `app/components/Navbar.tsx`. Reuse the existing state, focus trap, close behavior, and Framer Motion structure, and only replace the overlay visual language, layout, and mobile-only motion details.

**Tech Stack:** Next.js App Router, React, TypeScript, Framer Motion, Tailwind CSS, `next/image`, `lucide-react`

---

### Task 1: Restyle The Mobile Menu Overlay

**Files:**
- Modify: `app/components/Navbar.tsx`
- Verify: `docs/superpowers/specs/2026-05-12-mobile-menu-editorial-cobalt-design.md`

- [ ] **Step 1: Re-read the approved design constraints**

Confirm the implementation matches these approved points from `docs/superpowers/specs/2026-05-12-mobile-menu-editorial-cobalt-design.md`:

```md
- fullscreen mobile overlay
- brand-blue background centered on #040082
- original Logo.png without inversion
- large editorial one-column nav links
- white pill CTA with blue text/icon
- retain current focus trap, Escape close, and return-focus behavior
- desktop navbar unchanged
```

- [ ] **Step 2: Update the mobile overlay shell and top bar**

Modify the mobile menu container in `app/components/Navbar.tsx` so the overlay uses a layered blue background instead of `bg-[#02020a]/95`, and replace the inverted-logo header with the original logo plus a light circular close button.

Target areas to replace:

```tsx
className="fixed inset-0 z-[60] bg-[#02020a]/95 backdrop-blur-xl flex flex-col"
```

```tsx
<Image
  src="/Logo.png"
  alt="Case Lab"
  fill
  className="object-contain invert"
  priority
  sizes="140px"
/>
```

Replace with a shell shaped like this:

```tsx
className="fixed inset-0 z-[60] overflow-hidden bg-[#040082] text-white"
```

And a top area shaped like this:

```tsx
<div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-3">
  <div className="relative h-8 w-[148px] rounded-full bg-white/10 px-3 py-1 backdrop-blur-sm">
    <Image
      src="/Logo.png"
      alt="Case Lab"
      fill
      className="object-contain p-2"
      priority
      sizes="148px"
    />
  </div>
  <button
    type="button"
    onClick={() => {
      setMobileOpen(false);
      toggleRef.current?.focus();
    }}
    className="flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors duration-300 active:bg-white/20"
    aria-label="Закрыть меню"
  >
    <X size={20} strokeWidth={1.75} />
  </button>
</div>
```

- [ ] **Step 3: Add the Editorial Cobalt background layers**

Inside the overlay wrapper, add decorative absolute layers before the content so the blue background has depth without becoming noisy.

Insert elements shaped like this near the top of the overlay:

```tsx
<div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.18),transparent_32%),radial-gradient(circle_at_75%_30%,rgba(120,150,255,0.22),transparent_28%),linear-gradient(180deg,#0a0f9f_0%,#040082_45%,#03045e_100%)]" />
<div className="absolute inset-x-0 top-0 h-px bg-white/20" />
```

These layers should remain purely decorative and should not wrap or interfere with focusable content.

- [ ] **Step 4: Replace the current mobile nav list styling with editorial typography**

Update the mobile link block so it no longer uses compact `text-[28px] py-3` links. Keep the same `navLinks.map(...)` structure and click behavior, but change the presentation to a single large editorial stack.

Reshape the nav area roughly like this:

```tsx
<div className="relative z-10 flex flex-1 flex-col px-6 pt-10 pb-6">
  <div className="flex flex-col gap-1">
    {navLinks.map((link, i) => (
      <motion.a
        key={link.label}
        href={link.href}
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.06 + 0.08, duration: 0.42 }}
        onClick={() => {
          setMobileOpen(false);
          toggleRef.current?.focus();
        }}
        className="group py-3 text-[clamp(30px,8vw,38px)] leading-[1.02] tracking-[-0.03em] text-white/92 transition-all duration-300 active:translate-x-1 active:text-white"
        style={{ fontFamily: "var(--font-heading)" }}
      >
        <span className="inline-block border-b border-transparent pb-1 group-active:border-white/50">
          {link.label}
        </span>
      </motion.a>
    ))}
  </div>
```

This keeps the information architecture unchanged while upgrading the feel from utility navigation to brand-led navigation.

- [ ] **Step 5: Replace the current CTA block with the approved bottom section**

Keep the `/contact/` destination and close behavior, but move the CTA into a bottom block with one supporting line beneath it.

Implement a block shaped like this:

```tsx
<div className="mt-auto pt-10">
  <motion.a
    href="/contact/"
    initial={{ opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: 0.28, duration: 0.42 }}
    onClick={() => {
      setMobileOpen(false);
      toggleRef.current?.focus();
    }}
    className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-[14px] font-normal text-[#040082] transition-transform duration-300 active:scale-[0.98]"
    style={{ fontFamily: "var(--font-body)" }}
  >
    Записаться
    <ArrowRight size={14} strokeWidth={2.5} />
  </motion.a>

  <p
    className="mt-4 max-w-[260px] text-[13px] leading-[1.45] text-white/68"
    style={{ fontFamily: "var(--font-body)" }}
  >
    Диагностика маркетинга для команд, которым нужен ясный следующий шаг.
  </p>
</div>
```

- [ ] **Step 6: Verify the change compiles**

Run:

```bash
npm run build
```

Expected:
- build succeeds
- existing Supabase warning may still appear
- no TypeScript or JSX errors from `Navbar.tsx`

- [ ] **Step 7: Commit the mobile menu restyle**

```bash
git add app/components/Navbar.tsx docs/superpowers/specs/2026-05-12-mobile-menu-editorial-cobalt-design.md docs/superpowers/plans/2026-05-12-mobile-menu-editorial-cobalt.md
git commit -m "feat(navbar): restyle mobile menu with editorial cobalt overlay"
```

### Task 2: Verify Behavior And Polish

**Files:**
- Modify: `app/components/Navbar.tsx` if any spacing or motion correction is needed

- [ ] **Step 1: Re-check mobile-only behavior against the spec**

Confirm the implemented mobile menu still satisfies the approved behavior:

```md
- fullscreen mobile overlay remains in place
- original logo remains visible and not inverted
- desktop navbar remains unchanged
- existing nav destinations remain unchanged
- focus trap and Escape handling still exist in the component
- menu closes and returns focus to the toggle button
```

- [ ] **Step 2: Verify no accidental desktop regression was introduced**

Inspect `Navbar.tsx` and ensure all changed class names are inside the mobile-only overlay/button section, not the desktop nav links or desktop CTA.

Desktop sections that must remain unchanged:

```tsx
<div className="hidden md:flex items-center">
```

```tsx
<a
  href="/contact/"
  className="hidden md:inline-flex ..."
>
```

- [ ] **Step 3: Run the production build one more time after any polish edits**

Run:

```bash
npm run build
```

Expected:
- build succeeds again
- no new warnings except the already-known Supabase configuration warning

- [ ] **Step 4: Push the final navbar change**

```bash
git push
```
