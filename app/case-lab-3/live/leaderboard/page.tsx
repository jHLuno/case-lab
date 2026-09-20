import type { Metadata } from "next";

import LeaderboardClient from "./LeaderboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Лидерборд | Case Lab III",
  description: "Текущие результаты интерактива Case Lab III.",
  robots: { index: false, follow: false },
};

export default function CaseLab3LeaderboardPage() {
  return <LeaderboardClient />;
}
