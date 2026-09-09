import "server-only";

import QRCode from "qrcode";

import {
  assertOrderSession,
  authorizeTicketAccessToken,
  getOrderRequestSecret,
  getPublicPaymentEnvironment,
  isOrderId,
  OrderAuthorizationError,
  type OrderSession,
  type TicketSession,
} from "./orders.server";
import { deriveManualCheckInCode, buildTicketQrPayload } from "./tokens.server";
import { getCaseLab3AdminClient } from "./supabase-admin.server";
import type { OrderStatusResponse, PaymentEnvironment } from "./contracts";

export const CASE_LAB_3_EVENT = {
  name: "Case Lab III",
  date: "24 сентября 2026",
  time: "10:00–14:00",
  venue: "Narxoz Business School, Алматы, ул. Жандосова 55/10",
  supportEmail: "hello@caselab.kz",
} as const;

export type TicketStatus = "valid" | "used" | "cancelled";

export type TicketPresentation = {
  ticketId: string;
  publicTicketNumber: string;
  revisionId: string;
  revisionNumber: number;
  tokenVersion: number;
  status: TicketStatus;
  participant: {
    firstName: string;
    lastName: string;
  };
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  supportEmail: string;
  qrPayload: string;
  qrDataUrl: string;
  manualCode: string;
  pdfUrl: string;
};

export type PurchaserOrderView = {
  kind: "purchaser_order";
  order: {
    id: string;
    orderNumber: string;
    purchaserEmail: string;
    fiscalEmail: string;
    participant: {
      firstName: string;
      lastName: string;
      email: string;
      phone: string | null;
      company: string | null;
      position: string | null;
    };
    tier: "early_bird" | "standard";
    amountMinor: number;
    currency: "KZT";
    receiptLabel: string;
    paymentStatus: OrderStatusResponse["paymentStatus"];
    ticketStatus: "pending" | TicketStatus;
    receiptStatus: OrderStatusResponse["receiptStatus"];
    emailStatus: OrderStatusResponse["emailStatus"];
    paidAmountMinor: number;
    refundedAmountMinor: number;
    refundableAmountMinor: number;
    refundedAt: string | null;
  };
  ticket: TicketPresentation | null;
};

export type ParticipantTicketView = {
  kind: "participant_ticket";
  ticket: TicketPresentation;
};

export type TicketPdfRevision = {
  ticketId: string;
  publicTicketNumber: string;
  revisionId: string;
  revisionNumber: number;
  tokenVersion: number;
  status: TicketStatus;
  firstName: string;
  lastName: string;
  qrPayload: string;
  manualCode: string;
  eventName: string;
  eventDate: string;
  eventTime: string;
  venue: string;
  supportEmail: string;
  pdfUrl?: string;
};

export class TicketAuthorizationError extends Error {
  constructor() {
    super("Ticket authorization failed");
    this.name = "TicketAuthorizationError";
  }
}

export class TicketServiceError extends Error {
  constructor() {
    super("Ticket service unavailable");
    this.name = "TicketServiceError";
  }
}

type QueryResult<T> = Promise<{ data: T | null; error: unknown }>;

type QueryBuilder = {
  eq(column: string, value: unknown): QueryBuilder;
  maybeSingle(): QueryResult<unknown>;
};

type TicketDatabaseClient = {
  from(table: string): { select(selection: string): QueryBuilder };
};

type OrderAuthRow = {
  id: string;
  environment: PaymentEnvironment;
  order_access_token_version: number;
  order_access_revoked_at: string | null;
};

type OrderRow = OrderAuthRow & {
  order_number: string;
  first_name: string;
  last_name: string;
  participant_email: string;
  purchaser_email: string;
  fiscal_email: string;
  phone: string | null;
  company: string | null;
  position: string | null;
  tier: "early_bird" | "standard";
  amount_minor: number;
  currency: "KZT";
  receipt_label: string;
  payment_status: OrderStatusResponse["paymentStatus"];
  ticket_status: "pending" | TicketStatus;
  receipt_status: OrderStatusResponse["receiptStatus"];
  email_status: OrderStatusResponse["emailStatus"];
  paid_amount_minor: number;
  refunded_amount_minor: number;
  refundable_amount_minor: number;
  refunded_at: string | null;
};

type TicketAuthRow = {
  id: string;
  order_id: string;
  environment: PaymentEnvironment;
  public_ticket_number: string;
  current_revision_id: string | null;
  status: TicketStatus;
};

type TicketRevisionAuthRow = {
  id: string;
  ticket_id: string;
  revision_number: number;
  token_version: number;
};

type TicketRevisionRow = TicketRevisionAuthRow & {
  first_name: string;
  last_name: string;
};

function clientOrDefault(client?: TicketDatabaseClient): TicketDatabaseClient {
  return client ?? (getCaseLab3AdminClient() as unknown as TicketDatabaseClient);
}

