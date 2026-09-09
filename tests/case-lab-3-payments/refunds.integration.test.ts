import assert from "node:assert/strict";
import test from "node:test";

import { crmAuthModule } from "./server-only-test-loader";
import { createCaseLab3JobHandlers } from "../../app/lib/case-lab-3/worker.server";

const ORDER_UUID = "00000000-0000-4000-8000-000000000801";
const REFUND_UUID = "00000000-0000-4000-8000-000000000802";
const OPERATION_KEY = "refund-operation-1";
const adminSession = { role: "crm_admin" as const, token: "session-token" };

async function refundRoute() {
  return import("../../app/api/admin/case-lab-3/orders/[id]/refunds/route");
}

function request(url: string, init: RequestInit = {}, requestOrigin = "https://caselab.kz", origin = requestOrigin): Request {
  return new Request(`${requestOrigin}${url}`, {
    method: "POST",
    ...init,
    headers: {
      Origin: origin,
      "Content-Type": "application/json",
      "Idempotency-Key": OPERATION_KEY,
      "X-CSRF-Token": "csrf-token",
      ...(init.headers ?? {}),
    },
  });
}

function fullRefundState(overrides: Record<string, unknown> = {}) {
  return {
    environment: "test" as const,
    paymentStatus: "paid",
    paidAmountMinor: 1_500_000,
    refundedAmountMinor: 0,
    refundableAmountMinor: 1_500_000,
    pendingRefundAmountMinor: 0,
    existingRefund: null,
    ...overrides,
  };
}

function authorizedDependencies(extra: Record<string, unknown> = {}) {
  return {
    requireCrmAdmin: async () => adminSession,
    verifyCrmMutation: () => true,
    parseBody: async () => ({ confirm: true, reason: "Buyer requested a full refund" }),
    getRefundState: async () => fullRefundState(),
    createRefund: async () => ({
      kind: "created" as const,
      refundId: REFUND_UUID,
      operationKey: OPERATION_KEY,
      refundType: "full" as const,
      amountMinor: 1_500_000,
      remainingRefundableAmountMinor: 0,
    }),
    ...extra,
  };
}

