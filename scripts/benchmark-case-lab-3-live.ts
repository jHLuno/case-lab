import "../tests/case-lab-3-payments/server-only-test-loader";

import { generateShortlist } from "../app/lib/case-lab-3/live/openrouter.server";

const BENCHMARK_FLAG = "1";
const SYNTHETIC_ANSWER_COUNT = 80;

function syntheticAnswers() {
  const patterns = [
    "Сначала проверю гипотезу на небольшом сегменте, зафиксирую метрику успеха и только потом расширю решение.",
    "Я бы начал с интервью и наблюдения за текущим сценарием, чтобы отделить реальную проблему от симптома.",
    "Предложу пилот с ограниченным бюджетом, контрольной группой и заранее согласованным критерием остановки.",
    "Команде важно выбрать один приоритет, назначить владельца решения и вернуть результат в общий цикл обратной связи.",
    "В первую очередь проверю ограничения: сроки, ресурсы, юридические риски и зависимость от внешних подрядчиков.",
  ];

  return Array.from({ length: SYNTHETIC_ANSWER_COUNT }, (_, index) => ({
    submissionId: `synthetic-submission-${String(index + 1).padStart(3, "0")}`,
    answer: `${patterns[index % patterns.length]} Вариант ${index + 1} добавляет отдельную проверку результата.`,
  }));
}

async function main() {
  if (process.env.CASE_LAB_3_LIVE_BENCHMARK !== BENCHMARK_FLAG) {
    console.error("Benchmark skipped. Set CASE_LAB_3_LIVE_BENCHMARK=1 explicitly to allow an OpenRouter request.");
    process.exitCode = 2;
    return;
  }

  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    console.log(JSON.stringify({ status: "skipped", reason: "OPENROUTER_API_KEY is not configured", submissions: SYNTHETIC_ANSWER_COUNT }));
    return;
  }

  const startedAt = Date.now();
  try {
    const result = await generateShortlist({
      question: "Как команде быстро выбрать и проверить решение для новой маркетинговой задачи?",
      referenceAnswer: "Начать с диагностики, сформулировать проверяемую гипотезу, провести компактный пилот и принять решение по заранее выбранным метрикам.",
      context: "Синтетический benchmark для Case Lab III. Персональных данных нет.",
      approvedRubric: {
        criteria: [
          { name: "Связь с вопросом", description: "Ответ прямо предлагает решение поставленной задачи.", weight: 35 },
          { name: "Проверяемость", description: "Есть конкретный следующий шаг и критерий результата.", weight: 35 },
          { name: "Работа с ограничениями", description: "Учитываются ресурсы, риски и порядок действий.", weight: 30 },
        ],
      },
      submissions: syntheticAnswers(),
    });
    console.log(JSON.stringify({
      status: "passed",
      submissions: SYNTHETIC_ANSWER_COUNT,
      candidates: result.candidates.length,
      model: result.model,
      latencyMs: result.latencyMs,
      wallClockMs: Date.now() - startedAt,
      usage: result.usage,
    }));
  } catch {
    console.log(JSON.stringify({ status: "failed", submissions: SYNTHETIC_ANSWER_COUNT, reason: "provider_or_validation_error" }));
    process.exitCode = 1;
  }
}

void main();
