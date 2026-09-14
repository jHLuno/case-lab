"use client";

import type { CheckoutSource } from "./checkout/checkout-machine";

export type CaseLab3AnalyticsEvent =
  | { name: "case_lab_3_cta_clicked"; source: CheckoutSource }
  | { name: "case_lab_3_checkout_opened"; source: CheckoutSource }
  | { name: "case_lab_3_form_submitted" }
  | { name: "case_lab_3_payment_started" }
  | { name: "case_lab_3_widget_error"; stage: "load" | "payment" }
  | { name: "case_lab_3_payment_failed" };

type AnalyticsWindow = Window & { dataLayer?: unknown[] };

export function pushCaseLab3Event(event: CaseLab3AnalyticsEvent): void {
  if (typeof window === "undefined") return;

  const browserWindow = window as AnalyticsWindow;
  if (!Array.isArray(browserWindow.dataLayer)) browserWindow.dataLayer = [];

  const { name, ...parameters } = event;
  browserWindow.dataLayer.push({ event: name, ...parameters });
}
