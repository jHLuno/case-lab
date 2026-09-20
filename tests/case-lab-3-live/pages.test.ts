import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PAGE = "app/case-lab-3/live/page.tsx";
const CLIENT = "app/case-lab-3/live/LiveParticipantClient.tsx";
const CSS = "app/case-lab-3/live/live.module.css";

test("participant live page stays dynamic, private, and server-first", async () => {
  const source = await readFile(PAGE, "utf8");
  assert.match(source, /dynamic\s*=\s*["']force-dynamic["']/u);
  assert.match(source, /revalidate\s*=\s*0/u);
  assert.match(source, /fetchCache\s*=\s*["']force-no-store["']/u);
  assert.match(source, /robots:\s*\{\s*index:\s*false,\s*follow:\s*false/u);
  assert.match(source, /<main/u);
  assert.match(source, /<LiveParticipantClient\s*\/>/u);
  assert.doesNotMatch(source, /["']use client["']/u);
});

test("participant client exposes accessible named controls and complete states", async () => {
  const source = await readFile(CLIENT, "utf8");
  assert.match(source, /^["']use client["'];/u);
  assert.match(source, /name="firstName"/u);
  assert.match(source, /name="lastName"/u);
  assert.match(source, /name="ticketNumber"/u);
  assert.match(source, /name="answer"/u);
  assert.match(source, /maxLength=\{300\}/u);
  assert.match(source, /answer\.length/u);
  assert.match(source, /aria-live="polite"/u);
  assert.match(source, /Загрузка/u);
  assert.match(source, /Повторить/u);
  assert.match(source, /Пока нет активного кейса/u);
  assert.doesNotMatch(source, /@supabase|openrouter/iu);
});

test("participant styles preserve keyboard focus and reduced-motion behavior", async () => {
  const source = await readFile(CSS, "utf8");
  assert.match(source, /:focus-visible/u);
  assert.match(source, /@media\s*\(prefers-reduced-motion:\s*reduce\)/u);
  assert.match(source, /min-height:\s*100dvh/u);
});
