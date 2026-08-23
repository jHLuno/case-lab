import type { Metadata } from "next";
import { headers } from "next/headers";
import CaseLab3Page from "../components/CaseLab3Page";
import { caseLab3CheckoutHref } from "../lib/caseLab3";

const caseLab3EventOffers = caseLab3CheckoutHref
  ? [
      {
        "@type": "Offer",
        name: "Early Bird",
        price: "7890",
        priceCurrency: "KZT",
        availability: "https://schema.org/InStock",
        url: caseLab3CheckoutHref,
      },
      {
        "@type": "Offer",
        name: "Обычный билет",
        price: "15000",
        priceCurrency: "KZT",
        availability: "https://schema.org/InStock",
        url: caseLab3CheckoutHref,
      },
    ]
  : undefined;

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
  image: ["https://caselab.kz/case-lab-3/opengraph-image"],
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
  ...(caseLab3EventOffers ? { offers: caseLab3EventOffers } : {}),
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
    images: [
      {
        url: "/case-lab-3/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Case Lab III — три маркетинговых кейса в Алматы",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Case Lab 3 | Кейсы, которые обычно не попадают в презентации",
    description:
      "Три реальных кейса в Алматы 24 сентября 2026 года, 10:00–14:00 (UTC+5). Early Bird — 7 890 ₸.",
    images: ["/case-lab-3/opengraph-image"],
  },
};

export default async function Page() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <>
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(caseLab3EventSchema) }}
      />
      <CaseLab3Page />
    </>
  );
}
