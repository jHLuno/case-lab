import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import "./server-only-test-loader";
import {
  JOB_LEASE_MS,
  WORKER_EXTERNAL_TIMEOUT_MS,
  classifyJobError,
  PermanentJobError,
  RetryableJobError,
  UnknownJobError,
} from "../../app/lib/case-lab-3/jobs.server";
import { createInitiateRefundHandler, createProductionCaseLab3JobHandlers, runCaseLab3Worker } from "../../app/lib/case-lab-3/worker.server";
import { handlePost as handleWorkerPost } from "../../app/api/internal/case-lab-3/jobs/route";
import { TipTopApiError } from "../../app/lib/case-lab-3/tiptoppay.server";

const ENVIRONMENT = "test" as const;

function claimedJob(index: number) {
  return {
    jobId: `00000000-0000-4000-8000-0000000009${String(index).padStart(2, "0")}`,
    jobType: "send_analytics_event" as const,
    logicalKey: `job-${index}`,
    payloadReference: { eventKey: `event-${index}` },
    orderId: null,
    ticketId: null,
    refundId: null,
    leaseToken: `lease-${index}`,
    leasedUntil: "2026-09-08T01:02:00.000Z",
  };
}

const REFUND_JOB_ID = "00000000-0000-4000-8000-000000000941";
const REFUND_ID = "00000000-0000-4000-8000-000000000942";
const REFUND_ORDER_ID = "00000000-0000-4000-8000-000000000943";
const PAYMENT_ATTEMPT_ID = "00000000-0000-4000-8000-000000000944";
const REFUND_OPERATION_KEY = "refund-operation-941";

function refundJob(overrides: Record<string, unknown> = {}) {
  return {
    jobId: REFUND_JOB_ID,
    jobType: "initiate_refund" as const,
    logicalKey: `refund:${REFUND_OPERATION_KEY}`,
    payloadReference: {
      refundId: REFUND_ID,
      operationKey: REFUND_OPERATION_KEY,
      amountMinor: 789000,
    },
    orderId: REFUND_ORDER_ID,
    ticketId: null,
    refundId: REFUND_ID,
    leaseToken: "refund-lease",
    leasedUntil: "2026-09-09T01:02:00.000Z",
    ...overrides,
  };
}

function refundState(overrides: Record<string, unknown> = {}) {
  return {
    environment: ENVIRONMENT,
    orderId: REFUND_ORDER_ID,
    orderNumber: "CL3-REFUND-941",
    paymentStatus: "refund_pending",
    paidAmountMinor: 789000,
    ticketStatus: "cancelled",
    refundId: REFUND_ID,
    paymentAttemptId: PAYMENT_ATTEMPT_ID,
    paymentProviderTransactionId: "12345",
    operationKey: REFUND_OPERATION_KEY,
    refundType: "full",
    amountMinor: 789000,
    currency: "KZT",
    refundStatus: "requested",
    attemptCount: 0,
    uncertainSinceAt: null,
    ...overrides,
  };
}

const refundContext = {
  environment: ENVIRONMENT,
  signal: new AbortController().signal,
  timeoutMs: WORKER_EXTERNAL_TIMEOUT_MS,
  now: () => 0,
};

