import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import "./server-only-test-loader";

const ORDER_ID = "00000000-0000-4000-8000-000000000001";
const TICKET_ID = "00000000-0000-4000-8000-000000000002";
const TOKEN = "a".repeat(43);

function cookies(values: Record<string, string>) {
  return {
    get(name: string) {
      const value = values[name];
      return value ? { value } : undefined;
    },
  };
}

const ticket = {
  ticketId: TICKET_ID,
  publicTicketNumber: "CL3-TICKET-001",
  revisionId: "00000000-0000-4000-8000-000000000003",
  revisionNumber: 1,
  tokenVersion: 1,
  status: "valid" as const,
  firstName: "Айдан",
  lastName: "Серикова",
  qrPayload: `cl3:${TICKET_ID}:1:${TOKEN}`,
  manualCode: "ABCDEFGHJK",
  eventName: "Case Lab III",
  eventDate: "24 сентября 2026",
  eventTime: "10:00–14:00",
  venue: "Narxoz Business School, Алматы",
  supportEmail: "hello@caselab.kz",
  qrDataUrl: "data:image/png;base64,qr",
  pdfUrl: `/api/case-lab-3/orders/${ORDER_ID}/ticket.pdf`,
};

test("purchaser and participant sessions authorize the same current PDF through separate paths", async () => {
  const route = await import("../../app/api/case-lab-3/orders/[id]/ticket.pdf/route");
  const pdf = Buffer.from("%PDF-1.7 protected ticket");
  const baseDependencies = {
    renderTicketPdf: async () => pdf,
    getTicketRevisionForPdf: async () => ticket,
  };
  const purchaser = await route.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${ORDER_ID}/ticket.pdf`),
    { params: Promise.resolve({ id: ORDER_ID }) },
    {
      ...baseDependencies,
      getPurchaserOrderView: async () => ({ ticket }),
      getCookies: async () => cookies({ cl3_order_session: `1.${TOKEN}` }),
    } as never,
  );
  assert.equal(purchaser.status, 200);
  assert.equal(purchaser.headers.get("cache-control"), "no-store");
  assert.match(purchaser.headers.get("x-robots-tag") ?? "", /noindex/u);
  assert.equal(purchaser.headers.get("content-type"), "application/pdf");

  const participant = await route.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${ORDER_ID}/ticket.pdf`),
    { params: Promise.resolve({ id: ORDER_ID }) },
    {
      ...baseDependencies,
      getPurchaserOrderView: async () => { throw new Error("not purchaser"); },
      getTicketRevisionForPdf: async () => ticket,
      getCookies: async () => cookies({ cl3_ticket_session: `1.1.${TOKEN}` }),
    } as never,
  );
  assert.equal(participant.status, 200);
  assert.equal(participant.headers.get("cache-control"), "no-store");
});

test("unauthorized PDF access cannot reveal order or fiscal data", async () => {
  const route = await import("../../app/api/case-lab-3/orders/[id]/ticket.pdf/route");
  const response = await route.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${ORDER_ID}/ticket.pdf`),
    { params: Promise.resolve({ id: ORDER_ID }) },
    {
      getCookies: async () => cookies({}),
      getPurchaserOrderView: async () => { throw new Error("no access"); },
      getTicketRevisionForPdf: async () => { throw new Error("no access"); },
      renderTicketPdf: async () => Buffer.from("never"),
    } as never,
  );
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/u);
  assert.deepEqual(await response.json(), { error: "unauthorized" });
});

test("protected status and access responses are no-store and noindex", async () => {
  const statusRoute = await import("../../app/api/case-lab-3/orders/[id]/status/route");
  const orderAccessRoute = await import("../../app/api/case-lab-3/orders/[id]/access/route");
  const ticketAccessRoute = await import("../../app/api/case-lab-3/tickets/[number]/access/route");
  const emptyCookies = async () => ({
    get: (name: string) => cookies({}).get(name),
    set() {},
  });
  const assertProtectedHeaders = (response: Response) => {
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/u);
  };

  const status = await statusRoute.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${ORDER_ID}/status`),
    { params: Promise.resolve({ id: ORDER_ID }) },
    { getOrderStatus: async () => { throw new Error("not reached"); }, getCookies: emptyCookies },
  );
  assert.equal(status.status, 401);
  assertProtectedHeaders(status);

  const orderAccess = await orderAccessRoute.handleGet(
    new Request("https://caselab.kz/api/case-lab-3/orders/not-an-order/access"),
    { params: Promise.resolve({ id: "not-an-order" }) },
    { exchangeOrderAccessToken: async () => null, getCookies: emptyCookies },
  );
  assert.equal(orderAccess.status, 401);
  assertProtectedHeaders(orderAccess);

  const ticketAccess = await ticketAccessRoute.handleGet(
    new Request("https://caselab.kz/api/case-lab-3/tickets/CL3-TICKET-001/access"),
    { params: Promise.resolve({ number: "CL3-TICKET-001" }) },
    { exchangeTicketAccessToken: async () => null, getCookies: emptyCookies },
  );
  assert.equal(ticketAccess.status, 401);
  assertProtectedHeaders(ticketAccess);
});

