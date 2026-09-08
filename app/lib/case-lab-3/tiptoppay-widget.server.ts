import "server-only";

import { minorToMajor } from "./money";
import type { TipTopWidgetParams } from "./contracts";

export type WidgetAttempt = {
  amountMinor: number;
  externalId: string;
  receiptEmail: string;
  orderOpaqueId: string;
  firstName: string;
  lastName: string;
  phone: string | null;
};

export function buildWidgetParams(attempt: WidgetAttempt, publicTerminalId: string): TipTopWidgetParams {
  if (!publicTerminalId.trim()) {
    throw new Error("TipTop Pay terminal configuration incomplete");
  }

  return {
    publicTerminalId,
    amount: minorToMajor(attempt.amountMinor),
    currency: "KZT",
    paymentSchema: "Single",
    externalId: attempt.externalId,
    receiptEmail: attempt.receiptEmail,
    emailBehavior: "Hidden",
    tokenize: false,
    retryPayment: false,
    userInfo: {
      accountId: attempt.orderOpaqueId,
      firstName: attempt.firstName,
      lastName: attempt.lastName,
      email: attempt.receiptEmail,
      phone: attempt.phone ?? undefined,
    },
  };
}
