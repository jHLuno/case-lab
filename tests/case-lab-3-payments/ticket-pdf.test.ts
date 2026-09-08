import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import "./server-only-test-loader";

const ORDER_ID = "00000000-0000-4000-8000-000000000001";
const TICKET_ID = "00000000-0000-4000-8000-000000000002";
const REVISION_ID = "00000000-0000-4000-8000-000000000003";
const SECRET = "ticket-test-secret-2026-0123456789";

process.env.CASE_LAB_3_PAYMENT_MODE = "test";

function ticketClient(currentRevisionNumber = 2) {
  const order = {
    id: ORDER_ID,
    order_number: "CL3-ORDER-001",
    environment: "test",
    order_access_token_version: 1,
    order_access_revoked_at: null,
    first_name: "Айдан",
    last_name: "Серикова",
    participant_email: "participant@example.test",
    purchaser_email: "purchaser@example.test",
    fiscal_email: "purchaser@example.test",
    phone: null,
    company: "Case Lab",
    position: "Маркетолог",
    tier: "standard",
    amount_minor: 1500000,
    currency: "KZT",
    receipt_label: "Участие в Case Lab III, 24.09.2026, Стандарт",
    payment_status: "paid",
    ticket_status: "valid",
    receipt_status: "issued",
    email_status: "sent",
    paid_amount_minor: 1500000,
    refunded_amount_minor: 0,
    refundable_amount_minor: 1500000,
    reservation_expires_at: null,
    refunded_at: null,
  };
  const ticket = {
    id: TICKET_ID,
    order_id: ORDER_ID,
    environment: "test",
    public_ticket_number: "CL3-TICKET-001",
    current_revision_id: REVISION_ID,
    status: "valid",
  };
  const revision = {
    id: REVISION_ID,
    ticket_id: TICKET_ID,
    environment: "test",
    revision_number: currentRevisionNumber,
    first_name: "Айдан",
    last_name: "Серикова",
    participant_email: "participant@example.test",
    phone: null,
    company: "Case Lab",
    position: "Маркетолог",
    token_version: currentRevisionNumber,
  };
  const calls = new Map<string, number>();
  return {
    calls,
    from(table: string) {
      const call = (selection: string) => {
        const key = `${table}:${selection}`;
        const count = calls.get(key) ?? 0;
        calls.set(key, count + 1);
        if (table === "case_lab_3_orders") return { data: count === 0 ? { ...order } : { ...order }, error: null };
        if (table === "case_lab_3_tickets") return { data: { ...ticket }, error: null };
        return { data: { ...revision }, error: null };
      };
      let selection = "";
      const query = {
        select(value: string) {
          selection = value;
          return query;
        },
        eq() {
          return query;
        },
        maybeSingle() {
          return Promise.resolve(call(selection));
        },
      };
      return query;
    },
  };
}

function pdfRevision(manualCode: string) {
  return {
    ticketId: TICKET_ID,
    publicTicketNumber: "CL3-TICKET-001",
    revisionId: REVISION_ID,
    revisionNumber: 2,
    tokenVersion: 2,
    status: "valid" as const,
    firstName: "Айдан",
    lastName: "Серикова",
    qrPayload: `cl3:${TICKET_ID}:2:${"a".repeat(43)}`,
    manualCode,
    eventName: "Case Lab III",
    eventDate: "24 сентября 2026",
    eventTime: "10:00–14:00",
    venue: "Narxoz Business School, Алматы",
    supportEmail: "hello@caselab.kz",
    pdfUrl: "https://caselab.kz/api/case-lab-3/orders/00000000-0000-0000-0000-000000000001/ticket.pdf",
  };
}

test("ticket presentation keeps purchaser fields out of the participant view", async () => {
  process.env.CASE_LAB_3_TOKEN_SECRET = SECRET;
  const { derivePurposeToken } = await import("../../app/lib/case-lab-3/tokens.server");
  const { getParticipantTicketView, getPurchaserOrderView } = await import("../../app/lib/case-lab-3/ticket.server");

  const orderSession = {
    purpose: "order-session" as const,
    orderId: ORDER_ID,
    version: 1,
    token: derivePurposeToken(SECRET, "order-session", ORDER_ID, 1),
  };
  const purchaserView = await getPurchaserOrderView(orderSession, ORDER_ID, ticketClient() as never);
  assert.equal(purchaserView.order.purchaserEmail, "purchaser@example.test");
  assert.equal(purchaserView.order.fiscalEmail, "purchaser@example.test");
  assert.equal(purchaserView.ticket?.publicTicketNumber, "CL3-TICKET-001");

  const participantSession = {
    purpose: "ticket-session" as const,
    ticketId: TICKET_ID,
    revisionNumber: 2,
    token: derivePurposeToken(SECRET, "ticket-session", TICKET_ID, 2),
  };
  const participantView = await getParticipantTicketView(participantSession, "CL3-TICKET-001", ticketClient() as never);
  assert.equal(participantView.ticket.participant.firstName, "Айдан");
  assert.equal("purchaserEmail" in participantView, false);
  assert.equal("fiscalEmail" in participantView, false);
  assert.equal("receiptStatus" in participantView, false);
  assert.equal("emailStatus" in participantView, false);
  assert.equal(participantView.ticket.manualCode.length, 10);
  assert.match(participantView.ticket.qrPayload, /^cl3:[0-9a-f-]{36}:2:[A-Za-z0-9_-]{43}$/u);
});

