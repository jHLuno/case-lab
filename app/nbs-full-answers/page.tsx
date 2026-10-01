import type { Metadata } from "next";

import NbsResultsClient from "@/components/nbs/NbsResultsClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "Полный отчёт | NBS Leadership Forum 2026",
  description: "Полный агрегированный анализ ответов участников NBS Leadership Forum 2026.",
  alternates: { canonical: "https://caselab.kz/nbs-full-answers/" },
  robots: { index: false, follow: false },
  openGraph: { title: "Полный отчёт — NBS Leadership Forum 2026", url: "https://caselab.kz/nbs-full-answers/", type: "website" },
};

export default function NbsFullAnswersPage() {
  return <NbsResultsClient view="full" />;
}
