import type {
  AvailabilityResponse,
  CreateOrderResult,
  OrderInput,
  PaymentEnvironment,
  TicketTier,
} from "./contracts";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PaymentStatus =
  | "pending"
  | "processing"
  | "paid"
  | "failed"
  | "refund_pending"
  | "partially_refunded"
  | "refunded"
  | "review_required";

export type ReservationStatus = "active" | "processing" | "consumed" | "expired" | "released";
export type PaymentAttemptStatus = "created" | "check_approved" | "completed" | "failed" | "review_required";
export type FiscalStatus = "not_requested" | "queued" | "issued" | "error" | "unknown";
export type TicketStatus = "valid" | "used" | "cancelled";
// The order summary exposes a pending state before a ticket row exists.
// The ticket record itself intentionally uses TicketStatus and never pending.
export type OrderSummaryTicketStatus = "pending" | TicketStatus;
export type OrderTicketStatus = OrderSummaryTicketStatus;
export type EmailStatus = "pending" | "sent" | "failed" | "unknown";
export type RefundStatus = "requested" | "processing" | "confirmed" | "failed" | "unknown" | "review_required";
export type JobStatus = "pending" | "leased" | "completed" | "failed" | "unknown";
export type PolicyStatus = "draft" | "approved" | "retired";
export type IncidentStatus = "open" | "investigating" | "resolved" | "ignored";
export type DocumentKind = "offer" | "privacy";
export type FiscalPurpose = "payment_income" | "service_settlement_income" | "refund_income_return";
export type FiscalReceiptType = "Income" | "IncomeReturn";
export type ProviderName = "tiptoppay" | "kassir";

export type SupportedFiscalPayloadFields = {
  vat: "omitted_or_null";
  taxation_system: 0;
  calculation_place: "caselab.kz";
  calculation_method: "full_payment";
};

export type SupportedFiscalPolicyDefinition = [
  {
    purpose: "payment_income";
    trigger: "payment_confirmed";
    depends_on_purpose: null;
    provider_receipt_type: "Income";
    payload_fields: SupportedFiscalPayloadFields;
    schedule: "immediate";
  },
  {
    purpose: "refund_income_return";
    trigger: "refund_confirmed";
    depends_on_purpose: "payment_income";
    provider_receipt_type: "IncomeReturn";
    payload_fields: SupportedFiscalPayloadFields;
    schedule: "after_dependency";
  },
];

export type FiscalPolicyVersionRow = {
  id: string;
  environment: PaymentEnvironment;
  version_number: number;
  policy_key: string;
  policy_status: PolicyStatus;
  is_test_policy: boolean;
  is_accountant_approved: boolean;
  required_purposes: FiscalPurpose[];
  policy_definition: SupportedFiscalPolicyDefinition;
  policy_hash: string;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FiscalPolicyVersionInsert = Omit<
  FiscalPolicyVersionRow,
  "id" | "created_at" | "updated_at" | "policy_status" | "is_test_policy" | "is_accountant_approved"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  policy_status?: PolicyStatus;
  is_test_policy?: boolean;
  is_accountant_approved?: boolean;
};

export type FiscalPolicyVersionUpdate = Partial<FiscalPolicyVersionInsert>;

export type LegalDocumentVersionRow = {
  id: string;
  environment: PaymentEnvironment;
  document_kind: DocumentKind;
  version_id: string;
  url: string;
  publication_label: string;
  content_snapshot: string;
  content_hash: string;
  is_active: boolean;
  activated_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LegalDocumentVersionInsert = Omit<LegalDocumentVersionRow, "id" | "created_at" | "updated_at" | "is_active"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  is_active?: boolean;
};

export type LegalDocumentVersionUpdate = Partial<LegalDocumentVersionInsert>;

