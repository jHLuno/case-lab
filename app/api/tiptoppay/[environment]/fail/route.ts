import "server-only";

import {
  applyFail,
  handleSignedTipTopWebhook,
  parseFail,
  tipTopSecret,
  type TipTopFail,
  type TipTopTransitionResult,
  type TipTopWebhookContext,
} from "@/lib/case-lab-3/tiptoppay.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type FailRouteDependencies = {
  getSecret: typeof tipTopSecret;
  applyFail: (environment: "test" | "live", payload: TipTopFail, context: TipTopWebhookContext) => Promise<TipTopTransitionResult>;
};

const productionDependencies: FailRouteDependencies = {
  getSecret: tipTopSecret,
  applyFail,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ environment: string }> },
  dependencies: FailRouteDependencies = productionDependencies,
): Promise<Response> {
  const { environment } = await params;
  return handleSignedTipTopWebhook(request, environment, {
    getSecret: dependencies.getSecret,
    parse: parseFail,
    apply: (payload, context) => dependencies.applyFail(context.environment, payload, context),
    eventType: "Fail",
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ environment: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
