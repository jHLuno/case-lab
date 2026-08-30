import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);
const repoRoot = fileURLToPath(new URL("../", import.meta.url));
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const readOptional = async (path) => {
  try {
    return await read(path);
  } catch (error) {
    if (error?.code === "ENOENT") return "";
    throw error;
  }
};

const readGitHead = async (path) => {
  const { stdout } = await execFileAsync("git", ["show", `HEAD:${path}`], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return stdout;
};

const readGitPaths = async (path) => {
  const { stdout } = await execFileAsync("git", ["ls-tree", "-r", "--name-only", "HEAD", "--", path], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  return stdout.trim().split("\n").filter(Boolean);
};

const findMarkerIndex = (source, marker) =>
  typeof marker === "string" ? source.indexOf(marker) : source.search(marker);

const extractEnclosingBraceBlock = (source, marker) => {
  const markerIndex = findMarkerIndex(source, marker);
  if (markerIndex < 0) return "";

  const openings = [];
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < markerIndex; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && nextChar === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "/" && nextChar === "/") {
      lineComment = true;
      index += 1;
    } else if (char === "/" && nextChar === "*") {
      blockComment = true;
      index += 1;
    } else if (["'", '"', "`"].includes(char)) {
      quote = char;
    } else if (char === "{") {
      openings.push(index);
    } else if (char === "}") {
      openings.pop();
    }
  }

  const openingIndex = openings.at(-1);
  if (openingIndex === undefined) return "";

  let depth = 1;
  quote = "";
  escaped = false;
  lineComment = false;
  blockComment = false;

  for (let index = openingIndex + 1; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (lineComment) {
      if (char === "\n") lineComment = false;
      continue;
    }

    if (blockComment) {
      if (char === "*" && nextChar === "/") {
        blockComment = false;
        index += 1;
      }
      continue;
    }

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = "";
      }
      continue;
    }

    if (char === "/" && nextChar === "/") {
      lineComment = true;
      index += 1;
    } else if (char === "/" && nextChar === "*") {
      blockComment = true;
      index += 1;
    } else if (["'", '"', "`"].includes(char)) {
      quote = char;
    } else if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;
      if (depth === 0) return source.slice(openingIndex, index + 1);
    }
  }

  return "";
};

const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const [proofSource, heroSource, grainientBoundarySource, grainientSource, casesSource, speakersSource, pageSource, nextConfigSource, proxySource, layoutSource, globalStylesSource, caseLabStylesSource, navbarSource, scrollRevealSource, backToTopSource, caseLab3PageSource, caseLab3FooterSource, footerSource, homePageSource, evpProComponentSource, comingSoonSource, faqSource, ticketsSource, evpSessionSource, evpFacilitatorsSource, evpPricingSource, evpFaqSource, jsonLdSource, serviceJsonLdSource, homeRouteSource, openGraphImageSource, checkoutSource] = await Promise.all([
  read("app/sections/CaseLab3Proof.tsx"),
  read("app/sections/CaseLab3Hero.tsx"),
  readOptional("app/components/GrainientBoundary.tsx"),
  readOptional("app/components/Grainient.jsx"),
  read("app/sections/Cases.tsx"),
  read("app/sections/CaseLab3Speakers.tsx"),
  read("app/case-lab-3/page.tsx"),
  read("next.config.ts"),
  readOptional("proxy.ts"),
  read("app/layout.tsx"),
  read("app/globals.css"),
  read("app/case-lab-3/case-lab-3.module.css"),
  read("app/components/Navbar.tsx"),
  read("app/components/ScrollReveal.tsx"),
  read("app/components/BackToTop.tsx"),
  read("app/components/CaseLab3Page.tsx"),
  read("app/components/CaseLab3Footer.tsx"),
  read("app/components/Footer.tsx"),
  read("app/components/HomePage.tsx"),
  read("app/components/EVPProPage.tsx"),
  read("app/components/ComingSoonPage.tsx"),
  read("app/sections/CaseLab3FAQ.tsx"),
  read("app/sections/CaseLab3Tickets.tsx"),
  read("app/sections/EVPProSession.tsx"),
  read("app/sections/EVPProFacilitators.tsx"),
  read("app/sections/EVPProPricing.tsx"),
  read("app/sections/EVPProFAQ.tsx"),
  read("app/components/JsonLd.tsx"),
  readOptional("app/components/ServiceJsonLd.tsx"),
  read("app/page.tsx"),
  readOptional("app/case-lab-3/opengraph-image.tsx"),
  read("app/lib/caseLab3.ts"),
]);
const caseLab3NavbarSource = await read("app/components/CaseLab3Navbar.tsx");

const caseLabRouteSources = [
  pageSource,
  caseLab3PageSource,
  heroSource,
  speakersSource,
  proofSource,
  casesSource,
  ticketsSource,
  faqSource,
];

