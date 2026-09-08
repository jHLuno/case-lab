import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import "./server-only-test-loader";

type TestCreateOrderResult = import("../../app/lib/case-lab-3/contracts").CreateOrderResult;

process.env.CASE_LAB_3_PAYMENT_MODE = "test";

const routePaths = [
  "app/api/case-lab-3/availability/route.ts",
  "app/api/case-lab-3/orders/route.ts",
  "app/api/case-lab-3/orders/[id]/payment-attempts/route.ts",
  "app/api/case-lab-3/orders/[id]/status/route.ts",
  "app/api/case-lab-3/orders/[id]/access/route.ts",
  "app/api/case-lab-3/tickets/[number]/access/route.ts",
] as const;

async function source(path: string): Promise<string> {
  return readFile(path, "utf8");
}

function requiredSource(routes: ReadonlyMap<string, string>, path: string): string {
  const value = routes.get(path);
  if (typeof value !== "string") throw new Error(`Missing route source: ${path}`);
  return value;
}

test("public payment routes expose the required server-side guards", async () => {
  const files = await Promise.all(routePaths.map(async (path) => [path, await source(path)] as const));
  const routes = new Map(files);
  const availability = requiredSource(routes, routePaths[0]);
  const orders = requiredSource(routes, routePaths[1]);
  const ordersService = await source("app/lib/case-lab-3/orders.server.ts");
  const ticketService = await source("app/lib/case-lab-3/ticket.server.ts");
  const databaseTypes = await source("app/lib/case-lab-3/database.types.ts");
  const attempts = requiredSource(routes, routePaths[2]);
  const status = requiredSource(routes, routePaths[3]);
  const orderAccess = requiredSource(routes, routePaths[4]);
  const ticketAccess = requiredSource(routes, routePaths[5]);

  assert.match(availability, /getAvailability/);
  assert.match(availability, /noStoreJson/);
  assert.match(availability, /handleGet/);
  assert.match(availability, /consumeRateLimit/);
  assert.match(orders, /requireJson/);
  assert.match(orders, /readBoundedBody/);
  assert.match(orders, /requireSameOrigin/);
  assert.match(orders, /idempotency-key/i);
  assert.match(orders, /consumeRateLimit/);
  assert.match(orders, /parseOrderInput/);
  assert.match(orders, /offer_changed/);
  assert.match(orders, /status:\s*409/);
  assert.match(orders, /httpOnly:\s*true/);
  assert.match(orders, /secure:\s*true/);
  assert.match(orders, /sameSite:\s*["']lax["']/);
  assert.match(attempts, /params:\s*Promise/);
  assert.match(attempts, /await params/);
  assert.match(attempts, /createPaymentAttempt/);
  assert.match(attempts, /noStoreJson/);
  assert.match(status, /params:\s*Promise/);
  assert.match(status, /await params/);
  assert.match(status, /getOrderStatus/);
  assert.match(status, /status:\s*401/);
  assert.match(status, /noStoreJson/);
  assert.match(ordersService, /policy_purpose/);
  assert.match(ordersService, /payment_income/);
  assert.match(ordersService, /case_lab_3_consume_rate_limit/);
  assert.match(ordersService, /case-lab-3-availability/);
  assert.match(ordersService, /case-lab-3-order-create/);
  assert.match(ordersService, /type PaymentAttemptRpcResult = CreatePaymentAttemptRpcResult/);
  assert.match(databaseTypes, /export type CreatePaymentAttemptRpcResult =\s*[\s\S]*kind:\s*"offer_changed"[\s\S]*availability:\s*AvailabilityResponse/);
  assert.doesNotMatch(ordersService, /as unknown as PaymentAttemptRpcResult/);
  assert.match(ordersService, /const config = getCaseLab3Config\(order\.environment\);[\s\S]*case_lab_3_create_payment_attempt/);
  assert.doesNotMatch(ordersService, /case_lab_3_create_payment_attempt[\s\S]*getCaseLab3Config\(order\.environment\)/);
  assert.match(ordersService, /loadOrderSession[\s\S]*configuredEnvironment\(\)[\s\S]*\.eq\("environment", environment\)/);
  assert.match(ordersService, /loadOrderForAttempt[\s\S]*configuredEnvironment\(\)[\s\S]*\.eq\("environment", environment\)/);
  assert.match(ordersService, /getOrderStatus[\s\S]*configuredEnvironment\(\)[\s\S]*\.eq\("environment", environment\)/);
  assert.match(ordersService, /exchangeTicketAccessToken[\s\S]*configuredEnvironment\(\)[\s\S]*\.eq\("environment", environment\)/);
  assert.match(ticketService, /getPublicPaymentEnvironment/);
  assert.match(orderAccess, /exchangeOrderAccessToken/);
  assert.match(orderAccess, /status:\s*303/);
  assert.match(orderAccess, /Cache-Control[\s\S]*no-store/);
  assert.match(orderAccess, /Referrer-Policy[\s\S]*no-referrer/);
  assert.match(orderAccess, /ORDER_SESSION_COOKIE/);
  assert.match(ticketAccess, /exchangeTicketAccessToken/);
  assert.match(ticketAccess, /status:\s*303/);
  assert.match(ticketAccess, /Cache-Control[\s\S]*no-store/);
  assert.match(ticketAccess, /Referrer-Policy[\s\S]*no-referrer/);
  assert.match(ticketAccess, /TICKET_SESSION_COOKIE/);

  for (const route of [orders, attempts, status, orderAccess, ticketAccess]) {
    assert.doesNotMatch(route, /error:\s*\{[^}]*\b(?:email|firstName|lastName|phone)\b/u);
  }
});

function makeOrderRequest(options: {
  origin?: string;
  contentType?: string;
  idempotencyKey?: string;
  body?: string;
  duplicateIdempotencyKey?: boolean;
} = {}) {
  const headers = new Headers({
    Origin: options.origin ?? "https://caselab.kz",
    "Content-Type": options.contentType ?? "application/json",
  });
  if (options.idempotencyKey !== undefined) {
    headers.set("Idempotency-Key", options.idempotencyKey);
    if (options.duplicateIdempotencyKey) {
      headers.append("Idempotency-Key", options.idempotencyKey);
    }
  }
  return new Request("https://caselab.kz/api/case-lab-3/orders", {
    method: "POST",
    headers,
    body: options.body ?? JSON.stringify(orderBody()),
  });
}

function orderDependencies(overrides: Partial<import("../../app/api/case-lab-3/orders/route").OrderRouteDependencies> = {}) {
  return {
    createOrder: async () => ({
      kind: "created" as const,
      orderId: TEST_ORDER_ID,
      orderNumber: "CL3-TEST001",
      tier: "standard" as const,
      amountMinor: 1500000,
      reservationExpiresAt: "2026-09-07T10:15:00.000Z",
    }),
    getPublicPaymentEnvironment: () => "test" as const,
    getOrderRequestSecret: () => "s".repeat(32),
    getHashedClientIp: () => "h".repeat(64),
    consumeRateLimit: async () => undefined,
    issueOrderSession: () => ({ purpose: "order-session" as const, orderId: TEST_ORDER_ID, version: 1, token: TEST_TOKEN }),
    getCookies: async () => cookieStore(),
    ...overrides,
  };
}

test("order handler executes content, size, origin, and idempotency guards", async () => {
  const route = await import("../../app/api/case-lab-3/orders/route");
  let serviceCalls = 0;
  const dependencies = orderDependencies({ createOrder: async () => {
    serviceCalls += 1;
    return {
      kind: "created" as const,
      orderId: TEST_ORDER_ID,
      orderNumber: "CL3-TEST001",
      tier: "standard" as const,
      amountMinor: 1500000,
      reservationExpiresAt: "2026-09-07T10:15:00.000Z",
    };
  } });

  const unsupported = await route.handlePost(
    makeOrderRequest({ contentType: "text/plain", idempotencyKey: "00000000-0000-4000-8000-000000000012" }),
    dependencies,
  );
  assert.equal(unsupported.status, 415);
  assert.equal(unsupported.headers.get("cache-control"), "no-store");

  const tooLarge = await route.handlePost(
    makeOrderRequest({ idempotencyKey: "00000000-0000-4000-8000-000000000013", body: "{" + "x".repeat(16 * 1024) }),
    dependencies,
  );
  assert.equal(tooLarge.status, 413);
  assert.equal(tooLarge.headers.get("cache-control"), "no-store");

  const missingKey = await route.handlePost(makeOrderRequest(), dependencies);
  assert.equal(missingKey.status, 400);
  assert.equal(missingKey.headers.get("cache-control"), "no-store");

  const duplicateKey = await route.handlePost(
    makeOrderRequest({ idempotencyKey: "00000000-0000-4000-8000-000000000014", duplicateIdempotencyKey: true }),
    dependencies,
  );
  assert.equal(duplicateKey.status, 400);
  assert.equal(duplicateKey.headers.get("cache-control"), "no-store");

  const uppercaseKey = await route.handlePost(
    makeOrderRequest({ idempotencyKey: "00000000-0000-4000-8000-0000000000AF" }),
    dependencies,
  );
  assert.equal(uppercaseKey.status, 400);
  assert.equal(uppercaseKey.headers.get("cache-control"), "no-store");

  const invalidOrigin = await route.handlePost(
    makeOrderRequest({ origin: "https://evil.example", idempotencyKey: "00000000-0000-4000-8000-000000000015" }),
    dependencies,
  );
  assert.equal(invalidOrigin.status, 403);
  assert.equal(invalidOrigin.headers.get("cache-control"), "no-store");
  assert.equal(serviceCalls, 0);
});

test("availability and order creation rate-limit before service work and fail closed", async () => {
  const availabilityRoute = await import("../../app/api/case-lab-3/availability/route");
  const orderRoute = await import("../../app/api/case-lab-3/orders/route");
  const { RateLimitExceededError } = await import("../../app/lib/case-lab-3/orders.server");
  const availabilityCalls: string[] = [];
  const availabilityResponse = await availabilityRoute.handleGet(
    new Request("https://caselab.kz/api/case-lab-3/availability", {
      headers: { "x-vercel-forwarded-for": "198.51.100.10" },
    }),
    {
      getOrderRequestSecret: () => {
        availabilityCalls.push("secret");
        return "s".repeat(32);
      },
      getHashedClientIp: (_request, _secret, scope) => {
        availabilityCalls.push(`hash:${scope}`);
        return "a".repeat(64);
      },
      consumeRateLimit: async (scope, hash, limit, bucket) => {
        availabilityCalls.push(`limit:${scope}:${hash}:${limit}:${bucket}`);
      },
      getAvailability: async () => {
        availabilityCalls.push("availability");
        return TEST_AVAILABILITY;
      },
      getPublicPaymentEnvironment: () => "test",
    },
  );
  assert.equal(availabilityResponse.status, 200);
  assert.deepEqual(availabilityCalls, [
    "secret",
    "hash:case-lab-3-availability",
    "limit:case-lab-3-availability:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:60:60",
    "availability",
  ]);

  let orderServiceCalls = 0;
  const unavailable = await orderRoute.handlePost(
    makeOrderRequest({ idempotencyKey: "00000000-0000-4000-8000-000000000017" }),
    orderDependencies({
      consumeRateLimit: async () => {
        throw new Error("rate limiter unavailable");
      },
      createOrder: async () => {
        orderServiceCalls += 1;
        return {
          kind: "created" as const,
          orderId: TEST_ORDER_ID,
          orderNumber: "CL3-TEST001",
          tier: "standard" as const,
          amountMinor: 1500000,
          reservationExpiresAt: "2026-09-07T10:15:00.000Z",
        };
      },
    }),
  );
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.headers.get("cache-control"), "no-store");
  assert.deepEqual(await unavailable.json(), { error: "service_unavailable" });
  assert.equal(orderServiceCalls, 0);

  const limited = await orderRoute.handlePost(
    makeOrderRequest({ idempotencyKey: "00000000-0000-4000-8000-000000000018" }),
    orderDependencies({
      consumeRateLimit: async () => {
        throw new RateLimitExceededError();
      },
    }),
  );
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("cache-control"), "no-store");
  assert.deepEqual(await limited.json(), { error: "rate_limited" });
});

