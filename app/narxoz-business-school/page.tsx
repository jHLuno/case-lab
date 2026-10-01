import type { Metadata } from "next";

import NbsParticipantClient from "./NbsParticipantClient";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const metadata: Metadata = {
  title: "NBS Leadership Forum 2026 — Опрос",
  description: "Поделитесь взглядом на лидерство и искусственный интеллект на NBS Leadership Forum 2026.",
  alternates: { canonical: "https://caselab.kz/narxoz-business-school/" },
  robots: { index: false, follow: false },
  openGraph: {
    title: "NBS Leadership Forum 2026",
    description: "Опрос участников форума о лидерстве и AI.",
    url: "https://caselab.kz/narxoz-business-school/",
    type: "website",
  },
};

export default function NarxozBusinessSchoolPage() {
  return <NbsParticipantClient />;
}
