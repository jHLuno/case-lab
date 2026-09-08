"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  type ReactNode,
} from "react";

import type { AvailabilityResponse, OrderStatusResponse, TipTopWidgetParams } from "../../../lib/case-lab-3/contracts";
import { checkoutReducer, initialCheckoutState, type CheckoutPhase, type CheckoutSource } from "./checkout-machine";
import CaseLab3CheckoutDialog from "./CaseLab3CheckoutDialog";
import { loadTipTopWidget, startTipTopPayment } from "./tiptoppay-widget.client";

const OFFER_VERSION_ID = "offer-2026-09-07";
const PRIVACY_VERSION_ID = "privacy-2026-09-07";

type CheckoutContextValue = {
  openCheckout: (source: CheckoutSource) => void;
};

const CheckoutContext = createContext<CheckoutContextValue | null>(null);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAvailability(value: unknown): value is AvailabilityResponse {
  if (!isRecord(value)) return false;
  return (
    typeof value.available === "boolean" &&
    (value.reason === "available" ||
      value.reason === "early_bird_temporarily_reserved" ||
      value.reason === "sold_out" ||
      value.reason === "sales_closed" ||
      value.reason === "configuration_incomplete") &&
    (value.tier === null || value.tier === "early_bird" || value.tier === "standard") &&
    (value.amountMinor === null || (typeof value.amountMinor === "number" && Number.isSafeInteger(value.amountMinor))) &&
    value.currency === "KZT" &&
    typeof value.salesLimit === "number"
  );
}

function isTipTopWidgetParams(value: unknown): value is TipTopWidgetParams {
  return isRecord(value) &&
    typeof value.publicTerminalId === "string" &&
    typeof value.amount === "number" &&
    value.currency === "KZT" &&
    value.paymentSchema === "Single" &&
    typeof value.externalId === "string" &&
    typeof value.receiptEmail === "string" &&
    value.emailBehavior === "Hidden" &&
    value.tokenize === false &&
    value.retryPayment === false &&
    isRecord(value.userInfo) &&
    typeof value.userInfo.accountId === "string" &&
    typeof value.userInfo.firstName === "string" &&
    typeof value.userInfo.lastName === "string" &&
    typeof value.userInfo.email === "string";
}

function isOrderCreated(value: unknown): value is {
  orderId: string;
  orderNumber: string;
  tier: "early_bird" | "standard";
  amountMinor: number;
  reservationExpiresAt: string;
} {
  return isRecord(value) &&
    typeof value.orderId === "string" &&
    typeof value.orderNumber === "string" &&
    (value.tier === "early_bird" || value.tier === "standard") &&
    typeof value.amountMinor === "number" &&
    Number.isSafeInteger(value.amountMinor) &&
    typeof value.reservationExpiresAt === "string";
}

function isAttemptResponse(value: unknown): value is {
  attemptId: string;
  externalId: string;
  reservationExpiresAt: string;
  widget: TipTopWidgetParams;
} {
  return isRecord(value) &&
    typeof value.attemptId === "string" &&
    typeof value.externalId === "string" &&
    typeof value.reservationExpiresAt === "string" &&
    isTipTopWidgetParams(value.widget);
}

function isOrderStatus(value: unknown): value is OrderStatusResponse {
  return isRecord(value) &&
    typeof value.orderNumber === "string" &&
    (value.paymentStatus === "pending" ||
      value.paymentStatus === "processing" ||
      value.paymentStatus === "paid" ||
      value.paymentStatus === "failed" ||
      value.paymentStatus === "refund_pending" ||
      value.paymentStatus === "partially_refunded" ||
      value.paymentStatus === "refunded" ||
      value.paymentStatus === "review_required") &&
    (value.ticketStatus === "pending" || value.ticketStatus === "valid" || value.ticketStatus === "used" || value.ticketStatus === "cancelled") &&
    (value.receiptStatus === "not_requested" || value.receiptStatus === "queued" || value.receiptStatus === "issued" || value.receiptStatus === "error" || value.receiptStatus === "unknown") &&
    (value.emailStatus === "pending" || value.emailStatus === "sent" || value.emailStatus === "failed" || value.emailStatus === "unknown") &&
    (value.receiptUrl === null || typeof value.receiptUrl === "string");
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function attribution(): Record<string, string> {
  const result: Record<string, string> = {};
  const params = new URLSearchParams(window.location.search);
  for (const name of ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]) {
    const value = params.get(name);
    if (value) result[name] = value.slice(0, 512);
  }
  if (document.referrer) result.referrer = document.referrer.slice(0, 512);
  return result;
}

