import type { Metadata } from "next";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BackToTop from "./BackToTop";

type ComingSoonPageProps = {
  tag: string;
  title: string;
  description: string;
};

export function buildComingSoonMetadata(title: string, description: string): Metadata {
  return {
    title: `${title} — Case Lab`,
    description,
    alternates: {
      canonical: "/",
    },
    robots: "index, follow",
  };
}

export default function ComingSoonPage({ tag, title, description }: ComingSoonPageProps) {
  return (
    <main className="relative min-h-screen bg-white">
      <Navbar />

      <section className="relative px-6 md:px-10 pt-32 md:pt-40 pb-24 md:pb-32 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

        <div className="max-w-[960px] mx-auto">
          <span
            className="text-gray text-[11px] mb-4 block leading-[1.58] uppercase tracking-wider"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {tag}
          </span>

          <h1
            className="text-black text-[clamp(32px,5vw,72px)] font-bold leading-[0.98] uppercase tracking-[0.02em] mb-6"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {title}
          </h1>

          <p
            className="text-black/60 text-[18px] md:text-[22px] leading-[1.4] max-w-2xl font-light mb-12"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {description}
          </p>

          <div className="rounded-[24px] border border-black/[0.08] bg-[#fafafa] p-8 md:p-12">
            <p
              className="text-gray text-[12px] uppercase tracking-wider mb-4"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Статус
            </p>
            <h2
              className="text-black text-[24px] md:text-[32px] font-bold leading-[1.05] uppercase tracking-[0.02em] mb-4"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Скоро будет
            </h2>
            <p
              className="text-black/60 text-[15px] md:text-[17px] leading-[1.55] max-w-2xl font-light"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Мы готовим полную страницу с разбором, выводами, инсайтами и визуальными материалами. Пока страница в подготовке, но скоро появится в базе знаний Case Lab.
            </p>
          </div>
        </div>
      </section>

      <Footer />
      <BackToTop />
    </main>
  );
}
