import "server-only";

import {
  applyPay,
  handleSignedTipTopWebhook,
  parsePay,
  tipTopSecret,
  type TipTopPay,
  type TipTopTransitionResult,
  type TipTopWebhookContext,
} from "@/lib/case-lab-3/tiptoppay.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type PayRouteDependencies = {
  getSecret: typeof tipTopSecret;
  applyPay: (environment: "test" | "live", payload: TipTopPay, context: TipTopWebhookContext) => Promise<TipTopTransitionResult>;
};

const productionDependencies: PayRouteDependencies = {
  getSecret: tipTopSecret,
  applyPay,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ environment: string }> },
  dependencies: PayRouteDependencies = productionDependencies,
): Promise<Response> {
  const { environment } = await params;
  return handleSignedTipTopWebhook(request, environment, {
    getSecret: dependencies.getSecret,
    parse: parsePay,
    apply: (payload, context) => dependencies.applyPay(context.environment, payload, context),
    eventType: "Pay",
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ environment: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