function isCurrentOperation(
  current: { generation: number; phase: CheckoutPhase },
  generation: number,
  phases: CheckoutPhase | CheckoutPhase[],
): boolean {
  const allowedPhases = Array.isArray(phases) ? phases : [phases];
  return current.generation === generation && allowedPhases.includes(current.phase);
}

type WidgetOperation = {
  generation: number;
  controller: AbortController;
  widgetOpen: boolean;
};

export default function CaseLab3CheckoutProvider({
  children,
  nonce,
}: {
  children: ReactNode;
  nonce?: string;
}) {
  const [state, dispatch] = useReducer(checkoutReducer, initialCheckoutState);
  const backgroundRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const operationRef = useRef<{ generation: number; phase: CheckoutPhase }>({ generation: initialCheckoutState.generation, phase: initialCheckoutState.phase });
  const orderRequestKeyRef = useRef<{ generation: number; key: string } | null>(null);
  const widgetOperationRef = useRef<WidgetOperation | null>(null);
  const wasOpenRef = useRef(false);
  const getOrderRequestIdempotencyKey = useCallback((generation: number): string => {
    if (orderRequestKeyRef.current?.generation === generation) return orderRequestKeyRef.current.key;

    const key = crypto.randomUUID();
    orderRequestKeyRef.current = { generation, key };
    return key;
  }, []);
  const openCheckout = useCallback((source: CheckoutSource) => {
    if (typeof document !== "undefined") {
      openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    dispatch({ type: "OPEN", source });
  }, []);

  const isOpen = state.phase !== "idle";

  useEffect(() => {
    operationRef.current = { generation: state.generation, phase: state.phase };
  }, [state.generation, state.phase]);

  useEffect(() => {
    const backgrounds = [
      backgroundRef.current,
      document.querySelector<HTMLElement>("[data-case-lab-global-skip-link]"),
    ].filter((element): element is HTMLElement => element !== null);
    if (backgrounds.length === 0) return;

    const previousAttributes = backgrounds.map((element) => ({
      element,
      ariaHidden: element.getAttribute("aria-hidden"),
      inert: element.hasAttribute("inert"),
    }));
    const restoreBackground = () => {
      previousAttributes.forEach(({ element, ariaHidden, inert }) => {
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
        if (!inert) element.removeAttribute("inert");
      });
    };

    if (isOpen) {
      backgrounds.forEach((element) => {
        element.setAttribute("aria-hidden", "true");
        element.setAttribute("inert", "");
      });
    } else {
      restoreBackground();
    }

    return restoreBackground;
  }, [isOpen]);

  useEffect(() => {
    if (wasOpenRef.current && !isOpen) {
      requestAnimationFrame(() => openerRef.current?.focus());
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useEffect(() => {
    if (state.phase !== "loading_availability") return;
    const controller = new AbortController();
    const generation = state.generation;

    async function fetchAvailability() {
      try {
        const response = await fetch("/api/case-lab-3/availability", {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await readJson(response);
        if (!response.ok || !isAvailability(payload)) throw new Error("Availability unavailable");
        if (isCurrentOperation(operationRef.current, generation, "loading_availability")) {
          dispatch({ type: "AVAILABILITY", generation, requestPhase: "loading_availability", availability: payload });
        }
      } catch (error) {
        if (!controller.signal.aborted && isCurrentOperation(operationRef.current, generation, "loading_availability")) {
          dispatch({ type: "AVAILABILITY_ERROR", generation, message: error instanceof Error ? error.message : undefined });
        }
      }
    }

    void fetchAvailability();
    return () => controller.abort();
  }, [state.generation, state.phase]);

  useEffect(() => {
    if (state.phase !== "submitting" || !state.form || !state.offer) return;
    const controller = new AbortController();
    const generation = state.generation;

    async function createOrderRequest() {
      try {
        const response = await fetch("/api/case-lab-3/orders", {
          method: "POST",
          signal: controller.signal,
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": getOrderRequestIdempotencyKey(generation),
          },
          body: JSON.stringify({
            firstName: state.form?.firstName,
            lastName: state.form?.lastName,
            email: state.form?.email,
            phone: state.form?.phone || null,
            company: state.form?.company || null,
            position: state.form?.position || null,
            expectedTier: state.offer?.tier,
            expectedAmountMinor: state.offer?.amountMinor,
             offerVersionId: OFFER_VERSION_ID,
             privacyVersionId: PRIVACY_VERSION_ID,
             acceptedTerms: state.form?.acceptedTerms ?? false,
             marketingConsent: state.form?.marketingConsent ?? false,
            attribution: attribution(),
          }),
        });
        const payload = await readJson(response);
        if (response.status === 409 && isRecord(payload) && isAvailability(payload.availability)) {
          if (payload.error === "offer_changed" && payload.availability.available && payload.availability.tier && payload.availability.amountMinor !== null) {
            if (isCurrentOperation(operationRef.current, generation, "submitting")) {
              dispatch({ type: "OFFER_CHANGED", generation, requestPhase: "submitting", offer: { tier: payload.availability.tier, amountMinor: payload.availability.amountMinor }, availability: payload.availability });
            }
          } else if (isCurrentOperation(operationRef.current, generation, "submitting")) {
            dispatch({ type: "AVAILABILITY", generation, requestPhase: "submitting", availability: payload.availability });
          }
          return;
        }
        if (!response.ok || !isOrderCreated(payload)) throw new Error("Order unavailable");
        if (isCurrentOperation(operationRef.current, generation, "submitting")) {
          dispatch({ type: "ORDER_CREATED", generation, ...payload });
        }
      } catch (error) {
        if (!controller.signal.aborted && isCurrentOperation(operationRef.current, generation, "submitting")) {
          dispatch({ type: "ORDER_ERROR", generation, message: error instanceof Error ? error.message : undefined });
        }
      }
    }

    void createOrderRequest();
    return () => controller.abort();
  }, [getOrderRequestIdempotencyKey, state.form, state.generation, state.offer, state.phase]);

  useEffect(() => {
    if (state.phase !== "reserved" || !state.orderId) return;
    const controller = new AbortController();
    const generation = state.generation;

    async function createAttemptRequest() {
      try {
        const response = await fetch(`/api/case-lab-3/orders/${encodeURIComponent(state.orderId ?? "")}/payment-attempts`, {
          method: "POST",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
        });
        const payload = await readJson(response);
        if (response.status === 409 && isRecord(payload) && isAvailability(payload.availability) && payload.availability.available && payload.availability.tier && payload.availability.amountMinor !== null) {
          if (isCurrentOperation(operationRef.current, generation, "reserved")) {
            dispatch({ type: "OFFER_CHANGED", generation, requestPhase: "reserved", offer: { tier: payload.availability.tier, amountMinor: payload.availability.amountMinor }, availability: payload.availability });
          }
          return;
        }
        if (response.status === 409 && isRecord(payload) && isAvailability(payload.availability)) {
          if (isCurrentOperation(operationRef.current, generation, "reserved")) {
            dispatch({ type: "AVAILABILITY", generation, requestPhase: "reserved", availability: payload.availability });
          }
          return;
        }
        if (!response.ok || !isAttemptResponse(payload)) throw new Error("Payment attempt unavailable");
        if (isCurrentOperation(operationRef.current, generation, "reserved")) {
          dispatch({ type: "ATTEMPT_READY", generation, ...payload });
        }
      } catch (error) {
        if (!controller.signal.aborted && isCurrentOperation(operationRef.current, generation, "reserved")) {
          dispatch({ type: "SCRIPT_ERROR", generation, requestPhase: "reserved", message: error instanceof Error ? error.message : undefined });
        }
      }
    }

    void createAttemptRequest();
    return () => controller.abort();
  }, [state.generation, state.orderId, state.phase]);

  useEffect(() => {
    if (operationRef.current.phase !== "loading_widget" || !state.widget) return;
    const controller = new AbortController();
    const generation = state.generation;
    const widget = state.widget;
    const widgetOperation: WidgetOperation = { generation, controller, widgetOpen: false };
    widgetOperationRef.current = widgetOperation;

    async function launchPaymentWidget() {
      let widgetOpen = false;
      try {
        if (!nonce) throw new Error("TipTop Pay widget nonce is unavailable");
        await loadTipTopWidget(nonce, controller.signal);
        if (controller.signal.aborted) return;
        if (!isCurrentOperation(operationRef.current, generation, "loading_widget")) return;
        widgetOperation.widgetOpen = true;
        dispatch({ type: "WIDGET_OPEN", generation });
        widgetOpen = true;
        const result = await startTipTopPayment(widget);
        if (!controller.signal.aborted && isCurrentOperation(operationRef.current, generation, ["loading_widget", "payment_open"])) {
          dispatch({ type: "WIDGET_COMPLETE", generation, result });
        }
      } catch (error) {
        const requestPhase = widgetOpen ? "payment_open" : "loading_widget";
        if (!controller.signal.aborted && operationRef.current.generation === generation) {
          dispatch({ type: "SCRIPT_ERROR", generation, requestPhase, message: error instanceof Error ? error.message : undefined });
        }
      } finally {
        if (widgetOperationRef.current === widgetOperation) widgetOperationRef.current = null;
      }
    }

    void launchPaymentWidget();
    return () => {
      if (widgetOperationRef.current === widgetOperation) widgetOperationRef.current = null;
      if (!widgetOperation.widgetOpen) controller.abort();
    };
  }, [nonce, state.generation, state.widget]);

  useEffect(() => {
    if (state.phase !== "verifying" || !state.orderId) return;
    const controller = new AbortController();
    const generation = state.generation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempts = 0;

    async function pollStatus() {
      try {
        const response = await fetch(`/api/case-lab-3/orders/${encodeURIComponent(state.orderId ?? "")}/status`, {
          signal: controller.signal,
          cache: "no-store",
        });
        const payload = await readJson(response);
        if (!response.ok || !isOrderStatus(payload)) throw new Error("Status unavailable");

        if (payload.paymentStatus === "paid" || payload.paymentStatus === "failed" || payload.paymentStatus === "review_required") {
           dispatch({ type: "STATUS", generation, status: payload.paymentStatus });
          return;
        }

        attempts += 1;
        if (attempts >= 90) {
           dispatch({ type: "STATUS", generation, status: "review_required" });
          return;
        }
        timer = setTimeout(pollStatus, 1000);
      } catch {
        if (controller.signal.aborted) return;
        attempts += 1;
        if (attempts >= 90) {
           dispatch({ type: "STATUS", generation, status: "review_required" });
          return;
        }
        timer = setTimeout(pollStatus, 1000);
      }
    }

    void pollStatus();
    return () => {
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [state.generation, state.orderId, state.phase]);

  useEffect(() => {
    if (!state.reservationExpiresAt || !["reserved", "loading_widget"].includes(state.phase)) return;
    const generation = state.generation;
    const expireReservation = () => {
      const widgetOperation = widgetOperationRef.current;
      if (widgetOperation?.generation === generation && !widgetOperation.widgetOpen) {
        widgetOperation.controller.abort();
      }
      dispatch({ type: "RESERVATION_EXPIRED", generation });
    };
    const remaining = new Date(state.reservationExpiresAt).getTime() - Date.now();
    if (!Number.isFinite(remaining) || remaining <= 0) {
      expireReservation();
      return;
    }

    const timer = window.setTimeout(expireReservation, remaining);
    return () => window.clearTimeout(timer);
  }, [state.generation, state.phase, state.reservationExpiresAt]);

  return (
    <CheckoutContext.Provider value={{ openCheckout }}>
      <div ref={backgroundRef}>{children}</div>
      <CaseLab3CheckoutDialog state={state} dispatch={dispatch} />
    </CheckoutContext.Provider>
  );
}

export function useCaseLab3Checkout(): CheckoutContextValue {
  const context = useContext(CheckoutContext);
  if (!context) throw new Error("useCaseLab3Checkout must be used within CaseLab3CheckoutProvider");
  return context;
}
