import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { httpModule, providerHmacModule } from "./server-only-test-loader";

function expectStatus(action: () => void, status: number, isGuardError: (error: unknown) => boolean): void {
  assert.throws(action, (error: unknown) => {
    assert.equal(isGuardError(error), true);
    assert.equal((error as Error & { status?: number }).status, status);
    return true;
  });
}

test("bounded body reads bytes once and rejects bodies above the limit", async () => {
  const { readBoundedBody, RequestGuardError } = await httpModule;
  const request = new Request("https://caselab.kz/api/provider", {
    method: "POST",
    body: "12345",
  });

  const body = await readBoundedBody(request, 5);
  assert.deepEqual([...body], [49, 50, 51, 52, 53]);
  await assert.rejects(() => readBoundedBody(request, 5));

  await assert.rejects(
    () => readBoundedBody(new Request("https://caselab.kz/api/provider", { method: "POST", body: "123456" }), 5),
    (error: unknown) => {
      assert.equal(error instanceof RequestGuardError, true);
      assert.equal((error as Error & { status?: number }).status, 413);
      return true;
    },
  );
});

test("content type guards accept only JSON and form requests", async () => {
  const { requireForm, requireJson, RequestGuardError } = await httpModule;
  requireJson(new Headers({ "content-type": "application/json; charset=utf-8" }));
  requireForm(new Headers({ "content-type": "application/x-www-form-urlencoded" }));
  expectStatus(() => requireJson(new Headers({ "content-type": "text/plain" })), 415, (error) => error instanceof RequestGuardError);
  expectStatus(() => requireForm(new Headers({ "content-type": "multipart/form-data" })), 415, (error) => error instanceof RequestGuardError);
});

test("same-origin guard requires an exact non-null Origin", async () => {
  const { requireSameOrigin, RequestGuardError } = await httpModule;
  const request = new Request("https://caselab.kz/api/admin", {
    method: "POST",
    headers: { Origin: "https://caselab.kz" },
  });
  assert.doesNotThrow(() => requireSameOrigin(request));
  expectStatus(
    () => requireSameOrigin(new Request(request.url, { method: "POST", headers: { Origin: "https://evil.example" } })),
    403,
    (error) => error instanceof RequestGuardError,
  );
  expectStatus(() => requireSameOrigin(new Request(request.url, { method: "POST" })), 403, (error) => error instanceof RequestGuardError);
});

test("client IP hashes are purpose-bound and never return the raw address", async () => {
  const { getHashedClientIp } = await httpModule;
  const platformHeaders = new Headers({ "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.1" });
  const first = getHashedClientIp(platformHeaders, "s".repeat(32), "crm-login");
  const second = getHashedClientIp(platformHeaders, "s".repeat(32), "order-create");

  assert.notEqual(first, "203.0.113.10");
  assert.notEqual(first, second);
  assert.throws(
    () => getHashedClientIp(new Headers({ "x-forwarded-for": "198.51.100.20" }), "s".repeat(32), "crm-login"),
    /client IP/i,
  );
  assert.throws(
    () => getHashedClientIp(new Headers({ "x-real-ip": "198.51.100.20" }), "s".repeat(32), "crm-login"),
    /client IP/i,
  );

  const forgedFallbackHeaders = new Headers({
    "x-vercel-forwarded-for": "203.0.113.10, 10.0.0.1",
    "x-forwarded-for": "198.51.100.20",
    "x-real-ip": "198.51.100.20",
  });
  assert.equal(getHashedClientIp(forgedFallbackHeaders, "s".repeat(32), "crm-login"), first);
});

test("provider HMAC verifies the exact raw body with constant-time-sized signatures", async () => {
  const { verifyProviderHmac } = await providerHmacModule;
  const secret = "fixture-secret-2026";
  const rawBody = "TransactionId=12345&Amount=7890.00&Currency=KZT";
  const signature = createHmac("sha256", secret).update(rawBody).digest("base64");
  const headers = new Headers({ "Content-HMAC": signature });

  assert.equal(verifyProviderHmac(rawBody, headers, secret, "raw"), true);
  assert.equal(verifyProviderHmac(`${rawBody}&tampered=1`, headers, secret, "raw"), false);
  assert.equal(verifyProviderHmac(rawBody, new Headers({ "X-Content-HMAC": signature }), secret, "raw"), false);
  assert.equal(verifyProviderHmac(rawBody, new Headers({ "Content-HMAC": "not-base64" }), secret, "raw"), false);
});

test("JSON responses are explicitly non-cacheable", async () => {
  const { noStoreJson } = await httpModule;
  const response = noStoreJson({ ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { ok: true });
});

test("malformed JSON is rejected with a safe 400 error", async () => {
  const { parseJsonBody, RequestGuardError } = await httpModule;
  assert.throws(
    () => parseJsonBody(new TextEncoder().encode('{"password":')),
    (error: unknown) => {
      assert.equal(error instanceof RequestGuardError, true);
      assert.equal((error as Error & { status?: number }).status, 400);
      assert.equal((error as Error).message, "Invalid request body");
      return true;
    },
  );
});
