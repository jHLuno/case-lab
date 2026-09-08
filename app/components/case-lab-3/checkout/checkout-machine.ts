import type { AvailabilityResponse, TicketTier, TipTopWidgetParams } from "../../../lib/case-lab-3/contracts";

export type CheckoutSource = "navbar" | "hero" | "tickets" | "footer";

export type CheckoutPhase =
  | "idle"
  | "loading_availability"
  | "form"
  | "submitting"
  | "confirm_changed_offer"
  | "reserved"
  | "loading_widget"
  | "payment_open"
  | "verifying"
  | "paid"
  | "failed"
  | "review_required"
  | "expired"
  | "temporarily_reserved"
  | "sold_out"
  | "closed"
  | "script_error";

export type CheckoutForm = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company: string;
  position: string;
  acceptedTerms: boolean;
  marketingConsent: boolean;
};

export type CheckoutOffer = {
  tier: TicketTier;
  amountMinor: number;
};

export type CheckoutState = {
  phase: CheckoutPhase;
  generation: number;
  source: CheckoutSource | null;
  form?: CheckoutForm;
  offer?: CheckoutOffer;
  availability?: AvailabilityResponse;
  orderId?: string;
  orderNumber?: string;
  reservationExpiresAt?: string;
  attemptId?: string;
  externalId?: string;
  widget?: TipTopWidgetParams;
  errorMessage?: string;
  canRetry?: boolean;
};

export type CheckoutEvent =
  | { type: "OPEN"; source: CheckoutSource }
  | { type: "CLOSE" }
  | { type: "RESET" }
  | { type: "AVAILABILITY"; generation: number; requestPhase: "loading_availability" | "submitting" | "reserved"; availability: AvailabilityResponse }
  | { type: "AVAILABILITY_ERROR"; generation: number; message?: string }
  | { type: "FIELD_CHANGED"; field: keyof CheckoutForm; value: string | boolean }
  | { type: "SUBMIT" }
  | { type: "OFFER_CHANGED"; generation: number; requestPhase: "submitting" | "reserved"; offer: CheckoutOffer; availability?: AvailabilityResponse }
  | { type: "ORDER_ERROR"; generation: number; message?: string }
  | { type: "CONFIRM_CHANGED_OFFER" }
  | {
      type: "ORDER_CREATED";
      generation: number;
      orderId: string;
      orderNumber: string;
      tier: TicketTier;
      amountMinor: number;
      reservationExpiresAt: string;
    }
  | {
      type: "ATTEMPT_READY";
      generation: number;
      attemptId: string;
      externalId: string;
      reservationExpiresAt: string;
      widget: TipTopWidgetParams;
    }
  | { type: "WIDGET_OPEN"; generation: number }
  | { type: "WIDGET_COMPLETE"; generation: number; result: "success" | "failure" | "cancelled" | "closed" }
  | { type: "STATUS"; generation: number; status: "paid" | "failed" | "review_required" | "processing" | "pending" }
  | { type: "RESERVATION_EXPIRED"; generation: number }
  | { type: "SCRIPT_ERROR"; generation: number; requestPhase: "reserved" | "loading_widget" | "payment_open"; message?: string }
  | { type: "RETRY_WIDGET" }
  | { type: "RETRY_PAYMENT" }
  | { type: "RETRY_AVAILABILITY" };

export const initialCheckoutForm: CheckoutForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  company: "",
  position: "",
  acceptedTerms: false,
  marketingConsent: false,
};

export const initialCheckoutState: CheckoutState = {
  phase: "idle",
  generation: 0,
  source: null,
  form: initialCheckoutForm,
};

function withPhase(state: CheckoutState, phase: CheckoutPhase, extra: Partial<CheckoutState> = {}): CheckoutState {
  return { ...state, phase, ...extra };
}

function availabilityPhase(availability: AvailabilityResponse): CheckoutPhase {
  if (availability.available) return "form";
  if (availability.reason === "early_bird_temporarily_reserved") return "temporarily_reserved";
  if (availability.reason === "sold_out") return "sold_out";
  if (availability.reason === "sales_closed") return "closed";
  return "script_error";
}

function offerFromAvailability(availability: AvailabilityResponse): CheckoutOffer | undefined {
  if (!availability.available || !availability.tier || availability.amountMinor === null) return undefined;
  return { tier: availability.tier, amountMinor: availability.amountMinor };
}

function acceptsAsyncEvent(
  state: CheckoutState,
  event: { generation: number },
  phases: CheckoutPhase | CheckoutPhase[],
): boolean {
  const allowedPhases = Array.isArray(phases) ? phases : [phases];
  return event.generation === state.generation && allowedPhases.includes(state.phase);
}

function resetWithNextGeneration(state: CheckoutState): CheckoutState {
  return { ...initialCheckoutState, generation: state.generation + 1 };
}

