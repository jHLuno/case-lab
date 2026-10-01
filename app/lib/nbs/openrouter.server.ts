import "server-only";

import { createHash } from "node:crypto";

import type { NbsModelMetadata } from "./contracts";

const ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_PRIMARY = "google/gemini-3-flash-preview";
const DEFAULT_FALLBACK = "openai/gpt-5-mini";
const MAX_RESPONSE_BYTES = 1024 * 1024;
const MAX_REQUEST_BYTES = 950 * 1024;
const MAX_TIMEOUT_MS = 45_000;

export class NbsAnalysisError extends Error {
  constructor(readonly code: "provider_error" | "invalid_response" | "input_too_large" | "privacy_check_failed") {
    super(code);
    this.name = "NbsAnalysisError";
  }
}

type OpenRouterOptions = {
  fetch?: typeof fetch;
  now?: () => number;
  timeoutMs?: number;
  attemptCount?: number;
  maxCompletionTokens?: number;
};

export type NbsOpenRouterResult = {
  content: unknown;
  metadata: NbsModelMetadata;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown): number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

async function readBounded(response: Response): Promise<Record<string, unknown>> {
  const declared = response.headers.get("content-length");
  if (declared && Number(declared) > MAX_RESPONSE_BYTES) throw new NbsAnalysisError("invalid_response");
  if (!response.body) throw new NbsAnalysisError("invalid_response");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new NbsAnalysisError("invalid_response");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    const parsed: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!isRecord(parsed)) throw new Error();
    return parsed;
  } catch {
    throw new NbsAnalysisError("invalid_response");
  }
}

export async function completeNbsJson(
  system: string,
  user: unknown,
  schemaName: string,
  schema: object,
  options: OpenRouterOptions = {},
): Promise<NbsOpenRouterResult> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const primaryModel = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_PRIMARY;
  const fallbackModel = process.env.OPENROUTER_FALLBACK_MODEL?.trim() || DEFAULT_FALLBACK;
  if (!apiKey) throw new NbsAnalysisError("provider_error");

  const userContent = typeof user === "string" ? user : JSON.stringify(user);
  const requestBody = {
    models: options.attemptCount && options.attemptCount > 1 ? [fallbackModel, primaryModel] : [primaryModel, fallbackModel],
    messages: [{ role: "system", content: system }, { role: "user", content: userContent }],
    max_tokens: Math.min(60_000, Math.max(512, options.maxCompletionTokens ?? 60_000)),
    provider: { data_collection: "deny", zdr: true, require_parameters: true },
    response_format: { type: "json_schema", json_schema: { name: schemaName, strict: true, schema } },
  };
  const requestText = JSON.stringify(requestBody);
  if (new TextEncoder().encode(requestText).byteLength > MAX_REQUEST_BYTES) throw new NbsAnalysisError("input_too_large");
  const started = (options.now ?? Date.now)();
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://caselab.kz",
        "X-Title": "NBS Leadership Forum 2026",
      },
      body: requestText,
      signal: AbortSignal.timeout(Math.min(options.timeoutMs ?? MAX_TIMEOUT_MS, MAX_TIMEOUT_MS)),
      cache: "no-store",
    });
  } catch {
    throw new NbsAnalysisError("provider_error");
  }
  if (!response.ok) throw new NbsAnalysisError("provider_error");

  const payload = await readBounded(response);
  if (!Array.isArray(payload.choices) || !isRecord(payload.choices[0])) throw new NbsAnalysisError("invalid_response");
  const choice = payload.choices[0];
  if (choice.finish_reason !== "stop" || !isRecord(choice.message) || typeof choice.message.content !== "string") {
    throw new NbsAnalysisError("invalid_response");
  }
  let content: unknown;
  try {
    content = JSON.parse(choice.message.content);
  } catch {
    throw new NbsAnalysisError("invalid_response");
  }
  const usage = isRecord(payload.usage) ? payload.usage : {};
  const servedModel = typeof payload.model === "string" && payload.model.length <= 160 ? payload.model : null;
  const generationId = typeof payload.id === "string" && payload.id.length <= 160 ? payload.id : null;
  const costValue = usage.cost;
  return {
    content,
    metadata: {
      requestedModels: requestBody.models,
      servedModel,
      generationId,
      promptVersion: schemaName,
      requestHash: createHash("sha256").update(requestText, "utf8").digest("hex"),
      latencyMs: Math.max(0, (options.now ?? Date.now)() - started),
      promptTokens: positiveInteger(usage.prompt_tokens),
      completionTokens: positiveInteger(usage.completion_tokens),
      cost: typeof costValue === "number" && Number.isFinite(costValue) && costValue >= 0 ? costValue : null,
    },
  };
}