test("same idempotency key is forwarded unchanged for replayed order responses", async () => {
  const route = await import("../../app/api/case-lab-3/orders/route");
  const seenKeys: string[] = [];
  const result = {
    kind: "created" as const,
    orderId: TEST_ORDER_ID,
    orderNumber: "CL3-REPLAY001",
    tier: "standard" as const,
    amountMinor: 1500000,
    reservationExpiresAt: "2026-09-07T10:15:00.000Z",
  };
  const durableOrders = new Map<string, typeof result>();
  let createdOrders = 0;
  const dependencies = orderDependencies({
    createOrder: async (_input, context) => {
      seenKeys.push(context.idempotencyKey);
      const existing = durableOrders.get(context.idempotencyKey);
      if (existing) return existing;
      createdOrders += 1;
      durableOrders.set(context.idempotencyKey, result);
      return result;
    },
  });
  const requestOptions = { idempotencyKey: "00000000-0000-4000-8000-000000000016" };
  const first = await route.handlePost(makeOrderRequest(requestOptions), dependencies);
  const second = await route.handlePost(makeOrderRequest(requestOptions), dependencies);
  assert.equal(first.status, 201);
  assert.equal(second.status, 201);
  assert.deepEqual(await first.json(), await second.json());
  assert.deepEqual(seenKeys, [requestOptions.idempotencyKey, requestOptions.idempotencyKey]);
  assert.equal(createdOrders, 1);
});