async function selectOne<T>(
  client: TicketDatabaseClient,
  table: string,
  selection: string,
  filters: ReadonlyArray<readonly [string, unknown]>,
): Promise<T> {
  let query = client.from(table).select(selection) as unknown as QueryBuilder;
  for (const [column, value] of filters) query = query.eq(column, value);
  const result = await query.maybeSingle();
  if (result.error || !result.data) throw new TicketServiceError();
  return result.data as T;
}

function assertEnvironment(value: unknown): asserts value is PaymentEnvironment {
  if (value !== "test" && value !== "live") throw new TicketServiceError();
}

function assertTicketStatus(value: unknown): asserts value is TicketStatus {
  if (value !== "valid" && value !== "used" && value !== "cancelled") throw new TicketServiceError();
}

function assertRevision(value: TicketRevisionAuthRow, ticketId: string): void {
  if (
    value.ticket_id !== ticketId ||
    !isOrderId(value.id) ||
    !Number.isSafeInteger(value.revision_number) ||
    value.revision_number < 1 ||
    !Number.isSafeInteger(value.token_version) ||
    value.token_version < 1
  ) {
    throw new TicketServiceError();
  }
}

async function ticketPresentation(
  ticket: TicketAuthRow,
  revision: TicketRevisionRow,
): Promise<TicketPresentation> {
  assertEnvironment(ticket.environment);
  assertTicketStatus(ticket.status);
  assertRevision(revision, ticket.id);

  const secret = getOrderRequestSecret();
  const qrPayload = buildTicketQrPayload(ticket.id, revision.revision_number, secret);
  const manualCode = deriveManualCheckInCode(secret, ticket.id, revision.revision_number);
  const qrDataUrl = await QRCode.toDataURL(qrPayload, {
    errorCorrectionLevel: "M",
    margin: 4,
    width: 280,
  });

  return {
    ticketId: ticket.id,
    publicTicketNumber: ticket.public_ticket_number,
    revisionId: revision.id,
    revisionNumber: revision.revision_number,
    tokenVersion: revision.token_version,
    status: ticket.status,
    participant: {
      firstName: revision.first_name,
      lastName: revision.last_name,
    },
    eventName: CASE_LAB_3_EVENT.name,
    eventDate: CASE_LAB_3_EVENT.date,
    eventTime: CASE_LAB_3_EVENT.time,
    venue: CASE_LAB_3_EVENT.venue,
    supportEmail: CASE_LAB_3_EVENT.supportEmail,
    qrPayload,
    qrDataUrl,
    manualCode,
    pdfUrl: `/api/case-lab-3/orders/${encodeURIComponent(ticket.order_id)}/ticket.pdf`,
  };
}

async function loadCurrentRevision(
  client: TicketDatabaseClient,
  ticket: TicketAuthRow,
): Promise<TicketRevisionRow> {
  if (!ticket.current_revision_id) throw new TicketAuthorizationError();
  return selectOne<TicketRevisionRow>(
    client,
    "case_lab_3_ticket_revisions",
    "id, ticket_id, revision_number, token_version, first_name, last_name",
    [
      ["id", ticket.current_revision_id],
      ["ticket_id", ticket.id],
      ["environment", ticket.environment],
    ],
  );
}

function assertCurrentParticipantSession(
  session: TicketSession,
  ticket: TicketAuthRow,
  revision: TicketRevisionAuthRow,
): void {
  if (
    session.purpose !== "ticket-session" ||
    session.ticketId !== "" && session.ticketId !== ticket.id ||
    session.revisionNumber !== revision.revision_number ||
    ("tokenVersion" in session && session.tokenVersion !== revision.token_version) ||
    !authorizeTicketAccessToken(session.token, {
      id: ticket.id,
      status: ticket.status,
      revisionNumber: revision.revision_number,
      tokenVersion: revision.token_version,
    })
  ) {
    throw new TicketAuthorizationError();
  }
}

async function participantViewForTicket(
  session: TicketSession,
  ticket: TicketAuthRow,
  client: TicketDatabaseClient,
): Promise<ParticipantTicketView> {
  if (session.ticketId !== "" && session.ticketId !== ticket.id) throw new TicketAuthorizationError();
  if (!ticket.current_revision_id) throw new TicketAuthorizationError();
  const revisionAuth = await selectOne<TicketRevisionAuthRow>(
    client,
    "case_lab_3_ticket_revisions",
    "id, ticket_id, revision_number, token_version",
    [
      ["id", ticket.current_revision_id],
      ["ticket_id", ticket.id],
      ["environment", ticket.environment],
    ],
  );
  assertCurrentParticipantSession(session, ticket, revisionAuth);
  const revision = await selectOne<TicketRevisionRow>(
    client,
    "case_lab_3_ticket_revisions",
    "id, ticket_id, revision_number, token_version, first_name, last_name",
    [
      ["id", revisionAuth.id],
      ["ticket_id", ticket.id],
      ["environment", ticket.environment],
    ],
  );
  return { kind: "participant_ticket", ticket: await ticketPresentation(ticket, revision) };
}

