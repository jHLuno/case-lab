import "server-only";

import type { PaymentEnvironment } from "./contracts";

type EnvironmentSource = Readonly<Record<string, string | undefined>>;

export type CaseLab3Config = {
  environment: PaymentEnvironment;
  paymentMode: PaymentEnvironment;
  widget: {
    terminalId: string;
  };
  tiptop: {
    publicId: string;
    apiSecret: string;
  };
  kassir: {
    publicId: string;
    apiSecret: string;
  };
  seller: {
    inn: string;
  };
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    password: string;
    from: string;
  };
  alertEmail: string;
  tokenSecret: string;
  cronSecret: string;
  ga4: {
    measurementId: string;
    apiSecret: string;
  } | null;
};

function required(source: EnvironmentSource, name: string): string {
  const value = source[name]?.trim();
  if (!value) {
    throw new Error("Case Lab III configuration incomplete");
  }
  return value;
}

function optional(source: EnvironmentSource, name: string): string | null {
  const value = source[name]?.trim();
  return value || null;
}

function parsePort(source: EnvironmentSource): number {
  const value = required(source, "SMTP_PORT");
  if (!/^\d+$/u.test(value)) {
    throw new Error("Case Lab III configuration incomplete");
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("Case Lab III configuration incomplete");
  }
  return port;
}

function parseBoolean(source: EnvironmentSource): boolean {
  const value = required(source, "SMTP_SECURE").toLowerCase();
  if (value !== "true" && value !== "false") {
    throw new Error("Case Lab III configuration incomplete");
  }
  return value === "true";
}

function assertSecretLength(value: string): string {
  if (value.length < 32) {
    throw new Error("Case Lab III configuration incomplete");
  }
  return value;
}

export function getCaseLab3Config(
  environment: PaymentEnvironment,
  source: EnvironmentSource = process.env,
): CaseLab3Config {
  if (environment !== "test" && environment !== "live") {
    throw new Error("Case Lab III configuration incomplete");
  }

  const environmentLabel = environment.toUpperCase();
  const paymentMode = required(source, "CASE_LAB_3_PAYMENT_MODE");
  if (paymentMode !== environment) {
    throw new Error("Case Lab III configuration incomplete");
  }

  const tiptopApiSecret = required(source, `TIPTOP_${environmentLabel}_API_SECRET`);
  const kassirApiSecret = required(source, `KASSIR_${environmentLabel}_API_SECRET`);
  const tokenSecret = assertSecretLength(required(source, "CASE_LAB_3_TOKEN_SECRET"));
  const cronSecret = assertSecretLength(required(source, "CASE_LAB_3_CRON_SECRET"));
  const ga4MeasurementId = optional(source, "NEXT_PUBLIC_GA4_MEASUREMENT_ID");
  const ga4ApiSecret = optional(source, "GA4_API_SECRET");

  return {
    environment,
    paymentMode,
    widget: {
      terminalId: required(source, `TIPTOP_${environmentLabel}_TERMINAL_ID`),
    },
    tiptop: {
      publicId: required(source, `TIPTOP_${environmentLabel}_PUBLIC_ID`),
      apiSecret: tiptopApiSecret,
    },
    kassir: {
      publicId: required(source, `KASSIR_${environmentLabel}_PUBLIC_ID`),
      apiSecret: kassirApiSecret,
    },
    seller: {
      inn: required(source, "KASSIR_SELLER_INN"),
    },
    smtp: {
      host: required(source, "SMTP_HOST"),
      port: parsePort(source),
      secure: parseBoolean(source),
      user: required(source, "SMTP_USER"),
      password: required(source, "SMTP_PASSWORD"),
      from: required(source, "SMTP_FROM"),
    },
    alertEmail: required(source, "CASE_LAB_3_ALERT_EMAIL"),
    tokenSecret,
    cronSecret,
    ga4: ga4MeasurementId && ga4ApiSecret
      ? { measurementId: ga4MeasurementId, apiSecret: ga4ApiSecret }
      : null,
  };
}
