import type { Metadata } from "next";
import CaseLab3Page from "../components/CaseLab3Page";

export const metadata: Metadata = {
  title: "Case Lab 3 | Кейсы, которые обычно не попадают в презентации",
  description:
    "24 сентября в Narxoz Business School три маркетинговых кейса от Invictus Go, Qara Studios и Forte Bank x GForce Grey.",
  alternates: {
    canonical: "/case-lab-3/",
  },
  openGraph: {
    title: "Case Lab 3 | Кейсы, которые обычно не попадают в презентации",
    description:
      "Три реальных кейса, три CMO и один вечер в Алматы. Первые 20 билетов — 7 890 ₸.",
    url: "/case-lab-3/",
    images: ["/caselab2.webp"],
  },
};

export default function Page() {
  return <CaseLab3Page />;
}
