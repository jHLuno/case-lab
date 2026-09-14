import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  pushCaseLab3Event,
  type CaseLab3AnalyticsEvent,
} from "../../app/components/case-lab-3/analytics";

type TestWindow = Window & { dataLayer?: unknown[] };

function installWindow(dataLayer?: unknown[]): TestWindow {
  const value = (dataLayer === undefined ? {} : { dataLayer }) as TestWindow;
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value,
  });
  return value;
}

afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

describe("Case Lab III analytics", () => {
  it("pushes a safe event into the GTM dataLayer", () => {
    const browserWindow = installWindow([]);
    const event: CaseLab3AnalyticsEvent = {
      name: "case_lab_3_cta_clicked",
      source: "hero",
    };

    pushCaseLab3Event(event);

    assert.deepEqual(browserWindow.dataLayer, [{
      event: "case_lab_3_cta_clicked",
      source: "hero",
    }]);
  });

  it("does not include personal data in the public event contract", () => {
    const browserWindow = installWindow([]);

    pushCaseLab3Event({ name: "case_lab_3_payment_failed" });

    assert.deepEqual(browserWindow.dataLayer, [{ event: "case_lab_3_payment_failed" }]);
    assert.equal("email" in (browserWindow.dataLayer?.[0] as Record<string, unknown>), false);
    assert.equal("orderId" in (browserWindow.dataLayer?.[0] as Record<string, unknown>), false);
  });

  it("is a no-op when called during server rendering", () => {
    assert.doesNotThrow(() => pushCaseLab3Event({ name: "case_lab_3_checkout_opened", source: "tickets" }));
  });

  it("preserves an existing dataLayer", () => {
    const browserWindow = installWindow([{ event: "gtm.start" }]);

    pushCaseLab3Event({ name: "case_lab_3_form_submitted" });

    assert.deepEqual(browserWindow.dataLayer, [
      { event: "gtm.start" },
      { event: "case_lab_3_form_submitted" },
    ]);
  });
});
