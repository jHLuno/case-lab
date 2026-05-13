import type { Metadata } from "next";
import { Inter, Bebas_Neue } from "next/font/google";
import "./globals.css";
import JsonLd from "./components/JsonLd";

const inter = Inter({
  subsets: ["latin", "cyrillic"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const bebasNeue = Bebas_Neue({
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
  weight: ["400"],
});

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
  verification: {
    google: "your-google-verification-code",
    yandex: "your-yandex-verification-code",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
      <html lang="ru" className={`${inter.variable} ${bebasNeue.variable}`} suppressHydrationWarning>
      <head>
        <link rel="icon" type="image/x-icon" href="/favicons/favicon.ico?v=2" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicons/favicon-16x16.png?v=2" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicons/favicon-32x32.png?v=2" />
        <link rel="apple-touch-icon" sizes="180x180" href="/favicons/apple-touch-icon.png?v=2" />
        <link rel="manifest" href="/favicons/site.webmanifest?v=2" />
        <link rel="preload" href="/fonts/Benzin-Bold.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Benzin-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Gilroy-Regular.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/Gilroy-Medium.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        <JsonLd />
        <script dangerouslySetInnerHTML={{__html: `
          (function() {
            function clean() {
              document.querySelectorAll('[bis_skin_checked]').forEach(function(el) {
                el.removeAttribute('bis_skin_checked');
              });
            }
            clean();
            if (typeof MutationObserver !== 'undefined') {
              var obs = new MutationObserver(function(mutations) {
                mutations.forEach(function(m) {
                  if (m.type === 'attributes' && m.attributeName === 'bis_skin_checked') {
                    m.target.removeAttribute('bis_skin_checked');
                  }
                });
              });
              obs.observe(document.documentElement, { subtree: true, attributes: true, attributeFilter: ['bis_skin_checked'] });
            }
          })();
        `}} />
        {children}
      </body>
    </html>
  );
}
