import "server-only";

import { createHash } from "node:crypto";

import { createTransport, type SendMailOptions, type Transporter } from "nodemailer";

import { getCaseLab3Config } from "./config.server";
import type { PaymentEnvironment } from "./contracts";

export const MAIL_MAX_ATTEMPTS = 3;
export const MAIL_TIMEOUT_MS = 10_000;

export type MailConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from: string;
  alertEmail: string;
};

export type MailTransport = {
  sendMail(message: SendMailOptions): Promise<{
    messageId?: string;
    accepted?: unknown[];
    rejected?: unknown[];
  }>;
};

export type MailTransportFactory = (options: {
  host: string;
  port: number;
  secure: boolean;
  auth: { user: string; pass: string };
  connectionTimeout: number;
  greetingTimeout: number;
  socketTimeout: number;
}) => MailTransport;

export type MailAdapterOptions = {
  config?: MailConfig;
  getConfig?: (environment: PaymentEnvironment) => MailConfig;
  transport?: MailTransport;
  getTransport?: (config: MailConfig) => MailTransport;
  maxAttempts?: number;
  attemptCount?: number;
  signal?: AbortSignal;
};

export type MailSendResult = {
  status: "sent" | "partially_accepted" | "rejected";
  messageId: string;
  transportMessageId: string | null;
  acceptedCount: number;
  rejectedCount: number;
};

export class MailDeliveryError extends Error {
  readonly status: "failed" | "unknown";

  constructor(status: "failed" | "unknown") {
    super("Mail delivery failed");
    this.name = "MailDeliveryError";
    this.status = status;
  }
}

export class MailRetryCeilingError extends MailDeliveryError {
  constructor() {
    super("failed");
    this.name = "MailRetryCeilingError";
  }
}

export type TicketEmailInput = {
  environment: PaymentEnvironment;
  operationKey: string;
  recipientEmail: string;
  participant: { firstName: string; lastName: string };
  ticket: { publicTicketNumber: string; participantUrl: string };
  pdf: Buffer;
  receiptUrl?: string | null;
};

export type RefundEmailInput = {
  environment: PaymentEnvironment;
  operationKey: string;
  recipientEmail: string;
  ticketNumber: string;
  refundReceiptUrl?: string | null;
};

export type AdminAlertInput = {
  environment: PaymentEnvironment;
  operationKey: string;
  subject: string;
  text: string;
};

function safeText(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= maxLength && !/[\u0000-\u001f\u007f]/u.test(value);
}

function safeEmail(value: unknown): value is string {
  return safeText(value, 320) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(value);
}

function safeHttpsUrl(value: unknown): value is string {
  if (!safeText(value, 2048)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function stableMessageId(operationKey: string): string {
  const digest = createHash("sha256").update(operationKey, "utf8").digest("hex");
  return `<case-lab-3-${digest}@caselab.kz>`;
}

export function createMailTransport(
  config: MailConfig,
  factory: MailTransportFactory = (options) => createTransport(options) as unknown as Transporter,
): MailTransport {
  if (
    config.host !== "smtp.mail.ru" ||
    config.port !== 465 ||
    config.secure !== true ||
    !safeEmail(config.user) ||
    !safeText(config.password, 1024) ||
    !safeEmail(config.from) ||
    !safeEmail(config.alertEmail)
  ) {
    throw new MailDeliveryError("failed");
  }
  return factory({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.password },
    connectionTimeout: MAIL_TIMEOUT_MS,
    greetingTimeout: MAIL_TIMEOUT_MS,
    socketTimeout: MAIL_TIMEOUT_MS,
  });
}

function resolveConfig(environment: PaymentEnvironment, options: MailAdapterOptions): MailConfig {
  const config = options.config ?? options.getConfig?.(environment) ?? (() => {
    const value = getCaseLab3Config(environment);
    return { ...value.smtp, alertEmail: value.alertEmail };
  })();
  if (!config || config.host !== "smtp.mail.ru" || config.port !== 465 || config.secure !== true) {
    throw new MailDeliveryError("failed");
  }
  return config;
}

function resolveTransport(environment: PaymentEnvironment, options: MailAdapterOptions): MailTransport {
  if (options.transport) return options.transport;
  const config = resolveConfig(environment, options);
  return options.getTransport?.(config) ?? createMailTransport(config);
}

function retryAllowed(options: MailAdapterOptions): void {
  const maxAttempts = options.maxAttempts ?? MAIL_MAX_ATTEMPTS;
  const attemptCount = options.attemptCount ?? 0;
  if (!Number.isSafeInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > MAIL_MAX_ATTEMPTS || !Number.isSafeInteger(attemptCount) || attemptCount < 0 || attemptCount >= maxAttempts) {
    throw new MailRetryCeilingError();
  }
}

function isTimeout(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const value = error as { code?: unknown; name?: unknown };
  return value.code === "ETIMEDOUT" || value.code === "ESOCKET" || value.name === "TimeoutError";
}

async function awaitMailSend<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) throw new MailDeliveryError("unknown");
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(new MailDeliveryError("unknown"));
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