test("full refund accepts same-origin CRM requests on test and live origins", async () => {
  const { handlePost } = await refundRoute();

  for (const origin of ["https://case-lab-test-payments.vercel.app", "https://caselab.kz"]) {
    const response = await handlePost(
      request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`, {}, origin),
      { params: Promise.resolve({ id: ORDER_UUID }) },
      authorizedDependencies(),
    );

    assert.equal(response.status, 202, origin);
  }
});

test("production live refund requests are blocked before any refund RPC", async () => {
  const { handlePost } = await refundRoute();
  let created = false;
  const response = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    authorizedDependencies({
      getRefundState: async () => fullRefundState({ environment: "live" }),
      createRefund: async () => {
        created = true;
        return {};
      },
    }),
  );

  assert.equal(response.status, 410);
  assert.deepEqual(await response.json(), {
    error: "automatic_refunds_disabled",
    message: "Возврат выполняется вручную через кабинет TipTop Pay.",
  });
  assert.equal(created, false);
});

test("full refund requires an authenticated CRM admin and rejects an exact-origin violation before parsing", async () => {
  const { handlePost } = await refundRoute();
  let parsed = false;
  let created = false;

  const unauthorized = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    {
      requireCrmAdmin: async () => null,
      parseBody: async () => {
        parsed = true;
        return {};
      },
      createRefund: async () => {
        created = true;
        return {};
      },
    },
  );

  assert.equal(unauthorized.status, 401);
  assert.equal(parsed, false);
  assert.equal(created, false);

  const wrongOrigin = await handlePost(
    new Request(`https://caselab.kz/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`, {
      method: "POST",
      headers: {
        Origin: "https://evil.example",
        "Content-Type": "application/json",
        "Idempotency-Key": OPERATION_KEY,
        "X-CSRF-Token": "csrf-token",
      },
      body: JSON.stringify({ confirm: true, reason: "Buyer requested a full refund" }),
    }),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    authorizedDependencies({
      parseBody: async () => {
        parsed = true;
        return {};
      },
      createRefund: async () => {
        created = true;
        return {};
      },
    }),
  );

  assert.equal(wrongOrigin.status, 403);
  assert.equal(parsed, false);
  assert.equal(created, false);
  assert.equal(wrongOrigin.headers.get("cache-control"), "no-store");

  const wrongRequestOrigin = await handlePost(
    new Request(`https://evil.example/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`, {
      method: "POST",
      headers: {
        Origin: "https://caselab.kz",
        "Content-Type": "application/json",
        "Idempotency-Key": OPERATION_KEY,
        "X-CSRF-Token": "csrf-token",
      },
      body: JSON.stringify({ confirm: true, reason: "Buyer requested a full refund" }),
    }),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    authorizedDependencies(),
  );

  assert.equal(wrongRequestOrigin.status, 403);

  const missingOrigin = await handlePost(
    new Request(`https://case-lab-test-payments.vercel.app/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": OPERATION_KEY,
        "X-CSRF-Token": "csrf-token",
      },
      body: JSON.stringify({ confirm: true, reason: "Buyer requested a full refund" }),
    }),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    authorizedDependencies(),
  );

  assert.equal(missingOrigin.status, 403);
});

test("full refund requires the existing CRM mutation guard and never parses an unauthorized mutation", async () => {
  const { handlePost } = await refundRoute();
  let parsed = false;
  let stateRead = false;

  const response = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`, { body: "not-json" }),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    {
      requireCrmAdmin: async () => adminSession,
      verifyCrmMutation: () => false,
      parseBody: async () => {
        parsed = true;
        return {};
      },
      getRefundState: async () => {
        stateRead = true;
        return fullRefundState();
      },
    },
  );

  assert.equal(response.status, 403);
  assert.equal(parsed, false);
  assert.equal(stateRead, false);
  assert.deepEqual(await response.json(), { error: "forbidden" });
});

test("full refund rejects an invalid CSRF token before reading refund state", async () => {
  const { verifyCrmMutation } = await crmAuthModule;
  const { handlePost } = await refundRoute();
  let stateRead = false;
  process.env.CASE_LAB_3_TOKEN_SECRET = "t".repeat(32);

  const response = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    authorizedDependencies({
      verifyCrmMutation,
      getRefundState: async () => {
        stateRead = true;
        return fullRefundState();
      },
    }),
  );

  assert.equal(response.status, 403);
  assert.equal(stateRead, false);
});

