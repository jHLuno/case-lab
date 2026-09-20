import "server-only";

export type OpenRouterFetch = typeof fetch;

type SubmissionForEvaluation = {
  submissionId: string;
  answer: string;
};

export type ShortlistInput = {
  question: string;
  referenceAnswer: string;
  context?: string | null;
  approvedRubric?: unknown;
  submissions: readonly SubmissionForEvaluation[];
};

export type ValidatedShortlist = {
  candidates: Array<{
    submissionId: string;
    score: number;
    reason: string;
    approach: string;
    candidateType: "strong" | "alternative" | "wildcard";
  }>;
  model: string;
  latencyMs: number;
  usage: { promptTokens: number; completionTokens: number; cost: number | null };
};

export type EvaluationRubric = {
  criteria: Array<{ name: string; description: string; weight: number }>;
};

export class OpenRouterValidationError extends Error {
  readonly code = "openrouter_invalid_response" as const;

  constructor(message = "OpenRouter response is invalid") {
    super(message);
    this.name = "OpenRouterValidationError";
  }
}

type Dependencies = {
  apiKey?: string;
  primaryModel?: string;
  fallbackModel?: string;
  fetch?: OpenRouterFetch;
  timeoutMs?: number;
  now?: () => number;
};

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_PRIMARY_MODEL = "google/gemini-3-flash-preview";
const DEFAULT_FALLBACK_MODEL = "openai/gpt-5-mini";
const MAX_RESPONSE_BYTES = 128 * 1024;

const shortlistSchema = {
  type: "object",
  additionalProperties: false,
  required: ["candidates"],
  properties: {
    candidates: {
      type: "array",
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["id", "score", "reason", "approach", "candidateType"],
        properties: {
          id: { type: "string", pattern: "^candidate_[0-9]{3}$" },
          score: { type: "integer", minimum: 0, maximum: 100 },
          reason: { type: "string", minLength: 1, maxLength: 500 },
          approach: { type: "string", minLength: 1, maxLength: 120 },
          candidateType: { type: "string", enum: ["strong", "alternative", "wildcard"] },
        },
      },
    },
  },
} as const;

const rubricSchema = {
  type: "object",
  additionalProperties: false,
  required: ["criteria"],
  properties: {
    criteria: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "description", "weight"],
        properties: {
          name: { type: "string", minLength: 1, maxLength: 80 },
          description: { type: "string", minLength: 1, maxLength: 300 },
          weight: { type: "integer", minimum: 1, maximum: 100 },
        },
      },
    },
  },
} as const;

function config(dependencies: Dependencies) {
  const apiKey = dependencies.apiKey ?? process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OpenRouter API key is not configured");
  return {
    apiKey,
    primaryModel: dependencies.primaryModel ?? process.env.OPENROUTER_MODEL?.trim() ?? DEFAULT_PRIMARY_MODEL,
    fallbackModel: dependencies.fallbackModel ?? process.env.OPENROUTER_FALLBACK_MODEL?.trim() ?? DEFAULT_FALLBACK_MODEL,
    fetch: dependencies.fetch ?? fetch,
    timeoutMs: dependencies.timeoutMs ?? 20_000,
    now: dependencies.now ?? Date.now,
  };
}

function finiteText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maxLength;
}

function jsonSchema(name: string, schema: object) {
  return { type: "json_schema", json_schema: { name, strict: true, schema } };
}

function anonymizedSubmissions(submissions: readonly SubmissionForEvaluation[]) {
  return submissions.map((submission, index) => ({
    id: `candidate_${String(index + 1).padStart(3, "0")}`,
    answer: submission.answer,
  }));
}

function promptForShortlist(input: ShortlistInput, candidates: ReturnType<typeof anonymizedSubmissions>): string {
  return JSON.stringify({
    task: "Оцени ответы участников и верни до 10 наиболее релевантных решений.",
    question: input.question,
    speakerReferenceAnswer: input.referenceAnswer,
    context: input.context ?? null,
    rubric: input.approvedRubric ?? null,
    candidates,
    rules: [
      "Сравнивай только с вопросом, эталоном и критериями.",
      "Не используй скорость ответа, имя или любые персональные данные.",
      "Верни только JSON по схеме.",
    ],
  });
}

