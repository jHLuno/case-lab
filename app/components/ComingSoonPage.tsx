import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "./Navbar";
import Footer from "./Footer";
import BackToTop from "./BackToTop";
import { ArrowLeft } from "lucide-react";

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

        <div className="max-w-[720px] mx-auto">
          {/* Back link */}
          <Link
            href="/#news"
            className="inline-flex items-center gap-2 text-black/40 text-[13px] font-light mb-8 hover:text-[#040082] transition-colors"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <ArrowLeft size={14} />
            Назад к статьям
          </Link>

          {/* Tag */}
          <span
            className="text-[#040082] text-[11px] mb-4 block leading-[1.58] uppercase tracking-wider font-medium"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {tag}
          </span>

          {/* Title */}
          <h1
            className="text-black text-[clamp(24px,4vw,42px)] font-bold leading-[1.1] uppercase tracking-[0.02em] mb-6"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            {title}
          </h1>

          {/* Description */}
          <p
            className="text-black/60 text-[16px] md:text-[18px] leading-[1.5] font-light mb-12"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {description}
          </p>

          {/* Coming soon card */}
          <div className="rounded-[20px] border border-black/[0.06] bg-[#fafafa] p-8 md:p-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-2 h-2 rounded-full bg-[#040082] animate-pulse" />
              <span
                className="text-black/40 text-[12px] uppercase tracking-wider font-medium"
                style={{ fontFamily: "var(--font-body)" }}
              >
                В подготовке
              </span>
            </div>
            <h2
              className="text-black text-[20px] md:text-[24px] font-bold leading-[1.1] uppercase tracking-[0.02em] mb-3"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Скоро
            </h2>
            <p
              className="text-black/50 text-[14px] md:text-[15px] leading-[1.55] font-light"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Мы готовим полную страницу с разбором, выводами и визуальными материалами. Скоро появится в базе знаний Case Lab.
            </p>
          </div>
        </div>
      </section>

      <Footer />
      <BackToTop />
    </main>
  );
}