test("protected status and access service failures are generic 500 responses", async () => {
  const statusRoute = await import("../../app/api/case-lab-3/orders/[id]/status/route");
  const orderAccessRoute = await import("../../app/api/case-lab-3/orders/[id]/access/route");
  const ticketAccessRoute = await import("../../app/api/case-lab-3/tickets/[number]/access/route");
  const authorization = { Authorization: `Bearer ${TOKEN}` };

  const status = await statusRoute.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${ORDER_ID}/status`),
    { params: Promise.resolve({ id: ORDER_ID }) },
    {
      getOrderStatus: async () => { throw new Error("database password"); },
      getCookies: async () => cookies({ cl3_order_session: `1.${TOKEN}` }),
    } as never,
  );
  assert.equal(status.status, 500);
  assert.deepEqual(await status.json(), { error: "service_unavailable" });

  const orderAccess = await orderAccessRoute.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${ORDER_ID}/access`, { headers: authorization }),
    { params: Promise.resolve({ id: ORDER_ID }) },
    {
      exchangeOrderAccessToken: async () => { throw new Error("config secret"); },
      getCookies: async () => cookies({}),
    } as never,
  );
  assert.equal(orderAccess.status, 500);
  assert.deepEqual(await orderAccess.json(), { error: "service_unavailable" });

  const ticketAccess = await ticketAccessRoute.handleGet(
    new Request("https://caselab.kz/api/case-lab-3/tickets/CL3-TICKET-001/access", { headers: authorization }),
    { params: Promise.resolve({ number: "CL3-TICKET-001" }) },
    {
      exchangeTicketAccessToken: async () => { throw new Error("database secret"); },
      getCookies: async () => cookies({}),
    } as never,
  );
  assert.equal(ticketAccess.status, 500);
  assert.deepEqual(await ticketAccess.json(), { error: "service_unavailable" });
});

test("internal protected-page failures stay generic 500 responses instead of becoming 404s", async () => {
  const route = await import("../../app/api/case-lab-3/orders/[id]/ticket.pdf/route");
  const response = await route.handleGet(
    new Request(`https://caselab.kz/api/case-lab-3/orders/${ORDER_ID}/ticket.pdf`),
    { params: Promise.resolve({ id: ORDER_ID }) },
    {
      getCookies: async () => cookies({ cl3_order_session: `1.${TOKEN}` }),
      getPurchaserOrderView: async () => { throw new Error("database credentials leaked"); },
      getTicketRevisionForPdf: async () => { throw new Error("not reached"); },
      renderTicketPdf: async () => Buffer.from("never"),
    } as never,
  );
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.match(response.headers.get("x-robots-tag") ?? "", /noindex/u);
  assert.deepEqual(await response.json(), { error: "service_unavailable" });
});

test("protected pages include dynamic params, no-store behavior, noindex metadata, and scoped sessions", async () => {
  const paths = [
    "app/case-lab-3/order/[id]/page.tsx",
    "app/case-lab-3/order/[id]/OrderStatusClient.tsx",
    "app/case-lab-3/order/[id]/order.module.css",
    "app/case-lab-3/ticket/[number]/page.tsx",
    "app/case-lab-3/ticket/[number]/ticket.module.css",
    "app/components/case-lab-3/TicketView.tsx",
  ];
  const sources = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  const pageSources = [sources[0], sources[3]];
  for (const source of pageSources) {
    assert.match(source, /params\s*:\s*Promise/u);
    assert.match(source, /noindex|index:\s*false/u);
    assert.match(source, /no-store|force-no-store/u);
  }
  assert.match(sources[1], /cache:\s*"no-store"/u);
  assert.match(sources[3], /parseTicketSession/u);
  assert.match(sources[0], /parseOrderSession/u);
  assert.match(sources[5], /manualCode/u);
});

test("protected pages distinguish authorization failures from internal failures", async () => {
  const paths = [
    "app/case-lab-3/order/[id]/page.tsx",
    "app/case-lab-3/ticket/[number]/page.tsx",
  ];
  const sources = await Promise.all(paths.map((path) => readFile(path, "utf8")));
  for (const source of sources) {
    assert.match(source, /TicketAuthorizationError/u);
    assert.match(source, /instanceof TicketAuthorizationError\)\s*notFound\(\)/u);
    assert.match(source, /throw new Error\(["']Protected page unavailable["']\)/u);
    assert.doesNotMatch(source, /catch\s*\{\s*notFound\(\)/u);
  }
});
