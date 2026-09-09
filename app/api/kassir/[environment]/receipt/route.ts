import "server-only";

import {
  applyReceipt,
  handleSignedKassirReceipt,
  kassirSecret,
  type KassirReceiptPayload,
  type KassirTransitionResult,
  type KassirWebhookDiagnostic,
  type KassirWebhookContext,
} from "@/lib/case-lab-3/kassir.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type ReceiptRouteDependencies = {
  getSecret: typeof kassirSecret;
  applyReceipt: (environment: "test" | "live", payload: KassirReceiptPayload, context: KassirWebhookContext) => Promise<KassirTransitionResult>;
  onDiagnostic?: (diagnostic: KassirWebhookDiagnostic) => void;
};

const productionDependencies: ReceiptRouteDependencies = {
  getSecret: kassirSecret,
  applyReceipt,
};

export async function handlePost(
  request: Request,
  { params }: { params: Promise<{ environment: string }> },
  dependencies: ReceiptRouteDependencies = productionDependencies,
): Promise<Response> {
  const { environment } = await params;
  return handleSignedKassirReceipt(request, environment, dependencies);
}

export async function POST(
  request: Request,
  context: { params: Promise<{ environment: string }> },
): Promise<Response> {
  return handlePost(request, context);
}
