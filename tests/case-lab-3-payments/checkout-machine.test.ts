import assert from "node:assert/strict";
import test from "node:test";

import {
  checkoutReducer,
  initialCheckoutState,
  type CheckoutState,
  type CheckoutEvent,
} from "../../app/components/case-lab-3/checkout/checkout-machine";
import { startTipTopPayment } from "../../app/components/case-lab-3/checkout/tiptoppay-widget.client";
import type { TipTopWidgetParams } from "../../app/lib/case-lab-3/contracts";

const availability = {
  available: true,
  reason: "available" as const,
  tier: "early_bird" as const,
  amountMinor: 789000,
  currency: "KZT" as const,
  salesLimit: 70,
};

const paymentOpenState: CheckoutState = {
  phase: "payment_open",
  generation: 0,
  source: "hero",
  offer: { tier: "early_bird", amountMinor: 789000 },
  orderId: "order-1",
  orderNumber: "CL3-0001",
  reservationExpiresAt: "2026-09-23T10:15:00.000Z",
  attemptId: "attempt-1",
  externalId: "external-1",
};

const submittingState: CheckoutState = {
  phase: "submitting",
  generation: 0,
  source: "tickets",
  form: {
    firstName: "Aida",
    lastName: "Example",
    email: "aida@example.com",
    phone: "",
    company: "",
    position: "",
    marketingConsent: false,
    acceptedTerms: true,
  },
  offer: { tier: "early_bird", amountMinor: 789000 },
};

test("widget success enters server verification instead of paid", () => {
  const next = checkoutReducer(paymentOpenState, { type: "WIDGET_COMPLETE", generation: 0, result: "success" });
  assert.equal(next.phase, "verifying");
});

test("widget failure also enters server verification instead of trusting the callback", () => {
  const next = checkoutReducer(paymentOpenState, { type: "WIDGET_COMPLETE", generation: 0, result: "failure" });
  assert.equal(next.phase, "verifying");
});

test("async widget start rejection is surfaced as a safe retry error", async () => {
  const previousWindow = globalThis.window;

  class RejectingWidget {
    oncomplete?: (result: unknown) => void;

    start() {
      return {
        then: (_resolve: unknown, reject: (error: Error) => void) => {
          queueMicrotask(() => reject(new Error("provider failed")));
        },
      };
    }
  }

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: { tiptop: { Widget: RejectingWidget } },
  });

  try {
    await assert.rejects(
      Promise.race([
        startTipTopPayment({} as TipTopWidgetParams),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("widget start did not reject")), 50)),
      ]),
      /Платежный виджет временно недоступен/,
    );
  } finally {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Object.defineProperty(globalThis, "window", { configurable: true, value: previousWindow });
  }
});

test("changed offer requires explicit confirmation", () => {
  const next = checkoutReducer(submittingState, {
    type: "OFFER_CHANGED",
    generation: 0,
    requestPhase: "submitting",
    offer: { tier: "standard", amountMinor: 1500000 },
  });
  assert.equal(next.phase, "confirm_changed_offer");
  assert.deepEqual(next.offer, { tier: "standard", amountMinor: 1500000 });
});

test("submitting state ignores a second submit", () => {
  const next = checkoutReducer(submittingState, { type: "SUBMIT" });
  assert.strictEqual(next, submittingState);
});

test("availability reasons map to dedicated checkout phases", () => {
  const base: CheckoutState = { phase: "loading_availability", generation: 0, source: "navbar" };

  assert.equal(checkoutReducer(base, { type: "AVAILABILITY", generation: 0, requestPhase: "loading_availability", availability }).phase, "form");
  assert.equal(
    checkoutReducer(base, {
      type: "AVAILABILITY",
      generation: 0,
      requestPhase: "loading_availability",
      availability: { ...availability, available: false, reason: "early_bird_temporarily_reserved", tier: null, amountMinor: null },
    }).phase,
    "temporarily_reserved",
  );
  assert.equal(
    checkoutReducer(base, {
      type: "AVAILABILITY",
      generation: 0,
      requestPhase: "loading_availability",
      availability: { ...availability, available: false, reason: "sold_out", tier: null, amountMinor: null },
    }).phase,
    "sold_out",
  );
  assert.equal(
    checkoutReducer(base, {
      type: "AVAILABILITY",
      generation: 0,
      requestPhase: "loading_availability",
      availability: { ...availability, available: false, reason: "sales_closed", tier: null, amountMinor: null },
    }).phase,
    "closed",
  );
});

test("temporarily reserved availability can be checked again", () => {
  const temporarilyReserved: CheckoutState = {
    phase: "temporarily_reserved",
    generation: 3,
    source: "tickets",
    availability: { ...availability, available: false, reason: "early_bird_temporarily_reserved", tier: null, amountMinor: null },
  };

  const next = checkoutReducer(temporarilyReserved, { type: "RETRY_AVAILABILITY" });

  assert.equal(next.phase, "loading_availability");
  assert.equal(next.generation, 4);
});

