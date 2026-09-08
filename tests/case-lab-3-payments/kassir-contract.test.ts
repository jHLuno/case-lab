import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import "./server-only-test-loader";
import {
  buildFiscalPayload,
  getReceiptDetails,
  getReceiptStatus,
  parseReceiptForm,
  queueReceipt,
  type KassirFiscalOperation,
  type KassirFiscalPolicy,
} from "../../app/lib/case-lab-3/kassir.server";

const FIXTURE_ROOT = "tests/fixtures/case-lab-3/kassir";
const SECRET = "fixture-kassir-secret-2026";
const TEST_ORDER_ID = "018f4c5e-7e75-4a12-a123-123456789abc";
const POLICY_DEFINITION = [
  {
    purpose: "payment_income",
    trigger: "payment_confirmed",
    depends_on_purpose: null,
    provider_receipt_type: "Income",
    payload_fields: {
      vat: "omitted_or_null",
      taxation_system: 0,
      calculation_place: "caselab.kz",
      calculation_method: "full_payment",
    },
    schedule: "immediate",
  },
  {
    purpose: "refund_income_return",
    trigger: "refund_confirmed",
    depends_on_purpose: "payment_income",
    provider_receipt_type: "IncomeReturn",
    payload_fields: {
      vat: "omitted_or_null",
      taxation_system: 0,
      calculation_place: "caselab.kz",
      calculation_method: "full_payment",
    },
    schedule: "after_dependency",
  },
] as const;

const policy: KassirFiscalPolicy = {
  environment: "test",
  sellerInn: "123456789012",
  policyDefinition: POLICY_DEFINITION,
};

function operation(overrides: Partial<KassirFiscalOperation> = {}): KassirFiscalOperation {
  return {
    environment: "test",
    id: "00000000-0000-4000-8000-000000000901",
    orderId: TEST_ORDER_ID,
    orderNumber: "CL3-TEST-001",
    accountId: TEST_ORDER_ID,
    operationKey: "fiscal:payment_income:payment-001",
    providerReceiptType: "Income",
    tier: "early_bird",
    receiptLabel: "Участие в Case Lab III, 24.09.2026, Early Bird",
    amountMinor: 789000,
    email: "buyer@example.test",
    payloadSnapshot: {
      calculationMethod: "full_payment",
    },
    ...overrides,
  };
}

async function fixture(name: string): Promise<string> {
  return readFile(`${FIXTURE_ROOT}/${name}`, "utf8");
}

test("builds the approved Early Bird and Standard income payloads", () => {
  const earlyBird = buildFiscalPayload(operation(), policy);
  const standard = buildFiscalPayload(
    operation({
      tier: "standard",
      receiptLabel: "Участие в Case Lab III, 24.09.2026, Стандарт",
      amountMinor: 1500000,
      operationKey: "fiscal:payment_income:payment-002",
    }),
    policy,
  );

  for (const [payload, label, amount] of [
    [earlyBird, "Участие в Case Lab III, 24.09.2026, Early Bird", 7890],
    [standard, "Участие в Case Lab III, 24.09.2026, Стандарт", 15000],
  ] as const) {
    assert.equal(payload.Inn, "123456789012");
    assert.equal(payload.Type, "Income");
    assert.equal(payload.CustomerReceipt.TaxationSystem, 0);
    assert.equal(payload.CustomerReceipt.CalculationPlace, "caselab.kz");
    assert.equal(payload.CustomerReceipt.Email, "buyer@example.test");
    assert.equal(payload.CustomerReceipt.Items.length, 1);
    assert.equal(payload.CustomerReceipt.Items[0]?.Label, label);
    assert.equal(payload.CustomerReceipt.Items[0]?.Quantity, 1);
    assert.equal(payload.CustomerReceipt.Items[0]?.Price, amount);
    assert.equal(payload.CustomerReceipt.Items[0]?.Amount, amount);
    assert.equal(payload.CustomerReceipt.Amounts.Electronic, amount);
    assert.equal(payload.CustomerReceipt.Amounts.Cash, 0);
    assert.equal("Vat" in payload.CustomerReceipt.Items[0]!, false);
  }
});

test("uses the actual partial refund amount and keeps the operation key stable", () => {
  const partial = buildFiscalPayload(
    operation({
      operationKey: "fiscal:refund_income_return:refund-001",
      providerReceiptType: "IncomeReturn",
      amountMinor: 123450,
      payloadSnapshot: {
        calculationMethod: "full_payment",
        tinyUrlRefundTarget: "https://receipt.example.test/original",
      },
    }),
    policy,
  );

  assert.equal(partial.Type, "IncomeReturn");
  assert.equal(partial.CustomerReceipt.Items[0]?.Price, 1234.5);
  assert.equal(partial.CustomerReceipt.Items[0]?.Amount, 1234.5);
  assert.equal(partial.CustomerReceipt.Amounts.Electronic, 1234.5);
  assert.equal(partial.CustomerReceipt.Amounts.Cash, 0);
  assert.equal(partial.CustomerReceipt.TinyUrlRefundTarget, "https://receipt.example.test/original");
  assert.equal(partial.AccountId, TEST_ORDER_ID);
});