export type EventSettingsRow = {
  id: string;
  environment: PaymentEnvironment;
  early_bird_amount_minor: number;
  standard_amount_minor: number;
  early_bird_quota: number;
  online_sales_limit: number;
  venue_capacity: number;
  sales_cutoff: string;
  sales_enabled: boolean;
  seller_label: string;
  taxation_system: number;
  vat_rate: number | null;
  early_bird_receipt_label: string;
  standard_receipt_label: string;
  calculation_place: string;
  active_fiscal_policy_version_id: string | null;
  active_offer_version_id: string | null;
  active_privacy_version_id: string | null;
  configuration_version: number;
  latest_worker_heartbeat_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IdempotencyScope = "order" | "payment" | "ticket" | "email" | "fiscal" | "worker";

export type IdempotencyRecordRow = {
  id: string;
  environment: PaymentEnvironment;
  scope: IdempotencyScope;
  idempotency_key: string;
  request_hash: string;
  result: Json;
  created_at: string;
  expires_at: string | null;
};

export type IdempotencyRecordInsert = Omit<IdempotencyRecordRow, "id" | "created_at"> & {
  id?: string;
  created_at?: string;
};

export type EventSettingsInsert = Omit<
  EventSettingsRow,
  | "id"
  | "created_at"
  | "updated_at"
  | "sales_enabled"
  | "seller_label"
  | "taxation_system"
  | "early_bird_receipt_label"
  | "standard_receipt_label"
  | "calculation_place"
  | "configuration_version"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  sales_enabled?: boolean;
  seller_label?: string;
  taxation_system?: number;
  early_bird_receipt_label?: string;
  standard_receipt_label?: string;
  calculation_place?: string;
  configuration_version?: number;
};

export type EventSettingsUpdate = Partial<EventSettingsInsert>;

export type InventoryAllocationRow = {
  id: string;
  environment: PaymentEnvironment;
  allocation_category: "paid" | "invited" | "organizer_reserved";
  quantity: number;
  tier: TicketTier | null;
  counts_toward_online_limit: boolean;
  holds_early_bird_quota: boolean;
  ticket_id: string | null;
  reason: string;
  actor_label: string;
  released_at: string | null;
  released_by: string | null;
  release_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type InventoryAllocationInsert = Omit<InventoryAllocationRow, "id" | "created_at" | "updated_at" | "counts_toward_online_limit" | "holds_early_bird_quota"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  counts_toward_online_limit?: boolean;
  holds_early_bird_quota?: boolean;
};

export type InventoryAllocationUpdate = Partial<InventoryAllocationInsert>;

export type OrderRow = {
  id: string;
  order_number: string;
  idempotency_key: string;
  environment: PaymentEnvironment;
  order_type: "single_ticket";
  first_name: string;
  last_name: string;
  participant_email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  purchaser_email: string;
  fiscal_email: string;
  original_contact_snapshot: Json;
  tier: TicketTier;
  amount_minor: number;
  currency: "KZT";
  receipt_label: string;
  taxation_system: number;
  vat_rate: number | null;
  configuration_version: number;
  offer_version_id: string;
  privacy_version_id: string;
  accepted_at: string;
  marketing_consent: boolean;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: string | null;
  utm_content: string | null;
  referrer: string | null;
  ga_client_id: string | null;
  payment_status: PaymentStatus;
  ticket_status: OrderSummaryTicketStatus;
  receipt_status: FiscalStatus;
  email_status: EmailStatus;
  paid_amount_minor: number;
  refunded_amount_minor: number;
  refundable_amount_minor: number;
  order_access_token_version: number;
  order_access_revoked_at: string | null;
  reservation_expires_at: string | null;
  paid_at: string | null;
  refunded_at: string | null;
  created_at: string;
  updated_at: string;
};

export type OrderInsert = Omit<
  OrderRow,
  | "id"
  | "created_at"
  | "updated_at"
  | "order_type"
  | "currency"
  | "taxation_system"
  | "marketing_consent"
  | "payment_status"
  | "ticket_status"
  | "receipt_status"
  | "email_status"
  | "paid_amount_minor"
  | "refunded_amount_minor"
  | "refundable_amount_minor"
  | "order_access_token_version"
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  order_type?: "single_ticket";
  currency?: "KZT";
  taxation_system?: number;
  marketing_consent?: boolean;
  payment_status?: PaymentStatus;
  ticket_status?: OrderSummaryTicketStatus;
  receipt_status?: FiscalStatus;
  email_status?: EmailStatus;
  paid_amount_minor?: number;
  refunded_amount_minor?: number;
  refundable_amount_minor?: number;
  order_access_token_version?: number;
};

export type OrderUpdate = Partial<OrderInsert>;

export type ReservationRow = {
  id: string;
  order_id: string;
  environment: PaymentEnvironment;
  tier: TicketTier;
  expires_at: string;
  status: ReservationStatus;
  admitted_payment_attempt_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ReservationInsert = Omit<ReservationRow, "id" | "created_at" | "updated_at" | "status" | "admitted_payment_attempt_id"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  status?: ReservationStatus;
  admitted_payment_attempt_id?: string | null;
};

