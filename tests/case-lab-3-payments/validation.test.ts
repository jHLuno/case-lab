import assert from "node:assert/strict";
import test from "node:test";

import { parseOrderInput } from "../../app/lib/case-lab-3/validation";

const validOrder = {
  firstName: "  Айдана ",
  lastName: " Садыкова ",
  email: " AIDANA@Example.COM ",
  phone: "+7 (777) 123-45-67",
  company: " IP Case Lab ",
  position: " Founder ",
  expectedTier: "early_bird",
  expectedAmountMinor: 789000,
  offerVersionId: "offer-2026-09-07",
  privacyVersionId: "privacy-2026-09-07",
  acceptedTerms: true,
  marketingConsent: false,
  attribution: {
    utm_source: "google",
    utm_medium: "cpc",
    utm_campaign: "case-lab-3",
    referrer: "https://example.com/landing",
    ga_client_id: "123.456",
  },
} as const;

function expectValidationIssue(value: unknown, field: string, code: string): void {
  assert.throws(
    () => parseOrderInput(value),
    (error: unknown) => {
      assert.equal(error instanceof Error, true);
      const validationError = error as Error & {
        code?: unknown;
        issues?: unknown;
      };
      assert.equal(validationError.code, "invalid_order_input");
      assert.deepEqual(validationError.issues, [{ field, code }]);
      assert.doesNotMatch(validationError.message, /Айдана|Example|secret|777/iu);
      return true;
    },
  );
}

test("trims names, lowercases email, normalizes Kazakhstan phone, and keeps optional blanks null", () => {
  const parsed = parseOrderInput({
    ...validOrder,
    phone: "8 (777) 123-45-67",
    company: "   ",
    position: "",
  });

  assert.deepEqual(parsed, {
    ...validOrder,
    firstName: "Айдана",
    lastName: "Садыкова",
    email: "aidana@example.com",
    phone: "+77771234567",
    company: null,
    position: null,
  });
});

test("accepts omitted optional contact fields", () => {
  const parsed = parseOrderInput({
    ...validOrder,
    phone: undefined,
    company: undefined,
    position: undefined,
  });

  assert.equal(parsed.phone, null);
  assert.equal(parsed.company, null);
  assert.equal(parsed.position, null);
});

test("rejects fields above their maximum lengths", () => {
  expectValidationIssue({ ...validOrder, firstName: "a".repeat(101) }, "firstName", "too_long");
});

test("rejects invalid tier, money, version ID, and phone values", () => {
  expectValidationIssue({ ...validOrder, expectedTier: "vip" }, "expectedTier", "invalid_enum");
  expectValidationIssue({ ...validOrder, expectedAmountMinor: 789000.5 }, "expectedAmountMinor", "invalid_money");
  expectValidationIssue({ ...validOrder, offerVersionId: "offer/secret" }, "offerVersionId", "invalid_version_id");
  expectValidationIssue({ ...validOrder, phone: "+1 212 555 0100" }, "phone", "invalid_phone");
});

test("rejects a plus-prefixed non-Kazakhstan country code", () => {
  expectValidationIssue({ ...validOrder, phone: "+8 777 123 45 67" }, "phone", "invalid_phone");
});

test("rejects an order without explicit terms acceptance", () => {
  expectValidationIssue({ ...validOrder, acceptedTerms: false }, "acceptedTerms", "must_accept");
});

test("rejects unknown top-level and attribution keys", () => {
  expectValidationIssue({ ...validOrder, debug: true }, "debug", "unknown_field");
  expectValidationIssue(
    { ...validOrder, attribution: { ...validOrder.attribution, coupon: "secret" } },
    "attribution.coupon",
    "unknown_field",
  );
});

test("rejects a malformed GA4 client id instead of forwarding arbitrary attribution", () => {
  expectValidationIssue(
    { ...validOrder, attribution: { ...validOrder.attribution, ga_client_id: "buyer@example.com" } },
    "attribution.ga_client_id",
    "invalid_ga_client_id",
  );
});