test("rejects a fiscal policy with an unsupported stage or field", () => {
  assert.throws(
    () => buildFiscalPayload(operation(), {
      ...policy,
      policyDefinition: [
        ...POLICY_DEFINITION,
        {
          purpose: "service_settlement_income",
          trigger: "service_delivered",
          depends_on_purpose: "payment_income",
          provider_receipt_type: "Income",
          payload_fields: {
            vat: "omitted_or_null",
            taxation_system: 0,
            calculation_place: "caselab.kz",
            calculation_method: "unsupported_method",
          },
          schedule: "after_dependency",
        },
      ],
    }),
    /unsupported fiscal policy/i,
  );
});

test("uses Basic Auth, JSON UTF-8, the stable request key, and the ten-second boundary", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), init: init ?? {} });
    return new Response(await fixture("receipt-queued.json"), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const result = await queueReceipt("test", operation(), policy, {
    fetch: fakeFetch,
    getConfig: () => ({
      kassir: { publicId: "public-id", apiSecret: SECRET },
      seller: { inn: "123456789012" },
    }),
  });

  assert.equal(result.kind, "queued");
  assert.equal(result.receiptId, "kassir-receipt-001");
  assert.equal(requests[0]?.url, "https://api.tiptoppay.kz/kkt/receipt");
  const headers = new Headers(requests[0]?.init.headers);
  assert.equal(headers.get("content-type"), "application/json; charset=utf-8");
  assert.equal(headers.get("x-request-id"), "fiscal:payment_income:payment-001");
  assert.equal(headers.get("authorization"), `Basic ${Buffer.from(`public-id:${SECRET}`).toString("base64")}`);
  assert.deepEqual(JSON.parse(String(requests[0]?.init.body)).CustomerReceipt.Amounts, {
    Electronic: 7890,
    Cash: 0,
  });
  assert.equal(requests[0]?.init.signal instanceof AbortSignal, true);
});

test("status inspects Model and details are fetched only as a separate call", async () => {
  const urls: string[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    urls.push(url);
    if (url.endsWith("/status/get")) {
      return new Response(JSON.stringify({ Success: true, Model: "Processed" }), { status: 200 });
    }
    return new Response(JSON.stringify({
      Success: true,
      Model: { Id: "kassir-receipt-001", Url: "https://receipt.example.test/1" },
    }), { status: 200 });
  };
  const options = {
    fetch: fakeFetch,
    getConfig: () => ({ kassir: { publicId: "public-id", apiSecret: SECRET } }),
  };

  assert.equal((await getReceiptStatus("test", "kassir-receipt-001", options)).status, "Processed");
  const details = await getReceiptDetails("test", "kassir-receipt-001", options);
  assert.equal(details.model?.Url, "https://receipt.example.test/1");
  assert.deepEqual(urls, [
    "https://api.tiptoppay.kz/kkt/receipt/status/get",
    "https://api.tiptoppay.kz/kkt/receipt/get",
  ]);
});

test("receipt route verifies the raw signature before parsing and persists before code zero", async () => {
  const route = await import("../../app/api/kassir/[environment]/receipt/route");
  const body = await fixture("receipt-issued.form");
  let calls = 0;
  const response = await route.handlePost(
    new Request("https://caselab.kz/api/kassir/test/receipt", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
        "Content-HMAC": "1d35AzZRvuPl+LeiEJRfL7XwNtEtauMktRdZZP/s3Fc=",
      },
      body,
    }),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: () => SECRET,
      applyReceipt: async (_environment, payload) => {
        calls += 1;
        assert.equal(payload.id, "kassir-receipt-001");
        assert.equal(payload.amountMinor, 789000);
        return { kind: "accepted" };
      },
    },
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { code: 0 });
  assert.equal(calls, 1);

  const malformed = await route.handlePost(
    new Request("https://caselab.kz/api/kassir/test/receipt", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-HMAC": "pinned-fixture-signature",
      },
      body: "Id=valid&Type=Income&Amount=%ZZ",
    }),
    { params: Promise.resolve({ environment: "test" }) },
    { getSecret: () => SECRET, applyReceipt: async () => { throw new Error("must not persist"); } },
  );
  assert.equal(malformed.status, 200);
  assert.deepEqual(await malformed.json(), { code: 20 });
  assert.equal(calls, 1);
});

test("receipt parser returns strict durable identity without raw payload fields", async () => {
  const payload = parseReceiptForm(await fixture("receipt-issued.form"));
  assert.deepEqual(
    {
      id: payload.id,
      type: payload.type,
      amountMinor: payload.amountMinor,
      invoiceId: payload.invoiceId,
      accountId: payload.accountId,
      url: payload.url,
    },
    {
      id: "kassir-receipt-001",
      type: "Income",
      amountMinor: 789000,
      invoiceId: "CL3-TEST-001",
      accountId: TEST_ORDER_ID,
      url: "https://receipt.example.test/1",
    },
  );
  assert.equal("rawBody" in payload.sanitizedFields, false);
});