test("worker claims at most five jobs, preserves lease tokens, and runs registered handlers", async () => {
  const claimed = Array.from({ length: 6 }, (_, index) => claimedJob(index + 1));
  const completed: Array<{ jobId: string; leaseToken: string }> = [];
  const contexts: Array<{ timeoutMs: number; aborted: boolean }> = [];
  const calls: string[] = [];

  const result = await runCaseLab3Worker({
    environment: ENVIRONMENT,
    timeBudgetMs: 45_000,
    maxJobs: 5,
    workerId: "worker-test",
    now: () => 0,
    dependencies: {
      recordWorkerHeartbeat: async () => { calls.push("heartbeat"); return {}; },
      runMaintenance: async () => { calls.push("maintenance"); return { kind: "maintained" }; },
      claimJobs: async () => { calls.push("claim"); return claimed; },
      completeJob: async (_environment, jobId, leaseToken) => {
        completed.push({ jobId, leaseToken });
        return { kind: "completed" };
      },
      handlers: {
        send_analytics_event: async (_job, context) => {
          contexts.push({ timeoutMs: context.timeoutMs, aborted: context.signal.aborted });
          return { delivered: true };
        },
      },
    },
  });

  assert.equal(result.claimed, 5);
  assert.equal(result.completed, 5);
  assert.equal(result.retried, 0);
  assert.equal(result.unknown, 0);
  assert.deepEqual(calls, ["heartbeat", "maintenance", "claim"]);
  assert.deepEqual(completed, claimed.slice(0, 5).map((job) => ({ jobId: job.jobId, leaseToken: job.leaseToken })));
  assert.deepEqual(contexts, Array.from({ length: 5 }, () => ({ timeoutMs: 10_000, aborted: false })));
});

test("worker does not claim new work after the invocation budget", async () => {
  let now = 0;
  let claimCalls = 0;
  const result = await runCaseLab3Worker({
    environment: ENVIRONMENT,
    timeBudgetMs: 45_000,
    maxJobs: 5,
    now: () => now,
    dependencies: {
      recordWorkerHeartbeat: async () => { now = 45_000; return {}; },
      runMaintenance: async () => ({ kind: "maintained" }),
      claimJobs: async () => { claimCalls += 1; return []; },
    },
  });

  assert.equal(claimCalls, 0);
  assert.equal(result.claimed, 0);
  assert.equal(result.skippedForBudget, true);
});

test("worker retries transient failures and marks an uncertain receipt unknown after one hour", async () => {
  const retried: Array<{ jobId: string; leaseToken: string; delay: number }> = [];
  const unknown: Array<{ jobId: string; leaseToken: string }> = [];
  const incidents: Array<{ jobId: string; error: string }> = [];
  const jobs = [claimedJob(11), claimedJob(12)];
  const result = await runCaseLab3Worker({
    environment: ENVIRONMENT,
    timeBudgetMs: 45_000,
    maxJobs: 5,
    now: () => 3_600_001,
    dependencies: {
      recordWorkerHeartbeat: async () => ({}),
      runMaintenance: async () => ({ kind: "maintained" }),
      claimJobs: async () => jobs,
      retryJob: async (_environment, jobId, leaseToken, _error, delay) => {
        retried.push({ jobId, leaseToken, delay });
        return { kind: "retried" };
      },
      markJobUnknown: async (_environment, jobId, leaseToken) => {
        unknown.push({ jobId, leaseToken });
        return { kind: "unknown" };
      },
      recordIncident: async (_environment, job, error) => {
        incidents.push({ jobId: job.jobId, error });
        return {};
      },
      handlers: {
        send_analytics_event: async (job) => {
          if (job.jobId === jobs[0]?.jobId) throw new RetryableJobError("temporary network failure");
          throw new UnknownJobError("receipt request timed out", 0);
        },
      },
    },
  });

  assert.equal(result.retried, 1);
  assert.equal(result.unknown, 1);
  assert.deepEqual(retried, [{ jobId: jobs[0]!.jobId, leaseToken: jobs[0]!.leaseToken, delay: 60 }]);
  assert.deepEqual(unknown, [{ jobId: jobs[1]!.jobId, leaseToken: jobs[1]!.leaseToken }]);
  assert.deepEqual(incidents, [{ jobId: jobs[1]!.jobId, error: "receipt request timed out" }]);
});

test("job error classification keeps validation errors terminal and exposes fixed timing bounds", () => {
  assert.equal(JOB_LEASE_MS, 120_000);
  assert.equal(WORKER_EXTERNAL_TIMEOUT_MS, 10_000);
  assert.equal(classifyJobError(new RetryableJobError("temporary")), "retry");
  assert.equal(classifyJobError(new UnknownJobError("unknown", 0), 3_600_001), "unknown");
  assert.equal(classifyJobError(new PermanentJobError("invalid fiscal policy")), "unknown");
});

