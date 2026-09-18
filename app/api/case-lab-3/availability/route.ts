import "server-only";

import { getHashedClientIp, noStoreJson } from "@/lib/case-lab-3/http.server";
import {
  consumeRateLimit,
  getAvailability,
  getPrivateOfferAvailability,
  getOrderRequestSecret,
  getPublicPaymentEnvironment,
  PUBLIC_AVAILABILITY_RATE_LIMIT,
  publicOrderError,
  sanitizeAvailabilityResponse,
} from "@/lib/case-lab-3/orders.server";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

export type AvailabilityRouteDependencies = {
  getAvailability: typeof getAvailability;
  getPrivateOfferAvailability?: typeof getPrivateOfferAvailability;
  getPublicPaymentEnvironment: typeof getPublicPaymentEnvironment;
  getOrderRequestSecret: typeof getOrderRequestSecret;
  getHashedClientIp: typeof getHashedClientIp;
  consumeRateLimit: typeof consumeRateLimit;
};

const productionDependencies: AvailabilityRouteDependencies = {
  getAvailability,
  getPrivateOfferAvailability,
  getPublicPaymentEnvironment,
  getOrderRequestSecret,
  getHashedClientIp,
  consumeRateLimit,
};

export async function handleGet(
  request: Request,
  dependencies: AvailabilityRouteDependencies = productionDependencies,
): Promise<Response> {
  try {
    const hashedClientIp = dependencies.getHashedClientIp(
      request,
      dependencies.getOrderRequestSecret(),
      PUBLIC_AVAILABILITY_RATE_LIMIT.scope,
    );
    await dependencies.consumeRateLimit(
      PUBLIC_AVAILABILITY_RATE_LIMIT.scope,
      hashedClientIp,
      PUBLIC_AVAILABILITY_RATE_LIMIT.limitCount,
      PUBLIC_AVAILABILITY_RATE_LIMIT.bucketSeconds,
    );
    const environment = dependencies.getPublicPaymentEnvironment();
    const privateToken = new URL(request.url).searchParams.get("private_token");
    const availability = sanitizeAvailabilityResponse(
      privateToken === null
        ? await dependencies.getAvailability(environment)
        : await (dependencies.getPrivateOfferAvailability ?? getPrivateOfferAvailability)(environment, privateToken),
    );
    return noStoreJson(availability);
  } catch (error) {
    const result = publicOrderError(error);
    return noStoreJson(result.body, { status: result.status });
  }
}

export async function GET(request: Request): Promise<Response> {
  return handleGet(request);
}
