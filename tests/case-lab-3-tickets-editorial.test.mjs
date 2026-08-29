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
  assert.match(ticketSource, /case-lab-3-ticket-early-bird-v4\.webp/);
  assert.match(ticketSource, /case-lab-3-ticket-standard-v5\.webp/);
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

test("ticket artwork is smaller, tighter, and angles the upper ticket left", () => {
  assert.match(ticketStylesBlock, /\.ticketArtwork\s*\{[\s\S]*?gap:\s*0;/);
  assert.match(ticketStylesBlock, /\.ticketImage\s*\{[\s\S]*?transform:\s*scale\(\.85\);/);
  assert.match(ticketStylesBlock, /\.ticketImage:first-child\s*\{[\s\S]*?transform:\s*rotate\(-10deg\)\s+scale\(\.85\);/);
  assert.match(ticketStylesBlock, /\.ticketImage\s*\+\s*\.ticketImage\s*\{[\s\S]*?margin-top:\s*-10%;/);
  assert.match(ticketStylesBlock, /\.ticketGrid\s+h2|\.ticketGrid h2/);
  assert.match(ticketStylesBlock, /\.ticketGrid h2\s*\{[\s\S]*?calc\(5\.8vw\s*-\s*30px\)[\s\S]*?52px/);
});
