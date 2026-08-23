import type { Metadata } from "next";
import CaseLab3Page from "../components/CaseLab3Page";
import { caseLab3CheckoutHref } from "../lib/caseLab3";

const caseLab3EventSchema = {
  "@context": "https://schema.org",
  "@type": "Event",
  name: "Case Lab III",
  description:
    "Разбор трёх казахстанских маркетинговых кейсов с обсуждением решений и результатов.",
  startDate: "2026-09-24T10:00:00+05:00",
  endDate: "2026-09-24T14:00:00+05:00",
  duration: "PT4H",
  eventStatus: "https://schema.org/EventScheduled",
  eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
  image: ["https://caselab.kz/caselab2.webp"],
  location: {
    "@type": "Place",
    name: "Narxoz Business School",
    address: {
      "@type": "PostalAddress",
      streetAddress: "ул. Жандосова 55/10",
      addressLocality: "Алматы",
      addressCountry: "KZ",
    },
  },
  organizer: {
    "@type": "Organization",
    name: "Case Lab",
    url: "https://caselab.kz",
  },
  performer: [
    {
      "@type": "Person",
      name: "Ануар Абдрахманов",
      jobTitle: "ex-CMO Invictus Go · нынешний CMO Bayan Sulu",
    },
    {
      "@type": "Person",
      name: "Перизат Сейфульмаликова",
      jobTitle: "CMO Qara Studios",
    },
  ],
  offers: [
    {
      "@type": "Offer",
      name: "Early Bird",
      price: "7890",
      priceCurrency: "KZT",
      availability: "https://schema.org/InStock",
      ...(caseLab3CheckoutHref ? { url: caseLab3CheckoutHref } : {}),
    },
    {
      "@type": "Offer",
      name: "Обычный билет",
      price: "15000",
      priceCurrency: "KZT",
      availability: "https://schema.org/InStock",
      ...(caseLab3CheckoutHref ? { url: caseLab3CheckoutHref } : {}),
    },
  ],
};

export const metadata: Metadata = {
  title: "Case Lab 3 | Кейсы, которые обычно не попадают в презентации",
  description:
    "24 сентября 2026 года, 10:00–14:00 (UTC+5), Narxoz Business School, ул. Жандосова 55/10, Алматы. Три маркетинговых кейса.",
  alternates: {
    canonical: "/case-lab-3/",
  },
  openGraph: {
    title: "Case Lab 3 | Кейсы, которые обычно не попадают в презентации",
    description:
      "Три реальных кейса в Алматы 24 сентября 2026 года, 10:00–14:00 (UTC+5). Early Bird — 7 890 ₸.",
    url: "/case-lab-3/",
    images: ["/caselab2.webp"],
  },
};

export default function Page() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(caseLab3EventSchema) }}
      />
      <CaseLab3Page />
    </>
  );
}
