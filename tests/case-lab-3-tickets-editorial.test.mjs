import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const pageSource = await readFile(new URL("../app/components/CaseLab3Page.tsx", import.meta.url), "utf8");
const ticketSource = await readFile(new URL("../app/sections/CaseLab3Tickets.tsx", import.meta.url), "utf8");
const ticketStyles = await readFile(new URL("../app/case-lab-3/case-lab-3.module.css", import.meta.url), "utf8");

test("tickets appear after process and before proof", () => {
  const processIndex = pageSource.indexOf("<CaseLab3HowItWorks />");
  const ticketIndex = pageSource.indexOf("<CaseLab3Tickets />");
  const proofIndex = pageSource.indexOf("<CaseLab3Proof />");

  assert.ok(processIndex >= 0);
  assert.ok(ticketIndex > processIndex);
  assert.ok(proofIndex > ticketIndex);
});

test("ticket section uses the generated background and disabled CTA", () => {
  assert.match(ticketSource, /id="tickets"/);
  assert.match(ticketSource, /case-lab-3-tickets-bg\.png/);
  assert.match(ticketSource, /alt=""/);
  assert.match(ticketSource, /disabled/);
  assert.match(ticketSource, /aria-disabled="true"/);
  assert.match(ticketSource, /24 сентября 2026/);
  assert.match(ticketSource, /10:00–14:00/);
  assert.match(ticketSource, /Narxoz Business School/);
  assert.match(ticketSource, /100 мест/);
  assert.match(ticketSource, /7 890 ₸/);
  assert.match(ticketSource, /15 000 ₸/);
  assert.match(ticketSource, /Первые 20 билетов/);
});

test("ticket section exposes the editorial layout classes", () => {
  assert.match(ticketStyles, /\.ticketBackground\s*\{/);
  assert.match(ticketStyles, /\.ticketOverlay\s*\{/);
  assert.match(ticketStyles, /\.ticketPanel\s*\{/);
  assert.match(ticketStyles, /\.ticketFacts\s*\{/);
});