async function sendMessage(
  environment: PaymentEnvironment,
  operationKey: string,
  recipientEmail: string,
  message: SendMailOptions,
  options: MailAdapterOptions,
): Promise<MailSendResult> {
  if (!safeText(operationKey, 256) || !safeEmail(recipientEmail)) throw new MailDeliveryError("failed");
  retryAllowed(options);
  const messageId = stableMessageId(operationKey);
  const transport = resolveTransport(environment, options);
  try {
    const sendPromise = transport.sendMail({
      ...message,
      to: recipientEmail,
      messageId,
      headers: {
        ...(message.headers ?? {}),
        "Message-ID": messageId,
      },
    });
    const result = await awaitMailSend(sendPromise, options.signal);
    const acceptedCount = Array.isArray(result.accepted) ? result.accepted.length : 0;
    const rejectedCount = Array.isArray(result.rejected) ? result.rejected.length : 0;
    return {
      status: rejectedCount === 0 ? "sent" : acceptedCount > 0 ? "partially_accepted" : "rejected",
      messageId,
      transportMessageId: safeText(result.messageId, 512) ? result.messageId : null,
      acceptedCount,
      rejectedCount,
    };
  } catch (error) {
    throw new MailDeliveryError(isTimeout(error) ? "unknown" : "failed");
  }
}

export async function sendTicketEmail(
  input: TicketEmailInput,
  options: MailAdapterOptions = {},
): Promise<MailSendResult> {
  if (
    !safeText(input.participant.firstName, 200) ||
    !safeText(input.participant.lastName, 200) ||
    !safeText(input.ticket.publicTicketNumber, 100) ||
    !safeHttpsUrl(input.ticket.participantUrl) ||
    !Buffer.isBuffer(input.pdf) ||
    input.pdf.length === 0 ||
    input.pdf.length > 10 * 1024 * 1024 ||
    input.receiptUrl !== undefined && input.receiptUrl !== null && !safeHttpsUrl(input.receiptUrl)
  ) {
    throw new MailDeliveryError("failed");
  }
  const firstName = escapeHtml(input.participant.firstName);
  const lastName = escapeHtml(input.participant.lastName);
  const ticketNumber = escapeHtml(input.ticket.publicTicketNumber);
  const participantUrl = escapeHtml(input.ticket.participantUrl);
  const receiptLink = input.receiptUrl
    ? `<p>Фискальный чек: <a href="${escapeHtml(input.receiptUrl)}">открыть чек</a></p>`
    : "";
  return sendMessage(input.environment, input.operationKey, input.recipientEmail, {
    from: resolveConfig(input.environment, options).from,
    subject: "Ваш билет на Case Lab III",
    text: `Билет Case Lab III для ${input.participant.firstName} ${input.participant.lastName}. Номер: ${input.ticket.publicTicketNumber}. Открыть билет: ${input.ticket.participantUrl}`,
    html: `<p>${firstName} ${lastName}, ваш билет на Case Lab III готов.</p><p>Номер билета: <strong>${ticketNumber}</strong></p><p><a href="${participantUrl}">Открыть билет</a></p>${receiptLink}`,
    attachments: [{
      filename: `case-lab-3-ticket-${input.ticket.publicTicketNumber}.pdf`,
      content: input.pdf,
      contentType: "application/pdf",
    }],
  }, options);
}

export async function sendRefundEmail(
  input: RefundEmailInput,
  options: MailAdapterOptions = {},
): Promise<MailSendResult> {
  if (
    !safeText(input.ticketNumber, 100) ||
    input.refundReceiptUrl !== undefined && input.refundReceiptUrl !== null && !safeHttpsUrl(input.refundReceiptUrl)
  ) throw new MailDeliveryError("failed");
  const receiptText = input.refundReceiptUrl ? ` Чек возврата: ${input.refundReceiptUrl}` : "";
  const receiptHtml = input.refundReceiptUrl
    ? `<p><a href="${escapeHtml(input.refundReceiptUrl)}">Открыть чек возврата</a></p>`
    : "";
  return sendMessage(input.environment, input.operationKey, input.recipientEmail, {
    from: resolveConfig(input.environment, options).from,
    subject: "Возврат за билет Case Lab III",
    text: `Билет ${input.ticketNumber} отменен. Средства возвращены.${receiptText}`,
    html: `<p>Билет <strong>${escapeHtml(input.ticketNumber)}</strong> отменен.</p><p>Средства возвращены.</p>${receiptHtml}`,
  }, options);
}

function redactAlertText(value: string): string {
  return value.replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/gu, "[redacted]").replace(/\b\d{12,19}\b/gu, "[redacted]");
}

export async function sendAdminAlert(
  input: AdminAlertInput,
  options: MailAdapterOptions = {},
): Promise<MailSendResult> {
  if (!safeText(input.subject, 200) || !safeText(input.text, 4000)) throw new MailDeliveryError("failed");
  const config = resolveConfig(input.environment, options);
  const text = redactAlertText(input.text);
  return sendMessage(input.environment, input.operationKey, config.alertEmail, {
    from: config.from,
    subject: redactAlertText(input.subject),
    text,
    html: `<p>${escapeHtml(text).replaceAll("\n", "<br>")}</p>`,
  }, options);
}
