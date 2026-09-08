import assert from "node:assert/strict";
import test from "node:test";

import "./server-only-test-loader";

const UUID = "00000000-0000-4000-8000-000000000701";
const TICKET_UUID = "00000000-0000-4000-8000-000000000702";

const adminSession = { role: "crm_admin" as const, token: "session-token" };

async function adminOrdersRoute() {
  return import("../../app/api/admin/case-lab-3/orders/route");
}

async function exportRoute() {
  return import("../../app/api/admin/case-lab-3/orders/export/route");
}

async function settingsRoute() {
  return import("../../app/api/admin/case-lab-3/settings/route");
}

async function allocationsRoute() {
  return import("../../app/api/admin/case-lab-3/allocations/route");
}

async function transferRoute() {
  return import("../../app/api/admin/case-lab-3/orders/[id]/transfer/route");
}

async function cancellationRoute() {
  return import("../../app/api/admin/case-lab-3/orders/[id]/cancel-ticket/route");
}

function request(url: string, init: RequestInit = {}): Request {
  return new Request(`https://caselab.kz${url}`, {
    ...init,
    headers: {
      Origin: "https://caselab.kz",
      ...(init.headers ?? {}),
    },
  });
}

function authorizedMutationDependencies<T extends Record<string, unknown>>(extra: T) {
  return {
    requireCrmAdmin: async () => adminSession,
    verifyCrmMutation: () => true,
    auditAction: async () => {},
    ...extra,
  };
}

test("admin order list rejects an unauthenticated request before database access", async () => {
  const { handleGet } = await adminOrdersRoute();
  let called = false;

  const response = await handleGet(
    request(`/api/admin/case-lab-3/orders?search=${encodeURIComponent("buyer@example.test")}`),
    {
      requireCrmAdmin: async () => null,
      listOrders: async () => {
        called = true;
        return { orders: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 0 } };
      },
    },
  );

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(called, false);
});