test("public availability responses allowlist authoritative fields without caching", async () => {
  const route = await import("../../app/api/case-lab-3/availability/route");
  const unsafeAvailability = {
    ...TEST_AVAILABILITY,
    participantEmail: "buyer@example.test",
    internalReservationId: "reservation-secret",
  } as unknown as typeof TEST_AVAILABILITY;
  const response = await route.handleGet(new Request("https://caselab.kz/api/case-lab-3/availability", {
    headers: { "x-vercel-forwarded-for": "198.51.100.10" },
  }), {
    getOrderRequestSecret: () => "s".repeat(32),
    getHashedClientIp: () => "a".repeat(64),
    consumeRateLimit: async () => undefined,
    getAvailability: async () => unsafeAvailability,
    getPublicPaymentEnvironment: () => "test",
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), TEST_AVAILABILITY);
});

test("public order responses allowlist created and changed-offer fields", async () => {
  const route = await import("../../app/api/case-lab-3/orders/route");
  const unsafeAvailability = {
    ...TEST_AVAILABILITY,
    participantEmail: "buyer@example.test",
    internalReservationId: "reservation-secret",
  } as unknown as typeof TEST_AVAILABILITY;
  const unsafeCreated = {
    kind: "created" as const,
    orderId: TEST_ORDER_ID,
    orderNumber: "CL3-TEST001",
    tier: "standard" as const,
    amountMinor: 1500000,
    reservationExpiresAt: "2026-09-07T10:15:00.000Z",
    participantEmail: "buyer@example.test",
    purchaserEmail: "purchaser@example.test",
    internalReservationId: "reservation-secret",
  } as unknown as TestCreateOrderResult;

  const createdResponse = await route.handlePost(
    makeOrderRequest({ idempotencyKey: "00000000-0000-4000-8000-000000000019" }),
    orderDependencies({ createOrder: async () => unsafeCreated }),
  );
  assert.equal(createdResponse.status, 201);
  assert.deepEqual(await createdResponse.json(), {
    kind: "created",
    orderId: TEST_ORDER_ID,
    orderNumber: "CL3-TEST001",
    tier: "standard",
    amountMinor: 1500000,
    reservationExpiresAt: "2026-09-07T10:15:00.000Z",
  });

  const changedResponse = await route.handlePost(
    makeOrderRequest({ idempotencyKey: "00000000-0000-4000-8000-000000000020" }),
    orderDependencies({
      createOrder: async () => ({
        kind: "offer_changed" as const,
        availability: unsafeAvailability,
      } as unknown as TestCreateOrderResult),
    }),
  );
  assert.equal(changedResponse.status, 409);
  assert.deepEqual(await changedResponse.json(), { error: "offer_changed", availability: TEST_AVAILABILITY });
});

