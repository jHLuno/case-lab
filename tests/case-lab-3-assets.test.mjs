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

test("hero fill images have positioned parents and defer loading", () => {
  const heroCards = [...heroSource.matchAll(/<div className=\{styles\.caseRoomCase\}[^>]*>[\s\S]*?<Image[^>]+>/g)].map(
    (match) => match[0],
  );

  assert.equal(heroCards.length, 3);
  for (const heroCard of heroCards) {
    assert.match(heroCard, /style=\{\{ position: "relative" \}\}/);
  }
  for (const heroCard of heroCards) {
    assert.match(heroCard, /loading="lazy"/);
  }
});

test("semantic speaker image parents stay positioned outside the mobile media query", () => {
  const baseStyles = caseLabStyles.split("@media (max-width: 767px)")[0];

  assert.match(baseStyles, /\.speakerAccessibleCase,\s*\.speakerAccessibleVisual\s*\{[^}]*position:\s*relative/s);
});

test("semantic speaker tree supplies the responsive fill-image figures", () => {
  assert.match(
    speakersSource,
    /<div className=\{styles\.speakerAccessibleCases\}[^>]*>[\s\S]*?<ul>[\s\S]*?cases\.map\([\s\S]*?<article className=\{styles\.speakerAccessibleCase\}>[\s\S]*?<figure className=\{styles\.speakerAccessibleVisual\}>[\s\S]*?<Image src=\{item\.image\} alt=\{item\.alt\} fill/,
  );
});

test("speaker motion uses a replaceable observer and aligned crossfade durations", () => {
  assert.match(speakersSource, /observer = new IntersectionObserver\(/);
  assert.match(speakersSource, /outgoingCopy[\s\S]*duration: visualTransitionDuration/);
  assert.match(speakersSource, /incomingCopy[\s\S]*duration: visualTransitionDuration/);
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

test("hero event details keep the date number and use the compact copy", () => {
  assert.match(heroSource, /<strong>24<\/strong>/);
  assert.match(heroSource, /СЕНТЯБРЯ<br \/>/);
  assert.match(heroSource, /10:00–14:00<br \/>/);
  assert.match(heroSource, /NARXOZ BUSINESS SCHOOL/);
  assert.doesNotMatch(heroSource, /СЕНТЯБРЯ 2026|UTC\+5|4 ЧАСА|ЖАНДОСОВА/);
  assert.match(caseLabStyles, /\.caseRoomDetails span\s*\{[^}]*font-size:\s*12px;/s);
  assert.match(caseLabStyles, /\.caseRoomDetails strong\s*\{[^}]*font-size:\s*clamp\(32px, 3\.5vw, 52px\);/s);
});

test("Case Lab 3 topics are synchronized across Hero and speakers", () => {
  const invictusTopic = "Как построить маркетинг, который масштабируется вместе с бизнесом?";
  const qaraTopic = "Как коллаборации и маркетинг масштабировали OYU Fest?";

  assert.equal(heroSource.split(invictusTopic).length - 1, 1);
  assert.equal(speakersSource.split(invictusTopic).length - 1, 1);
  assert.equal(heroSource.split(qaraTopic).length - 1, 1);
  assert.equal(speakersSource.split(qaraTopic).length - 1, 1);
  assert.doesNotMatch(heroSource, /Масштабирование сети фитнес-клубов|Что сработало в продвижении OYU Fest\?/);
  assert.doesNotMatch(speakersSource, /Как масштабировать точки и не потерять спрос|Что осталось после OYU Fest 2026/);
});

test("hero case cards give their text a 20px inset", () => {
  assert.match(caseLabStyles, /\.caseRoomCase\s*\{[^}]*padding:\s*20px;/s);
});

test("hero case topics use a wider text measure", () => {
  assert.match(
    caseLabStyles,
    /\.caseRoomCase \.caseRoomCaseFeaturedDescription\s*\{[^}]*max-width:\s*20ch;/s,
  );
});

test("Qara hero topic uses the extra-wide text measure", () => {
  assert.match(
    heroSource,
    /className=\{`\$\{styles\.caseRoomCaseFeaturedDescription\} \$\{styles\.caseRoomCaseFeaturedDescriptionWide\}`\}/,
  );
  assert.match(
    caseLabStyles,
    /\.caseRoomCase \.caseRoomCaseFeaturedDescriptionWide\s*\{[^}]*max-width:\s*22ch;/s,
  );
});

test("Case Lab 3 cases headline uses the shared left inset", () => {
  assert.match(pageSource, /<Cases alignToCaseLab \/>/);
  assert.match(casesSource, /alignToCaseLab\s*=\s*false/);
  assert.match(casesSource, /const caseLabShell = `max-w-\[1078px\] \$\{alignToCaseLab \? "ml-4 md:ml-10" : "mx-auto"\}`/);
  assert.equal((casesSource.match(/caseLabShell/g) ?? []).length, 3);
  assert.match(casesSource, /text-\[clamp\(24px,4vw,54px\)\]/);
});
