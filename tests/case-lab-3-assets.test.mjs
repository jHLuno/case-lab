import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const casesSource = await readFile(new URL("../app/sections/Cases.tsx", import.meta.url), "utf8");
const caseImagePaths = [...casesSource.matchAll(/photo: "([^"]+)"/g)].map((match) => match[1]);
const pageSource = await readFile(new URL("../app/components/CaseLab3Page.tsx", import.meta.url), "utf8");
const navbarSource = await readFile(new URL("../app/components/CaseLab3Navbar.tsx", import.meta.url), "utf8");
const heroSource = await readFile(new URL("../app/sections/CaseLab3Hero.tsx", import.meta.url), "utf8");
const speakersSource = await readFile(new URL("../app/sections/CaseLab3Speakers.tsx", import.meta.url), "utf8");
const caseLabStyles = await readFile(new URL("../app/case-lab-3/case-lab-3.module.css", import.meta.url), "utf8");

test("Case Lab 3 mounts the main Case Lab cases section", () => {
  assert.match(pageSource, /import Cases from "\.\.\/sections\/Cases"/);
  assert.match(pageSource, /<Cases alignToCaseLab \/>/);
  assert.doesNotMatch(pageSource, /CaseLab3Archive|archiveSection/);
  assert.match(navbarSource, /href: "#cases"/);
  assert.doesNotMatch(navbarSource, /case-lab-3-cases/);
});

test("main Case Lab cases keep the complete archive catalog", () => {
  assert.equal(caseImagePaths.length, 6);

  for (const imagePath of caseImagePaths) {
    assert.match(imagePath, /^\//, `Image path must be absolute: ${imagePath}`);
  }
});

test("hero fill images have positioned parents and defer secondary loading", () => {
  const heroCards = [...heroSource.matchAll(/<div className=\{styles\.caseRoomCase\}[^>]*>[\s\S]*?<Image[^>]+>/g)].map(
    (match) => match[0],
  );

  assert.equal(heroCards.length, 3);
  for (const heroCard of heroCards) {
    assert.match(heroCard, /style=\{\{ position: "relative" \}\}/);
  }
  assert.match(heroCards[0], /loading="eager"/);
  assert.match(heroCards[1], /loading="lazy"/);
  assert.match(heroCards[2], /loading="lazy"/);
});

test("hidden mobile fill-image parents stay positioned outside the mobile media query", () => {
  const baseStyles = caseLabStyles.split("@media (max-width: 767px)")[0];

  assert.match(baseStyles, /\.speakerMobileVisual\s*\{[^}]*position:\s*relative/);
});

test("mobile speaker fill-image parents declare position inline", () => {
  assert.match(speakersSource, /<figure className=\{styles\.speakerMobileVisual\} style=\{\{ position: "relative" \}\}>/);
});

test("hero left text uses the same inset as the main heading", () => {
  assert.match(
    heroSource,
    /<div className=\{`\$\{styles\.caseRoomShapeContent\} \$\{styles\.caseLabHeroHeading\}`\}>/,
  );
  assert.match(heroSource, /<h1 id="case-lab-3-title" className=\{styles\.caseRoomTitle\}>/);
  assert.match(caseLabStyles, /\.caseRoomShape\s*\{[^}]*--case-lab-heading-shift:\s*calc\(/s);
  assert.match(caseLabStyles, /\.caseRoomDetails\s*\{[^}]*left:\s*var\(--case-lab-heading-shift\)/s);
});

test("hero case cards give their text a 20px inset", () => {
  assert.match(caseLabStyles, /\.caseRoomCase\s*\{[^}]*padding:\s*20px;/s);
});

test("Case Lab 3 cases headline uses the shared left inset", () => {
  assert.match(pageSource, /<Cases alignToCaseLab \/>/);
  assert.match(casesSource, /alignToCaseLab\s*=\s*false/);
  assert.match(casesSource, /ml-4 md:ml-10/);
});
