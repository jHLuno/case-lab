import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { providerHmacModule } from "./server-only-test-loader";
import {
  findInvoiceOperations,
  getTransaction,
  listTransactionsPage,
  paginateTransactions,
  parseCheck,
  parseFail,
  parseFormPayload,
  parsePay,
  parseRefund,
  refundPayment,
  type TipTopApiResponse,
  type TipTopCheck,
  type TipTopFail,
  type TipTopJsonObject,
  type TipTopPay,
  type TipTopRefund,
  type TipTopTransitionResult,
  type TipTopWebhookContext,
} from "../../app/lib/case-lab-3/tiptoppay.server";

const SECRET = "fixture-secret-2026";
const FIXTURE_ROOT = "tests/fixtures/case-lab-3/tiptoppay";
const SIGNATURES = {
  "check-cyrillic.form": "+rjISSRvuc7ezdUkFKVIrw45ExbSSJz+SxXjMoYWUEo=",
  "check-plus-space.form": "OJoVqRVAHd/+UozilcNXMA+QANDAbQcIdS+aJ/8sTP4=",
  "check-percent-encoded.form": "HzybFnIN5h2ggAm4doxFVmvlOuYUydJPQzAQ19S4g9c=",
  "check-duplicate-parameters.form": "ZGDDYj5BME81nOVa1XEYPyk3/J5EbSnf9BsfOjLxOlU=",
  "pay-completed.form": "aOqdzbb5ihR0U2NcXjM3KrcwgnkyPFGkmD/J5ambHCM=",
  "fail-late.form": "zpoOMyBcjiklOm6V4+p9aJejAiYsNPB7St/ovY1iF8g=",
  "refund.form": "dJR+U8vmrpVXIAf8yDJxH9ydFPF93RkZedVcEyfJ4mE=",
} as const;

async function fixture(name: keyof typeof SIGNATURES): Promise<string> {
  const body = await readFile(`${FIXTURE_ROOT}/${name}`, "utf8");
  return body.endsWith("\n") ? body.slice(0, -1) : body;
}