test("full refund rejects partial or already-refunded state without creating a refund", async () => {
  const { handlePost } = await refundRoute();
  const calls: Array<Record<string, unknown>> = [];

  for (const state of [
    fullRefundState({ refundableAmountMinor: 1_000_000 }),
    fullRefundState({ pendingRefundAmountMinor: 500_000 }),
    fullRefundState({ refundedAmountMinor: 500_000, refundableAmountMinor: 1_000_000 }),
    fullRefundState({ paymentStatus: "refund_pending" }),
  ]) {
    const response = await handlePost(
      request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`),
      { params: Promise.resolve({ id: ORDER_UUID }) },
      authorizedDependencies({
        getRefundState: async () => state,
        createRefund: async (input: Record<string, unknown>) => {
          calls.push(input);
          return {};
        },
      }),
    );

    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { error: "refund_not_available" });
  }

  assert.equal(calls.length, 0);
});

test("full refund sends only the paid amount to the atomic RPC and returns an accepted durable request", async () => {
  const { handlePost } = await refundRoute();
  let received: Record<string, unknown> | undefined;

  const response = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    authorizedDependencies({
      createRefund: async (input: Record<string, unknown>) => {
        received = input;
        return {
          kind: "created",
          refundId: REFUND_UUID,
          operationKey: OPERATION_KEY,
          refundType: "full",
          amountMinor: 1_500_000,
          remainingRefundableAmountMinor: 0,
        };
      },
    }),
  );

  assert.equal(response.status, 202);
  assert.deepEqual(received, {
    orderId: ORDER_UUID,
    environment: "test",
    operationKey: OPERATION_KEY,
    amountMinor: 1_500_000,
    reason: "Buyer requested a full refund",
    actorId: "crm_admin",
  });
  assert.deepEqual(await response.json(), {
    kind: "created",
    refundId: REFUND_UUID,
    operationKey: OPERATION_KEY,
    refundType: "full",
    amountMinor: 1_500_000,
    remainingRefundableAmountMinor: 0,
  });
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("same-key retry reaches the idempotent RPC even after the order has a pending refund", async () => {
  const { handlePost } = await refundRoute();
  let calls = 0;

  const response = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    authorizedDependencies({
      getRefundState: async () => fullRefundState({
        paymentStatus: "refund_pending",
        refundableAmountMinor: 0,
        pendingRefundAmountMinor: 1_500_000,
        existingRefund: {
          orderId: ORDER_UUID,
          refundId: REFUND_UUID,
          operationKey: OPERATION_KEY,
          refundType: "full",
          amountMinor: 1_500_000,
          status: "requested",
        },
      }),
      createRefund: async (input: Record<string, unknown>) => {
        calls += 1;
        assert.equal(input.amountMinor, 1_500_000);
        return {
          kind: "accepted",
          duplicate: true,
          refundId: REFUND_UUID,
          operationKey: OPERATION_KEY,
          status: "requested",
        };
      },
    }),
  );

  assert.equal(response.status, 202);
  assert.equal(calls, 1);
  assert.deepEqual(await response.json(), {
    kind: "accepted",
    duplicate: true,
    refundId: REFUND_UUID,
    operationKey: OPERATION_KEY,
    status: "requested",
  });
});

test("repeating the same Idempotency-Key creates one refund row and one initiate_refund job", async () => {
  const { handlePost } = await refundRoute();
  let rpcCalls = 0;
  let refundRows = 0;
  let initiateRefundJobs = 0;

  const dependencies = authorizedDependencies({
    getRefundState: async () => refundRows === 0
      ? fullRefundState()
      : fullRefundState({
          paymentStatus: "refund_pending",
          refundableAmountMinor: 0,
          pendingRefundAmountMinor: 1_500_000,
          existingRefund: {
            orderId: ORDER_UUID,
            refundId: REFUND_UUID,
            operationKey: OPERATION_KEY,
            refundType: "full",
            amountMinor: 1_500_000,
            status: "requested",
          },
        }),
    createRefund: async () => {
      rpcCalls += 1;
      if (refundRows > 0) {
        return {
          kind: "accepted" as const,
          duplicate: true as const,
          refundId: REFUND_UUID,
          operationKey: OPERATION_KEY,
          status: "requested" as const,
        };
      }
      refundRows += 1;
      initiateRefundJobs += 1;
      return {
        kind: "created" as const,
        refundId: REFUND_UUID,
        operationKey: OPERATION_KEY,
        refundType: "full" as const,
        amountMinor: 1_500_000,
        remainingRefundableAmountMinor: 0,
      };
    },
  });

  const first = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    dependencies,
  );
  const second = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    dependencies,
  );

  assert.equal(first.status, 202);
  assert.equal(second.status, 202);
  assert.equal(rpcCalls, 2);
  assert.equal(refundRows, 1);
  assert.equal(initiateRefundJobs, 1);
});

test("a cancelled ticket remains eligible for a full refund while payment is paid", async () => {
  const { handlePost } = await refundRoute();
  let createCalls = 0;

  const response = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    authorizedDependencies({
      // Ticket cancellation is a separate mutation and does not change this paid refund state.
      getRefundState: async () => fullRefundState({ ticketStatus: "cancelled" }),
      createRefund: async () => {
        createCalls += 1;
        return {
          kind: "created" as const,
          refundId: REFUND_UUID,
          operationKey: OPERATION_KEY,
          refundType: "full" as const,
          amountMinor: 1_500_000,
          remainingRefundableAmountMinor: 0,
        };
      },
    }),
  );

  assert.equal(response.status, 202);
  assert.equal(createCalls, 1);
});

test("bounded JSON and invalid confirmation are rejected without exposing provider or database errors", async () => {
  const { handlePost } = await refundRoute();
  let created = false;
  const dependencies = authorizedDependencies({
    createRefund: async () => {
      created = true;
      throw new Error("provider secret and database details");
    },
  });

  const invalidConfirmation = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`, {
      body: JSON.stringify({ confirm: true, reason: "Buyer request", amountMinor: 1 }),
    }),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    {
      ...dependencies,
      parseBody: async () => ({ confirm: true, reason: "Buyer request", amountMinor: 1 }),
    },
  );
  assert.equal(invalidConfirmation.status, 400);
  assert.deepEqual(await invalidConfirmation.json(), { error: "invalid_request" });
  assert.equal(created, false);

  const tooLarge = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`, {
      headers: { "Content-Length": "5000" },
      body: JSON.stringify({ confirm: true, reason: "Buyer request" }),
    }),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    {
      requireCrmAdmin: async () => adminSession,
      verifyCrmMutation: () => true,
      getRefundState: async () => fullRefundState(),
      createRefund: dependencies.createRefund,
    },
  );
  assert.equal(tooLarge.status, 413);
  assert.deepEqual(await tooLarge.json(), { error: "request_too_large" });

  const serviceFailure = await handlePost(
    request(`/api/admin/case-lab-3/orders/${ORDER_UUID}/refunds`),
    { params: Promise.resolve({ id: ORDER_UUID }) },
    dependencies,
  );
  assert.equal(serviceFailure.status, 503);
  assert.deepEqual(await serviceFailure.json(), { error: "service_unavailable" });
  assert.doesNotMatch(await serviceFailure.text().catch(() => ""), /provider secret|database details/u);
});

test("refund and IncomeReturn jobs use the existing shared worker handler contract", async () => {
  const calls: string[] = [];
  const handlers = createCaseLab3JobHandlers({
    initiate_refund: async (job, context) => {
      calls.push(`${job.jobType}:${context.environment}:${context.timeoutMs}`);
      return { refundId: job.refundId };
    },
    issue_fiscal_operation: async (job, context) => {
      calls.push(`${job.jobType}:${context.environment}:${context.timeoutMs}`);
      const payload = job.payloadReference;
      const operationKey = payload && typeof payload === "object" && !Array.isArray(payload)
        ? payload.operationKey ?? null
        : null;
      return { operationKey };
    },
  });
  const context = {
    environment: "test" as const,
    signal: new AbortController().signal,
    timeoutMs: 10_000,
    now: () => 0,
  };

  await handlers.initiate_refund({
    jobId: "job-refund",
    jobType: "initiate_refund",
    logicalKey: "refund:refund-operation-1",
    payloadReference: { refundId: REFUND_UUID, operationKey: OPERATION_KEY, amountMinor: 1_500_000, requestId: OPERATION_KEY },
    orderId: ORDER_UUID,
    ticketId: null,
    refundId: REFUND_UUID,
    leaseToken: "lease-refund",
    leasedUntil: "2026-09-08T01:02:00.000Z",
  }, context);
  await handlers.issue_fiscal_operation({
    jobId: "job-receipt",
    jobType: "issue_fiscal_operation",
    logicalKey: "job:fiscal:refund_income_return:refund-1",
    payloadReference: { operationKey: "fiscal:refund_income_return:refund-1", purpose: "refund_income_return", dependsOnPurpose: "payment_income" },
    orderId: ORDER_UUID,
    ticketId: null,
    refundId: REFUND_UUID,
    leaseToken: "lease-receipt",
    leasedUntil: "2026-09-08T01:02:00.000Z",
  }, context);

  assert.deepEqual(calls, ["initiate_refund:test:10000", "issue_fiscal_operation:test:10000"]);
});