test("internal worker route requires a constant-time cron bearer secret and valid environment", async () => {
  const workerCalls: Array<"test" | "live"> = [];
  const dependencies = {
    getCronSecret: () => "cron-secret",
    runWorker: async ({ environment }: { environment: "test" | "live" }) => {
      workerCalls.push(environment);
      return {
        environment,
        workerId: "worker-test",
        claimed: 0,
        completed: 0,
        retried: 0,
        unknown: 0,
        skippedForBudget: false,
        maintenance: {},
      };
    },
  };

  const unauthorized = await handleWorkerPost(
    new Request("https://caselab.kz/api/internal/case-lab-3/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer wrong-secret" },
      body: JSON.stringify({ environment: "test" }),
    }),
    dependencies,
  );
  assert.equal(unauthorized.status, 401);

  const accepted = await handleWorkerPost(
    new Request("https://caselab.kz/api/internal/case-lab-3/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer cron-secret" },
      body: JSON.stringify({ environment: "live" }),
    }),
    dependencies,
  );
  assert.equal(accepted.status, 200);
  assert.deepEqual(workerCalls, ["live"]);
});

test("production handler registry covers fiscal and mail jobs but not GA4", () => {
  const handlers = createProductionCaseLab3JobHandlers({
    issueFiscalOperation: async () => ({}),
    pollReceipt: async () => ({}),
    sendTicketEmail: async () => ({}),
    sendRefundNotification: async () => ({}),
    sendOrganizerAlert: async () => ({}),
  });

  assert.equal(typeof handlers.issue_fiscal_operation, "function");
  assert.equal(typeof handlers.poll_receipt, "function");
  assert.equal(typeof handlers.send_ticket_email, "function");
  assert.equal(typeof handlers.send_refund_notification, "function");
  assert.equal(typeof handlers.send_organizer_alert, "function");
  assert.equal(typeof handlers.initiate_refund, "function");
  assert.equal(handlers.send_analytics_event, undefined);
});

test("valid initiate_refund calls TipTop Pay once and leaves confirmation to the callback", async () => {
  let providerCalls = 0;
  const transitions: string[] = [];
  const handler = createInitiateRefundHandler({
    loadState: async () => refundState(),
    markProcessing: async () => {
      transitions.push("processing");
      return "claimed";
    },
    refundPayment: async (environment, input, options) => {
      providerCalls += 1;
      assert.equal(environment, ENVIRONMENT);
      assert.deepEqual(input, {
        paymentTransactionId: "12345",
        amountMinor: 789000,
        operationKey: REFUND_OPERATION_KEY,
        invoiceId: "CL3-REFUND-941",
      });
      assert.equal(options.signal, refundContext.signal);
      return { success: true, message: "Queued", model: {}, status: 200 };
    },
  });

  const result = await handler(refundJob(), refundContext);

  assert.equal(providerCalls, 1);
  assert.deepEqual(transitions, ["processing"]);
  assert.deepEqual(result, {
    status: "processing",
    providerStatus: "accepted",
    failureKind: "none",
  });
});

test("a duplicate initiate_refund job with the same operation key does not call TipTop Pay again", async () => {
  let providerCalls = 0;
  const handler = createInitiateRefundHandler({
    loadState: async () => refundState({ refundStatus: "processing" }),
    refundPayment: async () => {
      providerCalls += 1;
      return { success: true, message: "Queued", model: {}, status: 200 };
    },
  });

  const result = await handler(refundJob(), refundContext);

  assert.equal(providerCalls, 0);
  assert.deepEqual(result, {
    status: "processing",
    providerStatus: "already_processing",
    failureKind: "none",
  });
});

