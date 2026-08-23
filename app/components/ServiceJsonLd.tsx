import { headers } from "next/headers";

export default async function ServiceJsonLd() {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Маркетинговая диагностика",
    provider: {
      "@type": "Organization",
      name: "Case Lab",
    },
    description: "2-часовая диагностика маркетинга. Разбор каналов, коммуникаций, слепых зон и точек роста.",
    areaServed: {
      "@type": "City",
      name: "Алматы",
    },
    offers: {
      "@type": "Offer",
      price: "175000",
      priceCurrency: "KZT",
      availability: "https://schema.org/InStock",
    },
  };

  return (
    <script
      type="application/ld+json"
      nonce={nonce}
      dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
    />
  );
}
