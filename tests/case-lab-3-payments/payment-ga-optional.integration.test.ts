import assert from "node:assert/strict";
import test from "node:test";

import "./server-only-test-loader";
import { createPaymentAttempt, issueOrderSession } from "../../app/lib/case-lab-3/orders.server";

const TEST_ORDER_ID = "00000000-0000-4000-8000-000000000001";
const TEST_ATTEMPT_ID = "00000000-0000-4000-8000-000000000002";
const TOKEN_SECRET = "t".repeat(32);

test("payment attempt creation succeeds in sandbox without GA4 credentials", async () => {
  const environment = {
    CASE_LAB_3_PAYMENT_MODE: "test",
    TIPTOP_TEST_TERMINAL_ID: "test-terminal",
    TIPTOP_TEST_PUBLIC_ID: "test-public",
    TIPTOP_TEST_API_SECRET: "test-tiptop-secret",
    KASSIR_TEST_PUBLIC_ID: "test-kassir-public",
    KASSIR_TEST_API_SECRET: "test-kassir-secret",
    KASSIR_SELLER_INN: "test-seller-inn",
    SMTP_HOST: "smtp.example.test",
    SMTP_PORT: "465",
    SMTP_SECURE: "true",
    SMTP_USER: "smtp-user",
    SMTP_PASSWORD: "smtp-password",
    SMTP_FROM: "hello@example.test",
    CASE_LAB_3_ALERT_EMAIL: "alerts@example.test",
    CASE_LAB_3_TOKEN_SECRET: TOKEN_SECRET,
    CASE_LAB_3_CRON_SECRET: "c".repeat(32),
    NEXT_PUBLIC_SUPABASE_URL: "https://supabase.example.test",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  } as const;
  const previousEnvironment = new Map<string, string | undefined>();
  for (const [name, value] of Object.entries(environment)) {
    previousEnvironment.set(name, process.env[name]);
    process.env[name] = value;
  }

  const previousFetch = globalThis.fetch;
  globalThis.fetch = async (input) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    if (url.includes("/rest/v1/case_lab_3_orders")) {
      return new Response(JSON.stringify({
        id: TEST_ORDER_ID,
        environment: "test",
        amount_minor: 1500000,
        participant_email: "participant@example.test",
        first_name: "Test",
        last_name: "Buyer",
        phone: null,
        order_access_token_version: 1,
        order_access_revoked_at: null,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.includes("/rest/v1/rpc/case_lab_3_create_payment_attempt")) {
      return new Response(JSON.stringify({
        attempt_id: TEST_ATTEMPT_ID,
        external_id: "cl3-test-attempt",
        reservation_expires_at: "2026-09-08T10:15:00.000Z",
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    throw new Error(`Unexpected Supabase request: ${url}`);
  };

  try {
    const result = await createPaymentAttempt(TEST_ORDER_ID, issueOrderSession(TEST_ORDER_ID));
    assert.equal(result.attemptId, TEST_ATTEMPT_ID);
    assert.equal(result.widget.publicTerminalId, "test-terminal");
    assert.equal(result.widget.amount, 15000);
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of previousEnvironment) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
