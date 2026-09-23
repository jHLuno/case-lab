export const LIVE_ROUND_SETTLE_GRACE_MS = 15_000;

export function analysisDelayMs(closesAtMs: number, nowMs: number): number {
  return Math.max(0, closesAtMs - nowMs + LIVE_ROUND_SETTLE_GRACE_MS);
}

export function isAnalysisReady(closesAtMs: number, nowMs: number): boolean {
  return nowMs >= closesAtMs + LIVE_ROUND_SETTLE_GRACE_MS;
}
