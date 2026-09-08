import assert from "node:assert/strict";
import test from "node:test";

import "./server-only-test-loader";

const mailInput = {
  environment: "test" as const,
  operationKey: "email:ticket:00000000-0000-0000-0000-000000000002:00000000-0000-0000-0000-000000000003",
  recipientEmail: "participant@example.test",
  participant: { firstName: "Айдан", lastName: "Серикова" },
  ticket: {
    publicTicketNumber: "CL3-TICKET-001",
    participantUrl: "https://caselab.kz/case-lab-3/ticket/CL3-TICKET-001/",
  },
  pdf: Buffer.from("pdf-ticket"),
};

function fakeTransport() {
  const messages: Array<Record<string, unknown>> = [];
  return {
    messages,
    sendMail(message: Record<string, unknown>) {
      messages.push(message);
      return Promise.resolve({ messageId: message.messageId, accepted: [message.to], rejected: [] });
    },
  };
}

const config = {
  host: "smtp.mail.ru",
  port: 465,
  secure: true,
  user: "hello@caselab.kz",
  password: "smtp-password-not-for-logs",
  from: "hello@caselab.kz",
  alertEmail: "ops@example.test",
};

test("ticket email uses Mail.ru TLS, stable headers, PDF, and ticket-only access", async () => {
  const { sendTicketEmail } = await import("../../app/lib/case-lab-3/mail.server");
  const firstTransport = fakeTransport();
  const secondTransport = fakeTransport();
  const options = { config, getTransport: () => firstTransport as never };
  const first = await sendTicketEmail(mailInput, options);
  await sendTicketEmail(mailInput, { config, getTransport: () => secondTransport as never });
  const message = firstTransport.messages[0];
  const repeatedMessage = secondTransport.messages[0];

  assert.equal(first.status, "sent");
  assert.equal(message.from, "hello@caselab.kz");
  assert.equal(message.to, "participant@example.test");
  assert.equal(message.messageId, repeatedMessage.messageId);
  assert.match(String(message.html), /CL3-TICKET-001/u);
  assert.match(String(message.html), /ticket\/CL3-TICKET-001/u);
  assert.doesNotMatch(String(message.html), /purchaser|fiscal|refund|payment/iu);
  assert.deepEqual(message.attachments, [{
    filename: "case-lab-3-ticket-CL3-TICKET-001.pdf",
    content: mailInput.pdf,
    contentType: "application/pdf",
  }]);
});

test("refund and admin messages expose only their intended content", async () => {
  const { sendAdminAlert, sendRefundEmail } = await import("../../app/lib/case-lab-3/mail.server");
  const transport = fakeTransport();
  const options = { config, getTransport: () => transport as never };
  await sendRefundEmail({
    environment: "test",
    operationKey: "email:refund:00000000-0000-0000-0000-000000000004",
    recipientEmail: "purchaser@example.test",
    ticketNumber: "CL3-TICKET-001",
    refundReceiptUrl: "https://receipt.example.test/refund/1",
  }, options);
  await sendAdminAlert({
    environment: "test",
    operationKey: "email:alert:00000000-0000-0000-0000-000000000005",
    subject: "Case Lab III: требуется внимание",
    text: "Проверьте состояние операции в CRM.",
  }, options);

  assert.match(String(transport.messages[0]?.text), /билет отменен|средства возвращены/iu);
  assert.match(String(transport.messages[0]?.text), /refund\/1/u);
  assert.equal(transport.messages[1]?.to, "ops@example.test");
  assert.doesNotMatch(String(transport.messages[1]?.text), /participant@example|purchaser@example/iu);
});

test("Mail.ru timeout is unknown and thrown errors do not contain personal data", async () => {
  const { MailDeliveryError, sendTicketEmail } = await import("../../app/lib/case-lab-3/mail.server");
  const transport = { sendMail: async () => { throw Object.assign(new Error("timeout for participant@example.test"), { code: "ETIMEDOUT" }); } };

  await assert.rejects(
    sendTicketEmail(mailInput, { config, getTransport: () => transport as never }),
    (error: unknown) => {
      assert.ok(error instanceof MailDeliveryError);
      assert.equal(error.status, "unknown");
      assert.match(String(error), /Mail delivery failed/u);
      assert.equal(String(error).includes("participant@example.test"), false);
      return true;
    },
  );
});

test("mail adapter creates the production transport from the Mail.ru configuration", async () => {
  const { createMailTransport } = await import("../../app/lib/case-lab-3/mail.server");
  const seen: Record<string, unknown>[] = [];
  createMailTransport(config, (transportOptions) => {
    seen.push(transportOptions as Record<string, unknown>);
    return fakeTransport() as never;
  });
  assert.deepEqual(seen[0], {
    host: "smtp.mail.ru",
    port: 465,
    secure: true,
    auth: { user: "hello@caselab.kz", pass: "smtp-password-not-for-logs" },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 10_000,
  });
});