const proxyCspHeaderSource = extractEnclosingBraceBlock(
  proxySource,
  /(?:set|append)\s*\(\s*["']Content-Security-Policy["']/,
);
const configCspHeaderSource = extractEnclosingBraceBlock(
  nextConfigSource,
  /key\s*:\s*["']Content-Security-Policy["']/,
);
const cspHeaderSource = proxyCspHeaderSource || configCspHeaderSource;
const nonceHeaderSource = extractEnclosingBraceBlock(proxySource, /["']x-nonce["']/);

test("testimonial cards expose the requested visual review CTA without video", () => {
  const visualReviewLabels = proofSource.match(
    /<span\s+className=\{styles\.testimonialReviewLabel\}\s+aria-hidden="true">\s*Посмотреть отзыв\s*<ArrowUpRight\b[^>]*\/?>\s*<\/span>/gs,
  ) ?? [];

  assert.equal(visualReviewLabels.length, 1);
  assert.equal((proofSource.match(/id: "testimonial-/g) ?? []).length, 3);
  const linkedReviewLabels = proofSource.match(
    /<a\s+href=\{testimonial\.reviewHref\}[\s\S]*?Посмотреть отзыв[\s\S]*?<\/a>/g,
  ) ?? [];

  assert.equal(linkedReviewLabels.length, 1);
  assert.match(proofSource, /https:\/\/www\.instagram\.com\/p\/DcYwmZZsQq1\//);
  assert.match(proofSource, /https:\/\/www\.instagram\.com\/p\/DcbLF_MsX5Q\//);
  assert.match(proofSource, /<a\s+href=\{testimonial\.reviewHref\}[\s\S]*?target="_blank"[\s\S]*?rel="noopener noreferrer"/);
  assert.doesNotMatch(proofSource, /video|видео|iframe|embedUrl/i);
});

test("ticket CTAs remain fail-closed without checkout links", () => {
  assert.match(heroSource, /<button\s+type="button"\s+className=\{styles\.heroCta\}\s+disabled\s+aria-disabled="true">[\s\S]*?Купить билет/);
  assert.match(
    ticketsSource,
    /<button\s+(?=[^>]*\btype="button")(?=[^>]*\bclassName=\{styles\.ticketCta\})(?=[^>]*\sdisabled(?:\s|=|>))(?=[^>]*\baria-disabled="true")[^>]*>[\s\S]*?Купить билет/,
  );
  assert.match(navbarSource, /ctaHref === null \? \([\s\S]*?<button[\s\S]*?disabled[\s\S]*?aria-disabled="true"[\s\S]*?\{ctaLabel\}/);
  assert.match(caseLab3FooterSource, /<button[\s\S]*?disabled[\s\S]*?aria-disabled="true"[\s\S]*?>[\s\S]*?Купить билет/);
  assert.match(caseLabStylesSource, /\.heroCta:disabled\s*\{[^}]*cursor:\s*not-allowed;[^}]*transform:\s*none;/s);
  assert.doesNotMatch(heroSource, /<a[^>]+href=/);
  assert.doesNotMatch(ticketsSource, /<a[^>]+href=/);
  assert.doesNotMatch(caseLab3FooterSource, /<a[^>]+href=\{caseLab3CheckoutHref\}/);
  assert.doesNotMatch(heroSource, /window\.location\.assign/);
  assert.doesNotMatch(casesSource, /cursor-pointer/);
});

test("ticket section uses the approved editorial CTA treatment", () => {
  assert.doesNotMatch(ticketsSource, /20 мест по ранней цене/);
  assert.match(caseLabStylesSource, /\.ticketCta\s*\{[^}]*width:\s*min\(100%, 340px\);/s);
  assert.match(caseLabStylesSource, /\.ticketCta\s*\{[^}]*font-size:\s*17px;/s);
  assert.match(caseLabStylesSource, /\.ticketCta\s*\{[^}]*min-height:\s*54px;/s);
  assert.match(caseLabStylesSource, /\.ticketCta\s*\{[^}]*justify-content:\s*center;/s);
});

test("speaker animation preserves the GSAP ScrollTrigger choreography", () => {
  assert.match(speakersSource, /gsap\.(?:context|matchMedia|timeline)/);
  assert.match(speakersSource, /ScrollTrigger\.create/);
});

test("speaker animation lazy-loads GSAP when the section intersects", () => {
  const lazyMotionSource = extractEnclosingBraceBlock(speakersSource, /new\s+IntersectionObserver\s*\(/);
  const dynamicImportModules = [...speakersSource.matchAll(/\bimport\s*\(\s*["']([^"']+)["']\s*\)/g)].map(
    ([, moduleName]) => moduleName,
  );
  const intersectionCheckIndex = lazyMotionSource.search(/\b[A-Za-z_$][\w$]*\.isIntersecting\b/);
  const postIntersectionSource = lazyMotionSource.slice(Math.max(intersectionCheckIndex, 0));
  const hasDirectLazyImport = /\bimport\s*\(/.test(postIntersectionSource);
  const hasLazyLoaderCall = /(?<![\w$.])(?:void\s+|await\s+)?(?!if\b|return\b|new\b)[A-Za-z_$][\w$]*\s*\(/.test(
    postIntersectionSource,
  );

  assert.match(lazyMotionSource, /\bnew\s+IntersectionObserver\s*\(/);
  assert.match(lazyMotionSource, /\.observe\s*\(/);
  assert.ok(
    dynamicImportModules.some((moduleName) => moduleName === "gsap" || moduleName.startsWith("gsap/")),
    "the intersection callback must dynamically load GSAP",
  );
  assert.ok(intersectionCheckIndex >= 0, "the observer callback must inspect intersection state");
  assert.ok(
    hasDirectLazyImport || hasLazyLoaderCall,
    "the intersection path must trigger the lazy motion loader",
  );
  assert.doesNotMatch(speakersSource, /^\s*import\b[^;\n]*\bfrom\s*["']gsap(?:\/[^"']*)?["']/m);
});

test("speaker semantic content has one accessible source tree", () => {
  const accessibleTreeReferences = speakersSource.match(/\bstyles\.speakerAccessibleCases\b/g) ?? [];
  const accessibleTreeTagMatch = speakersSource.match(
    /<div\b[^>]*\bclassName\s*=\s*\{styles\.speakerAccessibleCases\}[^>]*>/,
  );

  assert.equal(accessibleTreeReferences.length, 1);
  assert.ok(accessibleTreeTagMatch, "the semantic speaker tree must be rendered");
  assert.doesNotMatch(accessibleTreeTagMatch[0], /\baria-hidden\s*=\s*["']true["']/);
  assert.match(
    speakersSource.slice(accessibleTreeTagMatch.index),
    /<ul\b[\s\S]*?\bcases\.map\s*\([\s\S]*?<li\b[\s\S]*?<article\b/,
  );
  assert.doesNotMatch(speakersSource, /\bspeakerMobileCases\b/);
});

test("speaker semantic tree carries the mobile image and case copy", () => {
  const accessibleTreeStart = speakersSource.indexOf("styles.speakerAccessibleCases");
  const accessibleTreeSource = speakersSource.slice(accessibleTreeStart);

  assert.match(accessibleTreeSource, /<Image\s+src=\{item\.image\}\s+alt=\{item\.alt\}/);
  assert.match(accessibleTreeSource, /<strong>\{item\.company\}<\/strong>/);
  assert.match(accessibleTreeSource, /<h3>\{item\.title\}<\/h3>/);
  assert.match(accessibleTreeSource, /<p>\{item\.description\}<\/p>/);
  assert.match(accessibleTreeSource, /styles\.speakerAccessibleVisual/);
  assert.match(accessibleTreeSource, /styles\.speakerAccessibleCopy/);
  assert.doesNotMatch(accessibleTreeSource, /<span>\{item\.role\}<\/span>/);
  assert.doesNotMatch(speakersSource, /styles\.speakerStageRole/);
});

test("speaker motion preserves a static fallback and cleans up lazy resources", () => {
  assert.match(speakersSource, /useEffect/);
  assert.doesNotMatch(speakersSource, /prefersReducedMotionQuery/);
  assert.match(speakersSource, /observer\?\.disconnect\(\)/);
  assert.match(speakersSource, /context\?\.revert\(\)/);
  assert.match(speakersSource, /triggers\.forEach/);
});

test("speaker visual layers are decorative", () => {
  const visualSceneTag = speakersSource.match(
    /<div\b[^>]*\bclassName\s*=\s*\{styles\.speakerScene\}[^>]*>/,
  )?.[0] ?? "";
  const accessibleTreeStart = speakersSource.indexOf("styles.speakerAccessibleCases");
  const visualSceneStart = speakersSource.indexOf(visualSceneTag);
  const visualLayersSource = speakersSource.slice(visualSceneStart, accessibleTreeStart);
  const stageCardTags = visualLayersSource.match(
    /<figure\b[\s\S]*?\bclassName\s*=\s*\{styles\.speakerStageCard\}[\s\S]*?>/g,
  ) ?? [];
  const visualShadeTags = visualLayersSource.match(
    /<div\b[^>]*\bclassName\s*=\s*\{styles\.speakerVisualShade\}[^>]*>/g,
  ) ?? [];
  const decorativeImages = visualLayersSource.match(
    /<Image\b[^>]*\balt\s*=\s*["']\s*["'][^>]*>/g,
  ) ?? [];

  assert.match(visualSceneTag, /\baria-hidden\s*=\s*["']true["']/);
  assert.ok(stageCardTags.length > 0, "the visual scene must contain visual layers");
  stageCardTags.forEach((tag) => assert.match(tag, /\baria-hidden\s*=\s*["']true["']/));
  assert.ok(visualShadeTags.length > 0, "visual shading must be present");
  visualShadeTags.forEach((tag) => assert.match(tag, /\baria-hidden\s*=\s*["']true["']/));
  assert.ok(decorativeImages.length > 0, "visual-layer images must have empty alt text");
});

test("large speaker photos show each speaker role under the name", () => {
  assert.match(
    speakersSource,
    /speakerStageFeature[\s\S]*?<figcaption>[\s\S]*?<span>\{item\.company\}<\/span>[\s\S]*?<small>\{item\.role\}<\/small>/,
  );
  assert.match(speakersSource, /role: "exCMO Invictus Go & CCO Bayan Sulu"/);
  assert.match(
    caseLabStylesSource,
    /\.speakerStageFeature \.speakerStageCard figcaption\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s,
  );
  assert.match(caseLabStylesSource, /\.speakerStageFeature \.speakerStageCard figcaption small\s*\{/);
});

test("Case Lab 3 metadata declares a large-image Twitter card", () => {
  const twitterMetadata = pageSource.match(/twitter:\s*\{[\s\S]*?\n\s*\},/)?.[0] ?? "";

  assert.match(twitterMetadata, /twitter:\s*\{/);
  assert.match(twitterMetadata, /card:\s*["']summary_large_image["']/);
  assert.match(twitterMetadata, /title:\s*["'][^"']+["']/);
  assert.match(twitterMetadata, /description:\s*["'][^"']+["']/);
  assert.match(twitterMetadata, /images:\s*\[[^\]]+\]/s);
});

test("Case Lab 3 event metadata stays truthful when checkout is unavailable", () => {
  assert.match(pageSource, /image:\s*\["https:\/\/caselab\.kz\/case-lab-3\/opengraph-image"\]/);
  assert.match(pageSource, /const caseLab3EventOffers = caseLab3CheckoutHref/);
  assert.match(pageSource, /\.\.\.\(caseLab3EventOffers \? \{ offers: caseLab3EventOffers \} : \{\}\)/);
});

test("JSON-LD is server-side and the Service schema is homepage-only", () => {
  assert.doesNotMatch(jsonLdSource, /^"use client"/m);
  assert.doesNotMatch(jsonLdSource, /usePathname|@type":\s*"Service"/);
  assert.match(jsonLdSource, /@type":\s*"Organization"/);
  assert.match(jsonLdSource, /@type":\s*"WebSite"/);
  assert.match(serviceJsonLdSource, /@type":\s*"Service"/);
  assert.match(homeRouteSource, /import\s+ServiceJsonLd\s+from\s+["']\.\/components\/ServiceJsonLd["']/);
  assert.match(homeRouteSource, /<ServiceJsonLd\s*\/>/);
  assert.doesNotMatch(caseLab3PageSource, /ServiceJsonLd/);
});

test("strict nonce CSP is owned by proxy and excludes non-page requests", () => {
  assert.match(proxySource, /crypto\.randomUUID\(\)/);
  assert.match(proxySource, /requestHeaders\.set\(\s*["']x-nonce["']/);
  assert.match(proxySource, /response\.headers\.set\(\s*["']Content-Security-Policy["']/);
  assert.match(proxySource, /source:\s*["']\/\(\(\?!api\|_next\/static\|_next\/image\|favicon\.ico\)/);
  assert.match(proxySource, /next-router-prefetch/);
  assert.match(proxySource, /purpose/);
  assert.match(proxySource, /script-src\s+['"]self['"]\s+['"]nonce-\$\{nonce\}['"]\s+['"]strict-dynamic['"]/);
  assert.match(proxySource, /style-src\s+['"]self['"]\s+['"]unsafe-inline['"]/);
  assert.match(proxySource, /connect-src\s+['"]self['"]\s*\$\{/);
  assert.doesNotMatch(proxySource, /https:\/\/\*\.supabase\.co/);
  assert.doesNotMatch(proxySource, /SUPABASE_(?:ANON_KEY|SERVICE_ROLE_KEY)/);
  assert.doesNotMatch(nextConfigSource, /Content-Security-Policy/);
  assert.match(proxySource, /forwardableHeaders|accept-language|user-agent/);
});

test("JSON-LD scripts use the request nonce and the extension observer is absent", () => {
  assert.match(layoutSource, /import\s+\{\s*headers\s*\}\s+from\s+["']next\/headers["']/);
  assert.match(layoutSource, /<JsonLd\s+nonce=\{nonce\}/);
  assert.doesNotMatch(layoutSource, /bis_skin_checked|MutationObserver/);
  assert.match(jsonLdSource, /nonce\??:\s*string/);
  assert.match(jsonLdSource, /<script[\s\S]*?nonce=\{nonce\}/);
  assert.match(serviceJsonLdSource, /headers\(\)/);
  assert.match(serviceJsonLdSource, /nonce=\{nonce\}/);
  assert.match(pageSource, /import\s+\{\s*headers\s*\}\s+from\s+["']next\/headers["']/);
  assert.match(pageSource, /<script[\s\S]*?nonce=\{nonce\}/);
});

test("Grainient renderer failure leaves the CSS hero fallback and content intact", () => {
  assert.match(grainientBoundarySource, /getDerivedStateFromError/);
  assert.match(grainientBoundarySource, /return\s+null/);
  assert.match(heroSource, /GrainientBoundary/);
  assert.match(heroSource, /<GrainientBoundary>[\s\S]*?<Grainient[\s\S]*?<\/GrainientBoundary>/);
  assert.match(heroSource, /caseRoomShape/);
  assert.match(heroSource, /caseRoomGradient/);
  assert.match(grainientSource, /onError/);
  assert.match(grainientSource, /requestAnimationFrame|ResizeObserver/);
  assert.match(grainientSource, /try\s*\{/);
});

test("Case Lab 3 tickets stay server-rendered while ScrollReveal remains the client island", () => {
  assert.doesNotMatch(ticketsSource, /^"use client"/m);
  assert.match(ticketsSource, /import\s+ScrollReveal\s+from\s+["']\.\.\/components\/ScrollReveal["']/);
});

test("Case Lab 3 footer is static and keeps legal text readable", () => {
  assert.match(caseLab3PageSource, /import CaseLab3Footer from ["']\.\/CaseLab3Footer["']/);
  assert.doesNotMatch(caseLab3PageSource, /import Footer from ["']\.\/Footer["']/);
  assert.doesNotMatch(caseLab3FooterSource, /^"use client"/m);
  assert.match(footerSource, /Политика конфиденциальности[\s\S]*text-black\/60/);
});

test("Organization sameAs contains only the official Case Lab profile", () => {
  assert.match(jsonLdSource, /sameAs:\s*\["https:\/\/instagram\.com\/caselabkz"\]/);
  assert.doesNotMatch(jsonLdSource, /narxoz_business_school|kosnazzar|daniyar-kosnazarov/);
});

test("Case Lab 3 hero checkout has no SpecularButton or direct OGL dependency", () => {
  assert.doesNotMatch(heroSource, /SpecularButton|from\s+["']ogl["']|import\s*\(\s*["']ogl["']\s*\)/);
  assert.match(heroSource, /<button\s+type="button"\s+className=\{styles\.heroCta\}\s+disabled\s+aria-disabled="true">/);
});

test("Case Lab 3 source stays free of media promises and direct OGL imports", () => {
  for (const source of caseLabRouteSources) {
    assert.doesNotMatch(source, /\b(?:video|видео|iframe|embedUrl)\b/i);
    assert.doesNotMatch(source, /(?:from\s+|import\s*\(\s*)["']ogl["']/);
  }
});

test("Case Lab 3 checkout remains fail-closed without a validated URL", () => {
  assert.match(checkoutSource, /if \(!value\) return null/);
  assert.match(checkoutSource, /url\.protocol !== "https:"/);
  assert.match(checkoutSource, /url\.username|url\.password/);
  assert.match(checkoutSource, /url\.hostname !== host/);
  assert.doesNotMatch(heroSource, /caseLab3CheckoutHref|checkoutHref|href=/);
  assert.doesNotMatch(ticketsSource, /caseLab3CheckoutHref|href=/);
});

test("Case Lab 3 route tokens stay scoped and semantic", () => {
  const tokenRoot = caseLabStylesSource.match(
    /\.hero,\s*\.proofSection,\s*\.speakersSection,\s*\.ticketSection,\s*\.faqSection\s*\{[\s\S]*?\}/,
  )?.[0] ?? "";

  assert.match(tokenRoot, /--cl-accent:\s*#040082/);
  assert.match(tokenRoot, /--cl-accent-strong:\s*#020060/);
  assert.match(tokenRoot, /--cl-muted:\s*#4f4e5b/);
  assert.match(tokenRoot, /--cl-focus:\s*#040082/);
  assert.match(tokenRoot, /--cl-focus-contrast:\s*#ffffff/);
  assert.match(caseLabStylesSource, /color:\s*var\(--cl-muted\)/);
  assert.match(caseLabStylesSource, /color:\s*var\(--cl-accent\)/);
  assert.match(globalStylesSource, /outline:\s*3px solid var\(--cl-focus,\s*#040082\)/);
});

test("Case Lab 3 owns a 1200x630 generated Open Graph image", () => {
  assert.match(openGraphImageSource, /import\s+\{\s*ImageResponse\s*\}\s+from\s+["']next\/og["']/);
  assert.match(openGraphImageSource, /export\s+const\s+size\s*=\s*\{[\s\S]*?width:\s*1200[\s\S]*?height:\s*630/);
  assert.match(openGraphImageSource, /Case Lab III/);
  assert.match(openGraphImageSource, /24\s+СЕНТЯБРЯ\s+2026|24 сентября 2026/i);
  assert.match(openGraphImageSource, /10:00[–-]14:00/);
  assert.match(openGraphImageSource, /Narxoz Business School/);
  assert.match(openGraphImageSource, /Жандосова 55\/10/);
  assert.match(pageSource, /url:\s*["']\/case-lab-3\/opengraph-image["']/);
  assert.match(pageSource, /width:\s*1200/);
  assert.match(pageSource, /height:\s*630/);
  assert.match(pageSource, /alt:\s*["'][^"']+["']/);
});

test("CSP blocks plugin content", () => {
  assert.match(cspHeaderSource, /object-src 'none'/);
});

test("CSP restricts the document base URI", () => {
  assert.match(cspHeaderSource, /base-uri 'self'/);
});

test("CSP prevents framing by other origins", () => {
  assert.match(cspHeaderSource, /frame-ancestors 'none'/);
});

test("request proxy emits a CSP nonce", () => {
  const nonceDeclaration = nonceHeaderSource.match(
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*crypto\.randomUUID\s*\(\s*\)/,
  );

  assert.ok(nonceDeclaration, "the request header path must generate a nonce");
  const nonceName = nonceDeclaration[1];
  assert.match(
    nonceHeaderSource,
    new RegExp(`["']x-nonce["']\\s*,\\s*${escapeRegExp(nonceName)}\\b`),
  );
  assert.match(nonceHeaderSource, /Content-Security-Policy/);
});

test("local font faces remain the only font-loading path", () => {
  assert.doesNotMatch(layoutSource, /next\/font\/google/);
  assert.doesNotMatch(layoutSource, /<link[^>]+rel="preload"[^>]+href="\/fonts\//);
  assert.match(globalStylesSource, /@font-face\s*\{[^}]*font-family:\s*['"]Benzin['"][^}]*src:\s*url\(['"]\/fonts\/Benzin-Regular\.woff2['"]\)[^}]*font-display:\s*swap/s);
  assert.match(globalStylesSource, /@font-face\s*\{[^}]*font-family:\s*['"]Benzin['"][^}]*src:\s*url\(['"]\/fonts\/Benzin-Bold\.woff2['"]\)[^}]*font-display:\s*swap/s);
  assert.match(globalStylesSource, /@font-face\s*\{[^}]*font-family:\s*['"]Gilroy['"][^}]*src:\s*url\(['"]\/fonts\/Gilroy-Regular\.woff2['"]\)[^}]*font-display:\s*swap/s);
  assert.match(globalStylesSource, /@font-face\s*\{[^}]*font-family:\s*['"]Gilroy['"][^}]*src:\s*url\(['"]\/fonts\/Gilroy-Medium\.woff2['"]\)[^}]*font-display:\s*swap/s);
});

test("shared navigation restores hash focus and honors reduced motion", () => {
  assert.match(navbarSource, /useReducedMotion/);
  assert.match(navbarSource, /focusHashTarget/);
  assert.match(navbarSource, /requestAnimationFrame/);
  assert.match(navbarSource, /focus\(\{\s*preventScroll:\s*true/);
  assert.match(navbarSource, /menuDescription/);
  assert.match(scrollRevealSource, /useReducedMotion/);
  assert.match(backToTopSource, /useReducedMotion/);
  assert.match(backToTopSource, /window\.scrollTo\(\{\s*top:\s*0,\s*behavior:\s*["']auto["']/);
});

test("Escape restores Navbar focus after mobile-menu inert cleanup", () => {
  const closeFocusStart = navbarSource.indexOf("const closeMobileMenuAndReturnFocus");
  const closeFocusEnd = navbarSource.indexOf("const getNavHref", closeFocusStart);
  const closeFocusSource = navbarSource.slice(closeFocusStart, closeFocusEnd);

  assert.match(
    closeFocusSource,
    /setMobileOpen\(false\);\s*requestAnimationFrame\(\(\) => \{\s*toggleRef\.current\?\.focus\(\);\s*\}\);/s,
  );
});

test("EVP hash targets can receive restored keyboard focus", () => {
  for (const [id, source] of [
    ["session", evpSessionSource],
    ["facilitators", evpFacilitatorsSource],
    ["pricing", evpPricingSource],
    ["faq", evpFaqSource],
  ]) {
    assert.match(source, new RegExp(`<section\\s+[^>]*\\bid=["']${id}["'][^>]*\\btabIndex=\\{-1\\}`, "s"));
  }
});

test("shared reduced-motion CSS removes control motion without hiding content", () => {
  const reducedMotionStart = globalStylesSource.indexOf("@media (prefers-reduced-motion: reduce)");
  const nextRuleStart = globalStylesSource.indexOf("/* Marquee animation", reducedMotionStart);
  const reducedMotionSource = globalStylesSource.slice(reducedMotionStart, nextRuleStart);

  assert.match(globalStylesSource, /\.motion-control/);
  assert.match(globalStylesSource, /animation:\s*none\s*!important;/);
  assert.match(globalStylesSource, /transition:\s*none\s*!important;/);
  assert.match(globalStylesSource, /transform:\s*none\s*!important;/);
  assert.match(navbarSource, /className="[^"]*motion-control/);
  assert.match(backToTopSource, /className="[^"]*motion-control/);
  assert.doesNotMatch(reducedMotionSource, /opacity:\s*0/);
});

test("Case Lab 3 opts into motion despite reduced-motion preferences", () => {
  assert.match(caseLab3PageSource, /caseLabForceMotion/);
  assert.match(caseLab3PageSource, /<Cases alignToCaseLab forceMotion \/>/);
  assert.match(caseLab3PageSource, /<BackToTop forceMotion \/>/);
  assert.match(caseLab3NavbarSource, /document\.body\.classList\.add\("caseLabForceMotion"\)/);
  assert.match(caseLab3NavbarSource, /document\.body\.classList\.remove\("caseLabForceMotion"\)/);
  assert.match(caseLab3NavbarSource, /document\.body\.classList\.add\("caseLabPage"\)/);
  assert.match(caseLab3NavbarSource, /document\.body\.classList\.remove\("caseLabPage"\)/);
  assert.match(caseLab3NavbarSource, /document\.documentElement\.classList\.add\("caseLabPage"\)/);
  assert.match(caseLab3NavbarSource, /document\.documentElement\.classList\.remove\("caseLabPage"\)/);
  assert.match(caseLabStylesSource, /@media \(max-width: 767px\)[\s\S]*?\.speakerScene\s*\{\s*display: none;/);
  assert.doesNotMatch(
    caseLabStylesSource,
    /@media \(prefers-reduced-motion: reduce\)\s+and\s+\(min-width: 768px\)[\s\S]*?\.speakerScene\s*\{\s*display:\s*none;/,
  );
  assert.match(heroSource, /const shouldReduceMotion = false/);
  assert.doesNotMatch(speakersSource, /prefersReducedMotionQuery/);
  assert.match(casesSource, /forceMotion\?/);
  assert.match(casesSource, /forceMotion \|\| !prefersReducedMotion/);
  assert.match(scrollRevealSource, /forceMotion\?/);
  assert.match(ticketsSource, /<ScrollReveal\s+forceMotion/);
  assert.match(faqSource, /<ScrollReveal\s+forceMotion/);
  assert.match(globalStylesSource, /caseLabForceMotion/);
});

test("Case Lab 3 uses one heading-description gap at every breakpoint", () => {
  assert.match(caseLab3PageSource, /className=\{`\$\{styles\.caseLabPage\}/);
  assert.match(caseLabStylesSource, /\.caseLabPage\s*\{[\s\S]*?--case-lab-heading-description-gap:\s*20px;/);
  assert.match(caseLabStylesSource, /@media \(min-width: 768px\)[\s\S]*?\.caseLabPage\s*\{[\s\S]*?--case-lab-heading-description-gap:\s*24px;/);
  assert.match(caseLabStylesSource, /@media \(min-width: 1024px\)[\s\S]*?\.caseLabPage\s*\{[\s\S]*?--case-lab-heading-description-gap:\s*28px;/);
  assert.match(caseLabStylesSource, /\.caseRoomCopy\s*\{[\s\S]*?margin:\s*var\(--case-lab-heading-description-gap\)\s+0\s+0;/);
  assert.match(caseLabStylesSource, /\.sectionIntroWide > p:last-child\s*\{[\s\S]*?margin:\s*var\(--case-lab-heading-description-gap\)\s+0\s+0;/);
  assert.match(caseLabStylesSource, /\.howItWorksOutcome\s*\{[\s\S]*?margin:\s*var\(--case-lab-heading-description-gap\)\s+0\s+0;/);
  assert.match(caseLabStylesSource, /\.ticketCopy\s*\{[\s\S]*?margin:\s*var\(--case-lab-heading-description-gap\)\s+0\s+0;/);
  assert.match(caseLabStylesSource, /\.proofIntroDescription\s*\{[\s\S]*?margin:\s*var\(--case-lab-heading-description-gap\)\s+0\s+0;/);
  assert.match(caseLabStylesSource, /\.caseLabPage footer h2\s*\{[\s\S]*?margin-bottom:\s*var\(--case-lab-heading-description-gap\);/);
});

test("Case Lab 3 controls and review links meet the mobile target size", () => {
  assert.match(navbarSource, /h-11\s+w-11/);
  assert.match(backToTopSource, /h-11\s+w-11/);
  assert.match(caseLab3FooterSource, /inline-flex\s+min-h-11\s+items-center/);
  assert.match(caseLabStylesSource, /\.testimonialReviewLabel\s*\{[\s\S]*?min-height:\s*44px;/);
});

test("Case Lab 3 responsive fixes keep the event details and mobile layout aligned", () => {
  assert.match(caseLabStylesSource, /\.caseRoomDetails\s*\{[\s\S]*?align-items:\s*stretch;/);
  assert.match(caseLabStylesSource, /\.caseRoomDate\s*\{[\s\S]*?display:\s*flex;/);
  assert.match(caseLabStylesSource, /justify-content:\s*space-between/);
  assert.match(caseLabStylesSource, /\.caseRoomPurchase\s*\{[\s\S]*?align-items:\s*center;/);
  assert.match(caseLabStylesSource, /@media \(min-width: 1080px\)[\s\S]*?\.caseRoomCaseFeaturedDescription/);
  assert.match(caseLabStylesSource, /\.speakerStageCopyLayer > p:last-child\s*\{[\s\S]*?max-width:\s*none;/);
  assert.match(caseLabStylesSource, /\.howItWorksScoreboard\s*\{[\s\S]*?align-items:\s*flex-end;/);
  assert.match(caseLabStylesSource, /@media \(min-width: 768px\)[\s\S]*?\.ticketGrid h2\s*\{[\s\S]*?max-width:\s*18ch/);
  assert.match(caseLabStylesSource, /@media \(min-width: 768px\) and \(max-width: 1023px\)[\s\S]*?\.ticketArtwork/);
  assert.match(caseLabStylesSource, /\.caseLabFooterDetails/);
  assert.match(caseLab3FooterSource, /caseLabFooterDetails/);
  assert.match(ticketsSource, /кейтеринг/);
  assert.match(ticketsSource, /подарк|приз/i);
});

test("Case Lab 3 defers below-fold proof images and avoids mobile WebGL", () => {
  assert.match(proofSource, /loading="lazy"/);
  assert.doesNotMatch(proofSource, /quality=\{100\}/);
  assert.equal((heroSource.match(/loading="eager"/g) ?? []).length, 0);
  assert.equal((heroSource.match(/loading="lazy"/g) ?? []).length, 3);
  assert.match(heroSource, /matchMedia\("\(max-width:\s*767px\)"\)/);
  assert.doesNotMatch(heroSource, /pointer:\s*coarse/);
  caseLabRouteSources.forEach((source) => assert.doesNotMatch(source, /pointer:\s*coarse/));
  assert.match(heroSource, /grainientAllowed/);
});

test("Case Lab 3 keeps speaker motion independent from reduced-motion changes", () => {
  assert.doesNotMatch(speakersSource, /prefersReducedMotionQuery/);
  assert.match(speakersSource, /let motionRun = 0/);
  assert.match(speakersSource, /const setupRun = \+\+motionRun/);
  assert.match(speakersSource, /setupRun !== motionRun/);
});

test("case cards allow horizontal touch scrolling through tablet widths", () => {
  assert.match(casesSource, /className="overflow-x-auto py-3 scrollbar-hide lg:overflow-hidden"/);
  assert.doesNotMatch(casesSource, /md:overflow-hidden/);
  assert.match(casesSource, /onTouchStart=\{handleTouchStart\}/);
  assert.match(casesSource, /onTouchEnd=\{handleTouchEnd\}/);
  assert.match(casesSource, /onTouchCancel=\{handleTouchEnd\}/);
});

test("site routes own the single main landmark outside global navigation and footer", () => {
  assert.doesNotMatch(layoutSource, /<main\b/);
  assert.match(layoutSource, /<div\s+tabIndex=\{-1\}>\s*\{children\}/s);

  for (const source of [homePageSource, caseLab3PageSource, evpProComponentSource, comingSoonSource]) {
    assert.match(source, /<main\s+id="main"\s+tabIndex=\{-1\}>/);
  }
});

test("hash targets and archive clones are non-interactive and screen-reader safe", () => {
  assert.match(casesSource, /<section\s+id="cases"[^>]*tabIndex=\{-1\}/s);
  assert.match(faqSource, /<section\s+id="faq"[^>]*tabIndex=\{-1\}/s);
  assert.match(ticketsSource, /<section\s+id="tickets"[^>]*tabIndex=\{-1\}/s);
  assert.doesNotMatch(casesSource, /cursor-pointer|hover:shadow|hover:scale/);
  assert.match(casesSource, /aria-hidden=\{set === 1\}/);
  assert.match(casesSource, /alt=""/);
});

test("legal files are not part of the P2 change surface", async () => {
  const legalPaths = [
    ...new Set([
      ...(await readGitPaths("app/offer")),
      ...(await readGitPaths("app/privacy")),
    ]),
  ];
  const { stdout: changedLegalFiles } = await execFileAsync("git", ["status", "--short", "--", "app/offer", "app/privacy"], {
    cwd: repoRoot,
    encoding: "utf8",
  });

  assert.equal(changedLegalFiles.trim(), "");
  for (const path of legalPaths) {
    assert.equal(await read(path), await readGitHead(path), `Legal file changed: ${path}`);
  }
});
