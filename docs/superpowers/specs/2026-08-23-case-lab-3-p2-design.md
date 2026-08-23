# Case Lab 3 P2 Hardening Design

## Goal

Закрыть применимые P2-дефекты страницы Case Lab 3 без изменения страниц публичной оферты и политики конфиденциальности, сохранив GSAP-сцену спикеров и добавив честный визуальный CTA `Посмотреть отзыв` без video promise.

## Scope

- Исправить P2 accessibility, responsive, semantics, motion, performance, SEO, CSP, design-token и test issues.
- Сохранить смену изображений и описаний в speaker section как основной визуальный приём.
- Оставить имя третьего спикера как `Спикер уточняется`, пока подтверждённых данных нет.
- Не изменять `app/offer/**`, `app/privacy/**` и связанные legal copy.
- Не возвращать видео, iframe, video promise или несуществующие review URLs.

## Architecture

Speaker section сохраняет GSAP choreography, но визуальные desktop layers становятся декоративными и загружаются только при приближении к viewport. Доступный контент будет представлен одним semantic tree с именами, ролями, кейсами и описаниями; mobile cards используют этот tree вместо отдельной копии.

Static page content будет вынесен из лишних Client Component boundaries. JSON-LD и event metadata остаются Server Components, homepage-only Service schema отделяется от event route, а hero CTA становится обычной ссылкой с CSS-эффектом вместо OGL/WebGL-кнопки.

## Planned Changes

### Accessibility And Semantics

- Focus hash targets after mobile navigation and keep Escape focus restoration.
- Apply reduced-motion behavior to ScrollReveal, Navbar, BackToTop and speaker choreography.
- Remove false click affordance from non-link archive cards.
- Hide marquee clone from assistive technology and make all repeated portraits decorative.
- Use surface-aware contrast tokens for testimonial roles, footer metadata and focus rings.
- Pass route-specific mobile menu description instead of generic marketing-diagnostics copy.
- Keep one `main` landmark per non-legal route while leaving legal pages untouched.

### Speaker Animation

- Keep existing GSAP image/copy transitions and case order.
- Mark visual layers `aria-hidden` and keep one semantic speaker list.
- Remove the separate semantic mobile duplicate; style the semantic list as the mobile presentation.
- Load GSAP and ScrollTrigger only when the section is near the viewport.
- Use the first state as a static fallback for reduced motion, unsupported motion, or GSAP load/runtime failure.

### Testimonials

- Add a non-interactive visual footer to every testimonial card:
  `Посмотреть отзыв` plus `ArrowUpRight`.
- Mark the decorative CTA `aria-hidden="true"` so it is not announced as a dead action.
- Keep the quote, portrait and role as the actual accessible proof content.
- Do not add video wording, iframe controls or fabricated URLs.

### Performance And Boundaries

- Make `JsonLd` server-side and render Service schema only from the homepage.
- Remove the unnecessary client directive from CaseLab3Tickets.
- Use a static event footer path instead of loading the popup-dependent homepage footer on Case Lab 3.
- Replace hero OGL CTA with a styled `<a>` and remove its route import.
- Remove duplicate Google font loading and manual preloads for fonts already served locally.
- Preserve Next Image optimization and lazy-load below-fold visual assets.

### SEO, Metadata And Schema

- Add route-specific Twitter metadata.
- Add a Case Lab 3 Open Graph image route with explicit 1200x630 metadata.
- Keep Event JSON-LD aligned with visible date, time, address, prices and confirmed performers.
- Restrict Organization `sameAs` to official Case Lab profiles.

### CSP And Fallbacks

- Remove the extension-only inline MutationObserver from the root layout.
- Add a Next `proxy.ts` nonce-based CSP for dynamic rendering.
- Add `object-src 'none'`, `base-uri 'self'`, `form-action`, `frame-ancestors`, and `upgrade-insecure-requests`.
- Restrict `connect-src` to the configured Supabase origin instead of a wildcard.
- Keep the hero CSS background present beneath Grainient and catch renderer failures without hiding content.

### Tests

- Extend the existing Node tests for hash focus behavior, reduced motion, semantic speaker tree, CTA semantics, metadata, CSP directives, font loading and no-video guarantees.
- Keep tests focused on rendered/source contracts available in the repository; run TypeScript, full ESLint, production build and all Node tests.
- Do not add test fixtures containing personal data or credentials.

## Out Of Scope

- `app/offer/**` and `app/privacy/**` are explicitly excluded, including P2-22 legal-data remediation.
- P3 polish items are not part of this pass.
- No checkout URL will be enabled; the existing fail-closed state remains.

## Verification

- `node --test tests/*.mjs`
- `npx tsc --noEmit --incremental false`
- `npm run lint`
- `npm run build`
- `git diff --check`
