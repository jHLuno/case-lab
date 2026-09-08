export type PaymentEnvironment = "test" | "live";

export type TicketTier = "early_bird" | "standard";

export type AvailabilityReason =
  | "available"
  | "early_bird_temporarily_reserved"
  | "sold_out"
  | "sales_closed"
  | "configuration_incomplete";

export type AvailabilityResponse = {
  available: boolean;
  reason: AvailabilityReason;
  tier: TicketTier | null;
  amountMinor: number | null;
  currency: "KZT";
  salesLimit: number;
};

export type OrderInput = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  expectedTier: TicketTier;
  expectedAmountMinor: number;
  offerVersionId: string;
  privacyVersionId: string;
  acceptedTerms: boolean;
  marketingConsent: boolean;
  attribution: Record<string, string>;
};

export type CreateOrderResult =
  | {
      kind: "created";
      orderId: string;
      orderNumber: string;
      tier: TicketTier;
      amountMinor: number;
      reservationExpiresAt: string;
    }
  | { kind: "offer_changed"; availability: AvailabilityResponse }
  | { kind: "unavailable"; availability: AvailabilityResponse };

export type PaymentAttemptResponse = {
  attemptId: string;
  externalId: string;
  reservationExpiresAt: string;
  widget: TipTopWidgetParams;
};

export type TipTopWidgetParams = {
  publicTerminalId: string;
  amount: number;
  currency: "KZT";
  paymentSchema: "Single";
  externalId: string;
  receiptEmail: string;
  emailBehavior: "Hidden";
  tokenize: false;
  retryPayment: false;
  userInfo: {
    accountId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
};

export type OrderStatusResponse = {
  orderNumber: string;
  paymentStatus:
    | "pending"
    | "processing"
    | "paid"
    | "failed"
    | "refund_pending"
    | "partially_refunded"
    | "refunded"
    | "review_required";
  ticketStatus: "pending" | "valid" | "used" | "cancelled";
  receiptStatus: "not_requested" | "queued" | "issued" | "error" | "unknown";
  emailStatus: "pending" | "sent" | "failed" | "unknown";
  receiptUrl: string | null;
};
