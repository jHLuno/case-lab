import "server-only";

import { requireCrmAdmin, verifyCrmMutation } from "@/lib/crm-auth.server";
import {
  noStoreJson,
  parseJsonBody,
  readBoundedBody,
  requireJson,
  requireSameOrigin,
  RequestGuardError,
} from "@/lib/case-lab-3/http.server";
import type { PaymentEnvironment } from "@/lib/case-lab-3/contracts";
import type { RefundStatus } from "@/lib/case-lab-3/database.types";
import { getCaseLab3AdminClient } from "@/lib/case-lab-3/supabase-admin.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 4 * 1024;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const PENDING_REFUND_STATUSES = new Set<RefundStatus>(["requested", "processing", "unknown", "review_required"]);

type ExistingRefund = {
  orderId: string;
  refundId: string;
  operationKey: string;
  refundType: "full" | "partial";
  amountMinor: number;
  status: RefundStatus;
};

export type FullRefundState = {
  environment: PaymentEnvironment;
  paymentStatus: string;
  paidAmountMinor: number;
  refundedAmountMinor: number;
  refundableAmountMinor: number;
  pendingRefundAmountMinor: number;
  existingRefund: ExistingRefund | null;
};

type FullRefundInput = {
  orderId: string;
  environment: PaymentEnvironment;
  operationKey: string;
  amountMinor: number;
  reason: string;
  actorId: string;
};

