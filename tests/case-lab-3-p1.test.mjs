import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [layoutSource, globalsSource, navbarSource, caseLab3NavbarSource, casesSource, scrollRevealSource, proofSource, ticketsSource, faqSource, pageSource, jsonLdSource, sitemapSource, caseLabStyles, heroSource, speakersSource, checkoutProviderSource, checkoutDialogSource, checkoutDialogStylesSource, checkoutButtonSource] = await Promise.all([
  read("app/layout.tsx"),
  read("app/globals.css"),
  read("app/components/Navbar.tsx"),
  read("app/components/CaseLab3Navbar.tsx"),
  read("app/sections/Cases.tsx"),
  read("app/components/ScrollReveal.tsx"),
  read("app/sections/CaseLab3Proof.tsx"),
  read("app/sections/CaseLab3Tickets.tsx"),
  read("app/sections/CaseLab3FAQ.tsx"),
  read("app/case-lab-3/page.tsx"),
  read("app/components/JsonLd.tsx"),
  read("public/sitemap.xml"),
  read("app/case-lab-3/case-lab-3.module.css"),
  read("app/sections/CaseLab3Hero.tsx"),
  read("app/sections/CaseLab3Speakers.tsx"),
  read("app/components/case-lab-3/checkout/CaseLab3CheckoutProvider.tsx"),
  read("app/components/case-lab-3/checkout/CaseLab3CheckoutDialog.tsx"),
  read("app/components/case-lab-3/checkout/CaseLab3CheckoutDialog.module.css"),
  read("app/components/case-lab-3/checkout/CaseLab3CheckoutButton.tsx"),
]);

test("Case Lab 3 has no video-related promise or player implementation", () => {
  for (const source of [proofSource, ticketsSource, faqSource]) {
    assert.doesNotMatch(source, /video|видео|embedUrl|iframe/i);
  }
});