test("an old ticket revision cannot authorize the current participant page", async () => {
  process.env.CASE_LAB_3_TOKEN_SECRET = SECRET;
  const { derivePurposeToken } = await import("../../app/lib/case-lab-3/tokens.server");
  const { getParticipantTicketView, TicketAuthorizationError } = await import("../../app/lib/case-lab-3/ticket.server");
  const oldSession = {
    purpose: "ticket-session" as const,
    ticketId: TICKET_ID,
    revisionNumber: 1,
    token: derivePurposeToken(SECRET, "ticket-session", TICKET_ID, 1),
  };

  await assert.rejects(
    getParticipantTicketView(oldSession, "CL3-TICKET-001", ticketClient(2) as never),
    TicketAuthorizationError,
  );
});

test("purchaser view binds the URL order id to a parsed order session", async () => {
  process.env.CASE_LAB_3_TOKEN_SECRET = SECRET;
  const { derivePurposeToken } = await import("../../app/lib/case-lab-3/tokens.server");
  const { getPurchaserOrderView } = await import("../../app/lib/case-lab-3/ticket.server");
  const parsedSession = {
    purpose: "order-session" as const,
    orderId: "",
    version: 1,
    token: derivePurposeToken(SECRET, "order-session", ORDER_ID, 1),
  };

  const view = await getPurchaserOrderView(parsedSession, ORDER_ID, ticketClient() as never);
  assert.equal(view.order.id, ORDER_ID);
});

test("ticket PDF contains the event and participant contract without provider secrets", async () => {
  process.env.CASE_LAB_3_TOKEN_SECRET = SECRET;
  const { deriveManualCheckInCode } = await import("../../app/lib/case-lab-3/tokens.server");
  const { renderTicketPdf } = await import("../../app/lib/case-lab-3/pdf.server");
  const manualCode = deriveManualCheckInCode(SECRET, TICKET_ID, 2);
  const pdf = await renderTicketPdf(pdfRevision(manualCode));

  assert.match(pdf.toString("latin1"), /%PDF-/u);
  assert.ok(pdf.length > 1000);
  assert.ok(pdf.includes(Buffer.from("Case Lab III", "utf8")));
  assert.ok(pdf.includes(Buffer.from("CL3-TICKET-001", "utf8")));
  assert.equal(pdf.includes(Buffer.from("provider-api-secret", "utf8")), false);
  assert.equal(pdf.includes(Buffer.from("4111111111111111", "utf8")), false);
});

test("ticket PDF bytes are deterministic for the same immutable revision", async () => {
  process.env.CASE_LAB_3_TOKEN_SECRET = SECRET;
  const { deriveManualCheckInCode } = await import("../../app/lib/case-lab-3/tokens.server");
  const { renderTicketPdf } = await import("../../app/lib/case-lab-3/pdf.server");
  const manualCode = deriveManualCheckInCode(SECRET, TICKET_ID, 2);

  const first = await renderTicketPdf(pdfRevision(manualCode));
  const second = await renderTicketPdf(pdfRevision(manualCode));

  assert.deepEqual(second, first);
});

test("Task 11 protected files exist and use the protected page primitives", async () => {
  const files = [
    "app/case-lab-3/order/[id]/page.tsx",
    "app/case-lab-3/ticket/[number]/page.tsx",
    "app/api/case-lab-3/orders/[id]/ticket.pdf/route.ts",
  ];
  const sources = await Promise.all(files.map((file) => readFile(file, "utf8")));
  for (const source of sources) {
    assert.match(source, /force-dynamic/u);
    assert.match(source, /noindex|index:\s*false/u);
    assert.match(source, /no-store|force-no-store/u);
  }
});