test("order handler rejects malformed created-order identifiers, numbers, and timestamps", async () => {
  const route = await import("../../app/api/case-lab-3/orders/route");
  const created = {
    kind: "created" as const,
    orderId: TEST_ORDER_ID,
    orderNumber: "CL3-TEST001",
    tier: "standard" as const,
    amountMinor: 1500000,
    reservationExpiresAt: "2026-09-07T10:15:00.000Z",
  };
  const invalidResults = [
    { ...created, orderId: UPPERCASE_ORDER_ID },
    { ...created, orderNumber: "" },
    { ...created, reservationExpiresAt: "2026-09-07" },
  ];

  for (const result of invalidResults) {
    const cookies = cookieStore();
    const response = await route.handlePost(
      makeOrderRequest({ idempotencyKey: crypto.randomUUID() }),
      orderDependencies({ createOrder: async () => result, getCookies: async () => cookies }),
    );
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { error: "service_unavailable" });
    assert.deepEqual(cookies.writes, []);
  }
});

function cookieStore(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const writes: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  return {
    writes,
    get(name: string) {
      const value = values.get(name);
      return value === undefined ? undefined : { value };
    },
    set(name: string, value: string, options: Record<string, unknown>) {
      values.set(name, value);
      writes.push({ name, value, options });
    },
  };
}

const TEST_ORDER_ID = "00000000-0000-4000-8000-000000000001";
const TEST_TICKET_ID = "00000000-0000-4000-8000-000000000002";
const UPPERCASE_ORDER_ID = "00000000-0000-4000-8000-0000000000AF";
const TEST_TOKEN = "a".repeat(43);
const TEST_AVAILABILITY = {
  available: true,
  reason: "available" as const,
  tier: "standard" as const,
  amountMinor: 1500000,
  currency: "KZT" as const,
  salesLimit: 70,
};

function orderBody() {
  return {
    firstName: "Ada",
    lastName: "Lovelace",
    email: "buyer@example.test",
    phone: null,
    company: null,
    position: null,
    expectedTier: "standard",
    expectedAmountMinor: 1500000,
    offerVersionId: "offer-2026-09-07",
    privacyVersionId: "privacy-2026-09-07",
    acceptedTerms: true,
    marketingConsent: false,
    attribution: {},
  };
}

