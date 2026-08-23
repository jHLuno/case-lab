import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const [layoutSource, globalsSource, navbarSource, casesSource, scrollRevealSource, proofSource, ticketsSource, faqSource, checkoutSource, pageSource, jsonLdSource, sitemapSource, caseLabStyles, heroSource] = await Promise.all([
  read("app/layout.tsx"),
  read("app/globals.css"),
  read("app/components/Navbar.tsx"),
  read("app/sections/Cases.tsx"),
  read("app/components/ScrollReveal.tsx"),
  read("app/sections/CaseLab3Proof.tsx"),
  read("app/sections/CaseLab3Tickets.tsx"),
  read("app/sections/CaseLab3FAQ.tsx"),
  read("app/lib/caseLab3.ts"),
  read("app/case-lab-3/page.tsx"),
  read("app/components/JsonLd.tsx"),
  read("public/sitemap.xml"),
  read("app/case-lab-3/case-lab-3.module.css"),
  read("app/sections/CaseLab3Hero.tsx"),
]);

test("Case Lab 3 has no video-related promise or player implementation", () => {
  for (const source of [proofSource, ticketsSource, faqSource]) {
    assert.doesNotMatch(source, /video|видео|embedUrl|iframe/i);
  }
});

test("mobile speaker copy stays readable and short viewports use the mobile layout", () => {
  assert.match(globalsSource, /--color-blue/);
  assert.match(caseLabStyles, /\.speakerMobileCase p:last-child\s*\{[^}]*color:\s*#4f4e5b/s);
  assert.match(caseLabStyles, /@media \(max-width: 767px\), \(min-width: 768px\) and \(max-height: 700px\)/);
});

test("marquee exposes a pause control and stops for reduced motion", () => {
  assert.match(casesSource, /aria-pressed=/);
  assert.match(casesSource, /Поставить карусель на паузу|Продолжить карусель/);
  assert.match(casesSource, /IntersectionObserver/);
  assert.match(globalsSource, /\.marquee-track\s*\{\s*animation:\s*none\s*!important;/s);
});

test("SSR content is visible before client motion initializes", () => {
  assert.match(scrollRevealSource, /initial=\{false\}/);
  assert.match(scrollRevealSource, /hydrated/);
  assert.match(navbarSource, /initial=\{false\}/);
  assert.match(caseLabStyles, /\.caseRoomShape\s*\{[^}]*background:\s*#040082/s);
});

test("keyboard users can bypass the fixed navigation and keep it visible on focus", () => {
  assert.match(layoutSource, /Перейти к содержимому/);
  assert.match(layoutSource, /href="#main"/);
  assert.match(navbarSource, /focusWithin/);
  assert.match(navbarSource, /onFocusCapture/);
});

test("checkout configuration fails closed and only accepts secure URLs", () => {
  assert.match(checkoutSource, /new URL/);
  assert.match(checkoutSource, /https:/);
  assert.match(checkoutSource, /username|password/);
  assert.match(checkoutSource, /!host/);
  assert.match(checkoutSource, /null/);
});

test("all cases points to the homepage archive and the event is internally linked", () => {
  assert.match(casesSource, /href="\/#news"/);
  assert.match(navbarSource, /case-lab-3/);
  assert.match(sitemapSource, /https:\/\/caselab\.kz\/case-lab-3\//);
});

test("event metadata is route-specific and does not expose the service offer", () => {
  assert.match(pageSource, /"@type": "Event"/);
  assert.match(pageSource, /2026-09-24T10:00:00\+05:00/);
  assert.match(pageSource, /2026-09-24T14:00:00\+05:00/);
  assert.match(pageSource, /Жандосова 55\/10/);
  assert.match(pageSource, /"@type": "Offer"/);
  assert.doesNotMatch(pageSource, /Маркетинговая диагностика/);
  assert.match(heroSource, /24\.09\.2026|2026/);
  assert.match(heroSource, /10:00/);
  assert.match(heroSource, /14:00/);
  assert.match(heroSource, /Жандосова 55\/10/i);
  assert.match(jsonLdSource, /usePathname|case-lab-3/);
});