export async function getPurchaserOrderView(
  session: OrderSession,
  orderId: string,
  providedClient?: TicketDatabaseClient,
): Promise<PurchaserOrderView> {
  if (!isOrderId(orderId) || session.purpose !== "order-session" || session.orderId !== "" && session.orderId !== orderId) {
    throw new TicketAuthorizationError();
  }

  const environment = getPublicPaymentEnvironment();
  const client = clientOrDefault(providedClient);
  const authOrder = await selectOne<OrderAuthRow>(
    client,
    "case_lab_3_orders",
    "id, environment, order_access_token_version, order_access_revoked_at",
    [["id", orderId], ["environment", environment]],
  );
  assertEnvironment(authOrder.environment);
  try {
    assertOrderSession({ ...session, orderId }, authOrder);
  } catch (error) {
    if (error instanceof OrderAuthorizationError) throw new TicketAuthorizationError();
    throw error;
  }

  const order = await selectOne<OrderRow>(
    client,
    "case_lab_3_orders",
    "id, order_number, environment, order_access_token_version, order_access_revoked_at, first_name, last_name, participant_email, purchaser_email, fiscal_email, phone, company, position, tier, amount_minor, currency, receipt_label, payment_status, ticket_status, receipt_status, email_status, paid_amount_minor, refunded_amount_minor, refundable_amount_minor, refunded_at",
    [["id", orderId], ["environment", environment]],
  );
  if (order.id !== authOrder.id || order.environment !== authOrder.environment) throw new TicketServiceError();

  let ticket: TicketPresentation | null = null;
  if (order.ticket_status !== "pending") {
    const ticketRow = await selectOne<TicketAuthRow>(
      client,
      "case_lab_3_tickets",
      "id, order_id, environment, public_ticket_number, current_revision_id, status",
      [["order_id", order.id], ["environment", order.environment]],
    );
    const revision = await loadCurrentRevision(client, ticketRow);
    ticket = await ticketPresentation(ticketRow, revision);
  }

  return {
    kind: "purchaser_order",
    order: {
      id: order.id,
      orderNumber: order.order_number,
      purchaserEmail: order.purchaser_email,
      fiscalEmail: order.fiscal_email,
      participant: {
        firstName: order.first_name,
        lastName: order.last_name,
        email: order.participant_email,
        phone: order.phone,
        company: order.company,
        position: order.position,
      },
      tier: order.tier,
      amountMinor: order.amount_minor,
      currency: order.currency,
      receiptLabel: order.receipt_label,
      paymentStatus: order.payment_status,
      ticketStatus: order.ticket_status,
      receiptStatus: order.receipt_status,
      emailStatus: order.email_status,
      paidAmountMinor: order.paid_amount_minor,
      refundedAmountMinor: order.refunded_amount_minor,
      refundableAmountMinor: order.refundable_amount_minor,
      refundedAt: order.refunded_at,
    },
    ticket,
  };
}

export async function getParticipantTicketView(
  session: TicketSession,
  ticketNumber: string,
  providedClient?: TicketDatabaseClient,
): Promise<ParticipantTicketView> {
  if (!ticketNumber || ticketNumber.length > 100 || ticketNumber.includes("/")) {
    throw new TicketAuthorizationError();
  }
  if (session.purpose !== "ticket-session") throw new TicketAuthorizationError();
  const environment = getPublicPaymentEnvironment();
  const client = clientOrDefault(providedClient);
  const ticket = await selectOne<TicketAuthRow>(
    client,
    "case_lab_3_tickets",
    "id, order_id, environment, public_ticket_number, current_revision_id, status",
    [["public_ticket_number", ticketNumber], ["environment", environment]],
  );
  if (ticket.public_ticket_number !== ticketNumber) throw new TicketAuthorizationError();
  return participantViewForTicket(session, ticket, client);
}

export async function getTicketRevisionForPdf(
  session: OrderSession | TicketSession,
  orderId: string,
  providedClient?: TicketDatabaseClient,
): Promise<TicketPresentation> {
  if (!isOrderId(orderId)) throw new TicketAuthorizationError();
  if (session.purpose === "order-session") {
    const view = await getPurchaserOrderView(session, orderId, providedClient);
    if (!view.ticket) throw new TicketAuthorizationError();
    return view.ticket;
  }
  if (session.purpose !== "ticket-session") throw new TicketAuthorizationError();

  const environment = getPublicPaymentEnvironment();
  const client = clientOrDefault(providedClient);
  const ticket = await selectOne<TicketAuthRow>(
    client,
    "case_lab_3_tickets",
    "id, order_id, environment, public_ticket_number, current_revision_id, status",
    [["order_id", orderId], ["environment", environment]],
  );
  if (ticket.order_id !== orderId) throw new TicketAuthorizationError();
  const view = await participantViewForTicket(session, ticket, client);
  return view.ticket;
}
