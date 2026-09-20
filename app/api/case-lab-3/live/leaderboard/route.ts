import "server-only";

import { noStoreJson } from "@/lib/case-lab-3/http.server";
import { getPublicPaymentEnvironment } from "@/lib/case-lab-3/orders.server";
import { getPublicLeaderboardData, type PublicLeaderboardData } from "@/lib/case-lab-3/live/public.server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type PublicLeaderboardRouteDependencies = {
  getPublicData: (environment: ReturnType<typeof getPublicPaymentEnvironment>) => Promise<PublicLeaderboardData>;
  getEnvironment: typeof getPublicPaymentEnvironment;
};

const productionDependencies: PublicLeaderboardRouteDependencies = {
  getPublicData: getPublicLeaderboardData,
  getEnvironment: getPublicPaymentEnvironment,
};

export async function handleGet(_request: Request, dependencies: Partial<PublicLeaderboardRouteDependencies> = {}): Promise<Response> {
  const active = { ...productionDependencies, ...dependencies };
  try {
    const data = await active.getPublicData(active.getEnvironment());
    return noStoreJson({
      entries: data.entries.slice(0, 10).map((entry) => ({ displayName: entry.displayName, points: entry.points, rank: entry.rank })),
      activeCase: data.activeCase,
      podiumAnswers: data.podiumAnswers.map((answer) => ({ place: answer.place, displayName: answer.displayName, answer: answer.answer })),
    });
  } catch {
    return noStoreJson({ error: "service_unavailable" }, { status: 503 });
  }
}

export async function GET(request: Request): Promise<Response> { return handleGet(request); }
