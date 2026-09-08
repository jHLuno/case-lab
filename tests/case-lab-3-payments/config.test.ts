import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { SignJWT } from "jose";

import { configModule, jwtModule } from "./server-only-test-loader";

const completeTestEnvironment = {
  CASE_LAB_3_PAYMENT_MODE: "test",
  TIPTOP_TEST_TERMINAL_ID: "test-terminal",
  TIPTOP_TEST_PUBLIC_ID: "test-public",
  TIPTOP_TEST_API_SECRET: "test-api-secret",
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
  CASE_LAB_3_TOKEN_SECRET: "t".repeat(32),
  CASE_LAB_3_CRON_SECRET: "c".repeat(32),
  NEXT_PUBLIC_GA4_MEASUREMENT_ID: "G-TEST123",
  GA4_API_SECRET: "ga-secret",
};

test("live configuration rejects missing fiscal and provider secrets", async () => {
  const { getCaseLab3Config } = await configModule;
  assert.throws(() => getCaseLab3Config("live", {}), /configuration incomplete/i);
});

test("configuration selects the requested environment and keeps server values grouped", async () => {
  const { getCaseLab3Config } = await configModule;
  const config = getCaseLab3Config("test", completeTestEnvironment);

  assert.equal(config.environment, "test");
  assert.equal(config.paymentMode, "test");
  assert.equal(config.widget.terminalId, "test-terminal");
  assert.equal(config.tiptop.publicId, "test-public");
  assert.equal(config.kassir.publicId, "test-kassir-public");
  assert.equal(config.seller.inn, "test-seller-inn");
  assert.equal(config.smtp.port, 465);
  assert.equal(config.smtp.secure, true);
  assert.ok(config.ga4);
  assert.equal(config.ga4.measurementId, "G-TEST123");
  assert.equal("apiSecret" in config.widget, false);
});

test("sandbox payment configuration remains valid when GA4 is not configured", async () => {
  const { getCaseLab3Config } = await configModule;
  const source = {
    ...completeTestEnvironment,
    NEXT_PUBLIC_GA4_MEASUREMENT_ID: undefined,
    GA4_API_SECRET: undefined,
  };

  const config = getCaseLab3Config("test", source);

  assert.equal(config.ga4, null);
});

test("GA4 is disabled when only one server credential is configured", async () => {
  const { getCaseLab3Config } = await configModule;

  for (const name of ["NEXT_PUBLIC_GA4_MEASUREMENT_ID", "GA4_API_SECRET"] as const) {
    const source = { ...completeTestEnvironment, [name]: undefined };
    assert.equal(getCaseLab3Config("test", source).ga4, null, `${name} must not enable a partial GA4 integration`);
  }
});

test("CRM verification rejects a valid JWT with the wrong role", async () => {
  const { verifyToken } = await jwtModule;
  process.env.JWT_SECRET = "s".repeat(32);
  const token = await new SignJWT({ role: "viewer" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer("caselab.kz")
    .setAudience("caselab-crm")
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode("s".repeat(32)));
  assert.equal(await verifyToken(token), false);
});

test("CRM login does not depend on process-local rate limiting", async () => {
  const source = await readFile("app/api/auth/login/route.ts", "utf8");
  assert.doesNotMatch(source, /lib\/rate-limit/);
  assert.match(source, /case_lab_3_consume_rate_limit/);
});

test("JWT and auth routes keep server-only and no-store boundaries", async () => {
  const jwtSource = await readFile("app/lib/jwt.ts", "utf8");
  assert.match(jwtSource, /import ["']server-only["'];/);

  for (const path of ["app/api/auth/login/route.ts", "app/api/auth/check/route.ts"]) {
    const source = await readFile(path, "utf8");
    assert.doesNotMatch(source, /NextResponse\.json/);
    assert.match(source, /noStoreJson/);
  }
});

test("malformed login JSON is explicitly mapped to a safe 400", async () => {
  const source = await readFile("app/api/auth/login/route.ts", "utf8");
  assert.match(source, /parseJsonBody/);
  assert.match(source, /RequestGuardError[\s\S]*?jsonError\("Invalid request", error\.status/);
});

test("the committed environment template contains no credential-like values or obsolete checkout settings", async () => {
  const source = await readFile(".env.example", "utf8");
  const requiredEmptyVariables = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
    "CRM_PASSWORD",
    "TIPTOP_TEST_TERMINAL_ID",
    "TIPTOP_LIVE_TERMINAL_ID",
    "CASE_LAB_3_PAYMENT_MODE",
    "TIPTOP_TEST_PUBLIC_ID",
    "TIPTOP_TEST_API_SECRET",
    "TIPTOP_LIVE_PUBLIC_ID",
    "TIPTOP_LIVE_API_SECRET",
    "KASSIR_TEST_PUBLIC_ID",
    "KASSIR_TEST_API_SECRET",
    "KASSIR_LIVE_PUBLIC_ID",
    "KASSIR_LIVE_API_SECRET",
    "KASSIR_SELLER_INN",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_SECURE",
    "SMTP_USER",
    "SMTP_PASSWORD",
    "SMTP_FROM",
    "CASE_LAB_3_ALERT_EMAIL",
    "CASE_LAB_3_TOKEN_SECRET",
    "CASE_LAB_3_CRON_SECRET",
    "NEXT_PUBLIC_GA4_MEASUREMENT_ID",
    "GA4_API_SECRET",
    "JWT_SECRET",
  ];

  for (const variable of requiredEmptyVariables) {
    assert.match(source, new RegExp(`^${variable}=$`, "m"), `${variable} must be empty in the template`);
  }

  assert.doesNotMatch(source, /NEXT_PUBLIC_CASE_LAB_3_CHECKOUT_(?:URL|HOST)/);
  assert.doesNotMatch(source, /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|CaseLab2026@/);
});