function signedRequest(path: string, body: string, signature: string): Request {
  return new Request(`https://caselab.kz${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded; charset=utf-8",
      "Content-HMAC": signature,
    },
    body,
  });
}

function signedRequestWithSecret(path: string, body: string, secret = SECRET): Request {
  return signedRequest(path, body, createHmac("sha256", secret).update(body).digest("base64"));
}

async function captureWarnings<T>(action: () => Promise<T>): Promise<{ result: T; warnings: unknown[][] }> {
  const warnings: unknown[][] = [];
  const originalWarn = console.warn;
  console.warn = (...args) => warnings.push(args);
  try {
    return { result: await action(), warnings };
  } finally {
    console.warn = originalWarn;
  }
}

async function responseCode(response: Response): Promise<number> {
  assert.equal(response.headers.get("content-type"), "application/json");
  const body = await response.json() as { code?: unknown };
  assert.equal(typeof body.code, "number");
  return body.code as number;
}

test("the pinned OpenSSL control vector verifies exact raw bytes and rejects one byte changes", async () => {
  const { verifyProviderHmac } = await providerHmacModule;
  const body = await fixture("check-cyrillic.form");
  const headers = new Headers({ "Content-HMAC": SIGNATURES["check-cyrillic.form"] });

  assert.equal(verifyProviderHmac(body, headers, SECRET, "raw-body"), true);
  assert.equal(verifyProviderHmac(`${body} `, headers, SECRET, "raw-body"), false);
  assert.equal(verifyProviderHmac(body, new Headers({ "X-Content-HMAC": headers.get("Content-HMAC")! }), SECRET, "raw-body"), false);
});

test("form parsing applies HTML form decoding but rejects duplicates and malformed escapes", async () => {
  const plus = parseFormPayload(await fixture("check-plus-space.form"));
  assert.equal(plus.Name, "Jane Doe");
  assert.equal(plus.Description, "plus+space value");

  const percent = parseFormPayload(await fixture("check-percent-encoded.form"));
  assert.equal(percent.Name, "Айдан");

  const duplicate = await fixture("check-duplicate-parameters.form");
  assert.throws(() => parseFormPayload(duplicate), /invalid tiptop webhook payload/i);
  assert.throws(() => parseFormPayload("InvoiceId=%ZZ"), /invalid tiptop webhook payload/i);
});

test("Check accepts repeated SubscriptionId values without retaining the non-recurring field", async () => {
  const route = await import("../../app/api/tiptoppay/[environment]/check/route");
  const baseBody = await fixture("check-percent-encoded.form");
  const body = `${baseBody}&SubscriptionId=sub-001&SubscriptionId=sub-001`;
  let seenPayload: TipTopCheck | undefined;
  const response = await route.handlePost(
    signedRequestWithSecret("/api/tiptoppay/test/check", body),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: () => SECRET,
      applyCheck: async (_environment: "test" | "live", payload: TipTopCheck) => {
        seenPayload = payload;
        return { kind: "accepted", code: 0 };
      },
    },
  );

  assert.equal(await responseCode(response), 0);
  assert.equal("SubscriptionId" in (seenPayload as unknown as Record<string, unknown>), false);
  assert.equal(parseFormPayload(`${baseBody}&SubscriptionId=&SubscriptionId=`).SubscriptionId, undefined);
  assert.throws(
    () => parseFormPayload(`${baseBody}&SubscriptionId=sub-001&SubscriptionId=`),
    /invalid tiptop webhook payload/i,
  );
});

test("Check accepts empty documented optional fields after HMAC verification", async () => {
  const route = await import("../../app/api/tiptoppay/[environment]/check/route");
  const baseBody = await fixture("check-percent-encoded.form");
  const body = `${baseBody.replace("Name=%D0%90%D0%B9%D0%B4%D0%B0%D0%BD", "Name=")}&Email=&Description=&SubscriptionId=`;
  let seenPayload: TipTopCheck | undefined;
  const response = await route.handlePost(
    signedRequestWithSecret("/api/tiptoppay/test/check", body),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: () => SECRET,
      applyCheck: async (_environment: "test" | "live", payload: TipTopCheck) => {
        seenPayload = payload;
        return { kind: "accepted", code: 0 };
      },
    },
  );

  assert.equal(await responseCode(response), 0);
  assert.equal(seenPayload?.name, undefined);
});

test("Check treats Data and CustomFields as opaque body-bounded provider fields", async () => {
  const route = await import("../../app/api/tiptoppay/[environment]/check/route");
  const baseBody = await fixture("check-percent-encoded.form");
  const longData = JSON.stringify({ providerMetadata: "x".repeat(3000) });
  const cases = [
    longData,
    '{\n\t"provider": "tiptop"\r\n}',
    "",
  ];

  for (const data of cases) {
    const body = `${baseBody}&Data=${encodeURIComponent(data)}&CustomFields=${encodeURIComponent(longData)}`;
    let calls = 0;
    const response = await route.handlePost(
      signedRequestWithSecret("/api/tiptoppay/test/check", body),
      { params: Promise.resolve({ environment: "test" }) },
      {
        getSecret: () => SECRET,
        applyCheck: async () => {
          calls += 1;
          return { kind: "accepted", code: 0 };
        },
      },
    );

    assert.ok(longData.length > 2048);
    assert.equal(await responseCode(response), 0);
    assert.equal(calls, 1);
  }
});

test("Check keeps required values strict when their form values are empty", async () => {
  const baseBody = await fixture("check-percent-encoded.form");
  for (const field of [
    "TransactionId",
    "Amount",
    "Currency",
    "OperationType",
    "InvoiceId",
    "AccountId",
    "DateTime",
    "TestMode",
    "Status",
  ]) {
    const body = baseBody.replace(new RegExp(`${field}=[^&]*`), `${field}=`);
    const fields = parseFormPayload(body);
    assert.equal(fields[field], "", field);
    assert.throws(() => parseCheck(fields), /invalid tiptop webhook payload/i, field);
  }
});

test("typed parsers keep only strict, provider-documented transition data", async () => {
  const check = parseCheck(parseFormPayload(await fixture("check-plus-space.form")));
  assert.deepEqual(check, {
    transactionId: "12346",
    amountMinor: 789000,
    currency: "KZT",
    invoiceId: "cl3-attempt-plus",
    accountId: "order-plus",
    testMode: true,
    status: "Authorized",
    operationType: "Payment",
    name: "Jane Doe",
  });

  const pay = parsePay(parseFormPayload(await fixture("pay-completed.form")));
  assert.equal(pay.status, "Completed");
  assert.equal(pay.operationType, "Payment");

  const fail = parseFail(parseFormPayload(await fixture("fail-late.form")));
  assert.equal(fail.failureCode, "failed");
  assert.equal(fail.failureReason, "InsufficientFunds");

  const refund = parseRefund(parseFormPayload(await fixture("refund.form")));
  assert.equal(refund.transactionId, "77777");
  assert.equal(refund.paymentTransactionId, "12345");
  assert.equal(refund.invoiceId, "order-001");
  assert.equal(refund.operationKey, "refund-op-001");

  assert.throws(() => parsePay(parseFormPayload("TransactionId=1&Amount=Infinity&Currency=KZT&DateTime=x&TestMode=true&Status=Completed&OperationType=Payment&InvoiceId=x&AccountId=x")), /invalid/i);
  assert.throws(() => parseRefund(parseFormPayload("TransactionId=1&PaymentTransactionId=2&Amount=1&Currency=USD&DateTime=x&TestMode=true&Status=Completed&OperationType=Refund&InvoiceId=x&AccountId=x")), /invalid/i);
});

test("Fail accepts the undocumented status omission, validates charged amount/currency, and maps issuer declines to failed", () => {
  const fail = parseFail(parseFormPayload(
    "TransactionId=12345&Amount=15000.00&Currency=KZT&PaymentAmount=15000.00&PaymentCurrency=KZT&DateTime=2026-09-08T00%3A00%3A00Z&TestMode=1&Reason=InsufficientFunds&ReasonCode=5051&OperationType=Payment",
  ));

  assert.equal(fail.status, undefined);
  assert.equal(fail.invoiceId, "12345");
  assert.equal(fail.accountId, undefined);
  assert.equal(fail.testMode, true);
  assert.equal(fail.failureCode, "failed");
});

test("Pay accepts binary TestMode and documented optional fields but rejects amount or currency mismatches", () => {
  const body = "TransactionId=12345&Amount=15000.00&Currency=KZT&DateTime=2026-09-08T00%3A00%3A00Z&TestMode=0&Status=Completed&OperationType=Payment";
  const pay = parsePay(parseFormPayload(body));

  assert.equal(pay.testMode, false);
  assert.equal(pay.invoiceId, "12345");
  assert.equal(pay.accountId, undefined);
  assert.doesNotThrow(() => parsePay(parseFormPayload(`${body}&PaymentAmount=15000.00&PaymentCurrency=KZT`)));
  assert.throws(() => parsePay(parseFormPayload(`${body}&PaymentAmount=14999.99&PaymentCurrency=KZT`)), /invalid/i);
  assert.throws(() => parsePay(parseFormPayload(`${body}&PaymentAmount=15000.00&PaymentCurrency=USD`)), /invalid/i);

  const withoutTestMode = parsePay(parseFormPayload(body.replace("&TestMode=0", "")));
  assert.equal(withoutTestMode.testMode, undefined);
});

test("Pay accepts the full provider payload when it adds InstallmentTerm", async () => {
  const route = await import("../../app/api/tiptoppay/[environment]/pay/route");
  const body = [
    "TransactionId=12345",
    "Amount=15000.00",
    "Currency=KZT",
    "PaymentAmount=15000.00",
    "PaymentCurrency=KZT",
    "OperationType=Payment",
    "InvoiceId=cl3-attempt-001",
    "AccountId=order-001",
    "Name=",
    "Email=buyer%40example.test",
    "DateTime=2026-09-08T00%3A00%3A00Z",
    "IpAddress=127.0.0.1",
    "IpCountry=KZ",
    "IpCity=Almaty",
    "IpRegion=Almaty",
    "IpDistrict=Almaly",
    "IpLatitude=43.2389",
    "IpLongitude=76.8897",
    "CardId=card-001",
    "CardFirstSix=411111",
    "CardLastFour=1111",
    "CardType=Visa",
    "CardExpDate=12%2F30",
    "Issuer=TestBank",
    "IssuerBankCountry=KZ",
    "Description=Case%20Lab%20III",
    "AuthCode=auth-001",
    "TestMode=true",
    "Status=Completed",
    "GatewayName=TestGateway",
    "Data=%7B%22source%22%3A%22tiptop%22%7D",
    "TotalFee=0.00",
    "CardProduct=Visa%20Classic",
    "PaymentMethod=Card",
    "InstallmentTerm=0",
  ].join("&");
  let seenPayload: TipTopPay | undefined;
  const response = await route.handlePost(
    signedRequestWithSecret("/api/tiptoppay/test/pay", body),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: () => SECRET,
      applyPay: async (_environment: "test" | "live", payload: TipTopPay) => {
        seenPayload = payload;
        return { kind: "accepted", code: 0 };
      },
    },
  );

  assert.equal(await responseCode(response), 0);
  assert.equal(seenPayload?.status, "Completed");
  assert.equal("InstallmentTerm" in (seenPayload as unknown as Record<string, unknown>), false);
  assert.equal("Data" in (seenPayload as unknown as Record<string, unknown>), false);
});

test("Pay and Check ignore unknown provider fields without retaining their values", async () => {
  const payRoute = await import("../../app/api/tiptoppay/[environment]/pay/route");
  const checkRoute = await import("../../app/api/tiptoppay/[environment]/check/route");
  const payBody = `${await fixture("pay-completed.form")}&InstallmentTerm=0&FutureProviderField=private-value`;
  const checkBody = `${await fixture("check-percent-encoded.form")}&FutureProviderField=private-value`;
  let payPayload: TipTopPay | undefined;
  let checkPayload: TipTopCheck | undefined;

  const payResponse = await payRoute.handlePost(
    signedRequestWithSecret("/api/tiptoppay/test/pay", payBody),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: () => SECRET,
      applyPay: async (_environment: "test" | "live", payload: TipTopPay) => {
        payPayload = payload;
        return { kind: "accepted", code: 0 };
      },
    },
  );
  const checkResponse = await checkRoute.handlePost(
    signedRequestWithSecret("/api/tiptoppay/test/check", checkBody),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: () => SECRET,
      applyCheck: async (_environment: "test" | "live", payload: TipTopCheck) => {
        checkPayload = payload;
        return { kind: "accepted", code: 0 };
      },
    },
  );

  assert.equal(await responseCode(payResponse), 0);
  assert.equal(await responseCode(checkResponse), 0);
  assert.equal("InstallmentTerm" in (payPayload as unknown as Record<string, unknown>), false);
  assert.equal("FutureProviderField" in (payPayload as unknown as Record<string, unknown>), false);
  assert.equal("FutureProviderField" in (checkPayload as unknown as Record<string, unknown>), false);
});

test("unknown provider fields are reported by name only in safe diagnostics", async () => {
  const route = await import("../../app/api/tiptoppay/[environment]/pay/route");
  const body = `${(await fixture("pay-completed.form")).replace("Amount=15000.00", "Amount=not-money")}&InstallmentTerm=0&FutureProviderField=private-value`;
  const result = await captureWarnings(() => route.handlePost(
    signedRequestWithSecret("/api/tiptoppay/test/pay", body),
    { params: Promise.resolve({ environment: "test" }) },
    { getSecret: () => SECRET, applyPay: async () => ({ kind: "accepted", code: 0 }) },
  ));

  assert.equal(await responseCode(result.result), 20);
  assert.deepEqual(result.warnings[0]?.[1], {
    environment: "test",
    eventType: "Pay",
    stage: "invalid_payload",
    receivedFields: [],
    rejectedField: "Amount",
    ignoredFields: ["InstallmentTerm", "FutureProviderField"],
  });
  assert.doesNotMatch(JSON.stringify(result.warnings[0]), /private-value|Content-HMAC|fixture-secret-2026/i);
});

test("Pay rejects an invalid HMAC and a payload changed after signing", async () => {
  const route = await import("../../app/api/tiptoppay/[environment]/pay/route");
  const body = await fixture("pay-completed.form");
  let calls = 0;
  const dependencies = {
    getSecret: () => SECRET,
    applyPay: async () => {
      calls += 1;
      return { kind: "accepted" as const, code: 0 as const };
    },
  };

  const invalidHmac = await route.handlePost(
    signedRequest("/api/tiptoppay/test/pay", body, "invalid"),
    { params: Promise.resolve({ environment: "test" }) },
    dependencies,
  );
  const changedPayload = await route.handlePost(
    signedRequest("/api/tiptoppay/test/pay", `${body}&InstallmentTerm=0`, SIGNATURES["pay-completed.form"]),
    { params: Promise.resolve({ environment: "test" }) },
    dependencies,
  );

  assert.equal(await responseCode(invalidHmac), 20);
  assert.equal(await responseCode(changedPayload), 20);
  assert.equal(calls, 0);
});

test("critical Pay fields remain duplicate-safe", async () => {
  const body = await fixture("pay-completed.form");
  const duplicateFields = {
    Amount: "15000.00",
    InvoiceId: "cl3-attempt-001",
    AccountId: "order-001",
    TransactionId: "12345",
    TestMode: "true",
    Currency: "KZT",
  };

  for (const [field, value] of Object.entries(duplicateFields)) {
    assert.throws(
      () => parseFormPayload(`${body}&${field}=${encodeURIComponent(value)}`),
      /invalid tiptop webhook payload/i,
      field,
    );
  }
});

test("Refund keeps the original InvoiceId separate from the durable operation key carried in Data", () => {
  const refund = parseRefund(parseFormPayload(
    "TransactionId=77777&PaymentTransactionId=12345&Amount=15000.00&DateTime=2026-09-08T00%3A00%3A00Z&OperationType=Refund&InvoiceId=order-001&Data=%7B%22operationKey%22%3A%22refund-op-001%22%7D",
  ));

  assert.equal(refund.transactionId, "77777");
  assert.equal(refund.paymentTransactionId, "12345");
  assert.equal(refund.invoiceId, "order-001");
  assert.equal(refund.operationKey, "refund-op-001");

  const dashboardRefund = parseRefund(parseFormPayload(
    "TransactionId=77778&PaymentTransactionId=12345&Amount=15000.00&DateTime=2026-09-08T00%3A00%3A00Z&OperationType=Refund",
  ));
  assert.equal(dashboardRefund.invoiceId, undefined);
  assert.equal(dashboardRefund.operationKey, undefined);
  assert.throws(() => parseRefund(parseFormPayload(
    "TransactionId=77778&PaymentTransactionId=12345&Amount=15000.00&DateTime=2026-09-08T00%3A00%3A00Z&TestMode=1&OperationType=Refund",
  )), /invalid/i);
});

test("Refund parses only a strict Data operation key and accepts an empty Data field", () => {
  const common = "TransactionId=77778&PaymentTransactionId=12345&Amount=15000.00&DateTime=2026-09-08T00%3A00%3A00Z&OperationType=Refund";
  const whitespace = parseRefund(parseFormPayload(
    `${common}&Data=${encodeURIComponent('{\n\t"requestId": "refund-op-002"\r\n}')}`,
  ));
  assert.equal(whitespace.operationKey, "refund-op-002");
  assert.equal(parseRefund(parseFormPayload(`${common}&Data=`)).operationKey, undefined);
  assert.throws(() => parseRefund(parseFormPayload(`${common}&Data=not-json`)), /invalid/i);
  assert.throws(() => parseRefund(parseFormPayload(`${common}&Data=%5B%5D`)), /invalid/i);
});

test("Fail rejects the undocumented Status field", () => {
  assert.throws(() => parseFail(parseFormPayload(
    "TransactionId=12345&Amount=15000.00&Currency=KZT&DateTime=2026-09-08T00%3A00%3A00Z&TestMode=1&Status=Declined&Reason=InsufficientFunds&ReasonCode=5051&OperationType=Payment",
  )), /invalid/i);
});

test("typed parsers reject fields that bypass the form decoder", () => {
  assert.throws(() => parseCheck({
      TransactionId: "12345",
      Amount: "7890.00",
      Currency: "KZT",
      PaymentAmount: "7890.00",
      PaymentCurrency: "KZT",
      DateTime: "2026-09-08T00:00:00Z",
    TestMode: "true",
    Status: "Authorized",
    OperationType: "Payment",
    InvoiceId: "cl3-attempt-001",
    AccountId: "order-001",
    UnexpectedField: "must not cross the parser boundary",
  }), /invalid tiptop webhook payload/i);

  assert.throws(() => parseCheck({
    TransactionId: "12345",
    Amount: 7890 as unknown as string,
    Currency: "KZT",
    DateTime: "2026-09-08T00:00:00Z",
    TestMode: "true",
    Status: "Authorized",
    OperationType: "Payment",
    InvoiceId: "cl3-attempt-001",
    AccountId: "order-001",
  }), /invalid tiptop webhook payload/i);

  assert.doesNotThrow(() => parsePay({
    TransactionId: "12345",
    Amount: "7890.00",
    Currency: "KZT",
    DateTime: "2026-09-08T00:00:00Z",
    TestMode: "true",
    Status: "Completed",
    OperationType: "Payment",
    InvoiceId: "cl3-attempt-001",
    AccountId: "order-001",
    Rrn: "rrn-001",
  }));
});

test("Check verifies raw HMAC before parsing, selects only the route environment secret, and calls one RPC", async () => {
  const route = await import("../../app/api/tiptoppay/[environment]/check/route");
  const body = await fixture("check-percent-encoded.form");
  const calls: unknown[] = [];
  const response = await route.handlePost(
    signedRequest("/api/tiptoppay/test/check", body, SIGNATURES["check-percent-encoded.form"]),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: (environment) => {
        assert.equal(environment, "test");
        return SECRET;
      },
      applyCheck: async (_environment: "test" | "live", payload: TipTopCheck) => {
        calls.push(payload);
        return { kind: "accepted", code: 0 };
      },
    },
  );

  assert.equal(await responseCode(response), 0);
  assert.equal(calls.length, 1);
  assert.equal((calls[0] as TipTopCheck).name, "Айдан");

  const malformedWithBadSignature = await route.handlePost(
    signedRequest("/api/tiptoppay/test/check", "InvoiceId=%ZZ", "wrong"),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: () => SECRET,
      applyCheck: async () => {
        throw new Error("must not call transition");
      },
    },
  );
  assert.equal(await responseCode(malformedWithBadSignature), 20);
});

test("Check maps durable provider rejection codes without retrying the RPC", async () => {
  const route = await import("../../app/api/tiptoppay/[environment]/check/route");
  const body = await fixture("check-percent-encoded.form");

  for (const code of [10, 11, 12, 13, 20] as const) {
    let calls = 0;
    const response = await route.handlePost(
      signedRequest("/api/tiptoppay/test/check", body, SIGNATURES["check-percent-encoded.form"]),
      { params: Promise.resolve({ environment: "test" }) },
      {
        getSecret: () => SECRET,
        applyCheck: async () => {
          calls += 1;
          return { kind: "rejected", code };
        },
      },
    );
    assert.equal(await responseCode(response), code);
    assert.equal(calls, 1);
  }
});

test("Check callback diagnostics identify safe rejection stages and RPC metadata reasons", async () => {
  const route = await import("../../app/api/tiptoppay/[environment]/check/route");
  const body = await fixture("check-percent-encoded.form");
  type ApplyCheck = (environment: "test" | "live", payload: TipTopCheck, context: TipTopWebhookContext) => Promise<TipTopTransitionResult>;
  const run = (request: Request, applyCheck: ApplyCheck) => captureWarnings(() => route.handlePost(
    request,
    { params: Promise.resolve({ environment: "test" }) },
    { getSecret: () => SECRET, applyCheck },
  ));

  const invalidHmac = await run(
    signedRequest("/api/tiptoppay/test/check", body, "invalid"),
    async () => ({ kind: "accepted", code: 0 }),
  );
  assert.equal((invalidHmac.warnings[0]?.[1] as { stage?: string }).stage, "invalid_hmac");

  const invalidPayloadBody = "TransactionId=12345&Amount=7890.00&Currency=KZT&Status=Authorized&OperationType=Payment";
  const invalidPayload = await run(
    signedRequestWithSecret("/api/tiptoppay/test/check", invalidPayloadBody),
    async () => ({ kind: "accepted", code: 0 }),
  );
  assert.deepEqual(invalidPayload.warnings[0]?.[1], {
    environment: "test",
    eventType: "Check",
    stage: "invalid_payload",
    receivedFields: ["TransactionId", "Amount", "Currency", "Status", "OperationType"],
    rejectedField: "DateTime",
  });

  const duplicateCriticalField = await run(
    signedRequestWithSecret("/api/tiptoppay/test/check", `${body}&Amount=7890.00`),
    async () => ({ kind: "accepted", code: 0 }),
  );
  assert.deepEqual(duplicateCriticalField.warnings[0]?.[1], {
    environment: "test",
    eventType: "Check",
    stage: "invalid_payload",
    receivedFields: [
      "TransactionId",
      "Amount",
      "Currency",
      "PaymentAmount",
      "PaymentCurrency",
      "InvoiceId",
      "AccountId",
      "Name",
      "TestMode",
      "Status",
      "OperationType",
      "DateTime",
    ],
    rejectedField: "Amount",
    duplicateField: "Amount",
    occurrenceCount: 2,
  });

  const modeMismatchBody = body.replace("TestMode=true", "TestMode=false");
  const modeMismatch = await run(
    signedRequestWithSecret("/api/tiptoppay/test/check", modeMismatchBody),
    async () => ({ kind: "accepted", code: 0 }),
  );
  assert.equal((modeMismatch.warnings[0]?.[1] as { stage?: string }).stage, "mode_mismatch");

  const metadataMismatch = await run(
    signedRequestWithSecret("/api/tiptoppay/test/check", body),
    async () => ({ kind: "rejected", code: 20, result: "rejected_provider_metadata" }),
  );
  assert.deepEqual(metadataMismatch.warnings[0]?.[1], {
    environment: "test",
    eventType: "Check",
    stage: "metadata_mismatch",
    rpcCode: 20,
    rpcReason: "rejected_provider_metadata",
  });

  const rpcRejection = await run(
    signedRequestWithSecret("/api/tiptoppay/test/check", body),
    async () => ({ kind: "rejected", code: 11 }),
  );
  assert.deepEqual(rpcRejection.warnings[0]?.[1], {
    environment: "test",
    eventType: "Check",
    stage: "rpc_rejection",
    rpcCode: 11,
  });

  const unexpectedError = await run(
    signedRequestWithSecret("/api/tiptoppay/test/check", body),
    async () => { throw new Error("private database details"); },
  );
  assert.deepEqual(unexpectedError.warnings[0]?.[1], {
    environment: "test",
    eventType: "Check",
    stage: "unexpected_error",
    errorType: "Error",
    failedStage: "transition",
  });
  assert.doesNotMatch(JSON.stringify(unexpectedError.warnings[0]), /private database details|Content-HMAC|fixture-secret-2026/i);
});

test("payload diagnostics expose safe value metadata without logging the value", async () => {
  const route = await import("../../app/api/tiptoppay/[environment]/check/route");
  const baseBody = await fixture("check-percent-encoded.form");
  const run = (body: string) => captureWarnings(() => route.handlePost(
    signedRequestWithSecret("/api/tiptoppay/test/check", body),
    { params: Promise.resolve({ environment: "test" }) },
    { getSecret: () => SECRET, applyCheck: async () => ({ kind: "accepted", code: 0 }) },
  ));

  const longName = "n".repeat(2049);
  const longNameResult = await run(baseBody.replace("Name=%D0%90%D0%B9%D0%B4%D0%B0%D0%BD", `Name=${longName}`));
  assert.deepEqual(longNameResult.warnings[0]?.[1], {
    environment: "test",
    eventType: "Check",
    stage: "invalid_payload",
    receivedFields: [
      "TransactionId",
      "Amount",
      "Currency",
      "PaymentAmount",
      "PaymentCurrency",
      "InvoiceId",
      "AccountId",
      "Name",
    ],
    rejectedField: "Name",
    valueTooLong: true,
    valueLength: longName.length,
  });
  assert.doesNotMatch(JSON.stringify(longNameResult.warnings[0]), /n{100}/u);

  const data = '{\n\t"provider": "tiptop",\u0000\r\n}';
  const dataResult = await run(`${baseBody}&Data=${encodeURIComponent(data)}`);
  assert.deepEqual(dataResult.warnings[0]?.[1], {
    environment: "test",
    eventType: "Check",
    stage: "invalid_payload",
    receivedFields: [
      "TransactionId",
      "Amount",
      "Currency",
      "PaymentAmount",
      "PaymentCurrency",
      "InvoiceId",
      "AccountId",
      "Name",
      "TestMode",
      "Status",
      "OperationType",
      "DateTime",
      "Data",
    ],
    rejectedField: "Data",
    valueLength: data.length,
    hasJsonWhitespace: true,
  });
  const serializedDataWarning = JSON.stringify(dataResult.warnings[0]);
  assert.equal(serializedDataWarning.includes(data), false);
  assert.doesNotMatch(serializedDataWarning, /Content-HMAC|fixture-secret-2026/i);
});

test("wrong TestMode is rejected before Check persistence and an invalid environment is generic", async () => {
  const route = await import("../../app/api/tiptoppay/[environment]/check/route");
  const body = await fixture("check-percent-encoded.form");
  const liveBody = body.replace("TestMode=true", "TestMode=false");
  let calls = 0;

  const wrongMode = await route.handlePost(
    signedRequest("/api/tiptoppay/test/check", liveBody, "E37cHhQmaScpqU6ko4/O8NEsfv7ZWvTwyBZEQQhEm1k="),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: () => SECRET,
      applyCheck: async () => {
        calls += 1;
        return { kind: "accepted", code: 0 };
      },
    },
  );
  assert.equal(await responseCode(wrongMode), 20);
  assert.equal(calls, 0);

  const invalidEnvironment = await route.handlePost(
    signedRequest("/api/tiptoppay/staging/check", body, SIGNATURES["check-percent-encoded.form"]),
    { params: Promise.resolve({ environment: "staging" }) },
    {
      getSecret: () => SECRET,
      applyCheck: async () => {
        calls += 1;
        return { kind: "accepted", code: 0 };
      },
    },
  );
  assert.equal(await responseCode(invalidEnvironment), 20);
  assert.equal(calls, 0);
});

test("Pay, late Fail, and Refund call their matching transition exactly once", async () => {
  const payRoute = await import("../../app/api/tiptoppay/[environment]/pay/route");
  const failRoute = await import("../../app/api/tiptoppay/[environment]/fail/route");
  const refundRoute = await import("../../app/api/tiptoppay/[environment]/refund/route");
  const payBody = await fixture("pay-completed.form");
  const failBody = await fixture("fail-late.form");
  const refundBody = await fixture("refund.form");
  let payCalls = 0;
  let failCalls = 0;
  let refundCalls = 0;
  let seenRefund: TipTopRefund | undefined;

  const payResponse = await payRoute.handlePost(
    signedRequest("/api/tiptoppay/test/pay", payBody, SIGNATURES["pay-completed.form"]),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: () => SECRET,
      applyPay: async (_environment: "test" | "live", payload: TipTopPay) => {
        payCalls += 1;
        assert.equal(payload.status, "Completed");
        return { kind: "accepted" };
      },
    },
  );
  assert.equal(await responseCode(payResponse), 0);

  const failResponse = await failRoute.handlePost(
    signedRequest("/api/tiptoppay/test/fail", failBody, SIGNATURES["fail-late.form"]),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: () => SECRET,
      applyFail: async (_environment: "test" | "live", payload: TipTopFail) => {
        failCalls += 1;
        assert.equal(payload.transactionId, "12345");
        return { kind: "accepted", result: "late_failure_ignored" };
      },
    },
  );
  assert.equal(await responseCode(failResponse), 0);

  const refundResponse = await refundRoute.handlePost(
    signedRequest("/api/tiptoppay/test/refund", refundBody, SIGNATURES["refund.form"]),
    { params: Promise.resolve({ environment: "test" }) },
    {
      getSecret: () => SECRET,
      applyRefund: async (_environment: "test" | "live", payload: TipTopRefund) => {
        refundCalls += 1;
        seenRefund = payload;
        return { kind: "accepted", result: "confirmed" };
      },
    },
  );
  assert.equal(await responseCode(refundResponse), 0);
  assert.equal(payCalls, 1);
  assert.equal(failCalls, 1);
  assert.equal(refundCalls, 1);
  assert.equal(seenRefund?.transactionId, "77777");
  assert.equal(seenRefund?.paymentTransactionId, "12345");
  assert.equal(seenRefund?.invoiceId, "order-001");
  assert.equal(seenRefund?.operationKey, "refund-op-001");
});

test("TipTop API methods use environment credentials, JSON, Basic Auth, bounded timeout, and refund request IDs", async () => {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const fakeFetch: typeof fetch = async (input, init) => {
    requests.push({ url: String(input), init: init ?? {} });
    return new Response(JSON.stringify({ Success: true, Message: "Queued", Model: { Id: "provider-1" } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const options = {
    fetch: fakeFetch,
    getConfig: () => ({ tiptop: { publicId: "test-public", apiSecret: "test-api-secret" } }),
  };

  const refund = await refundPayment("test", {
    paymentTransactionId: "12345",
    amountMinor: 400000,
    operationKey: "refund-operation-1",
    invoiceId: "provider-invoice-001",
  }, options);
  assert.equal(refund.success, true);
  assert.equal(requests[0]?.url, "https://api.tiptoppay.kz/payments/refund");
  assert.equal(requests[0]?.init.headers && new Headers(requests[0].init.headers).get("authorization"), `Basic ${Buffer.from("test-public:test-api-secret").toString("base64")}`);
  assert.equal(requests[0]?.init.headers && new Headers(requests[0].init.headers).get("x-request-id"), "refund-operation-1");
  assert.deepEqual(JSON.parse(String(requests[0]?.init.body)), {
    TransactionId: 12345,
    Amount: 4000,
    JsonData: { operationKey: "refund-operation-1" },
  });
  assert.equal(requests[0]?.init.signal instanceof AbortSignal, true);

  await getTransaction("test", "12345", options);
  await findInvoiceOperations("test", "provider-invoice-001", options);
  await listTransactionsPage("test", {
    createdDateGte: "2026-09-08T00:00:00+06:00",
    createdDateLte: "2026-09-09T00:00:00+06:00",
    pageNumber: 1,
    timeZone: "ALMT",
  }, options);
  assert.equal(requests[1]?.url, "https://api.tiptoppay.kz/payments/get");
  assert.equal(requests[2]?.url, "https://api.tiptoppay.kz/payments/find");
  assert.deepEqual(JSON.parse(String(requests[2]?.init.body)), { InvoiceId: "provider-invoice-001" });
  assert.equal(requests[3]?.url, "https://api.tiptoppay.kz/v2/payments/list");
  assert.deepEqual(JSON.parse(String(requests[3]?.init.body)), {
    CreatedDateGte: "2026-09-08T00:00:00+06:00",
    CreatedDateLte: "2026-09-09T00:00:00+06:00",
    PageNumber: 1,
    TimeZone: "ALMT",
  });
  await assert.rejects(() => listTransactionsPage("test", {
    createdDateGte: "2026-09-08T00:00:00+06:00",
    createdDateLte: "2026-09-09T00:00:00+06:00",
    pageNumber: 0,
  }, options), /TipTop API request failed/i);
});

test("TipTop API requests abort when their bounded timeout expires", async () => {
  let aborted = false;
  const fetcher: typeof fetch = async (_input, init) => new Promise<Response>((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => {
      aborted = true;
      reject(new Error("aborted"));
    }, { once: true });
  });

  await assert.rejects(() => getTransaction("test", "12345", {
    fetch: fetcher,
    timeoutMs: 10,
    getConfig: () => ({ tiptop: { publicId: "test-public", apiSecret: "test-api-secret" } }),
  }), /TipTop API request failed/i);
  assert.equal(aborted, true);
});

test("an uncertain refund older than one hour is reconciled before any retry", async () => {
  const calls: string[] = [];
  const fakeFetch: typeof fetch = async (input) => {
    const url = String(input);
    calls.push(url);
    return new Response(JSON.stringify({ Success: true, Message: "Queued", Model: {} }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  await assert.rejects(
    () => refundPayment("test", {
      paymentTransactionId: "12345",
      amountMinor: 400000,
      operationKey: "refund-operation-2",
      invoiceId: "provider-invoice-001",
      uncertainSince: new Date("2026-09-08T00:00:00.000Z"),
    }, {
      fetch: fakeFetch,
      getConfig: () => ({ tiptop: { publicId: "test-public", apiSecret: "test-api-secret" } }),
      now: () => Date.parse("2026-09-08T01:00:01.000Z"),
    }),
    /reconciliation/i,
  );
  assert.deepEqual(calls, [
    "https://api.tiptoppay.kz/payments/get",
    "https://api.tiptoppay.kz/payments/find",
  ]);
});

test("TipTop API methods reject non-success HTTP responses and non-object models", async () => {
  const options = {
    getConfig: () => ({ tiptop: { publicId: "test-public", apiSecret: "test-api-secret" } }),
    fetch: (async (_input, init) => {
      assert.equal(init?.method, "POST");
      return new Response(JSON.stringify({ Success: true, Model: {} }), { status: 503 });
    }) satisfies typeof fetch,
  };

  await assert.rejects(() => getTransaction("test", "12345", options), /TipTop API request failed/i);

  const invalidModelOptions = {
    ...options,
    fetch: (async () => new Response(JSON.stringify({ Success: true, Model: [null] }), { status: 200 })) satisfies typeof fetch,
  };
  await assert.rejects(() => getTransaction("test", "12345", invalidModelOptions), /TipTop API request failed/i);
});

test("transaction pagination stops after an unsuccessful provider response", async () => {
  let calls = 0;
  const pages: TipTopJsonObject[] = [];
  let caught: unknown;
  try {
      for await (const page of paginateTransactions("test", {
        createdDateGte: "2026-09-08T00:00:00+06:00",
        createdDateLte: "2026-09-09T00:00:00+06:00",
      }, {
      getConfig: () => ({ tiptop: { publicId: "test-public", apiSecret: "test-api-secret" } }),
      fetch: (async () => {
        calls += 1;
        if (calls > 1) throw new Error("pagination did not stop");
        return new Response(JSON.stringify({ Success: false, Message: "Unavailable", Model: Array.from({ length: 100 }, () => ({})) }), {
          status: 200,
        });
      }) satisfies typeof fetch,
    })) {
      pages.push(page as unknown as TipTopJsonObject);
    }
  } catch (error) {
    caught = error;
  }

  assert.equal(caught, undefined);
  assert.equal(calls, 1);
  assert.equal(pages.length, 1);
});

test("transaction pagination starts at page one and advances after a full page", async () => {
  const requests: Array<{ url: string; body: TipTopJsonObject }> = [];
  let page = 0;
  const pages: TipTopApiResponse[] = [];
  for await (const result of paginateTransactions("test", {
    createdDateGte: "2026-09-08T00:00:00+06:00",
    createdDateLte: "2026-09-09T00:00:00+06:00",
  }, {
    getConfig: () => ({ tiptop: { publicId: "test-public", apiSecret: "test-api-secret" } }),
    fetch: (async (input, init) => {
      page += 1;
      requests.push({ url: String(input), body: JSON.parse(String(init?.body)) as TipTopJsonObject });
      return new Response(JSON.stringify({
        Success: true,
        Model: Array.from({ length: page === 1 ? 100 : 1 }, () => ({})),
      }), { status: 200 });
    }) satisfies typeof fetch,
  })) {
    pages.push(result);
  }

  assert.equal(pages.length, 2);
  assert.deepEqual(requests.map((request) => request.url), [
    "https://api.tiptoppay.kz/v2/payments/list",
    "https://api.tiptoppay.kz/v2/payments/list",
  ]);
  assert.deepEqual(requests.map((request) => request.body.PageNumber), [1, 2]);
});