test("order handler returns a no-store 409 for an injected changed offer and sets a protected cookie only after creation", async () => {
  const route = await import("../../app/api/case-lab-3/orders/route");
  const changedCookies = cookieStore();
  let changedSessionCalls = 0;
  const changedResponse = await route.handlePost(
    new Request("https://caselab.kz/api/case-lab-3/orders", {
      method: "POST",
      headers: {
        Origin: "https://caselab.kz",
        "Content-Type": "application/json",
        "Idempotency-Key": "00000000-0000-4000-8000-000000000010",
      },
      body: JSON.stringify(orderBody()),
    }),
    {
      createOrder: async () => ({ kind: "offer_changed", availability: TEST_AVAILABILITY }),
      getPublicPaymentEnvironment: () => "test",
      getOrderRequestSecret: () => "s".repeat(32),
      getHashedClientIp: () => "h".repeat(64),
      consumeRateLimit: async () => undefined,
      issueOrderSession: () => {
        changedSessionCalls += 1;
        return { purpose: "order-session", orderId: TEST_ORDER_ID, version: 1, token: TEST_TOKEN };
      },
      getCookies: async () => changedCookies,
    },
  );

  assert.equal(changedResponse.status, 409);
  assert.equal(changedResponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(await changedResponse.json(), { error: "offer_changed", availability: TEST_AVAILABILITY });
  assert.equal(changedSessionCalls, 0);
  assert.deepEqual(changedCookies.writes, []);

  const createdCookies = cookieStore();
  const createdResponse = await route.handlePost(
    new Request("https://caselab.kz/api/case-lab-3/orders", {
      method: "POST",
      headers: {
        Origin: "https://caselab.kz",
        "Content-Type": "application/json",
        "Idempotency-Key": "00000000-0000-4000-8000-000000000011",
      },
      body: JSON.stringify(orderBody()),
    }),
    {
      createOrder: async () => ({
        kind: "created",
        orderId: TEST_ORDER_ID,
        orderNumber: "CL3-TEST001",
        tier: "standard",
        amountMinor: 1500000,
        reservationExpiresAt: "2026-09-07T10:15:00.000Z",
      }),
       getPublicPaymentEnvironment: () => "test",
       getOrderRequestSecret: () => "s".repeat(32),
       getHashedClientIp: () => "h".repeat(64),
       consumeRateLimit: async () => undefined,
       issueOrderSession: () => ({ purpose: "order-session", orderId: TEST_ORDER_ID, version: 1, token: TEST_TOKEN }),
       getCookies: async () => createdCookies,
    },
  );

  assert.equal(createdResponse.status, 201);
  assert.equal(createdResponse.headers.get("cache-control"), "no-store");
  assert.deepEqual(createdCookies.writes[0]?.options, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
});

test("payment-attempt handler maps an injected changed offer to a no-store 409", async () => {
  const route = await import("../../app/api/case-lab-3/orders/[id]/payment-attempts/route");
  const { OfferChangedError } = await import("../../app/lib/case-lab-3/orders.server");
  const response = await route.handlePost(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/payment-attempts`, {
      method: "POST",
      headers: { Origin: "https://caselab.kz" },
    }),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    {
      createPaymentAttempt: async () => {
        throw new OfferChangedError(TEST_AVAILABILITY);
      },
      getCookies: async () => cookieStore({ cl3_order_session: `1.${TEST_TOKEN}` }),
    },
  );

  assert.equal(response.status, 409);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "offer_changed", availability: TEST_AVAILABILITY });
});

test("payment-attempt handler rejects malformed public responses", async () => {
  const route = await import("../../app/api/case-lab-3/orders/[id]/payment-attempts/route");
  const response = await route.handlePost(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/payment-attempts`, {
      method: "POST",
      headers: { Origin: "https://caselab.kz" },
    }),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    {
      createPaymentAttempt: async () => ({
        attemptId: "not-an-id",
        externalId: "",
        reservationExpiresAt: "not-a-date",
        widget: {},
      } as never),
      getCookies: async () => cookieStore({ cl3_order_session: `1.${TEST_TOKEN}` }),
    },
  );

  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "service_unavailable" });
});

test("payment-attempt handler returns only a validated successful attempt response", async () => {
  const route = await import("../../app/api/case-lab-3/orders/[id]/payment-attempts/route");
  const response = await route.handlePost(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/payment-attempts`, {
      method: "POST",
      headers: { Origin: "https://caselab.kz" },
    }),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    {
      createPaymentAttempt: async () => ({
        attemptId: "00000000-0000-4000-8000-000000000003",
        externalId: "cl3-attempt-003",
        reservationExpiresAt: "2026-09-08T10:15:00.000Z",
        widget: {
          publicTerminalId: "terminal-test",
          amount: 15000,
          currency: "KZT",
          paymentSchema: "Single",
          externalId: "cl3-attempt-003",
          receiptEmail: "buyer@example.test",
          emailBehavior: "Hidden",
          tokenize: false,
          retryPayment: false,
          userInfo: {
            accountId: TEST_ORDER_ID,
            firstName: "Ada",
            lastName: "Lovelace",
            email: "buyer@example.test",
          },
          receipt: { enabled: true },
          recurrent: { enabled: true },
        },
      } as never),
      getCookies: async () => cookieStore({ cl3_order_session: `1.${TEST_TOKEN}` }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    attemptId: "00000000-0000-4000-8000-000000000003",
    externalId: "cl3-attempt-003",
    reservationExpiresAt: "2026-09-08T10:15:00.000Z",
    widget: {
      publicTerminalId: "terminal-test",
      amount: 15000,
      currency: "KZT",
      paymentSchema: "Single",
      externalId: "cl3-attempt-003",
      receiptEmail: "buyer@example.test",
      emailBehavior: "Hidden",
      tokenize: false,
      retryPayment: false,
      userInfo: {
        accountId: TEST_ORDER_ID,
        firstName: "Ada",
        lastName: "Lovelace",
        email: "buyer@example.test",
      },
    },
  });
});

test("payment-attempt handler rejects unauthorized sessions before service work", async () => {
  const route = await import("../../app/api/case-lab-3/orders/[id]/payment-attempts/route");
  let serviceCalls = 0;
  const response = await route.handlePost(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/payment-attempts`, {
      method: "POST",
      headers: { Origin: "https://caselab.kz" },
    }),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    {
      createPaymentAttempt: async () => {
        serviceCalls += 1;
        throw new Error("must not run");
      },
      getCookies: async () => cookieStore(),
    },
  );

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "unauthorized" });
  assert.equal(serviceCalls, 0);
});

