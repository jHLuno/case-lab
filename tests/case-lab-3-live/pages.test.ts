import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const PAGE = "app/case-lab-3/live/page.tsx";
const CLIENT = "app/case-lab-3/live/LiveParticipantClient.tsx";
const CSS = "app/case-lab-3/live/live.module.css";
const CRM_PAGE = "app/crm/case-lab-3/live/page.tsx";
const CRM_CLIENT = "app/crm/case-lab-3/live/LiveOperatorClient.tsx";
const LEADERBOARD_PAGE = "app/case-lab-3/live/leaderboard/page.tsx";
const LEADERBOARD_CLIENT = "app/case-lab-3/live/leaderboard/LeaderboardClient.tsx";

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
  assert.match(source, /name="lastName"[^>]*required/u);
  assert.match(source, /Попадите в топ-3 лидерборда/u);
  assert.match(source, /и получите ценные призы!/u);
  assert.doesNotMatch(source, /из билета/u);
  assert.doesNotMatch(source, /name="ticketNumber"/u);
  assert.doesNotMatch(source, /needsTicketNumber/u);
  assert.match(source, /name="answer"/u);
  assert.match(source, /maxLength=\{350\}/u);
  assert.match(source, /rows=\{4\}/u);
  assert.match(source, /closesAt/u);
  assert.match(source, /formatRemaining/u);
  assert.match(source, /answerLocked/u);
  assert.match(source, /saveAnswer\("timeout"\)/u);
  assert.doesNotMatch(source, /Сменить участника/u);
  assert.doesNotMatch(source, /<strong>III<\/strong>/u);
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
  assert.match(source, /\.field textarea\s*\{[\s\S]*?min-height:\s*112px/u);
});

test("CRM live page is protected and exposes operator controls", async () => {
  const page = await readFile(CRM_PAGE, "utf8");
  const client = await readFile(CRM_CLIENT, "utf8");
  const nav = await readFile("app/crm/components/CrmSectionNav.tsx", "utf8");
  assert.match(page, /requireCrmAdmin/u);
  assert.match(page, /issueCrmCsrfToken/u);
  assert.match(client, /Подготовка кейсов/u);
  assert.match(client, /Сгенерировать критерии/u);
  assert.match(client, /Запустить AI-анализ/u);
  assert.match(client, /Сбросить таймер/u);
  assert.match(client, /reset-timer/u);
  assert.match(client, /Ручной режим/u);
  assert.match(client, /Опубликовать топ-3/u);
  assert.match(client, /Открыть выбор спикера/u);
  assert.match(client, /speaker-session/u);
  assert.match(client, /Сбросить участника/u);
  assert.match(client, /X-CSRF-Token/u);
  assert.match(client, /Idempotency-Key/u);
  assert.match(client, /LIVE_ENVIRONMENT\s*=\s*["']live["']/u);
  assert.match(client, /questionNumber/u);
  assert.match(client, /LIVE_ROUND_SETTLE_GRACE_MS/u);
  assert.match(client, /autoAnalyzedRounds/u);
  assert.doesNotMatch(client, /<option value=["']test["']>/u);
  assert.doesNotMatch(client, /Среда/u);
  assert.doesNotMatch(client, /OPENROUTER_API_KEY|openrouter\.server/u);
  assert.match(nav, /\/crm\/case-lab-3\/live\//u);
});

test("public leaderboard page polls a sanitized projection", async () => {
  const page = await readFile(LEADERBOARD_PAGE, "utf8");
  const client = await readFile(LEADERBOARD_CLIENT, "utf8");
  assert.match(page, /dynamic\s*=\s*["']force-dynamic["']/u);
  assert.match(page, /no-store/u);
  assert.match(client, /Лидерборд/u);
  assert.match(client, /Топ-10/u);
  assert.match(client, /podiumAnswers/u);
  assert.match(client, /questionAnswers/u);
  assert.match(client, /candidateId/u);
  assert.match(client, /speakerToken/u);
  assert.match(client, /Выбрать топ-3/u);
  assert.match(client, /setInterval/u);
  assert.match(client, /prefers-reduced-motion/u);
  assert.doesNotMatch(client, />Участнику</u);
  assert.doesNotMatch(client, /<strong>III<\/strong>/u);
  assert.doesNotMatch(client, /ticket|submissionId|aiScore|aiReason/iu);
});
