type JsonLdProps = {
  nonce?: string;
};

export default function JsonLd({ nonce }: JsonLdProps) {
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
    sameAs: ["https://instagram.com/caselabkz"],
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
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
      <script
        type="application/ld+json"
        nonce={nonce}
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
    </>
  );
}
