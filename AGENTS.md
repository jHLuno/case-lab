<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Repository Guidelines

## Project Structure

- Case Lab is Russian-language marketing site for marketing diagnostics and growth strategy. Production domain: `caselab.kz`.
- Stack: Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 4, Framer Motion, GSAP/ScrollTrigger, React Three Fiber, Supabase. `@/*` resolves to `app/*`.
- `app/components/HomePage.tsx` composes homepage. Individual sections live in `app/sections/`; shared interaction lives in `app/components/`; API routes live in `app/api/`.
- Main routes: `/`, `/crm`, `/privacy`, four static `/insights/*` routes. `supabase/migrations/20260512000000_create_leads.sql` is only schema migration.
- `SmoothScrollProvider.tsx` exists but is not mounted. Do not assume Lenis is active.

## Design And Accessibility

- Preserve editorial Case Lab visual system: cobalt `#040082`, white, near-black `#0a0a0a`, Benzin uppercase display headings, Gilroy body type, large spacing, rounded pills/cards, restrained motion, real assets from `public/`.
- Approved mobile navigation direction: `docs/superpowers/specs/2026-05-12-mobile-menu-editorial-cobalt-design.md`. Preserve desktop navigation, anchor destinations, fullscreen cobalt menu, safe areas, focus trap, Escape close, focus restoration, inert background, and scroll lock in `Navbar.tsx`.
- Global focus-visible styling exists in `app/globals.css`. `LeadPopup.tsx` currently supports Escape, backdrop close, labels, validation, and scroll lock, but has no dialog semantics or focus trap. Add these before claiming modal accessibility.
- Reduced-motion support is incomplete: CSS only adjusts scroll behavior and marquee duration. Framer, GSAP, WebGL, auto-rotation, and RAF effects need explicit handling when touched.
- Homepage dynamically loads eight sections with `ssr: false`; `gsap-hidden` elements remain invisible until client JS. Avoid widening this client-only boundary without performance/SEO review.

## Commands And Conventions

- Use npm: `npm run dev`, `npm run build`, `npm run start`, `npx tsc --noEmit --incremental false`.
- `npm run lint` is broken because Next 16 removed `next lint`; `npx eslint .` also scans generated `.worktrees` output without ignores. Repair lint command/config before relying on lint CI. ESLint flat config is `eslint.config.mjs`.
- No application test runner or test suite exists.
- Follow strict TypeScript and existing component patterns. Recent commits use lowercase Conventional Commits, often scoped: `fix(popup): ...`, `feat(team): ...`, `chore: ...`.

## Data And Security

- Leads are personal data. Never log, commit, expose, or copy `.env.local`, lead records, CRM password, service-role keys, or credentials.
- Public submission is `POST /api/leads`. CRM routes self-enforce cookie JWT authentication and use Supabase service role only server-side. Session cookie is one hour, `httpOnly`, `Secure` in production, and `SameSite=Strict`.
- Preserve RLS on `public.leads`; never expose `SUPABASE_SERVICE_ROLE_KEY` through `NEXT_PUBLIC_*` or client code. Current anon INSERT policy is `WITH CHECK (true)`, so direct Supabase inserts bypass API validation and rate limiting. Treat database-side validation and shared abuse protection as hardening backlog.
- Current rate limiter is per-process, unbounded, five requests per 15 minutes, and keyed from forwarded IP headers. Do not treat it as durable multi-instance protection.
- `public/_headers` defines CSP and security headers, but effectiveness depends on deployment host honoring this file; Next config does not configure headers. CSP currently permits inline and eval scripts.
- `next@16.2.4` has known `npm audit` findings. Update framework/dependencies deliberately.