export type ReservationUpdate = Partial<ReservationInsert>;

export type PaymentAttemptRow = {
  id: string;
  external_id: string;
  order_id: string;
  reservation_id: string;
  environment: PaymentEnvironment;
  amount_minor: number;
  currency: "KZT";
  provider_transaction_id: string | null;
  status: PaymentAttemptStatus;
  failure_code: string | null;
  failure_reason: string | null;
  check_approved_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentAttemptInsert = Omit<PaymentAttemptRow, "id" | "created_at" | "updated_at" | "currency" | "status"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  currency?: "KZT";
  status?: PaymentAttemptStatus;
};

export type PaymentAttemptUpdate = Partial<PaymentAttemptInsert>;

export type ProviderEventRow = {
  id: string;
  environment: PaymentEnvironment;
  provider: ProviderName;
  event_type: string;
  provider_event_id: string | null;
  external_id: string | null;
  provider_transaction_id: string | null;
  order_id: string | null;
  payment_attempt_id: string | null;
  refund_id: string | null;
  body_hash: string;
  verified_at: string;
  sanitized_fields: Json;
  processing_result: string;
  incident_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ProviderEventInsert = Omit<ProviderEventRow, "id" | "created_at" | "updated_at" | "sanitized_fields" | "order_id" | "payment_attempt_id" | "refund_id"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  sanitized_fields?: Json;
  order_id?: string | null;
  payment_attempt_id?: string | null;
  refund_id?: string | null;
};

export type ProviderEventUpdate = Partial<ProviderEventInsert>;

export type FiscalOperationRow = {
  id: string;
  environment: PaymentEnvironment;
  order_id: string;
  payment_attempt_id: string | null;
  refund_id: string | null;
  fiscal_policy_version_id: string;
  policy_purpose: FiscalPurpose;
  provider_receipt_type: FiscalReceiptType;
  amount_minor: number;
  currency: "KZT";
  payload_snapshot: Json;
  request_hash: string;
  operation_key: string;
  kassir_receipt_id: string | null;
  queued_at: string | null;
  uncertain_since_at: string | null;
  receipt_url: string | null;
  fiscal_fields: Json;
  status: FiscalStatus;
  attempt_count: number;
  next_attempt_at: string | null;
  last_error: string | null;
  issued_at: string | null;
  created_at: string;
  updated_at: string;
};

export type FiscalOperationInsert = Omit<FiscalOperationRow, "id" | "created_at" | "updated_at" | "currency" | "status" | "attempt_count" | "fiscal_fields" | "queued_at" | "uncertain_since_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  currency?: "KZT";
  status?: FiscalStatus;
  attempt_count?: number;
  fiscal_fields?: Json;
};

export type FiscalOperationUpdate = Partial<FiscalOperationInsert>;

export type TicketRow = {
  id: string;
  order_id: string;
  environment: PaymentEnvironment;
  public_ticket_number: string;
  current_revision_id: string | null;
  status: TicketStatus;
  created_at: string;
  updated_at: string;
};

export type TicketInsert = Omit<TicketRow, "id" | "created_at" | "updated_at" | "status"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  status?: TicketStatus;
};

export type TicketUpdate = Partial<TicketInsert>;

export type TicketRevisionRow = {
  id: string;
  ticket_id: string;
  environment: PaymentEnvironment;
  revision_number: number;
  first_name: string;
  last_name: string;
  participant_email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  token_version: number;
  creation_reason: string;
  created_at: string;
  updated_at: string;
};

export type TicketRevisionInsert = Omit<TicketRevisionRow, "id" | "created_at" | "updated_at" | "token_version"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  token_version?: number;
};

export type TicketRevisionUpdate = Partial<TicketRevisionInsert>;

export type CheckInRow = {
  id: string;
  ticket_id: string;
  ticket_revision_id: string;
  environment: PaymentEnvironment;
  checked_in_by: string;
  checked_in_at: string;
  created_at: string;
  updated_at: string;
};

export type CheckInInsert = Omit<CheckInRow, "id" | "created_at" | "updated_at" | "checked_in_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  checked_in_at?: string;
};

export type CheckInUpdate = Partial<CheckInInsert>;

export type RefundRow = {
  id: string;
  order_id: string;
  payment_attempt_id: string | null;
  environment: PaymentEnvironment;
  operation_key: string;
  provider_transaction_id: string | null;
  payment_provider_transaction_id: string | null;
  refund_type: "full" | "partial";
  amount_minor: number;
  remaining_refundable_amount_minor: number;
  currency: "KZT";
  status: RefundStatus;
  reason: string | null;
  attempt_count: number;
  next_attempt_at: string | null;
  uncertain_since_at: string | null;
  last_error: string | null;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
};