test("protected handlers use executable cookie seams and no-store responses", async () => {
  const statusRoute = await import("../../app/api/case-lab-3/orders/[id]/status/route");
  const statusResponse = await statusRoute.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/status`),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    {
      getOrderStatus: async () => ({
        orderNumber: "CL3-TEST001",
        paymentStatus: "paid",
        ticketStatus: "valid",
        receiptStatus: "queued",
        emailStatus: "pending",
        receiptUrl: null,
      }),
      getCookies: async () => cookieStore({ cl3_order_session: `1.${TEST_TOKEN}` }),
    },
  );
  assert.equal(statusResponse.status, 200);
  assert.equal(statusResponse.headers.get("cache-control"), "no-store");

  const orderAccessRoute = await import("../../app/api/case-lab-3/orders/[id]/access/route");
  const orderCookies = cookieStore();
  const orderAccessResponse = await orderAccessRoute.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/access?token=${TEST_TOKEN}`),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    {
      exchangeOrderAccessToken: async () => ({
        purpose: "order-session",
        orderId: TEST_ORDER_ID,
        version: 1,
        token: TEST_TOKEN,
      }),
      getCookies: async () => orderCookies,
    },
  );
  assert.equal(orderAccessResponse.status, 303);
  assert.equal(orderAccessResponse.headers.get("cache-control"), "no-store");
  assert.equal(orderAccessResponse.headers.get("referrer-policy"), "no-referrer");
  assert.equal(orderAccessResponse.headers.get("location"), `https://caselab.kz/case-lab-3/order/${TEST_ORDER_ID}/`);
  assert.equal(orderAccessResponse.headers.get("location")?.includes("token"), false);
  assert.equal(orderCookies.writes[0]?.name, "cl3_order_session");

  const ticketAccessRoute = await import("../../app/api/case-lab-3/tickets/[number]/access/route");
  const ticketCookies = cookieStore();
  const ticketAccessResponse = await ticketAccessRoute.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/tickets/CL3-TICKET-001/access?token=${TEST_TOKEN}`),
    { params: Promise.resolve({ number: "CL3-TICKET-001" }) },
    {
      exchangeTicketAccessToken: async () => ({
        session: { purpose: "ticket-session", ticketId: TEST_TICKET_ID, revisionNumber: 4, token: TEST_TOKEN },
        tokenVersion: 9,
      }),
      getCookies: async () => ticketCookies,
    },
  );
  assert.equal(ticketAccessResponse.status, 303);
  assert.equal(ticketAccessResponse.headers.get("cache-control"), "no-store");
  assert.equal(ticketAccessResponse.headers.get("referrer-policy"), "no-referrer");
  assert.equal(ticketCookies.writes[0]?.name, "cl3_ticket_session");
  assert.equal(ticketCookies.writes[0]?.value, `4.9.${TEST_TOKEN}`);
  assert.deepEqual(ticketCookies.writes[0]?.options, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
});

test("ticket access failure is unauthorized and cannot set a participant cookie", async () => {
  const route = await import("../../app/api/case-lab-3/tickets/[number]/access/route");
  const cookies = cookieStore();
  const response = await route.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/tickets/CL3-TICKET-001/access?token=${TEST_TOKEN}`),
    { params: Promise.resolve({ number: "CL3-TICKET-001" }) },
    {
      exchangeTicketAccessToken: async () => null,
      getCookies: async () => cookies,
    },
  );

  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  assert.deepEqual(await response.json(), { error: "unauthorized" });
  assert.deepEqual(cookies.writes, []);
});