test("mobile speaker copy stays readable without switching short desktop viewports to mobile", () => {
  assert.match(globalsSource, /--color-blue/);
  assert.match(caseLabStyles, /\.speakerAccessibleCase p:last-child\s*\{[^}]*color:\s*#4f4e5b/s);
  assert.doesNotMatch(caseLabStyles, /@media \(max-width: 767px\), \(min-width: 768px\) and \(max-height: 700px\)/);
  assert.match(
    caseLabStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.howItWorksLayout\s*\{\s*display:\s*block;[\s\S]*?\.proofIntro h2[\s\S]*?\.testimonialGallery[\s\S]*?\.speakerScene\s*\{\s*display:\s*none;\s*\}[\s\S]*?\.speakerAccessibleCases\s*\{[\s\S]*?position:\s*static/s,
  );
  assert.match(caseLabStyles, /\.speakerAccessibleVisual\s*\{[\s\S]*?min-height:\s*280px/s);
  assert.match(speakersSource, /<ul>[\s\S]*?cases\.map\([\s\S]*?<li\b[\s\S]*?<article\b[^>]*className=\{styles\.speakerAccessibleCase\}/);
});

test("marquee has no visible pause control and stops for reduced motion", () => {
  assert.doesNotMatch(casesSource, /<button[\s\S]*?aria-pressed=/);
  assert.doesNotMatch(casesSource, /Поставить карусель на паузу|Продолжить карусель/);
  assert.match(casesSource, /IntersectionObserver/);
  assert.match(globalsSource, /\.marquee-track\s*\{\s*animation:\s*none\s*!important;/s);
});

test("SSR content is visible before client motion initializes", () => {
  assert.match(scrollRevealSource, /initial=\{false\}/);
  assert.match(scrollRevealSource, /hydrated/);
  assert.match(navbarSource, /initial=\{false\}/);
  assert.match(caseLabStyles, /\.caseRoomShape\s*\{[^}]*background:\s*#040082/s);
});

test("hero headline uses the approved event framing", () => {
  assert.match(heroSource, /<span>Основано на<\/span>[\s\S]*?<span>реальных событиях<\/span>/);
  assert.doesNotMatch(heroSource, /Как это было|сделано на самом деле/);
});

test("keyboard users can bypass the fixed navigation and keep it visible on focus", () => {
  assert.match(layoutSource, /Перейти к содержимому/);
  assert.match(layoutSource, /href="#main"/);
  assert.match(navbarSource, /focusWithin/);
  assert.match(navbarSource, /onFocusCapture/);
});

test("Case Lab 3 owns one checkout provider and one dialog", () => {
  assert.match(pageSource, /<CaseLab3Page\s+nonce=\{nonce\}\s*\/>/);
  assert.match(checkoutProviderSource, /CaseLab3CheckoutDialog/);
  assert.equal((checkoutProviderSource.match(/<CaseLab3CheckoutDialog\b/g) ?? []).length, 1);
  assert.match(checkoutProviderSource, /useCaseLab3Checkout/);
  assert.match(checkoutProviderSource, /openCheckout/);
  assert.match(checkoutDialogSource, /role="dialog"/);
  assert.match(checkoutDialogSource, /aria-modal="true"/);
  assert.match(checkoutDialogSource, /aria-labelledby=/);
  assert.match(checkoutProviderSource, /aria-hidden|inert/);
});

test("Case Lab 3 exposes all four purchase CTA sources through the client leaf", () => {
  assert.match(caseLab3NavbarSource, /onCtaClick=\{\(\) => openCheckout\("navbar"\)\}/);
  assert.match(heroSource, /CaseLab3CheckoutButton\s+source="hero"/);
  assert.match(ticketsSource, /CaseLab3CheckoutButton\s+source="tickets"/);
  assert.match(checkoutButtonSource, /source/);
  assert.match(checkoutProviderSource, /CheckoutSource/);
  assert.match(checkoutProviderSource, /dispatch\(\{ type: "OPEN", source \}\)/);
  assert.doesNotMatch(pageSource + checkoutProviderSource + checkoutDialogSource, /caseLab3CheckoutHref/);
  assert.match(checkoutDialogSource, /amountMinor/);
  assert.match(checkoutDialogSource, /formatKzt/);
});

test("checkout popup provides legal-entity and payment contact paths", () => {
  assert.match(checkoutDialogSource, /href="https:\/\/wa\.me\/77072124410"/);
  assert.match(checkoutDialogSource, /Для юридических лиц/);
  assert.match(checkoutDialogSource, /href="mailto:hello@caselab\.kz"/);
  assert.match(checkoutDialogSource, /По вопросам оплаты/);
  assert.match(checkoutDialogSource, /target="_blank"/);
  assert.match(checkoutDialogSource, /rel="noopener noreferrer"/);
  assert.match(checkoutDialogStylesSource, /\.contactOptions\s*\{/);
  assert.match(checkoutDialogStylesSource, /\.contactButton:focus-visible/);
});

test("all cases points to the homepage archive and the event is internally linked", () => {
  assert.match(casesSource, /href="\/#news"/);
  assert.doesNotMatch(navbarSource, /label:\s*["']Case Lab 3["']/);
  assert.match(caseLab3NavbarSource, /basePath="\/case-lab-3\/"/);
  assert.match(sitemapSource, /https:\/\/caselab\.kz\/case-lab-3\//);
});

test("event metadata is route-specific and does not expose the service offer", () => {
  assert.match(pageSource, /"@type": "Event"/);
  assert.match(pageSource, /twitter/);
  assert.match(pageSource, /2026-09-24T10:00:00\+05:00/);
  assert.match(pageSource, /2026-09-24T14:00:00\+05:00/);
  assert.match(pageSource, /Жандосова 55\/10/);
  assert.doesNotMatch(pageSource, /"@type": "Offer"/);
  assert.doesNotMatch(pageSource, /Маркетинговая диагностика/);
  assert.match(heroSource, /24\.09\.2026|2026/);
  assert.match(heroSource, /10:00/);
  assert.match(heroSource, /14:00/);
  assert.doesNotMatch(heroSource, /Жандосова 55\/10/i);
  assert.doesNotMatch(jsonLdSource, /usePathname|case-lab-3/);
  assert.match(jsonLdSource, /@type\":\s*\"Organization\"/);
});