test("a cancelled ticket does not block a valid paid refund", async () => {
  let providerCalls = 0;
  const handler = createInitiateRefundHandler({
    loadState: async () => refundState({ ticketStatus: "cancelled" }),
    markProcessing: async () => "claimed",
    refundPayment: async () => {
      providerCalls += 1;
      return { success: true, message: "Queued", model: {}, status: 200 };
    },
  });

  await handler(refundJob(), refundContext);

  assert.equal(providerCalls, 1);
});

test("a final TipTop Pay refusal restores the refundable request through the failure transition", async () => {
  let failed = 0;
  const handler = createInitiateRefundHandler({
    loadState: async () => refundState(),
    markProcessing: async () => "claimed",
    markFailed: async () => {
      failed += 1;
    },
    refundPayment: async () => ({ success: false, message: "Authentication failed", model: null, status: 401 }),
  });

  const result = await handler(refundJob(), refundContext);

  assert.equal(failed, 1);
  assert.deepEqual(result, {
    status: "failed",
    providerStatus: "http_401",
    failureKind: "permanent",
  });
});

test("an unknown TipTop result marks reconciliation and never blindly retries", async () => {
  let providerCalls = 0;
  let markedUnknown = 0;
  const handler = createInitiateRefundHandler({
    loadState: async () => refundState(),
    markProcessing: async () => "claimed",
    markUnknown: async () => {
      markedUnknown += 1;
    },
    refundPayment: async () => {
      providerCalls += 1;
      throw new TipTopApiError();
    },
  });

  await assert.rejects(() => handler(refundJob(), refundContext), UnknownJobError);
  assert.equal(providerCalls, 1);
  assert.equal(markedUnknown, 1);

  const reconciledHandler = createInitiateRefundHandler({
    loadState: async () => refundState({ refundStatus: "unknown" }),
    refundPayment: async () => {
      providerCalls += 1;
      return { success: true, message: "must not retry", model: {}, status: 200 };
    },
  });
  const result = await reconciledHandler(refundJob(), refundContext);

  assert.equal(providerCalls, 1);
  assert.deepEqual(result, {
    status: "review_required",
    providerStatus: "unknown",
    failureKind: "unknown",
  });
});

test("initiate_refund rejects invalid environment, order, refund, and amount before TipTop Pay", async () => {
  const cases = [
    { name: "environment", job: refundJob(), state: refundState({ environment: "live" }) },
    { name: "order", job: refundJob({ orderId: "00000000-0000-4000-8000-000000000945" }), state: refundState() },
    { name: "refund", job: refundJob({ refundId: "00000000-0000-4000-8000-000000000946" }), state: refundState() },
    { name: "amount", job: refundJob(), state: refundState({ amountMinor: 700000 }) },
  ];

  for (const item of cases) {
    const handler = createInitiateRefundHandler({
      loadState: async () => item.state,
      refundPayment: async () => {
        assert.fail(`${item.name} must be rejected before provider call`);
      },
    });
    await assert.rejects(() => handler(item.job, refundContext), PermanentJobError, item.name);
  }
});

test("initiate_refund rejects a missing or malformed original provider transaction before changing state", async () => {
  let processingCalls = 0;
  for (const transactionId of [null, "not-numeric"]) {
    const handler = createInitiateRefundHandler({
      loadState: async () => refundState({ paymentProviderTransactionId: transactionId }),
      markProcessing: async () => {
        processingCalls += 1;
        return "claimed";
      },
      refundPayment: async () => {
        assert.fail("invalid provider transaction must be rejected before the provider call");
      },
    });

    await assert.rejects(() => handler(refundJob(), refundContext), PermanentJobError);
  }
  assert.equal(processingCalls, 0);
});