test("status handler rejects malformed public status responses", async () => {
  const route = await import("../../app/api/case-lab-3/orders/[id]/status/route");
  const response = await route.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/status`),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    {
      getOrderStatus: async () => ({
        orderNumber: "CL3-TEST001",
        paymentStatus: "not-a-payment-status",
        ticketStatus: "pending",
        receiptStatus: "queued",
        emailStatus: "pending",
        receiptUrl: null,
      } as never),
      getCookies: async () => cookieStore({ cl3_order_session: `1.${TEST_TOKEN}` }),
    },
  );

  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { error: "service_unavailable" });
});

test("status handler preserves the pending ticket status before a ticket row exists", async () => {
  const route = await import("../../app/api/case-lab-3/orders/[id]/status/route");
  const response = await route.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/status`),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    {
      getOrderStatus: async () => ({
        orderNumber: "CL3-TEST001",
        paymentStatus: "pending",
        ticketStatus: "pending",
        receiptStatus: "not_requested",
        emailStatus: "pending",
        receiptUrl: null,
      }),
      getCookies: async () => cookieStore({ cl3_order_session: `1.${TEST_TOKEN}` }),
    },
  );

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    orderNumber: "CL3-TEST001",
    paymentStatus: "pending",
    ticketStatus: "pending",
    receiptStatus: "not_requested",
    emailStatus: "pending",
    receiptUrl: null,
  });
});

test("status handler rejects malformed, wrong-order, and expired purchaser sessions", async () => {
  const route = await import("../../app/api/case-lab-3/orders/[id]/status/route");
  const { OrderAuthorizationError } = await import("../../app/lib/case-lab-3/orders.server");
  const status = {
    orderNumber: "CL3-TEST001",
    paymentStatus: "paid" as const,
    ticketStatus: "valid" as const,
    receiptStatus: "queued" as const,
    emailStatus: "pending" as const,
    receiptUrl: null,
  };
  let serviceCalls = 0;
  const dependencies = {
    getOrderStatus: async (_id: string, session: { version: number; token: string }) => {
      serviceCalls += 1;
      if (session.version !== 1 || session.token !== TEST_TOKEN) throw new OrderAuthorizationError();
      return status;
    },
    getCookies: async () => cookieStore(),
  };

  const malformed = await route.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/status`),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    { ...dependencies, getCookies: async () => cookieStore({ cl3_order_session: "malformed" }) },
  );
  assert.equal(malformed.status, 401);
  assert.equal(serviceCalls, 0);

  const wrongOrder = await route.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/status`),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    { ...dependencies, getCookies: async () => cookieStore({ cl3_order_session: `1.${"b".repeat(43)}` }) },
  );
  assert.equal(wrongOrder.status, 401);

  const expired = await route.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/status`),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    { ...dependencies, getCookies: async () => cookieStore({ cl3_order_session: `2.${TEST_TOKEN}` }) },
  );
  assert.equal(expired.status, 401);
  assert.equal(serviceCalls, 2);
});

test("service authorization rejects wrong-order, expired, and revoked order sessions", async () => {
  const { derivePurposeToken } = await import("../../app/lib/case-lab-3/tokens.server");
  const { assertOrderSession } = await import("../../app/lib/case-lab-3/orders.server");
  const secret = "s".repeat(32);
  const order = {
    id: TEST_ORDER_ID,
    environment: "test" as const,
    order_access_token_version: 3,
    order_access_revoked_at: null,
  };
  const valid = {
    purpose: "order-session" as const,
    orderId: TEST_ORDER_ID,
    version: 3,
    token: derivePurposeToken(secret, "order-session", TEST_ORDER_ID, 3),
  };

  assert.doesNotThrow(() => assertOrderSession(valid, order, secret));
  assert.throws(
    () => assertOrderSession({ ...valid, orderId: TEST_TICKET_ID }, order, secret),
    /authorization/i,
  );
  assert.throws(
    () => assertOrderSession({ ...valid, version: 2, token: derivePurposeToken(secret, "order-session", TEST_ORDER_ID, 2) }, order, secret),
    /authorization/i,
  );
  assert.throws(
    () => assertOrderSession(valid, { ...order, order_access_revoked_at: "2026-09-08T00:00:00.000Z" }, secret),
    /authorization/i,
  );
});

test("public and token UUID boundaries reject uppercase UUIDs", async () => {
  const { buildTicketQrPayload } = await import("../../app/lib/case-lab-3/tokens.server");
  const { isOrderId, issueOrderSession } = await import("../../app/lib/case-lab-3/orders.server");
  const uppercaseOrderId = UPPERCASE_ORDER_ID;

  assert.equal(isOrderId(uppercaseOrderId), false);
  process.env.CASE_LAB_3_TOKEN_SECRET = "s".repeat(32);
  assert.throws(() => issueOrderSession(uppercaseOrderId), /service|uuid/i);
  assert.throws(() => buildTicketQrPayload(uppercaseOrderId, 1, "s".repeat(32)), /uuid/i);
});

test("service ticket bearer authorization rejects wrong ticket, expired version, and revoked ticket", async () => {
  const { derivePurposeToken } = await import("../../app/lib/case-lab-3/tokens.server");
  const { authorizeTicketAccessToken } = await import("../../app/lib/case-lab-3/orders.server");
  const secret = "s".repeat(32);
  const ticket = {
    id: TEST_TICKET_ID,
    status: "valid" as const,
    revisionNumber: 4,
    tokenVersion: 9,
  };
  const token = derivePurposeToken(secret, "ticket-session", TEST_TICKET_ID, ticket.tokenVersion);

  assert.deepEqual(authorizeTicketAccessToken(token, ticket, secret), {
    purpose: "ticket-session",
    ticketId: TEST_TICKET_ID,
    revisionNumber: 4,
    token,
  });
  assert.equal(
    authorizeTicketAccessToken(derivePurposeToken(secret, "ticket-session", TEST_ORDER_ID, ticket.tokenVersion), ticket, secret),
    null,
  );
  assert.equal(
    authorizeTicketAccessToken(derivePurposeToken(secret, "ticket-session", TEST_TICKET_ID, 8), ticket, secret),
    null,
  );
  assert.equal(authorizeTicketAccessToken(token, { ...ticket, status: "cancelled" }, secret), null);
});

test("failed purchaser bearer exchange is unauthorized and cannot set a cookie", async () => {
  const route = await import("../../app/api/case-lab-3/orders/[id]/access/route");
  const cookies = cookieStore();
  const response = await route.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${TEST_ORDER_ID}/access?token=${TEST_TOKEN}`),
    { params: Promise.resolve({ id: TEST_ORDER_ID }) },
    {
      exchangeOrderAccessToken: async () => null,
      getCookies: async () => cookies,
    },
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(cookies.writes, []);
});

