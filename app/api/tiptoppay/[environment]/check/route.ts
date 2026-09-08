import "server-only";

import {
  applyCheck,
  handleSignedTipTopWebhook,
  parseCheck,
  tipTopSecret,
  type TipTopCheck,
  type TipTopTransitionResult,
  type TipTopWebhookContext,
} from "@/lib/case-lab-3/tiptoppay.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type CheckRouteDependencies = {
  getSecret: typeof tipTopSecret;
  applyCheck: (environment: "test" | "live", payload: TipTopCheck, context: TipTopWebhookContext) => Promise<TipTopTransitionResult>;
};

const productionDependencies: CheckRouteDependencies = {
  getSecret: tipTopSecret,
  applyCheck,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ environment: string }> },
  dependencies: CheckRouteDependencies = productionDependencies,
): Promise<Response> {
  const { environment } = await params;
  return handleSignedTipTopWebhook(request, environment, {
    getSecret: dependencies.getSecret,
    parse: parseCheck,
    apply: (payload, context) => dependencies.applyCheck(context.environment, payload, context),
    eventType: "Check",
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ environment: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
