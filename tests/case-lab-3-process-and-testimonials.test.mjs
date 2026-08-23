import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/components/CaseLab3Page.tsx", import.meta.url), "utf8");
const navbarSource = await readFile(new URL("../app/components/CaseLab3Navbar.tsx", import.meta.url), "utf8");
const sharedNavbarSource = await readFile(new URL("../app/components/Navbar.tsx", import.meta.url), "utf8");
const proofSource = await readFile(new URL("../app/sections/CaseLab3Proof.tsx", import.meta.url), "utf8");
const caseLabStyles = await readFile(new URL("../app/case-lab-3/case-lab-3.module.css", import.meta.url), "utf8");

test("Case Lab 3 places the process block before testimonials", () => {
  assert.match(pageSource, /import CaseLab3HowItWorks from "\.\.\/sections\/CaseLab3HowItWorks"/);

  const speakersIndex = pageSource.indexOf("<CaseLab3Speakers />");
  const processIndex = pageSource.indexOf("<CaseLab3HowItWorks />");
  const proofIndex = pageSource.indexOf("<CaseLab3Proof />");

  assert.ok(speakersIndex >= 0);
  assert.ok(processIndex > speakersIndex);
  assert.ok(proofIndex > processIndex);
});

test("testimonial proof is static and makes no video promise", () => {
  assert.doesNotMatch(proofSource, /До этого уже было/);
  assert.doesNotMatch(proofSource, /video|видео|embedUrl|iframe/i);
  assert.doesNotMatch(proofSource, /useState|useRef/);
  assert.doesNotMatch(caseLabStyles, /testimonialVideoLink|testimonialPlayerClose|testimonialMedia > iframe/);
});

test("Case Lab navigation gets scroll-safe behavior", () => {
  assert.match(navbarSource, /hideOnScroll/);
  assert.match(sharedNavbarSource, /window\.addEventListener\("scroll"/);
  assert.match(caseLabStyles, /\.howItWorksIntro\s*\{[^}]*top:\s*120px/);
});
