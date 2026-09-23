import assert from "node:assert/strict";
import test from "node:test";

import "./server-only-test-loader";

import { handlePost, type InternalTicketPdfDependencies } from "../../app/api/internal/case-lab-3/tickets/pdf/route";

const CRON_SECRET = "production-cron-secret-123456789012345";
const TOKEN_SECRET = "production-token-secret-123456789012345";

function request(body: unknown, authorization = `Bearer ${CRON_SECRET}`): Request {
  return new Request("https://caselab.kz/api/internal/case-lab-3/tickets/pdf", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function dependencies(overrides: Partial<InternalTicketPdfDependencies> = {}): InternalTicketPdfDependencies {
  return {
    getCronSecret: () => CRON_SECRET,
    getTokenSecret: () => TOKEN_SECRET,
    getTickets: async () => [{
      ticketId: "49aaa13e-8c8d-4ad9-9cc5-d37a74790e22",
      publicTicketNumber: "CL3-TICKET-8A05E4FDB691",
      status: "valid",
      revisionId: "de2cb469-c689-4e4a-8a5a-21330069da78",
      revisionNumber: 1,
      tokenVersion: 1,
      firstName: "Terminal",
      lastName: "Logistics Services",
    }],
    renderTicketPdf: async () => Buffer.from("pdf-bytes"),
    ...overrides,
  };
}

test("internal ticket PDF export requires the cron secret", async () => {
  const response = await handlePost(request({ orderIds: [] }, "Bearer wrong-secret"), dependencies());

  assert.equal(response.status, 401);
});

test("internal ticket PDF export returns rendered PDFs for requested orders", async () => {
  let requestedIds: string[] = [];
  const response = await handlePost(
    request({ orderIds: ["3fc3a4c3-d230-46be-a396-4b2cc097beec"] }),
    dependencies({ getTickets: async (orderIds) => {
      requestedIds = orderIds;
      return dependencies().getTickets(orderIds);
    } }),
  );

  assert.equal(response.status, 200);
  assert.deepEqual(requestedIds, ["3fc3a4c3-d230-46be-a396-4b2cc097beec"]);
  assert.deepEqual(await response.json(), {
    files: [{
      ticketNumber: "CL3-TICKET-8A05E4FDB691",
      pdfBase64: Buffer.from("pdf-bytes").toString("base64"),
    }],
  });
});
