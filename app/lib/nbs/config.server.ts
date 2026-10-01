import "server-only";

import type { NbsEnvironment } from "./contracts";

export type NbsConfig = {
  environment: NbsEnvironment;
  tokenSecret: string;
  workerSecret: string;
};

export function getNbsConfig(): NbsConfig {
  const environment = process.env.NBS_ENVIRONMENT?.trim() || process.env.CASE_LAB_3_PAYMENT_MODE?.trim();
  const tokenSecret = process.env.CASE_LAB_3_TOKEN_SECRET?.trim();
  const workerSecret = process.env.NBS_WORKER_SECRET?.trim() || process.env.CASE_LAB_3_CRON_SECRET?.trim();
  if (environment !== "test" && environment !== "live") throw new Error("NBS environment configuration incomplete");
  if (!tokenSecret || tokenSecret.length < 32) throw new Error("NBS token configuration incomplete");
  if (!workerSecret || workerSecret.length < 32) throw new Error("NBS worker configuration incomplete");
  return { environment, tokenSecret, workerSecret };
}