test("ticket session codec keeps revision number, token version, and purpose distinct", async () => {
  const { parseTicketSession, serializeTicketSession } = await import("../../app/lib/case-lab-3/orders.server");
  const serialized = serializeTicketSession(
    { purpose: "ticket-session", ticketId: TEST_TICKET_ID, revisionNumber: 4, token: TEST_TOKEN },
    9,
  );
  assert.equal(serialized, `4.9.${TEST_TOKEN}`);
  assert.deepEqual(parseTicketSession(serialized), {
    purpose: "ticket-session",
    ticketId: "",
    revisionNumber: 4,
    tokenVersion: 9,
    token: TEST_TOKEN,
  });
  assert.equal(parseTicketSession(`9.${TEST_TOKEN}`), null);
});

test("status receipt selection keeps the earliest issued payment_income receipt", async () => {
  const { selectOriginalPaymentIncomeReceipt } = await import("../../app/lib/case-lab-3/orders.server");
  const receipt = selectOriginalPaymentIncomeReceipt([
    {
      id: "refund",
      policyPurpose: "refund_income_return",
      providerReceiptType: "IncomeReturn",
      status: "issued",
      receiptUrl: "https://example.test/refund",
      createdAt: "2026-09-07T10:02:00.000Z",
    },
    {
      id: "later-payment",
      policyPurpose: "payment_income",
      providerReceiptType: "Income",
      status: "issued",
      receiptUrl: "https://example.test/later",
      createdAt: "2026-09-07T10:01:00.000Z",
    },
    {
      id: "original-payment",
      policyPurpose: "payment_income",
      providerReceiptType: "Income",
      status: "issued",
      receiptUrl: "https://example.test/original",
      createdAt: "2026-09-07T10:00:00.000Z",
    },
  ]);
  assert.equal(receipt?.id, "original-payment");
  assert.equal(receipt?.receiptUrl, "https://example.test/original");
});

test("widget output uses integer minor-unit conversion and excludes automatic receipt/recurrent options", async () => {
  const { buildWidgetParams } = await import("../../app/lib/case-lab-3/tiptoppay-widget.server");
  const params = buildWidgetParams(
    {
      amountMinor: 789000,
      externalId: "cl3-attempt-001",
      receiptEmail: "buyer@example.test",
      orderOpaqueId: "order-opaque-001",
      firstName: "Ada",
      lastName: "Lovelace",
      phone: null,
    },
    "terminal-test",
  );

  assert.deepEqual(params, {
    publicTerminalId: "terminal-test",
    amount: 7890,
    currency: "KZT",
    paymentSchema: "Single",
    externalId: "cl3-attempt-001",
    receiptEmail: "buyer@example.test",
    emailBehavior: "Hidden",
    tokenize: false,
    retryPayment: false,
    userInfo: {
      accountId: "order-opaque-001",
      firstName: "Ada",
      lastName: "Lovelace",
      email: "buyer@example.test",
      phone: undefined,
    },
  });

  assert.equal("receipt" in params, false);
  assert.equal("recurrent" in params, false);
  assert.equal("tokenization" in params, false);
});
