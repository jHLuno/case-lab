import "server-only";

import {
  applyRefund,
  handleSignedTipTopWebhook,
  parseRefund,
  tipTopSecret,
  type TipTopRefund,
  type TipTopTransitionResult,
  type TipTopWebhookContext,
} from "@/lib/case-lab-3/tiptoppay.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type RefundRouteDependencies = {
  getSecret: typeof tipTopSecret;
  applyRefund: (environment: "test" | "live", payload: TipTopRefund, context: TipTopWebhookContext) => Promise<TipTopTransitionResult>;
};

const productionDependencies: RefundRouteDependencies = {
  getSecret: tipTopSecret,
  applyRefund,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ environment: string }> },
  dependencies: RefundRouteDependencies = productionDependencies,
): Promise<Response> {
  const { environment } = await params;
  return handleSignedTipTopWebhook(request, environment, {
    getSecret: dependencies.getSecret,
    parse: parseRefund,
    apply: (payload, context) => dependencies.applyRefund(context.environment, payload, context),
    eventType: "Refund",
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ environment: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
