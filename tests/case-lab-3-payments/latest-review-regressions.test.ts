import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path: string) => readFile(path, "utf8");

function extractFunction(source: string, functionName: string): string {
  const start = source.indexOf(`create or replace function public.${functionName}(`);
  if (start < 0) return "";
  const next = source.indexOf("\ncreate or replace function", start + 1);
  return source.slice(start, next < 0 ? source.length : next);
}

async function readOptional(path: string): Promise<string> {
  try {
    return await read(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return "";
    throw error;
  }
}

test("proxy creates a fresh base64 nonce and forwards it both ways", async () => {
  const source = await read("proxy.ts");

  assert.match(source, /crypto\.getRandomValues\(/);
  assert.match(source, /btoa\(/);
  assert.match(source, /requestHeaders\.set\(\s*["']x-nonce["']\s*,\s*nonce\s*\)/);
  assert.match(source, /response\.headers\.set\(\s*["']x-nonce["']\s*,\s*nonce\s*\)/);
  assert.match(source, /response\.headers\.set\(\s*["']Content-Security-Policy["']\s*,\s*cspHeader\s*\)/);
});

test("TipTop script loading requires and applies the request nonce", async () => {
  const source = await read("app/components/case-lab-3/checkout/tiptoppay-widget.client.ts");

  assert.match(source, /nonce\s*:\s*string/);
  assert.match(source, /if\s*\(!nonce\)/);
  assert.match(source, /script\.nonce\s*=\s*nonce/);
  assert.doesNotMatch(source, /if\s*\(nonce\)\s*script\.nonce/);
});

test("payment-open expiry remains callback-eligible and starts verification", async () => {
  const machineSource = await read("app/components/case-lab-3/checkout/checkout-machine.ts");
  const providerSource = await read("app/components/case-lab-3/checkout/CaseLab3CheckoutProvider.tsx");
  const expiryCaseStart = machineSource.indexOf('case "RESERVATION_EXPIRED"');
  const expiryCaseEnd = machineSource.indexOf('case "SCRIPT_ERROR"', expiryCaseStart);
  const expiryCaseSource = machineSource.slice(expiryCaseStart, expiryCaseEnd);

  assert.match(expiryCaseSource, /RESERVATION_EXPIRED[\s\S]*?\["reserved",\s*"loading_widget"\]/);
  assert.doesNotMatch(expiryCaseSource, /"payment_open"/);
  assert.match(machineSource, /WIDGET_COMPLETE[\s\S]*?"payment_open"[\s\S]*?verifying/);
  assert.match(providerSource, /\["reserved",\s*"loading_widget"\]/);
  assert.doesNotMatch(providerSource, /\["reserved",\s*"loading_widget",\s*"payment_open"/);
});

test("payment completion is callback-only and never inferred from widget.start", async () => {
  const widgetSource = await read("app/components/case-lab-3/checkout/tiptoppay-widget.client.ts");
  const providerSource = await read("app/components/case-lab-3/checkout/CaseLab3CheckoutProvider.tsx");

  assert.match(widgetSource, /widget\.oncomplete\s*=\s*settle/);
  assert.doesNotMatch(widgetSource, /Promise\.resolve\(widget\.start\(params\)\)\.then\(settle/);
  assert.match(widgetSource, /void\s+Promise\.resolve\(widget\.start\(params\)\)\.catch\(rejectStart\)/);
  assert.match(providerSource, /startTipTopPayment\(widget\)/);
  assert.match(providerSource, /dispatch\(\{ type:\s*["']WIDGET_COMPLETE["']/);
});

test("payment retries clear prior attempt identity before requesting a new attempt", async () => {
  const source = await read("app/components/case-lab-3/checkout/checkout-machine.ts");

  assert.match(
    source,
    /case\s+["']RETRY_PAYMENT["'][\s\S]*?attemptId:\s*undefined[\s\S]*?externalId:\s*undefined[\s\S]*?widget:\s*undefined[\s\S]*?reservationExpiresAt:\s*undefined/,
  );
});

test("order creation reuses one idempotency key for the active checkout generation", async () => {
  const source = await read("app/components/case-lab-3/checkout/CaseLab3CheckoutProvider.tsx");

  assert.match(source, /orderRequestKeyRef\.current\?\.generation === generation/);
  assert.match(source, /orderRequestKeyRef\.current = \{ generation, key \}/);
  assert.match(source, /getOrderRequestIdempotencyKey\(generation\)/);
  assert.doesNotMatch(source, /"Idempotency-Key":\s*crypto\.randomUUID\(\)/);
});

test("widget.start failures are converted to a generic user-safe error", async () => {
  const source = await read("app/components/case-lab-3/checkout/tiptoppay-widget.client.ts");
  const startCatch = source.slice(source.indexOf("const rejectStart"), source.indexOf("export function resetTipTopWidgetLoaderForRetry"));

  assert.match(startCatch, /reject\(new Error\([^)]*USER_SAFE/);
  assert.doesNotMatch(startCatch, /reject\(error\)/);
});

test("widget loading can abort on reservation expiry without aborting an open widget", async () => {
  const providerSource = await read("app/components/case-lab-3/checkout/CaseLab3CheckoutProvider.tsx");
  const widgetSource = await read("app/components/case-lab-3/checkout/tiptoppay-widget.client.ts");
  const expiryHandlerStart = providerSource.indexOf("const expireReservation");
  const expiryHandlerEnd = providerSource.indexOf("const remaining", expiryHandlerStart);
  const expiryHandlerSource = providerSource.slice(expiryHandlerStart, expiryHandlerEnd);

  assert.match(providerSource, /widgetOperationRef/);
  assert.match(providerSource, /loadTipTopWidget\(nonce, controller\.signal\)/);
  assert.match(providerSource, /!widgetOperation\.widgetOpen[\s\S]*?controller\.abort\(\)/);
  assert.match(expiryHandlerSource, /widgetOperationRef\.current/);
  assert.match(expiryHandlerSource, /widgetOperation\?\.generation === generation/);
  assert.match(expiryHandlerSource, /!widgetOperation\.widgetOpen[\s\S]*?widgetOperation\.controller\.abort\(\)/);
  assert.match(widgetSource, /signal\??:\s*AbortSignal/);
  assert.match(widgetSource, /signal\?\.addEventListener\(["']abort["']/);
});

test("Navbar restores each sibling's prior aria-hidden and inert state", async () => {
  const source = await read("app/components/Navbar.tsx");
  const inertEffectStart = source.indexOf("const siblings = Array.from(document.body.children)");
  const inertEffectEnd = source.indexOf("}, [mobileOpen, portalNode]);", inertEffectStart);
  const inertEffectSource = source.slice(inertEffectStart, inertEffectEnd);

  assert.match(inertEffectSource, /previousAttributes/);
  assert.match(inertEffectSource, /getAttribute\(["']aria-hidden["']\)/);
  assert.match(inertEffectSource, /hasAttribute\(["']inert["']\)/);
  assert.match(inertEffectSource, /if \(ariaHidden === null\)[\s\S]*?node\.removeAttribute\(["']aria-hidden["']\)/);
  assert.match(inertEffectSource, /else node\.setAttribute\(["']aria-hidden["'], ariaHidden\)/);
  assert.match(inertEffectSource, /if \(!inert\)[\s\S]*?node\.removeAttribute\(["']inert["']\)/);
  assert.match(inertEffectSource, /else node\.setAttribute\(["']inert["'], ["']{2}\)/);
});

test("expired reservations can create a fresh payment attempt", async () => {
  const source = await readOptional("supabase/migrations/20260908000000_add_case_lab_3_retry_attempts.sql");
  const legacySource = await read("supabase/migrations/20260907010000_add_case_lab_3_atomic_functions.sql");

  assert.match(source, /create or replace function public\.case_lab_3_create_payment_attempt/);
  assert.match(source, /case_lab_3_create_payment_attempt_legacy/);
  assert.match(source, /status\s*=\s*'created'/);
  assert.match(source, /failure_code\s*=\s*'reservation_expired'/);
  assert.match(legacySource, /v_external_id\s*:=\s*'cl3-'/);
});

test("mobile CTA clears stale pending state on every non-CTA menu close", async () => {
  const source = await read("app/components/Navbar.tsx");

  assert.match(source, /const pendingMobileCta\s*=\s*useRef/);
  assert.match(source, /const closeMobileMenu\s*=\s*\(\)\s*=>\s*\{[\s\S]*?pendingMobileCta\.current\s*=\s*false[\s\S]*?setMobileOpen\(false\)/);
  assert.match(source, /handleMobileMenuExitComplete/);
  assert.match(source, /<AnimatePresence\s+onExitComplete=\{handleMobileMenuExitComplete\}>/);
});

test("visible required terms consent is included in the order contract and server validation", async () => {
  const dialogSource = await read("app/components/case-lab-3/checkout/CaseLab3CheckoutDialog.tsx");
  const providerSource = await read("app/components/case-lab-3/checkout/CaseLab3CheckoutProvider.tsx");
  const contractSource = await read("app/lib/case-lab-3/contracts.ts");
  const validationSource = await read("app/lib/case-lab-3/validation.ts");

  assert.match(dialogSource, /name=["']acceptedTerms["']/);
  assert.match(providerSource, /acceptedTerms/);
  assert.match(contractSource, /acceptedTerms:\s*boolean/);
  assert.match(validationSource, /acceptedTerms[\s\S]*must_accept/);
});

test("provider callback identifiers are bounded at every direct transition boundary", async () => {
  const source = await read("supabase/migrations/20260907020000_add_case_lab_3_provider_functions.sql");

  for (const functionName of ["case_lab_3_apply_check", "case_lab_3_apply_pay", "case_lab_3_apply_fail", "case_lab_3_apply_receipt"]) {
    const functionSource = extractFunction(source, functionName);
    assert.notEqual(functionSource, "", `${functionName} must exist`);
    assert.match(functionSource, /length\(btrim\(p_provider_event_id\)\) = 0/);
    assert.match(functionSource, /length\(p_provider_event_id\) > 256/);
    assert.match(functionSource, /p_provider_event_id ~ '\[\[:cntrl:\]\]'/);
  }

  for (const functionName of ["case_lab_3_apply_check", "case_lab_3_apply_fail"]) {
    const functionSource = extractFunction(source, functionName);
    assert.match(functionSource, /length\(btrim\(p_external_id\)\) = 0/);
    assert.match(functionSource, /length\(p_external_id\) > 256/);
    assert.match(functionSource, /p_external_id ~ '\[\[:cntrl:\]\]'/);
  }
});

test("early IncomeReturn rematching only issues a processed or issued receipt", async () => {
  const source = await read("supabase/migrations/20260907020000_add_case_lab_3_provider_functions.sql");
  const refundSource = extractFunction(source, "case_lab_3_apply_refund");

  assert.match(
    refundSource,
    /lower\(sanitized_fields->>'receiptStatus'\) in \('processed', 'issued'\)/,
  );
  assert.match(
    refundSource,
    /processing_result in \('pending_match', 'dependency_pending'\)[\s\S]*?lower\(sanitized_fields->>'receiptStatus'\) in \('processed', 'issued'\)/,
  );
});
