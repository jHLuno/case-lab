import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import "./server-only-test-loader";

import { hashPrivateOfferToken } from "../../app/lib/case-lab-3/orders.server";
import { parseOrderInput } from "../../app/lib/case-lab-3/validation";

const validOrder = {
  firstName: "Арина",
  lastName: "Садыкова",
  email: "arina@example.com",
  phone: null,
  company: null,
  position: null,
  expectedTier: "standard",
  expectedAmountMinor: 500000,
  offerVersionId: "offer-2026-09-07",
  privacyVersionId: "privacy-2026-09-07",
  acceptedTerms: true,
  marketingConsent: false,
  attribution: {},
} as const;

test("private offer tokens are hashed deterministically without preserving the raw token", () => {
  const token = "A".repeat(43);

  assert.equal(
    hashPrivateOfferToken(token),
    "0f007385b6f9d4b7eeb2748605afe1a984a0a3bfa3f014d09e2a784ce9e5cd1a",
  );
  assert.notEqual(hashPrivateOfferToken(token), token);
});

test("order input accepts a private token only in the bounded URL-token format", () => {
  const parsed = parseOrderInput({ ...validOrder, privateOfferToken: "A".repeat(43) });
  assert.equal(parsed.privateOfferToken, "A".repeat(43));

  assert.throws(
    () => parseOrderInput({ ...validOrder, privateOfferToken: "too-short" }),
    /Order input is invalid/,
  );
});

test("private offer migration keeps the amount server-authoritative and single-use", async () => {
  const source = await readFile(
    "supabase/migrations/20260917000000_add_case_lab_3_private_offers.sql",
    "utf8",
  );

  assert.match(source, /create table public\.case_lab_3_private_offers/iu);
  assert.match(source, /token_hash\s+text\s+not null/iu);
  assert.match(source, /amount_minor\s+bigint\s+not null/iu);
  assert.match(source, /private_offer_id/iu);
  assert.match(source, /case_lab_3_create_private_order/iu);
  assert.match(source, /p_private_offer_token_hash/iu);
  assert.match(source, /500000/iu);
  assert.match(source, /status\s*=\s*'redeemed'/iu);
  assert.match(source, /claimed_order_id/iu);
});

test("private checkout route is dynamic, noindex, and keeps the public page available", async () => {
  const [route, page, provider, publicPage] = await Promise.all([
    readFile("app/case-lab-3/private/[token]/page.tsx", "utf8"),
    readFile("app/components/CaseLab3Page.tsx", "utf8"),
    readFile("app/components/case-lab-3/checkout/CaseLab3CheckoutProvider.tsx", "utf8"),
    readFile("app/case-lab-3/page.tsx", "utf8"),
  ]);

  assert.match(route, /force-dynamic/iu);
  assert.match(route, /robots:[\s\S]*index:\s*false/iu);
  assert.match(route, /params:\s*Promise/iu);
  assert.match(page, /privateOfferToken/iu);
  assert.match(provider, /privateOfferToken/iu);
  assert.match(provider, /private_token/iu);
  assert.match(publicPage, /<CaseLab3Page nonce=\{nonce\}\s*\/>/iu);
});