test("admin order search preserves exact email semantics and server filters", async () => {
  const { handleGet } = await adminOrdersRoute();
  let received: Record<string, unknown> | undefined;

  const response = await handleGet(
    request(
      "/api/admin/case-lab-3/orders?environment=test&search=Buyer%40Example.test&paymentStatus=paid&ticketStatus=valid&page=2&pageSize=50",
    ),
    {
      requireCrmAdmin: async () => adminSession,
      listOrders: async (filters: Record<string, unknown>) => {
        received = filters;
        return {
          orders: [{ id: UUID, orderNumber: "CL3-0001", participantEmail: "buyer@example.test" }],
          pagination: { page: 2, pageSize: 50, total: 51, totalPages: 2 },
        };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(received, {
    environment: "test",
    search: "Buyer@Example.test",
    paymentStatus: "paid",
    ticketStatus: "valid",
    receiptStatus: null,
    emailStatus: null,
    refundStatus: null,
    incidentStatus: null,
    page: 2,
    pageSize: 50,
  });
  assert.deepEqual(await response.json(), {
    orders: [{ id: UUID, orderNumber: "CL3-0001", participantEmail: "buyer@example.test" }],
    pagination: { page: 2, pageSize: 50, total: 51, totalPages: 2 },
  });
});

test("CSV export is authenticated, audited, formula-safe, and no-store", async () => {
  const { handleGet } = await exportRoute();
  let audit: Record<string, unknown> | undefined;

  const response = await handleGet(
    request("/api/admin/case-lab-3/orders/export?environment=test&search=buyer%40example.test"),
    {
      requireCrmAdmin: async () => adminSession,
      exportOrders: async (filters: Record<string, unknown>) => {
        assert.equal(filters.search, "buyer@example.test");
        return {
          filename: "case-lab-3-orders.csv",
          csv: "Order number,Participant email\r\nCL3-0001,'=formula@example.test\r\n",
          rowCount: 1,
        };
      },
      auditExport: async (entry: Record<string, unknown>) => {
        audit = entry;
      },
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("content-type") ?? "", /text\/csv;\s*charset=utf-8/i);
  assert.match(response.headers.get("content-disposition") ?? "", /attachment/);
  assert.match(await response.text(), /'=formula/);
  assert.deepEqual(audit, {
    actorId: "crm_admin",
    action: "orders_exported",
    rowCount: 1,
    environment: "test",
  });
});

test("every admin mutation rejects missing CSRF/origin/idempotency before parsing or changing state", async () => {
  const { handlePost } = await settingsRoute();
  let changed = false;
  let parsed = false;

  const response = await handlePost(
    new Request("https://caselab.kz/api/admin/case-lab-3/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    }),
    {
      requireCrmAdmin: async () => adminSession,
      verifyCrmMutation: () => false,
      updateSettings: async () => {
        changed = true;
        return { kind: "updated" };
      },
      parseBody: async () => {
        parsed = true;
        return {};
      },
    },
  );

  assert.equal(response.status, 403);
  assert.equal(changed, false);
  assert.equal(parsed, false);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("settings mutation enforces the 70 through 100 sales-limit bounds", async () => {
  const { handlePost } = await settingsRoute();
  let called = false;

  const response = await handlePost(
    request("/api/admin/case-lab-3/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "settings-key" },
      body: JSON.stringify({ environment: "test", onlineSalesLimit: 69, salesEnabled: false }),
    }),
    authorizedMutationDependencies({
      updateSettings: async () => {
        called = true;
        return { kind: "updated" };
      },
    }),
  );

  assert.equal(response.status, 400);
  assert.equal(called, false);
  assert.deepEqual(await response.json(), { error: "invalid_request" });
});

test("manual allocation passes capacity controls to the atomic RPC", async () => {
  const { handlePost } = await allocationsRoute();
  let received: Record<string, unknown> | undefined;

  const response = await handlePost(
    request("/api/admin/case-lab-3/allocations", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "allocation-key" },
      body: JSON.stringify({
        environment: "test",
        allocationCategory: "invited",
        quantity: 2,
        tier: "standard",
        countsTowardOnlineLimit: false,
        holdsEarlyBirdQuota: false,
        reason: "Partner invitation",
      }),
    }),
    authorizedMutationDependencies({
      createAllocation: async (input: Record<string, unknown>) => {
        received = input;
        return { kind: "created", allocationId: UUID, environment: "test", quantity: 2 };
      },
    }),
  );

  assert.equal(response.status, 201);
  assert.deepEqual(received, {
    environment: "test",
    allocationCategory: "invited",
    quantity: 2,
    tier: "standard",
    countsTowardOnlineLimit: false,
    holdsEarlyBirdQuota: false,
    reason: "Partner invitation",
    actorId: "crm_admin",
  });
});

test("participant transfer rotates revision and queues a revised ticket email", async () => {
  const { handlePost } = await transferRoute();
  let transfer: Record<string, unknown> | undefined;
  let queued: Record<string, unknown> | undefined;
  let stage = "start";

  const response = await handlePost(
    request(`/api/admin/case-lab-3/orders/${UUID}/transfer`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "transfer-key" },
      body: JSON.stringify({
        firstName: "New",
        lastName: "Participant",
        email: "new@example.test",
        phone: null,
        company: null,
        position: null,
        reason: "Name correction",
      }),
    }),
    { params: Promise.resolve({ id: UUID }) },
    authorizedMutationDependencies({
      getTicketId: async () => {
        stage = "ticket";
        return TICKET_UUID;
      },
      transferParticipant: async (input: Record<string, unknown>) => {
        stage = "transfer";
        transfer = input;
        return { kind: "transferred", ticketId: TICKET_UUID, revisionId: "revision-2", revisionNumber: 2, tokenVersion: 2 };
      },
      queueTicketEmail: async (input: Record<string, unknown>) => {
        stage = "queue";
        queued = input;
      },
      auditAction: async () => {
        stage = "audit";
      },
    }),
  );

  if (response.status !== 200) assert.fail(`${stage}: ${await response.text()}`);
  assert.equal(response.status, 200);
  assert.deepEqual(transfer, {
    ticketId: TICKET_UUID,
    participant: {
      firstName: "New",
      lastName: "Participant",
      email: "new@example.test",
      phone: null,
      company: null,
      position: null,
    },
    reason: "Name correction",
    actorId: "crm_admin",
  });
  assert.deepEqual(queued, {
    orderId: UUID,
    ticketId: TICKET_UUID,
    revisionId: "revision-2",
    revisionNumber: 2,
    deliveryKind: "ticket",
  });
});

test("ticket cancellation uses the audited RPC without releasing paid capacity", async () => {
  const { handlePost } = await cancellationRoute();
  let cancelled: Record<string, unknown> | undefined;
  let stage = "start";

  const response = await handlePost(
    request(`/api/admin/case-lab-3/orders/${UUID}/cancel-ticket`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Idempotency-Key": "cancel-key" },
      body: JSON.stringify({ reason: "Organizer cancellation" }),
    }),
    { params: Promise.resolve({ id: UUID }) },
    authorizedMutationDependencies({
      getTicketId: async () => {
        stage = "ticket";
        return TICKET_UUID;
      },
      cancelTicket: async (input: Record<string, unknown>) => {
        stage = "cancel";
        cancelled = input;
        return { kind: "cancelled", ticketId: UUID, status: "cancelled" };
      },
    }),
  );

  if (response.status !== 200) assert.fail(`${stage}: ${await response.text()}`);
  assert.equal(response.status, 200);
  assert.deepEqual(cancelled, {
    ticketId: TICKET_UUID,
    reason: "Organizer cancellation",
    actorId: "crm_admin",
  });
  assert.doesNotMatch(JSON.stringify(cancelled), /refund|release|allocation/i);
});