test("server status determines paid, review, expired, and failed states", () => {
  const states: Array<[CheckoutEvent, CheckoutState["phase"]]> = [
    [{ type: "STATUS", generation: 0, status: "paid" }, "paid"],
    [{ type: "STATUS", generation: 0, status: "review_required" }, "review_required"],
    [{ type: "STATUS", generation: 0, status: "failed" }, "failed"],
  ];

  for (const [event, phase] of states) {
    assert.equal(checkoutReducer({ ...paymentOpenState, phase: "verifying" }, event).phase, phase);
  }

  assert.equal(
    checkoutReducer({ ...paymentOpenState, phase: "reserved" }, { type: "RESERVATION_EXPIRED", generation: 0 }).phase,
    "expired",
  );
});

test("payment-open expiry does not reject a late widget callback", () => {
  const afterExpiry = checkoutReducer(paymentOpenState, { type: "RESERVATION_EXPIRED", generation: 0 });

  assert.deepEqual(afterExpiry, paymentOpenState);
  assert.equal(
    checkoutReducer(afterExpiry, { type: "WIDGET_COMPLETE", generation: 0, result: "closed" }).phase,
    "verifying",
  );
});

test("script failures can be retried without losing the selected offer", () => {
  const errored = checkoutReducer(
    { ...paymentOpenState, phase: "loading_widget" },
    { type: "SCRIPT_ERROR", generation: 0, requestPhase: "loading_widget", message: "Widget unavailable" },
  );
  assert.equal(errored.phase, "script_error");
  assert.equal(checkoutReducer(errored, { type: "RETRY_WIDGET" }).phase, "loading_widget");
});

test("stale async results cannot change a checkout reopened after close", () => {
  const first = checkoutReducer(initialCheckoutState, { type: "OPEN", source: "hero" });
  const closed = checkoutReducer(first, { type: "CLOSE" });
  const reopened = checkoutReducer(closed, { type: "OPEN", source: "tickets" });
  const staleEvents = [
    { type: "AVAILABILITY", generation: 1, availability },
    { type: "ORDER_CREATED", generation: 1, orderId: "old-order", orderNumber: "OLD-1", tier: "early_bird", amountMinor: 789000, reservationExpiresAt: "2026-09-23T10:15:00.000Z" },
    { type: "ATTEMPT_READY", generation: 1, attemptId: "old-attempt", externalId: "old-external", reservationExpiresAt: "2026-09-23T10:15:00.000Z", widget: {} },
    { type: "WIDGET_COMPLETE", generation: 1, result: "success" },
    { type: "STATUS", generation: 1, status: "paid" },
  ] as unknown as CheckoutEvent[];

  for (const event of staleEvents) {
    assert.deepEqual(checkoutReducer(reopened, event), reopened);
  }
});

test("a response from before payment retry cannot launch a newer payment widget", () => {
  const failed = { ...paymentOpenState, phase: "failed", generation: 2 } as CheckoutState;
  const retried = checkoutReducer(failed, { type: "RETRY_PAYMENT" });
  const staleAttempt = {
    type: "ATTEMPT_READY",
    generation: 2,
    attemptId: "old-attempt",
    externalId: "old-external",
    reservationExpiresAt: "2026-09-23T10:15:00.000Z",
    widget: {},
  } as unknown as CheckoutEvent;

  assert.equal(retried.phase, "reserved");
  assert.deepEqual(checkoutReducer(retried, staleAttempt), retried);
});

test("payment callbacks are ignored after the checkout has closed", () => {
  const closed = checkoutReducer(paymentOpenState, { type: "CLOSE" });
  const callback = { type: "WIDGET_COMPLETE", generation: 1, result: "success" } as unknown as CheckoutEvent;

  assert.deepEqual(checkoutReducer(closed, callback), closed);
});

test("payment retry clears the old attempt before requesting a fresh server attempt", () => {
  const failed: CheckoutState = { ...paymentOpenState, phase: "failed" };
  const retried = checkoutReducer(failed, { type: "RETRY_PAYMENT" });

  assert.equal(retried.phase, "reserved");
  assert.equal(retried.attemptId, undefined);
  assert.equal(retried.externalId, undefined);
  assert.equal(retried.widget, undefined);
  assert.equal(retried.reservationExpiresAt, undefined);
});

test("client expiry cannot end verification before an authoritative paid status", () => {
  const verifying: CheckoutState = { ...paymentOpenState, phase: "verifying" };
  const afterExpiry = checkoutReducer(verifying, { type: "RESERVATION_EXPIRED", generation: 0 });

  assert.deepEqual(afterExpiry, verifying);
  assert.equal(checkoutReducer(afterExpiry, { type: "STATUS", generation: 0, status: "paid" }).phase, "paid");
});

test("widget lifecycle remains open to its callback before verification", () => {
  const loadingWidget: CheckoutState = { ...paymentOpenState, phase: "loading_widget" };
  const paymentOpen = checkoutReducer(loadingWidget, { type: "WIDGET_OPEN", generation: 0 });
  const verifying = checkoutReducer(paymentOpen, { type: "WIDGET_COMPLETE", generation: 0, result: "closed" });

  assert.equal(paymentOpen.phase, "payment_open");
  assert.equal(verifying.phase, "verifying");
});