export type RefundInsert = Omit<RefundRow, "id" | "created_at" | "updated_at" | "currency" | "status" | "attempt_count" | "remaining_refundable_amount_minor" | "uncertain_since_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  currency?: "KZT";
  status?: RefundStatus;
  attempt_count?: number;
  remaining_refundable_amount_minor?: number;
  uncertain_since_at?: string | null;
};

export type RefundUpdate = Partial<RefundInsert>;

export type JobRow = {
  id: string;
  environment: PaymentEnvironment;
  job_type:
    | "issue_fiscal_operation"
    | "poll_receipt"
    | "send_ticket_email"
    | "send_refund_notification"
    | "initiate_refund"
    | "reconcile_payment"
    | "send_analytics_event"
    | "send_organizer_alert"
    | "daily_provider_reconciliation";
  logical_key: string;
  payload_reference: Json;
  order_id: string | null;
  ticket_id: string | null;
  refund_id: string | null;
  status: JobStatus;
  attempt_count: number;
  available_at: string;
  leased_until: string | null;
  lease_token: string | null;
  result: Json | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type JobInsert = Omit<JobRow, "id" | "created_at" | "updated_at" | "payload_reference" | "order_id" | "ticket_id" | "refund_id" | "status" | "attempt_count" | "available_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  payload_reference?: Json;
  order_id?: string | null;
  ticket_id?: string | null;
  refund_id?: string | null;
  status?: JobStatus;
  attempt_count?: number;
  available_at?: string;
};

export type JobUpdate = Partial<JobInsert>;

export type EmailDeliveryRow = {
  id: string;
  environment: PaymentEnvironment;
  operation_key: string;
  delivery_kind: "ticket" | "refund_notification" | "organizer_alert";
  order_id: string | null;
  ticket_id: string | null;
  ticket_revision_id: string | null;
  recipient_email: string;
  status: EmailStatus;
  transport_message_id: string | null;
  attempt_count: number;
  next_attempt_at: string | null;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailDeliveryInsert = Omit<EmailDeliveryRow, "id" | "created_at" | "updated_at" | "status" | "attempt_count"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  status?: EmailStatus;
  attempt_count?: number;
};

export type EmailDeliveryUpdate = Partial<EmailDeliveryInsert>;

export type AnalyticsEventRow = {
  id: string;
  environment: PaymentEnvironment;
  event_key: string;
  event_name: "purchase" | "refund";
  order_id: string | null;
  refund_id: string | null;
  ga_client_id: string | null;
  payload_snapshot: Json;
  delivery_status: EmailStatus;
  attempt_count: number;
  next_attempt_at: string | null;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AnalyticsEventInsert = Omit<AnalyticsEventRow, "id" | "created_at" | "updated_at" | "payload_snapshot" | "delivery_status" | "attempt_count"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  payload_snapshot?: Json;
  delivery_status?: EmailStatus;
  attempt_count?: number;
};

export type AnalyticsEventUpdate = Partial<AnalyticsEventInsert>;

export type AuditLogRow = {
  id: string;
  environment: PaymentEnvironment;
  action: string;
  target_table: string;
  target_id: string | null;
  before_summary: Json | null;
  after_summary: Json | null;
  actor_id: string;
  actor_label: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditLogInsert = Omit<AuditLogRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type AuditLogUpdate = Partial<AuditLogInsert>;

export type IncidentRow = {
  id: string;
  environment: PaymentEnvironment;
  incident_type:
    | "unexpected_payment"
    | "unknown_provider_result"
    | "overdue_receipt"
    | "overdue_email"
    | "reconciliation_mismatch";
  status: IncidentStatus;
  order_id: string | null;
  payment_attempt_id: string | null;
  refund_id: string | null;
  provider_event_id: string | null;
  summary: Json;
  resolution: string | null;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
  updated_at: string;
};

export type IncidentInsert = Omit<IncidentRow, "id" | "created_at" | "updated_at" | "status" | "summary"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  status?: IncidentStatus;
  summary?: Json;
};

export type IncidentUpdate = Partial<IncidentInsert>;

export type RateLimitRow = {
  id: string;
  scope: string;
  purpose_ip_hash: string;
  bucket_start: string;
  limit_count: number;
  used_count: number;
  created_at: string;
  updated_at: string;
};

