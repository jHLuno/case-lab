import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/components/CaseLab3Page.tsx", import.meta.url), "utf8");
const ticketSource = await readFile(new URL("../app/sections/CaseLab3Tickets.tsx", import.meta.url), "utf8");
const ticketStyles = await readFile(new URL("../app/case-lab-3/case-lab-3.module.css", import.meta.url), "utf8");
const ticketStylesBlock = ticketStyles.slice(
  ticketStyles.indexOf(".ticketSection {\n  position: relative;"),
  ticketStyles.indexOf(".faqSection {\n  background: #fff;"),
);

test("tickets appear after process and before proof", () => {
  const processIndex = pageSource.indexOf("<CaseLab3HowItWorks />");
  const ticketIndex = pageSource.indexOf("<CaseLab3Tickets />");
  const proofIndex = pageSource.indexOf("<CaseLab3Proof />");

  assert.ok(processIndex >= 0);
  assert.ok(ticketIndex > processIndex);
  assert.ok(proofIndex > ticketIndex);
});

test("ticket section uses the generated background and fail-closed CTA", () => {
  assert.match(ticketSource, /id="tickets"/);
  assert.doesNotMatch(ticketSource, /ticketKicker|<p[^>]*>Билет<\/p>/);
  assert.match(ticketSource, /case-lab-3-ticket-early-bird\.webp/);
  assert.match(ticketSource, /case-lab-3-ticket-standard\.webp/);
  assert.doesNotMatch(ticketSource, /case-lab-3-ticket-(early-bird-v4|standard-v5)\.webp/);
  assert.match(ticketSource, /alt=""/);
  assert.match(ticketSource, /alt: "Early Bird: 7 890 ₸, первые 20 билетов"/);
  assert.match(ticketSource, /alt: "Стандарт: 15 000 ₸ после первых 20 билетов"/);
  assert.match(ticketSource, /<button\b[^>]*className=\{styles\.ticketCta\}[^>]*\bdisabled\b[^>]*\baria-disabled="true"[^>]*>/);
  assert.match(ticketSource, /24 сентября 2026/);
  assert.match(ticketSource, /10:00–14:00/);
  assert.match(ticketSource, /Narxoz Business School/);
  assert.match(ticketSource, /100 мест/);
  assert.match(ticketSource, /ticketPriceSummary/);
  assert.match(ticketSource, /<strong>7 890 ₸<\/strong>/);
  assert.match(ticketSource, /<strong>15 000 ₸<\/strong>/);
  assert.match(ticketSource, /ticketIncluded/);
  assert.match(ticketSource, /три подробных разбора кейсов/);
  assert.match(ticketSource, /живой разговор с CMO после выступлений/);
  assert.match(ticketSource, /знакомства с людьми из маркетинга и креатива/);
});

test("ticket section exposes the editorial layout classes", () => {
  assert.match(ticketStyles, /\.ticketArtwork\s*\{/);
  assert.match(ticketStyles, /\.ticketImage\s*\{/);
  assert.match(ticketStylesBlock, /\.ticketArtwork\s*\{[\s\S]*?display:\s*grid;/);
  assert.match(ticketStylesBlock, /\.ticketArtwork\s*\{[\s\S]*?gap:/);
  assert.doesNotMatch(ticketStylesBlock, /\.ticketArtwork\s*\{[\s\S]*?border-radius:/);
  assert.match(ticketStyles, /\.ticketFacts\s*\{/);
});

test("ticket section uses the blue Case Lab accent instead of purple tokens", () => {
  assert.match(ticketStylesBlock, /background:\s*var\(--cl-accent\)/);
  assert.doesNotMatch(ticketStylesBlock, /#9b54ff|#c3a3ff|#bd8dff|#b687ff|#d0b6ff|#bf8dff/i);
});

test("ticket artwork fills the compact column and angles the upper ticket left", () => {
  assert.match(ticketStylesBlock, /\.ticketArtwork\s*\{[\s\S]*?gap:\s*0;/);
  assert.match(ticketStylesBlock, /grid-template-columns:\s*minmax\(0,\s*65fr\)\s+minmax\(0,\s*35fr\);/);
  assert.match(ticketStylesBlock, /\.ticketLead\s*\{[\s\S]*?max-width:\s*760px;/);
  assert.match(ticketStylesBlock, /\.ticketGrid h2\s*\{[\s\S]*?max-width:\s*12ch[\s\S]*?font-size:\s*clamp\(34px,\s*5\.2vw,\s*68px\);/);
  assert.match(ticketStylesBlock, /\.ticketCopy\s*\{[\s\S]*?max-width:\s*56ch;/);
  assert.match(ticketStylesBlock, /@media \(min-width: 1101px\) \{[\s\S]*?\.ticketArtwork\s*\{[\s\S]*?width:\s*100%;/);
  assert.match(ticketStylesBlock, /\.ticketImage\s*\{[\s\S]*?transform:\s*scale\(1\.3\);/);
  assert.match(ticketStylesBlock, /\.ticketImage:first-child\s*\{[\s\S]*?transform:\s*rotate\(-10deg\)\s+scale\(1\.3\);/);
  assert.match(ticketStylesBlock, /\.ticketImage\s*\+\s*\.ticketImage\s*\{[\s\S]*?margin-top:\s*5%;/);
  assert.match(ticketStyles, /@media \(max-width: 767px\) \{[\s\S]*?\.ticketGrid\s*\{[\s\S]*?grid-template-columns:\s*1fr;/);
  assert.match(ticketStyles, /@media \(max-width: 767px\) \{[\s\S]*?\.ticketImage\s*\{[\s\S]*?transform:\s*scale\(1\);/);
  assert.match(ticketStyles, /@media \(max-width: 640px\) \{[\s\S]*?\.ticketImage\s*\{[\s\S]*?transform:\s*scale\(\.92\);/);
  assert.match(ticketStyles, /@media \(max-width: 640px\) \{[\s\S]*?\.ticketImage\s*\+\s*\.ticketImage\s*\{[\s\S]*?margin-top:\s*-6%;/);
  assert.match(ticketStyles, /@media \(min-width: 901px\) and \(max-width: 1100px\) \{[\s\S]*?\.ticketGrid\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 65fr\)\s+minmax\(0, 35fr\);/);
});
