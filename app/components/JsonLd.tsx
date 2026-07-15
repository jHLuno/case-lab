"use client";

export default function JsonLd() {
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Case Lab",
    alternateName: "Case Lab Kazakhstan",
    url: "https://caselab.kz",
    logo: "https://caselab.kz/Logo.png",
    description: "Маркетинговое агентство. Диагностика бизнеса, стратегия роста, маркетинговые гипотезы.",
    address: {
      "@type": "PostalAddress",
      addressLocality: "Алматы",
      addressCountry: "KZ",
    },
    contactPoint: {
      "@type": "ContactPoint",
      email: "hello@caselab.kz",
      contactType: "customer service",
      areaServed: "KZ",
      availableLanguage: ["Russian", "Kazakh"],
    },
    sameAs: [
      "https://instagram.com/narxoz_business_school",
      "https://instagram.com/kosnazzar",
      "https://linkedin.com/in/daniyar-kosnazarov-300806110",
    ],
  };

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

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Case Lab",
    url: "https://caselab.kz",
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  );
}
