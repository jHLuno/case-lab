import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import JsonLd from "./components/JsonLd";

export const metadata: Metadata = {
  metadataBase: new URL("https://caselab.kz"),
  title: "Case Lab — Маркетинговая диагностика и стратегия роста",
  description:
    "Case Lab — маркетинговое агентство. Диагностика бизнеса, стратегия роста, маркетинговые гипотезы. 2 часа глубокой сессии для понимания, где бизнес и где маркетинг.",
  keywords: ["маркетинг", "диагностика бизнеса", "стратегия роста", "маркетинговое агентство", "Казахстан", "Алматы"],
  authors: [{ name: "Case Lab" }],
  creator: "Case Lab",
  publisher: "Case Lab",
  robots: "index, follow",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "https://caselab.kz/",
    siteName: "Case Lab",
    title: "Case Lab — Маркетинговая диагностика и стратегия роста",
    description: "Case Lab — маркетинговое агентство. Диагностика бизнеса, стратегия роста, маркетинговые гипотезы. 2 часа глубокой сессии.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Case Lab — Маркетинговая диагностика",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Case Lab — Маркетинговая диагностика и стратегия роста",
    description: "Case Lab — маркетинговое агентство. Диагностика бизнеса, стратегия роста.",
    images: ["/og-image.png"],
    creator: "@caselab_kz",
  },

};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
      <html lang="ru" suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/x-icon" href="/favicons/favicon.ico?v=2" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png?v=2" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png?v=2" />
        <link rel="manifest" href="/favicons/site.webmanifest?v=2" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <JsonLd nonce={nonce} />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-3 focus:text-[#040082]"
        >
          Перейти к содержимому
        </a>
        <div tabIndex={-1}>
          {children}
        </div>
      </body>
    </html>
  );
}