async function readResponse(response: Response): Promise<Record<string, unknown>> {
  const contentLength = response.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_RESPONSE_BYTES) throw new OpenRouterValidationError("Response is too large");
  const text = await response.text();
  if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) throw new OpenRouterValidationError("Response is too large");
  try {
    const parsed = JSON.parse(text) as unknown;
    if (!isRecord(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new OpenRouterValidationError("Provider response is not valid JSON");
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function complete(
  messages: Array<{ role: "system" | "user"; content: string }>,
  responseSchema: object,
  dependencies: Dependencies,
) {
  const active = config(dependencies);
  const startedAt = active.now();
  let response: Response;
  try {
    response = await active.fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${active.apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://caselab.kz",
        "X-Title": "Case Lab III Live",
      },
      body: JSON.stringify({
        models: [active.primaryModel, active.fallbackModel],
        messages,
        temperature: 0.1,
        reasoning: { effort: "low" },
        provider: {
          data_collection: "deny",
          zdr: true,
          require_parameters: true,
        },
        response_format: jsonSchema("case_lab_3_live", responseSchema),
      }),
      signal: AbortSignal.timeout(active.timeoutMs),
    });
  } catch {
    throw new Error("OpenRouter request failed");
  }
  if (!response.ok) throw new Error("OpenRouter request failed");

  const payload = await readResponse(response);
  const choices = payload.choices;
  if (!Array.isArray(choices) || !isRecord(choices[0])) throw new OpenRouterValidationError("No model choice returned");
  const message = choices[0].message;
  if (!isRecord(message) || typeof message.content !== "string" || message.content.trim().startsWith("``")) {
    throw new OpenRouterValidationError("Model content is invalid");
  }
  let content: unknown;
  try {
    content = JSON.parse(message.content);
  } catch {
    throw new OpenRouterValidationError("Model content is not valid JSON");
  }
  return {
    content,
    model: typeof payload.id === "string" ? payload.id : active.primaryModel,
    latencyMs: Math.max(0, active.now() - startedAt),
    usage: isRecord(payload.usage) ? payload.usage : {},
  };
}

function usage(value: Record<string, unknown>) {
  const promptTokens = Number(value.prompt_tokens ?? 0);
  const completionTokens = Number(value.completion_tokens ?? 0);
  const costValue = value.cost;
  return {
    promptTokens: Number.isSafeInteger(promptTokens) && promptTokens >= 0 ? promptTokens : 0,
    completionTokens: Number.isSafeInteger(completionTokens) && completionTokens >= 0 ? completionTokens : 0,
    cost: typeof costValue === "number" && Number.isFinite(costValue) && costValue >= 0 ? costValue : null,
  };
}

function validateShortlistContent(
  content: unknown,
  submissions: readonly SubmissionForEvaluation[],
): ValidatedShortlist["candidates"] {
  if (!isRecord(content) || !Array.isArray(content.candidates) || content.candidates.length > 10) {
    throw new OpenRouterValidationError("Shortlist schema is invalid");
  }
  const known = new Map(submissions.map((submission, index) => [
    `candidate_${String(index + 1).padStart(3, "0")}`,
    submission.submissionId,
  ]));
  const seen = new Set<string>();
  return content.candidates.map((candidate) => {
    if (!isRecord(candidate)
      || typeof candidate.id !== "string"
      || !known.has(candidate.id)
      || seen.has(candidate.id)
      || !Number.isSafeInteger(candidate.score)
      || (candidate.score as number) < 0
      || (candidate.score as number) > 100
      || !finiteText(candidate.reason, 500)
      || !finiteText(candidate.approach, 120)
      || !["strong", "alternative", "wildcard"].includes(String(candidate.candidateType))) {
      throw new OpenRouterValidationError("Shortlist candidate is invalid");
    }
    seen.add(candidate.id);
    return {
      submissionId: known.get(candidate.id) as string,
      score: candidate.score as number,
      reason: candidate.reason.trim(),
      approach: candidate.approach.trim(),
      candidateType: candidate.candidateType as "strong" | "alternative" | "wildcard",
    };
  });
}

export async function generateShortlist(
  input: ShortlistInput,
  dependencies: Dependencies = {},
): Promise<ValidatedShortlist> {
  if (!finiteText(input.question, 1000) || !finiteText(input.referenceAnswer, 4000) || input.submissions.length === 0) {
    throw new OpenRouterValidationError("Shortlist input is invalid");
  }
  const candidates = anonymizedSubmissions(input.submissions);
  const result = await complete([
    {
      role: "system",
      content: "Ты помощник модератора Case Lab III. Оценивай идеи, а не людей. Не добавляй персональные данные.",
    },
    { role: "user", content: promptForShortlist(input, candidates) },
  ], shortlistSchema, dependencies);
  return {
    candidates: validateShortlistContent(result.content, input.submissions),
    model: result.model,
    latencyMs: result.latencyMs,
    usage: usage(result.usage),
  };
}

export async function generateEvaluationRubric(
  input: { question: string; referenceAnswer: string; context?: string | null; keyInsight?: string | null },
  dependencies: Dependencies = {},
): Promise<EvaluationRubric> {
  if (!finiteText(input.question, 1000) || !finiteText(input.referenceAnswer, 4000)) {
    throw new OpenRouterValidationError("Rubric input is invalid");
  }
  const result = await complete([
    {
      role: "system",
      content: "Составь компактную карточку оценки ответов для модератора Case Lab III. Не добавляй персональные данные.",
    },
    {
      role: "user",
      content: JSON.stringify({
        question: input.question,
        speakerReferenceAnswer: input.referenceAnswer,
        context: input.context ?? null,
        keyInsight: input.keyInsight ?? null,
        rules: ["2-6 критериев", "Вес каждого критерия от 1 до 100", "Только JSON по схеме"],
      }),
    },
  ], rubricSchema, dependencies);

  if (!isRecord(result.content) || !Array.isArray(result.content.criteria) || result.content.criteria.length < 2 || result.content.criteria.length > 6) {
    throw new OpenRouterValidationError("Rubric schema is invalid");
  }
  const criteria = result.content.criteria.map((criterion) => {
    if (!isRecord(criterion)
      || !finiteText(criterion.name, 80)
      || !finiteText(criterion.description, 300)
      || !Number.isSafeInteger(criterion.weight)
      || (criterion.weight as number) < 1
      || (criterion.weight as number) > 100) {
      throw new OpenRouterValidationError("Rubric criterion is invalid");
    }
    return {
      name: criterion.name.trim(),
      description: criterion.description.trim(),
      weight: criterion.weight as number,
    };
  });
  return { criteria };
}
