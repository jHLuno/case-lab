"use client";

import type { TipTopWidgetParams } from "../../../lib/case-lab-3/contracts";

const TIPTOP_WIDGET_SRC = "https://widget.tiptoppay.kz/bundles/widget.js";
const FORBIDDEN_PARAM_KEYS = new Set(["receipt", "recurrent", "tokenization"]);

type TipTopWidgetInstance = {
  oncomplete?: (result: unknown) => void;
  start: (params: TipTopWidgetParams) => unknown;
};

type TipTopGlobal = {
  Widget: new () => TipTopWidgetInstance;
};

declare global {
  interface Window {
    tiptop?: TipTopGlobal;
  }
}

let widgetLoadPromise: Promise<void> | null = null;

const USER_SAFE_WIDGET_ERROR = "Платежный виджет временно недоступен.";

function hasForbiddenParams(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(hasForbiddenParams);

  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_PARAM_KEYS.has(key.toLowerCase()) || hasForbiddenParams(nestedValue)) return true;
  }

  return false;
}

function assertSafeParams(params: TipTopWidgetParams): void {
  if (hasForbiddenParams(params)) {
    throw new Error("Unsupported TipTop Pay payment parameters");
  }
}

function removeWidgetScripts(): void {
  document.querySelectorAll<HTMLScriptElement>(`script[src="${TIPTOP_WIDGET_SRC}"]`).forEach((script) => script.remove());
}

export function loadTipTopWidget(nonce: string, signal?: AbortSignal): Promise<void> {
  if (!nonce) {
    return Promise.reject(new Error("TipTop Pay widget nonce is unavailable"));
  }
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("TipTop Pay is available in the browser only"));
  }
  if (signal?.aborted) {
    return Promise.reject(new Error("TipTop Pay widget load aborted"));
  }
  if (window.tiptop?.Widget) return Promise.resolve();
  if (widgetLoadPromise) return widgetLoadPromise;

  const loadPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = TIPTOP_WIDGET_SRC;
    script.async = true;
    script.nonce = nonce;

    const cleanup = () => {
      signal?.removeEventListener("abort", abort);
      script.remove();
      if (widgetLoadPromise === loadPromise) widgetLoadPromise = null;
    };
    const fail = () => {
      cleanup();
      reject(new Error("TipTop Pay widget failed to load"));
    };
    const abort = () => {
      cleanup();
      reject(new Error("TipTop Pay widget load aborted"));
    };

    script.addEventListener("load", () => {
      if (window.tiptop?.Widget) {
        signal?.removeEventListener("abort", abort);
        resolve();
      } else {
        fail();
      }
    }, { once: true });
    script.addEventListener("error", fail, { once: true });
    signal?.addEventListener("abort", abort, { once: true });
    document.head.appendChild(script);
  });

  widgetLoadPromise = loadPromise;
  return loadPromise;
}

export type TipTopPaymentResult = "success" | "failure" | "cancelled" | "closed";

function normalizeResult(result: unknown): TipTopPaymentResult {
  if (typeof result === "string") {
    const normalized = result.toLowerCase();
    if (normalized.includes("success") || normalized.includes("complete")) return "success";
    if (normalized.includes("fail") || normalized.includes("error")) return "failure";
    if (normalized.includes("cancel")) return "cancelled";
  }
  if (result && typeof result === "object") {
    const status = "status" in result && typeof result.status === "string" ? result.status.toLowerCase() : "";
    if (status.includes("success") || status.includes("complete") || status === "paid") return "success";
    if (status.includes("fail") || status.includes("error") || status === "declined") return "failure";
    if (status.includes("cancel")) return "cancelled";
  }
  return "closed";
}

export async function startTipTopPayment(params: TipTopWidgetParams): Promise<TipTopPaymentResult> {
  assertSafeParams(params);
  if (typeof window === "undefined" || !window.tiptop?.Widget) {
    throw new Error("TipTop Pay widget is not loaded");
  }

  const widget = new window.tiptop.Widget();
  return new Promise<TipTopPaymentResult>((resolve, reject) => {
    let settled = false;
    const settle = (result: unknown) => {
      if (settled) return;
      settled = true;
      resolve(normalizeResult(result));
    };

    widget.oncomplete = settle;
    const rejectStart = () => {
      if (settled) return;
      settled = true;
      reject(new Error(USER_SAFE_WIDGET_ERROR));
    };
    try {
      void Promise.resolve(widget.start(params)).catch(rejectStart);
    } catch {
      rejectStart();
    }
  });
}

export function resetTipTopWidgetLoaderForRetry(): void {
  widgetLoadPromise = null;
  removeWidgetScripts();
}