test("production handler execution returns durable metadata for queued receipts and email delivery", async () => {
  const events: string[] = [];
  const handlers = createProductionCaseLab3JobHandlers({
    issueFiscalOperation: async () => {
      events.push("queue");
      return { status: "queued", receiptId: "receipt-1" };
    },
    pollReceipt: async () => ({ status: "issued", receiptId: "receipt-1" }),
    sendTicketEmail: async () => {
      events.push("ticket-email");
      return { status: "sent", messageId: "message-1" };
    },
    sendRefundNotification: async () => ({ status: "sent", messageId: "message-2" }),
    sendOrganizerAlert: async () => ({ status: "sent", messageId: "message-3" }),
  });

  const result = await handlers.issue_fiscal_operation!(claimedJob(20), {
    environment: ENVIRONMENT,
    signal: new AbortController().signal,
    timeoutMs: WORKER_EXTERNAL_TIMEOUT_MS,
    now: () => 0,
  });
  const email = await handlers.send_ticket_email!(claimedJob(21), {
    environment: ENVIRONMENT,
    signal: new AbortController().signal,
    timeoutMs: WORKER_EXTERNAL_TIMEOUT_MS,
    now: () => 0,
  });

  assert.deepEqual(result, { status: "queued", receiptId: "receipt-1" });
  assert.deepEqual(email, { status: "sent", messageId: "message-1" });
  assert.deepEqual(events, ["queue", "ticket-email"]);
});

test("worker awaits production handlers and completes each job with its lease token", async () => {
  const completed: string[] = [];
  const jobs = [
    { ...claimedJob(30), jobType: "issue_fiscal_operation" as const },
    { ...claimedJob(31), jobType: "poll_receipt" as const },
    { ...claimedJob(32), jobType: "send_ticket_email" as const },
    { ...claimedJob(33), jobType: "send_refund_notification" as const },
    { ...claimedJob(34), jobType: "send_organizer_alert" as const },
  ];
  const handlers = createProductionCaseLab3JobHandlers({
    issueFiscalOperation: async () => ({ status: "queued" }),
    pollReceipt: async () => ({ status: "issued" }),
    sendTicketEmail: async () => ({ status: "sent" }),
    sendRefundNotification: async () => ({ status: "sent" }),
    sendOrganizerAlert: async () => ({ status: "sent" }),
  });

  const result = await runCaseLab3Worker({
    environment: ENVIRONMENT,
    workerId: "worker-production",
    now: () => 0,
    dependencies: {
      recordWorkerHeartbeat: async () => ({}),
      runMaintenance: async () => ({}),
      claimJobs: async () => jobs,
      completeJob: async (_environment, jobId, leaseToken) => {
        assert.equal(leaseToken, jobs.find((job) => job.jobId === jobId)?.leaseToken);
        completed.push(jobId);
        return { kind: "completed" };
      },
      handlers,
    },
  });

  assert.equal(result.completed, 5);
  assert.deepEqual(completed, jobs.map((job) => job.jobId));
});

test("fiscal operation schema has durable Kassir queue and uncertainty timestamps", async () => {
  const migration = await readFile("supabase/migrations/20260908060000_add_case_lab_3_worker_metadata.sql", "utf8");
  assert.match(migration, /add column if not exists queued_at timestamptz/iu);
  assert.match(migration, /add column if not exists uncertain_since_at timestamptz/iu);
});

test("worker aborts a timed-out handler before persisting the retry lease result", async () => {
  let handlerAborted = false;
  let retried = false;
  const result = await runCaseLab3Worker({
    environment: ENVIRONMENT,
    timeBudgetMs: 45_000,
    maxJobs: 1,
    workerId: "worker-timeout",
    externalTimeoutMs: 1,
    dependencies: {
      recordWorkerHeartbeat: async () => ({}),
      runMaintenance: async () => ({}),
      claimJobs: async () => [claimedJob(22)],
      retryJob: async () => {
        retried = true;
        assert.equal(handlerAborted, true);
        return { kind: "retried" };
      },
      handlers: {
        send_analytics_event: async (_job, context) => {
          await new Promise<void>((resolve) => {
            context.signal.addEventListener("abort", () => {
              handlerAborted = true;
              resolve();
            }, { once: true });
          });
          throw new UnknownJobError("timed out", 0);
        },
      },
    },
  });

  assert.equal(result.retried, 1);
  assert.equal(retried, true);
});