type FullRefundResult =
  | {
      kind: "created";
      refundId: string;
      operationKey: string;
      refundType: "full";
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

export type RefundRouteDependencies = {
  requireCrmAdmin: typeof requireCrmAdmin;
  verifyCrmMutation: typeof verifyCrmMutation;
  requireSameOrigin: typeof requireSameOrigin;
  parseBody: (request: Request) => Promise<unknown>;
  getRefundState: (orderId: string, operationKey: string) => Promise<FullRefundState | null>;
  createRefund: (input: FullRefundInput) => Promise<unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEnvironment(value: unknown): value is PaymentEnvironment {
  return value === "test" || value === "live";
}

function isRefundStatus(value: unknown): value is RefundStatus {
  return typeof value === "string" && [
    "requested",
    "processing",
    "confirmed",
    "failed",
    "unknown",
    "review_required",
  ].includes(value);
}

function isSafeMinor(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function parseOperationKey(request: Request): string | null {
  const value = request.headers.get("idempotency-key");
  if (
    !value ||
    value.length > 200 ||
    value.trim() !== value ||
    /\s/u.test(value) ||
    /[\u0000-\u001f\u007f]/u.test(value)
  ) {
    return null;
  }
  return value;
}

function parseBody(value: unknown): { reason: string } | null {
  if (
    !isRecord(value) ||
    Object.keys(value).length !== 2 ||
    value.confirm !== true ||
    typeof value.reason !== "string" ||
    value.reason.trim().length === 0 ||
    value.reason.trim().length > 500 ||
    /[\u0000-\u001f\u007f]/u.test(value.reason)
  ) {
    return null;
  }
  return { reason: value.reason.trim() };
}

function validExistingRefund(value: unknown): value is ExistingRefund {
  if (!isRecord(value)) return false;
  return (
    typeof value.orderId === "string" &&
    UUID_PATTERN.test(value.refundId as string) &&
    typeof value.operationKey === "string" &&
    (value.refundType === "full" || value.refundType === "partial") &&
    isSafeMinor(value.amountMinor) &&
    isRefundStatus(value.status)
  );
}

function validRefundState(value: FullRefundState): boolean {
  return (
    isEnvironment(value.environment) &&
    typeof value.paymentStatus === "string" &&
    isSafeMinor(value.paidAmountMinor) &&
    isSafeMinor(value.refundedAmountMinor) &&
    isSafeMinor(value.refundableAmountMinor) &&
    isSafeMinor(value.pendingRefundAmountMinor) &&
    (value.existingRefund === null || validExistingRefund(value.existingRefund))
  );
}

function isFullRefundable(state: FullRefundState): boolean {
  return (
    state.paymentStatus === "paid" &&
    state.paidAmountMinor > 0 &&
    state.refundedAmountMinor === 0 &&
    state.refundableAmountMinor === state.paidAmountMinor &&
    state.pendingRefundAmountMinor === 0
  );
}

function isSameKeyFullRefund(state: FullRefundState, orderId: string, operationKey: string): boolean {
  return (
    state.existingRefund !== null &&
    state.existingRefund.orderId === orderId &&
    state.existingRefund.operationKey === operationKey &&
    state.existingRefund.refundType === "full" &&
    state.existingRefund.amountMinor === state.paidAmountMinor
  );
}

function refundResult(value: unknown, operationKey: string, amountMinor: number): FullRefundResult | null {
  if (!isRecord(value) || value.operationKey !== operationKey || !UUID_PATTERN.test(value.refundId as string)) return null;
  if (
    value.kind === "created" &&
    value.refundType === "full" &&
    value.amountMinor === amountMinor &&
    value.remainingRefundableAmountMinor === 0
  ) {
    return {
      kind: "created",
      refundId: value.refundId as string,
      operationKey,
      refundType: "full",
      amountMinor,
      remainingRefundableAmountMinor: 0,
    };
  }
  if (value.kind === "accepted" && value.duplicate === true && isRefundStatus(value.status)) {
    return {
      kind: "accepted",
      duplicate: true,
      refundId: value.refundId as string,
      operationKey,
      status: value.status,
    };
  }
  return null;
}

async function readRefundState(orderId: string, operationKey: string): Promise<FullRefundState | null> {
  const client = getCaseLab3AdminClient();
  const { data: order, error: orderError } = await client
    .from("case_lab_3_orders")
    .select("environment, payment_status, paid_amount_minor, refunded_amount_minor, refundable_amount_minor")
    .eq("id", orderId)
    .maybeSingle();
  if (orderError) throw new Error("Admin refund state unavailable");
  if (!order || !isEnvironment(order.environment)) return null;

  const [refundsResult, operationResult] = await Promise.all([
    client
      .from("case_lab_3_refunds")
      .select("amount_minor, status")
      .eq("order_id", orderId)
      .eq("environment", order.environment),
    client
      .from("case_lab_3_refunds")
      .select("id, order_id, operation_key, refund_type, amount_minor, status")
      .eq("environment", order.environment)
      .eq("operation_key", operationKey)
      .maybeSingle(),
  ]);
  if (refundsResult.error || operationResult.error) throw new Error("Admin refund state unavailable");

  const pendingRefundAmountMinor = (refundsResult.data ?? []).reduce(
    (total, refund) => PENDING_REFUND_STATUSES.has(refund.status) ? total + refund.amount_minor : total,
    0,
  );
  const existing = operationResult.data;
  return {
    environment: order.environment,
    paymentStatus: order.payment_status,
    paidAmountMinor: order.paid_amount_minor,
    refundedAmountMinor: order.refunded_amount_minor,
    refundableAmountMinor: order.refundable_amount_minor,
    pendingRefundAmountMinor,
    existingRefund: existing
      ? {
          orderId: existing.order_id,
          refundId: existing.id,
          operationKey: existing.operation_key,
          refundType: existing.refund_type,
          amountMinor: existing.amount_minor,
          status: existing.status,
        }
      : null,
  };
}

async function createAtomicRefund(input: FullRefundInput): Promise<FullRefundResult> {
  const { data, error } = await getCaseLab3AdminClient().rpc("case_lab_3_create_refund", {
    p_environment: input.environment,
    p_order_id: input.orderId,
    p_operation_key: input.operationKey,
    p_amount_minor: input.amountMinor,
    p_reason: input.reason,
  });
  const result = refundResult(data, input.operationKey, input.amountMinor);
  if (error || !result) throw new Error("Admin refund unavailable");
  return result;
}

const productionDependencies: RefundRouteDependencies = {
  requireCrmAdmin,
  verifyCrmMutation,
  requireSameOrigin,
  parseBody: async (request) => {
    requireJson(request);
    return parseJsonBody(await readBoundedBody(request, MAX_BODY_BYTES));
  },
  getRefundState: readRefundState,
  createRefund: createAtomicRefund,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
  dependencies: Partial<RefundRouteDependencies> = {},
): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const session = await active.requireCrmAdmin();
    if (!session) return noStoreJson({ error: "unauthorized" }, { status: 401 });
    if (session.role !== "crm_admin") return noStoreJson({ error: "forbidden" }, { status: 403 });
    active.requireSameOrigin(request);
    if (!active.verifyCrmMutation(request, session, undefined, { requireIdempotencyKey: true })) {
      return noStoreJson({ error: "forbidden" }, { status: 403 });
    }

    const { id: orderId } = await params;
    if (!UUID_PATTERN.test(orderId)) return noStoreJson({ error: "not_found" }, { status: 404 });
    const operationKey = parseOperationKey(request);
    if (!operationKey) return noStoreJson({ error: "invalid_idempotency_key" }, { status: 400 });
    const body = parseBody(await active.parseBody(request));
    if (!body) return noStoreJson({ error: "invalid_request" }, { status: 400 });

    const state = await active.getRefundState(orderId, operationKey);
    if (!state) return noStoreJson({ error: "not_found" }, { status: 404 });
    if (!validRefundState(state)) return noStoreJson({ error: "service_unavailable" }, { status: 503 });
    if (state.environment === "live") {
      return noStoreJson({ error: "automatic_refunds_disabled", message: "Возврат выполняется вручную через кабинет TipTop Pay." }, { status: 410 });
    }

    const sameKeyFullRefund = isSameKeyFullRefund(state, orderId, operationKey);
    if (state.existingRefund !== null && !sameKeyFullRefund) {
      return noStoreJson({ error: "refund_not_available" }, { status: 409 });
    }
    if (!sameKeyFullRefund && !isFullRefundable(state)) {
      return noStoreJson({ error: "refund_not_available" }, { status: 409 });
    }

    const result = await active.createRefund({
      orderId,
      environment: state.environment,
      operationKey,
      amountMinor: state.paidAmountMinor,
      reason: body.reason,
      actorId: session.role,
    });
    const sanitized = refundResult(result, operationKey, state.paidAmountMinor);
    return sanitized
      ? noStoreJson(sanitized, { status: 202 })
      : noStoreJson({ error: "service_unavailable" }, { status: 503 });
  } catch (error) {
    if (error instanceof RequestGuardError) {
      const response = error.status === 403
        ? { error: "forbidden" }
        : error.status === 413
          ? { error: "request_too_large" }
          : error.status === 415
            ? { error: "unsupported_content_type" }
            : { error: "invalid_request" };
      return noStoreJson(response, { status: error.status });
    }
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
