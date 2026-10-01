import type { Metadata } from "next";

import NbsResultsClient from "@/components/nbs/NbsResultsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Результаты | NBS Leadership Forum 2026",
  description: "Короткие результаты опроса участников NBS Leadership Forum 2026.",
  alternates: { canonical: "https://caselab.kz/narxoz-business-school/answers/" },
  robots: { index: false, follow: false },
  openGraph: { title: "Результаты — NBS Leadership Forum 2026", url: "https://caselab.kz/narxoz-business-school/answers/", type: "website" },
};

export default function NbsShortAnswersPage() {
  return <NbsResultsClient view="screen" />;
}