export type RateLimitInsert = Omit<RateLimitRow, "id" | "created_at" | "updated_at" | "used_count"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
  used_count?: number;
};

export type RateLimitUpdate = Partial<RateLimitInsert>;

export type ReconciliationStateRow = {
  id: string;
  environment: PaymentEnvironment;
  provider: ProviderName;
  high_water_mark: string | null;
  pagination_cursor: string | null;
  last_run_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

export type ReconciliationStateInsert = Omit<ReconciliationStateRow, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ReconciliationStateUpdate = Partial<ReconciliationStateInsert>;

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export type AvailabilityRpcResult = AvailabilityResponse;
export type CreateOrderRpcResult = CreateOrderResult;
export type CreatePaymentAttemptRpcResult =
  | { kind: "offer_changed"; availability: AvailabilityResponse }
  | {
      attempt_id: string;
      external_id: string;
      reservation_expires_at: string;
    };
export type CheckInRpcResult = {
  result: "admitted" | "already_used" | "cancelled" | "invalid";
  checked_in_at: string | null;
};
export type RateLimitRpcResult = {
  allowed: boolean;
  remaining: number;
  reset_at: string;
};
export type TransferParticipantRpcResult = {
  kind: "transferred";
  ticketId: string;
  revisionId: string;
  revisionNumber: number;
  tokenVersion: number;
};
export type CancelTicketRpcResult = {
  kind: "cancelled";
  ticketId: string;
  status: "cancelled";
};
export type UpdateSettingsRpcResult = {
  kind: "updated";
  environment: PaymentEnvironment;
  onlineSalesLimit: number;
  salesEnabled: boolean;
  configurationVersion: number;
};
export type CreateAllocationRpcResult = {
  kind: "created";
  allocationId: string;
  environment: PaymentEnvironment;
  quantity: number;
};
export type ReleaseAllocationRpcResult = {
  kind: "released";
  allocationId: string;
  environment: PaymentEnvironment;
};
export type CreateRefundRpcResult =
  | {
      kind: "created";
      refundId: string;
      operationKey: string;
      refundType: "full" | "partial";
      amountMinor: number;
      remainingRefundableAmountMinor: number;
    }
  | {
      kind: "accepted";
      duplicate: true;
      refundId: string;
      operationKey: string;
      status: RefundStatus;
    };

export type RefundWorkerTransitionResult =
  | { kind: "claimed"; status: "processing" }
  | { kind: "already_processing"; status: "processing" }
  | { kind: "terminal"; status: "confirmed" | "failed" }
  | { kind: "review_required"; status: "unknown" | "review_required" }
  | { kind: "failed"; status: "failed" }
  | { kind: "unknown"; status: "unknown" };

export type Database = {
  public: {
    Tables: {
      case_lab_3_event_settings: Table<EventSettingsRow, EventSettingsInsert, EventSettingsUpdate>;
      case_lab_3_fiscal_policy_versions: Table<FiscalPolicyVersionRow, FiscalPolicyVersionInsert, FiscalPolicyVersionUpdate>;
      case_lab_3_inventory_allocations: Table<InventoryAllocationRow, InventoryAllocationInsert, InventoryAllocationUpdate>;
      case_lab_3_legal_document_versions: Table<LegalDocumentVersionRow, LegalDocumentVersionInsert, LegalDocumentVersionUpdate>;
      case_lab_3_orders: Table<OrderRow, OrderInsert, OrderUpdate>;
      case_lab_3_reservations: Table<ReservationRow, ReservationInsert, ReservationUpdate>;
      case_lab_3_payment_attempts: Table<PaymentAttemptRow, PaymentAttemptInsert, PaymentAttemptUpdate>;
      case_lab_3_provider_events: Table<ProviderEventRow, ProviderEventInsert, ProviderEventUpdate>;
      case_lab_3_fiscal_operations: Table<FiscalOperationRow, FiscalOperationInsert, FiscalOperationUpdate>;
      case_lab_3_tickets: Table<TicketRow, TicketInsert, TicketUpdate>;
      case_lab_3_ticket_revisions: Table<TicketRevisionRow, TicketRevisionInsert, TicketRevisionUpdate>;
      case_lab_3_check_ins: Table<CheckInRow, CheckInInsert, CheckInUpdate>;
      case_lab_3_refunds: Table<RefundRow, RefundInsert, RefundUpdate>;
      case_lab_3_jobs: Table<JobRow, JobInsert, JobUpdate>;
      case_lab_3_email_deliveries: Table<EmailDeliveryRow, EmailDeliveryInsert, EmailDeliveryUpdate>;
      case_lab_3_analytics_events: Table<AnalyticsEventRow, AnalyticsEventInsert, AnalyticsEventUpdate>;
      case_lab_3_audit_log: Table<AuditLogRow, AuditLogInsert, AuditLogUpdate>;
      case_lab_3_incidents: Table<IncidentRow, IncidentInsert, IncidentUpdate>;
      case_lab_3_rate_limits: Table<RateLimitRow, RateLimitInsert, RateLimitUpdate>;
      case_lab_3_reconciliation_state: Table<ReconciliationStateRow, ReconciliationStateInsert, ReconciliationStateUpdate>;
    };
    Views: Record<never, never>;
    Functions: {
      case_lab_3_get_availability: {
        Args: { p_environment: PaymentEnvironment };
        Returns: AvailabilityRpcResult;
      };
      case_lab_3_create_order: {
        Args: {
          p_environment: PaymentEnvironment;
          p_input: OrderInput;
          p_idempotency_key: string;
          p_hashed_client_ip: string;
        };
        Returns: CreateOrderRpcResult;
      };
      case_lab_3_create_payment_attempt: {
        Args: { p_order_id: string };
        Returns: CreatePaymentAttemptRpcResult;
      };
      case_lab_3_transfer_participant: {
        Args:
          | { p_ticket_id: string; p_input: Json; p_actor_id: string }
          | { p_ticket_id: string; p_input: Json; p_actor_id: string; p_reason: string };
        Returns: TransferParticipantRpcResult;
      };
      case_lab_3_cancel_ticket: {
        Args: { p_ticket_id: string; p_actor_id: string; p_reason: string };
        Returns: CancelTicketRpcResult;
      };
      case_lab_3_check_in: {
        Args: { p_ticket_id: string; p_ticket_revision_id: string; p_token_version: number };
        Returns: CheckInRpcResult;
      };
      case_lab_3_consume_rate_limit: {
        Args: { p_scope: string; p_purpose_ip_hash: string; p_limit_count: number; p_bucket_seconds: number };
        Returns: RateLimitRpcResult;
      };
      case_lab_3_update_settings: {
        Args: {
          p_environment: PaymentEnvironment;
          p_online_sales_limit: number | null;
          p_sales_enabled: boolean | null;
          p_actor_id: string;
        };
        Returns: UpdateSettingsRpcResult;
      };
      case_lab_3_create_allocation: {
        Args: {
          p_environment: PaymentEnvironment;
          p_allocation_category: InventoryAllocationRow["allocation_category"];
          p_quantity: number;
          p_tier: TicketTier | null;
          p_counts_toward_online_limit: boolean;
          p_holds_early_bird_quota: boolean;
          p_reason: string;
          p_actor_id: string;
        };
        Returns: CreateAllocationRpcResult;
      };
      case_lab_3_release_allocation: {
        Args: { p_environment: PaymentEnvironment; p_allocation_id: string; p_actor_id: string; p_reason: string };
        Returns: ReleaseAllocationRpcResult;
      };
      case_lab_3_create_refund: {
        Args: {
          p_environment: PaymentEnvironment;
          p_order_id: string;
          p_operation_key: string;
          p_amount_minor: number;
          p_reason: string;
        };
        Returns: CreateRefundRpcResult;
      };
      case_lab_3_begin_refund: {
        Args: {
          p_environment: PaymentEnvironment;
          p_order_id: string;
          p_refund_id: string;
          p_operation_key: string;
          p_amount_minor: number;
        };
        Returns: RefundWorkerTransitionResult;
      };
      case_lab_3_fail_refund: {
        Args: {
          p_environment: PaymentEnvironment;
          p_order_id: string;
          p_refund_id: string;
          p_operation_key: string;
          p_amount_minor: number;
          p_error: string;
        };
        Returns: RefundWorkerTransitionResult;
      };
      case_lab_3_mark_refund_unknown: {
        Args: {
          p_environment: PaymentEnvironment;
          p_order_id: string;
          p_refund_id: string;
          p_operation_key: string;
          p_error: string;
        };
        Returns: RefundWorkerTransitionResult;
      };
    };
    Enums: Record<never, never>;
    CompositeTypes: Record<never, never>;
  };
};