export function checkoutReducer(state: CheckoutState, event: CheckoutEvent): CheckoutState {
  switch (event.type) {
    case "OPEN":
      return {
        ...initialCheckoutState,
        generation: state.generation + 1,
        phase: "loading_availability",
        source: event.source,
        form: state.form ?? initialCheckoutForm,
      };
    case "CLOSE":
    case "RESET":
      return resetWithNextGeneration(state);
    case "AVAILABILITY": {
      if (!acceptsAsyncEvent(state, event, event.requestPhase)) return state;
      const offer = offerFromAvailability(event.availability);
      return withPhase(state, availabilityPhase(event.availability), {
        availability: event.availability,
        offer,
        errorMessage: undefined,
        canRetry: false,
      });
    }
    case "AVAILABILITY_ERROR":
      if (!acceptsAsyncEvent(state, event, "loading_availability")) return state;
      return withPhase(state, "script_error", {
        errorMessage: event.message ?? "Не удалось проверить наличие билетов.",
        canRetry: true,
      });
    case "RETRY_AVAILABILITY":
      return state.phase === "script_error" || state.phase === "temporarily_reserved" || state.phase === "sold_out" || state.phase === "closed"
        ? withPhase(state, "loading_availability", { generation: state.generation + 1, errorMessage: undefined, canRetry: false })
        : state;
    case "FIELD_CHANGED":
      if (state.phase !== "form" && state.phase !== "confirm_changed_offer") return state;
      return { ...state, form: { ...(state.form ?? initialCheckoutForm), [event.field]: event.value } as CheckoutForm };
    case "SUBMIT":
      return state.phase === "form" || state.phase === "confirm_changed_offer"
        ? withPhase(state, "submitting", { generation: state.generation + 1, errorMessage: undefined, canRetry: false })
        : state;
    case "OFFER_CHANGED":
      if (!acceptsAsyncEvent(state, event, event.requestPhase)) return state;
      return withPhase(state, "confirm_changed_offer", {
        offer: event.offer,
        availability: event.availability ?? state.availability,
        errorMessage: undefined,
        canRetry: false,
      });
    case "ORDER_ERROR":
      if (!acceptsAsyncEvent(state, event, "submitting")) return state;
      return withPhase(state, "script_error", {
        errorMessage: event.message ?? "Не удалось создать заказ.",
        canRetry: true,
      });
    case "CONFIRM_CHANGED_OFFER":
      return state.phase === "confirm_changed_offer"
        ? withPhase(state, "submitting", { generation: state.generation + 1, canRetry: false })
        : state;
    case "ORDER_CREATED":
      if (!acceptsAsyncEvent(state, event, "submitting")) return state;
      return withPhase(state, "reserved", {
        orderId: event.orderId,
        orderNumber: event.orderNumber,
        offer: { tier: event.tier, amountMinor: event.amountMinor },
        reservationExpiresAt: event.reservationExpiresAt,
        attemptId: undefined,
        externalId: undefined,
        widget: undefined,
        errorMessage: undefined,
        canRetry: false,
      });
    case "ATTEMPT_READY":
      if (!acceptsAsyncEvent(state, event, "reserved")) return state;
      return withPhase(state, "loading_widget", {
        attemptId: event.attemptId,
        externalId: event.externalId,
        reservationExpiresAt: event.reservationExpiresAt,
        widget: event.widget,
        errorMessage: undefined,
        canRetry: false,
      });
    case "WIDGET_OPEN":
      return acceptsAsyncEvent(state, event, "loading_widget") ? withPhase(state, "payment_open", { canRetry: false }) : state;
    case "WIDGET_COMPLETE":
      // The widget callback only tells the UI to begin authoritative polling.
      return acceptsAsyncEvent(state, event, "payment_open")
        ? withPhase(state, "verifying", { errorMessage: undefined, canRetry: false })
        : state;
    case "STATUS":
      if (!acceptsAsyncEvent(state, event, "verifying")) return state;
      if (event.status === "paid") return withPhase(state, "paid", { canRetry: false });
      if (event.status === "failed") return withPhase(state, "failed", { canRetry: true });
      if (event.status === "review_required") return withPhase(state, "review_required", { canRetry: false });
      return withPhase(state, "verifying", { canRetry: false });
    case "RESERVATION_EXPIRED":
      return acceptsAsyncEvent(state, event, ["reserved", "loading_widget"])
        ? withPhase(state, "expired", { canRetry: false })
        : state;
    case "SCRIPT_ERROR":
      if (!acceptsAsyncEvent(state, event, event.requestPhase)) return state;
      return withPhase(state, "script_error", {
        errorMessage: event.message ?? "Платежный виджет временно недоступен.",
        canRetry: true,
      });
    case "RETRY_WIDGET":
      return state.phase === "script_error"
        ? withPhase(state, "loading_widget", { generation: state.generation + 1, errorMessage: undefined, canRetry: false })
        : state;
    case "RETRY_PAYMENT":
      if (state.phase !== "failed" && state.phase !== "expired") return state;
      return state.orderId
        ? withPhase(state, "reserved", {
            generation: state.generation + 1,
            attemptId: undefined,
            externalId: undefined,
            widget: undefined,
            reservationExpiresAt: undefined,
            errorMessage: undefined,
            canRetry: false,
          })
        : withPhase(state, "loading_availability", { generation: state.generation + 1, errorMessage: undefined, canRetry: false });
    default:
      return state;
  }
}
