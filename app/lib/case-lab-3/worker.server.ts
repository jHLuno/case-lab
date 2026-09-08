import "server-only";

import {
  classifyJobError,
  createCaseLab3JobStore,
  JOB_LEASE_MS,
  MAX_JOBS_PER_INVOCATION,
  PermanentJobError,
  retryDelaySeconds,
  sanitizeJobError,
  WORKER_EXTERNAL_TIMEOUT_MS,
  WORKER_TIME_BUDGET_MS,
  type CaseLab3JobStore,
  type ClaimedCaseLab3Job,
  type CaseLab3JobType,
} from "./jobs.server";
import type { Json } from "./database.types";
import type { PaymentEnvironment } from "./contracts";
import {
  createProductionCaseLab3JobHandlers,
  type ProductionHandlerOverrides,
  type WorkerHandlerContext,
  type WorkerHandler,
  type ProductionJobHandlers,
} from "./worker-handlers.server";

export { JOB_LEASE_MS, WORKER_EXTERNAL_TIMEOUT_MS, WORKER_TIME_BUDGET_MS };

export type JobHandlerContext = WorkerHandlerContext;
export type CaseLab3JobHandler = WorkerHandler;

export type CaseLab3JobHandlers = Partial<Record<CaseLab3JobType, CaseLab3JobHandler>>;
export { createProductionCaseLab3JobHandlers };
export type { ProductionHandlerOverrides, ProductionJobHandlers };

export type WorkerDependencies = Partial<CaseLab3JobStore> & {
  handlers?: CaseLab3JobHandlers;
};

export type RunCaseLab3WorkerOptions = {
  environment: PaymentEnvironment;
  timeBudgetMs?: number;
  maxJobs?: number;
  workerId?: string;
  now?: () => number;
  externalTimeoutMs?: number;
  dependencies?: WorkerDependencies;
};

export type WorkerRunResult = {
  environment: PaymentEnvironment;
  workerId: string;
  claimed: number;
  completed: number;
  retried: number;
  unknown: number;
  skippedForBudget: boolean;
  maintenance: Json;
};

const JOB_TYPES: readonly CaseLab3JobType[] = [
  "issue_fiscal_operation",
  "poll_receipt",
  "send_ticket_email",
  "send_refund_notification",
  "initiate_refund",
  "reconcile_payment",
  "send_analytics_event",
  "send_organizer_alert",
  "daily_provider_reconciliation",
];

function defaultHandler(job: ClaimedCaseLab3Job): never {
  throw new PermanentJobError(`No registered handler for ${job.jobType}`);
}

export function createCaseLab3JobHandlers(overrides: CaseLab3JobHandlers = {}): Record<CaseLab3JobType, CaseLab3JobHandler> {
  const productionHandlers = createProductionCaseLab3JobHandlers();
  return Object.fromEntries(
    JOB_TYPES.map((jobType) => [jobType, overrides[jobType] ?? productionHandlers[jobType] ?? (async (job) => defaultHandler(job))]),
  ) as Record<CaseLab3JobType, CaseLab3JobHandler>;
}

function workerId(value: string | undefined): string {
  const candidate = value ?? `case-lab-3-worker-${crypto.randomUUID()}`;
  if (!/^[^\u0000-\u001f\u007f]{1,128}$/u.test(candidate)) throw new Error("Invalid worker id");
  return candidate;
}

function jsonResult(value: Json | undefined): Json {
  return value === undefined ? {} : value;
}

