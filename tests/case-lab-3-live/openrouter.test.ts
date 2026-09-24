import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import "../case-lab-3-payments/server-only-test-loader";

import {
  OpenRouterValidationError,
  generateEvaluationRubric,
  generateShortlist,
  type OpenRouterFetch,
} from "../../app/lib/case-lab-3/live/openrouter.server";

const SUBMISSIONS = [
  {
    submissionId: "sub-001",
    answer: "Сначала проверю гипотезу на небольшой группе клиентов и сравню конверсию с контрольной группой.",
  },
  {
    submissionId: "sub-002",
    answer: "Разделю аудиторию на сегменты, найду главный барьер и проверю решение коротким экспериментом.",
  },
];

async function fixtureResponse(name: string): Promise<Response> {
  return new Response(await readFile(`tests/fixtures/case-lab-3/live/${name}`, "utf8"), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function dependencies(fetch: OpenRouterFetch, options: { timeoutMs?: number } = {}) {
  return {
    apiKey: "test-openrouter-key",
    primaryModel: "google/gemini-3-flash-preview",
    fallbackModel: "openai/gpt-5-mini",
    fetch,
    ...options,
  };
}

test("sends a privacy-preserving strict-schema shortlist request", async () => {
  let requestBody: Record<string, unknown> | null = null;
  const fetch: OpenRouterFetch = async (_url, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return fixtureResponse("openrouter-valid.json");
  };

  const result = await generateShortlist({
    question: "Как вы проверите гипотезу?",
    referenceAnswer: "Начать с дешёвого эксперимента и заранее определить метрику успеха.",
    context: "У команды мало времени и ограниченный бюджет.",
    approvedRubric: { criteria: [{ name: "relevance", weight: 100 }] },
    submissions: SUBMISSIONS,
  }, dependencies(fetch));

  assert.ok(requestBody);
  const body = requestBody as Record<string, unknown>;
  assert.deepEqual(body.models, ["google/gemini-3-flash-preview", "openai/gpt-5-mini"]);
  assert.deepEqual(body.provider, {
    data_collection: "deny",
    zdr: true,
    require_parameters: true,
  });
  assert.equal((body.response_format as { type: string }).type, "json_schema");
  assert.equal(JSON.stringify(body).includes("sub-001"), false);
  assert.equal(JSON.stringify(body).includes("CL3-000123"), false);
  assert.equal(result.candidates[0]?.submissionId, "sub-001");
});

test("maps only validated ephemeral IDs back to internal submissions", async () => {
  const fetch: OpenRouterFetch = async () => fixtureResponse("openrouter-valid.json");
  const result = await generateShortlist({
    question: "Как вы проверите гипотезу?",
    referenceAnswer: "Проверить гипотезу экспериментом.",
    submissions: SUBMISSIONS,
  }, dependencies(fetch));

  assert.deepEqual(result.candidates.map((candidate) => candidate.submissionId), ["sub-001", "sub-002"]);
  assert.equal(result.model, "google/gemini-3-flash-preview");
  assert.ok(result.latencyMs >= 0);
});

test("rejects duplicate, unknown, and invalid-score candidates", async () => {
  const invalidPayload = {
    id: "google/gemini-3-flash-preview",
    choices: [{ message: { content: JSON.stringify({ candidates: [
      { id: "candidate_001", score: 101, reason: "x", approach: "x", candidateType: "strong" },
      { id: "candidate_001", score: 90, reason: "x", approach: "x", candidateType: "strong" },
    ] }) } }],
  };
  const fetch: OpenRouterFetch = async () => Response.json(invalidPayload);

  await assert.rejects(
    generateShortlist({ question: "Вопрос", referenceAnswer: "Эталон", submissions: SUBMISSIONS }, dependencies(fetch)),
    OpenRouterValidationError,
  );

  const unknown = await fixtureResponse("openrouter-invalid-id.json");
  await assert.rejects(
    generateShortlist({ question: "Вопрос", referenceAnswer: "Эталон", submissions: SUBMISSIONS }, dependencies(async () => unknown)),
    OpenRouterValidationError,
  );
});

test("accepts fewer candidates when there are fewer valid submissions", async () => {
  const payload = {
    id: "openai/gpt-5-mini",
    choices: [{ message: { content: JSON.stringify({ candidates: [
      { id: "candidate_001", score: 72, reason: "Достаточно конкретно.", approach: "Тест", candidateType: "wildcard" },
    ] }) } }],
  };
  const result = await generateShortlist({
    question: "Вопрос",
    referenceAnswer: "Эталон",
    submissions: [SUBMISSIONS[0]],
  }, dependencies(async () => Response.json(payload)));
  assert.equal(result.candidates.length, 1);
});

test("rejects a provider shortlist with more than five candidates", async () => {
  const candidates = Array.from({ length: 6 }, (_, index) => ({
    id: `candidate_${String(index + 1).padStart(3, "0")}`,
    score: 80,
    reason: "Конкретный план.",
    approach: "Эксперимент",
    candidateType: "strong",
  }));
  const result = {
    id: "openai/gpt-5-mini",
    choices: [{ message: { content: JSON.stringify({ candidates }) } }],
  };
  await assert.rejects(
    generateShortlist({
      question: "Вопрос",
      referenceAnswer: "Эталон",
      submissions: Array.from({ length: 6 }, (_, index) => ({ submissionId: `sub-${index + 1}`, answer: "Достаточно подробный ответ участника." })),
    }, dependencies(async () => Response.json(result))),
    OpenRouterValidationError,
  );
});

test("generates a validated rubric through the same private model route", async () => {
  let body = "";
  const fetch: OpenRouterFetch = async (_url, init) => {
    body = String(init?.body);
    return Response.json({
      id: "google/gemini-3-flash-preview",
      choices: [{ message: { content: JSON.stringify({ criteria: [
        { name: "relevance", description: "Связь с вопросом", weight: 60 },
        { name: "specificity", description: "Конкретность шага", weight: 40 },
      ] }) } }],
    });
  };
  const result = await generateEvaluationRubric({
    question: "Какое решение вы предложите?",
    referenceAnswer: "Сильный ответ называет действие, ограничение и метрику.",
    context: "Времени мало.",
  }, dependencies(fetch));
  assert.equal(result.criteria.length, 2);
  assert.equal(body.includes("fullName"), false);
});

test("uses a 40-second default timeout and caps it at one minute", async () => {
  const capturedTimeouts: number[] = [];
  const originalTimeout = AbortSignal.timeout;
  Object.defineProperty(AbortSignal, "timeout", {
    configurable: true,
    value: (delay: number) => {
      capturedTimeouts.push(delay);
      return originalTimeout(delay);
    },
  });

  const fetch: OpenRouterFetch = async (_url, init) => {
    assert.ok(init?.signal);
    throw new TypeError("network failed");
  };

  try {
    await assert.rejects(
      generateShortlist({ question: "Вопрос", referenceAnswer: "Эталон", submissions: SUBMISSIONS }, dependencies(fetch)),
      /OpenRouter request failed/u,
    );
    await assert.rejects(
      generateShortlist(
        { question: "Вопрос", referenceAnswer: "Эталон", submissions: SUBMISSIONS },
        dependencies(fetch, { timeoutMs: 120_000 }),
      ),
      /OpenRouter request failed/u,
    );
  } finally {
    Object.defineProperty(AbortSignal, "timeout", { configurable: true, value: originalTimeout });
  }

  assert.deepEqual(capturedTimeouts, [40_000, 60_000]);
});

test("rejects fenced or malformed JSON instead of guessing", async () => {
  const fetch: OpenRouterFetch = async () => Response.json({
    id: "google/gemini-3-flash-preview",
    choices: [{ message: { content: "```json\n{\"candidates\": []}\n```" } }],
  });
  await assert.rejects(
    generateShortlist({ question: "Вопрос", referenceAnswer: "Эталон", submissions: SUBMISSIONS }, dependencies(fetch)),
    OpenRouterValidationError,
  );
});
