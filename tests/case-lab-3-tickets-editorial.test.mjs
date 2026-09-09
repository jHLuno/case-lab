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

test("ticket section matches the dark reference and keeps CTA button-only", () => {
  assert.match(ticketSource, /id="tickets"/);
  assert.match(ticketSource, /case-lab-early-bird-7980\.webp/);
  assert.match(ticketSource, /case-lab-3-ticket-standard\.webp/);
  assert.doesNotMatch(ticketSource, /case-lab-3-ticket-(early-bird-v4|standard-v5)\.webp/);
  assert.match(ticketSource, /alt: "Early Bird: 7 980 ₸, первые 20 билетов"/);
  assert.match(ticketSource, /alt: "Стандарт: 15 000 ₸ после первых 20 билетов"/);
  assert.match(ticketSource, /<CaseLab3CheckoutButton\s+source="tickets"\s+className=\{styles\.ticketCta\}>/);
  assert.match(ticketSource, /24 сентября 2026/);
  assert.match(ticketSource, /10:00–14:00/);
  assert.match(ticketSource, /Narxoz Business School/);
  assert.doesNotMatch(ticketSource, /100 мест/);
  assert.match(ticketSource, /ticketIncluded/);
  assert.match(ticketSource, /Разборы Invictus, OYU Fest и ForteBank/);
  assert.match(ticketSource, /Обсуждение решений и вопросы спикерам/);
  assert.match(ticketSource, /Знакомства с коллегами и кейтеринг/);
  assert.match(ticketSource, /Участие в рейтинге и призы для топ-3/);
  assert.match(ticketSource, /БИЛЕТЫ НА CASE LAB III/);
  assert.match(ticketSource, /Купить билет за 7 980 ₸/);
  assert.match(ticketSource, /Один билет — вся программа Case Lab III/);
  assert.match(ticketSource, /className=\{styles\.ticketPurchaseArea\}/);
  assert.match(ticketSource, /className=\{styles\.ticketPurchaseMeta\}/);
  assert.match(ticketSource, /className=\{styles\.ticketPurchaseNote\}/);
  assert.match(ticketStylesBlock, /background:\s*#080811/);
  assert.doesNotMatch(ticketSource, /ticketBackground|ticketOverlay/);
});

test("ticket section exposes the reference composition", () => {
  const standardTicketIndex = ticketSource.indexOf('src: "/case-lab-3-ticket-standard.webp"');
  const earlyBirdTicketIndex = ticketSource.indexOf('src: "/case-lab-early-bird-7980.webp"');

  assert.ok(standardTicketIndex >= 0);
  assert.ok(earlyBirdTicketIndex > standardTicketIndex);
  assert.match(ticketStylesBlock, /grid-template-columns:\s*minmax\(0, 52fr\)\s+minmax\(0, 48fr\)/);
  assert.match(ticketStylesBlock, /\.ticketArtwork\s*\{[\s\S]*?position:\s*relative;/);
  assert.match(ticketStylesBlock, /\.ticketImage:first-child\s*\{[\s\S]*?z-index:\s*1;/);
  assert.match(ticketStylesBlock, /\.ticketImage\s*\+\s*\.ticketImage\s*\{[\s\S]*?z-index:\s*2;[\s\S]*?margin-top:\s*-\d+(?:\.\d+)?%;/);
  assert.match(ticketStylesBlock, /\.ticketPurchaseArea\s*\{[\s\S]*?background:\s*transparent;/);
  assert.match(ticketStylesBlock, /\.ticketCta\s*\{[\s\S]*?background:\s*#f5f4fb;/);
});

test("primary Case Lab CTAs use the shared 24px radius", () => {
  assert.match(
    ticketStyles,
    /\.heroCta,\s*\.ticketCta\s*\{[\s\S]*?border-radius:\s*24px;/,
  );
  assert.doesNotMatch(ticketStylesBlock, /\.ticketCta\s*\{[^}]*border-radius:\s*6px;/);
});

test("ticket heading uses the reduced reference scale", () => {
  assert.match(ticketStylesBlock, /\.ticketGrid h2\s*\{[\s\S]*?font-size:\s*clamp\(42px,\s*5\.8vw,\s*70px\);/);
  assert.match(
    ticketStyles,
    /@media \(min-width: 901px\) and \(max-width: 1100px\)[\s\S]*?\.ticketGrid h2\s*\{[^}]*font-size:\s*clamp\(38px,\s*5\.2vw,\s*52px\);/,
  );
  assert.match(
    ticketStyles,
    /@media \(min-width: 768px\) and \(max-width: 1023px\)[\s\S]*?\.ticketGrid h2\s*\{[^}]*font-size:\s*clamp\(38px,\s*5vw,\s*46px\);/,
  );
  assert.match(
    ticketStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.ticketGrid h2\s*\{[^}]*font-size:\s*clamp\(40px,\s*11vw,\s*54px\);/,
  );
});

test("ticket benefits follow the artwork on mobile and artwork scales up", () => {
  const purchaseIndex = ticketSource.indexOf("ticketPurchaseArea");
  const includedIndex = ticketSource.indexOf("ticketIncluded");

  assert.ok(includedIndex > purchaseIndex);
  assert.match(
    ticketStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.ticketIncludedGridItem\s*\{[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*auto;/,
  );
  assert.match(
    ticketStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.ticketImage:first-child\s*\{[^}]*transform:\s*rotate\(4deg\)\s+scale\(1\.04\);/,
  );
  assert.match(
    ticketStyles,
    /@media \(max-width: 767px\)[\s\S]*?\.ticketImage\s*\+\s*\.ticketImage\s*\{[^}]*transform:\s*rotate\(-6deg\)\s+scale\(1\.12\);/,
  );
});

test("ticket mobile details use a lighter rhythm", () => {
  const mobileTicketFacts = ticketStyles.match(
    /@media \(max-width: 767px\) \{[\s\S]*?\.ticketFacts\s*\{([^}]*)\}/,
  )?.[1] ?? "";
  const mobileTicketFactDivider = ticketStyles.match(
    /@media \(max-width: 767px\) \{[\s\S]*?\.ticketFact\s*\+\s*\.ticketFact\s*\{([^}]*)\}/,
  )?.[1] ?? "";
  const mobileTicketPurchaseMeta = ticketStyles.match(
    /@media \(max-width: 767px\) \{[\s\S]*?\.ticketPurchaseMeta\s*\{([^}]*)\}/,
  )?.[1] ?? "";
  const mobileTicketIncluded = ticketStyles.match(
    /\.ticketIncludedGridItem\s*\{\s*margin-top:\s*-16px;/,
  )?.[0] ?? "";

  assert.match(
    mobileTicketFacts,
    /border-top:\s*0;[\s\S]*border-bottom:\s*0;/,
  );
  assert.match(
    mobileTicketFactDivider,
    /border-top:\s*0;[\s\S]*border-left:\s*0;/,
  );
  assert.match(
    mobileTicketPurchaseMeta,
    /flex-direction:\s*row;[\s\S]*justify-content:\s*space-between;/,
  );
  assert.match(
    mobileTicketIncluded,
    /margin-top:\s*-16px;/,
  );
});

test("desktop ticket benefits sit closer to the ticket content", () => {
  assert.match(
    ticketStylesBlock,
    /@media \(min-width: 768px\)[\s\S]*?\.ticketIncluded\s*\{[^}]*margin-top:\s*0;/,
  );
});