async function runWithExternalTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  now: () => number,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const operationPromise = operation(controller.signal);
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new (class extends Error {
      readonly failureKind = "unknown" as const;
      readonly uncertainSince = now();
      constructor() {
        super("External worker operation timed out");
        this.name = "WorkerTimeoutError";
      }
    })()), timeoutMs);
  });
  try {
    return await Promise.race([operationPromise, timeout]);
  } catch (error) {
    if (controller.signal.aborted === false && error instanceof Error && error.name === "WorkerTimeoutError") {
      controller.abort();
      await operationPromise.catch(() => undefined);
    }
    throw error;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

export async function runCaseLab3Worker(options: RunCaseLab3WorkerOptions): Promise<WorkerRunResult> {
  if (options.environment !== "test" && options.environment !== "live") throw new Error("Invalid worker environment");
  const timeBudgetMs = options.timeBudgetMs ?? WORKER_TIME_BUDGET_MS;
  const maxJobs = Math.min(options.maxJobs ?? MAX_JOBS_PER_INVOCATION, MAX_JOBS_PER_INVOCATION);
  if (!Number.isSafeInteger(timeBudgetMs) || timeBudgetMs < 1 || !Number.isSafeInteger(maxJobs) || maxJobs < 1) {
    throw new Error("Invalid worker bounds");
  }

  const now = options.now ?? Date.now;
  const startedAt = now();
  const id = workerId(options.workerId);
  const externalTimeoutMs = options.externalTimeoutMs ?? WORKER_EXTERNAL_TIMEOUT_MS;
  if (!Number.isSafeInteger(externalTimeoutMs) || externalTimeoutMs < 1 || externalTimeoutMs > WORKER_EXTERNAL_TIMEOUT_MS) {
    throw new Error("Invalid worker timeout");
  }
  const dependencies = options.dependencies ?? {};
  const defaults = createCaseLab3JobStore();
  const store: CaseLab3JobStore = {
    claimJobs: dependencies.claimJobs ?? defaults.claimJobs,
    completeJob: dependencies.completeJob ?? defaults.completeJob,
    retryJob: dependencies.retryJob ?? defaults.retryJob,
    markJobUnknown: dependencies.markJobUnknown ?? defaults.markJobUnknown,
    runMaintenance: dependencies.runMaintenance ?? defaults.runMaintenance,
    recordWorkerHeartbeat: dependencies.recordWorkerHeartbeat ?? defaults.recordWorkerHeartbeat,
    ...(dependencies.recordIncident || defaults.recordIncident
      ? { recordIncident: dependencies.recordIncident ?? defaults.recordIncident }
      : {}),
  };
  const handlers = createCaseLab3JobHandlers(dependencies.handlers);

  await store.recordWorkerHeartbeat(options.environment);
  const maintenance = await store.runMaintenance(options.environment);
  if (now() - startedAt >= timeBudgetMs) {
    return {
      environment: options.environment,
      workerId: id,
      claimed: 0,
      completed: 0,
      retried: 0,
      unknown: 0,
      skippedForBudget: true,
      maintenance,
    };
  }

  const claimedJobs = (await store.claimJobs(options.environment, id)).slice(0, maxJobs);
  let completed = 0;
  let retried = 0;
  let unknown = 0;
  let skippedForBudget = false;

  for (const job of claimedJobs) {
    if (now() - startedAt >= timeBudgetMs) {
      skippedForBudget = true;
      break;
    }
    try {
      const result = await runWithExternalTimeout(
        (signal) => handlers[job.jobType](job, {
          environment: options.environment,
          signal,
          timeoutMs: externalTimeoutMs,
          now,
        }),
        now,
        externalTimeoutMs,
      );
      await store.completeJob(options.environment, job.jobId, job.leaseToken, jsonResult(result));
      completed += 1;
    } catch (error) {
      if (classifyJobError(error, now()) === "retry") {
        await store.retryJob(
          options.environment,
          job.jobId,
          job.leaseToken,
          sanitizeJobError(error),
          retryDelaySeconds(job.attemptCount ?? 1),
        );
        retried += 1;
      } else {
        await store.markJobUnknown(options.environment, job.jobId, job.leaseToken, sanitizeJobError(error));
        await store.recordIncident?.(options.environment, job, sanitizeJobError(error));
        unknown += 1;
      }
    }
  }

  return {
    environment: options.environment,
    workerId: id,
    claimed: claimedJobs.length,
    completed,
    retried,
    unknown,
    skippedForBudget,
    maintenance,
  };
}
