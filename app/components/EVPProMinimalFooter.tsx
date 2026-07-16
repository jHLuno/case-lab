"use client";

import Image from "next/image";

const socialLinks = [
  { label: "Instagram Narxoz", href: "https://instagram.com/narxoz_business_school" },
  { label: "Instagram Kosnazzar", href: "https://instagram.com/kosnazzar" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/daniyar-kosnazarov-300806110/" },
];

export default function EVPProMinimalFooter() {
  return (
    <footer className="relative bg-[#043B2C] px-6 pb-8 pt-5 md:px-10 md:pb-10 md:pt-6">
      <div className="mx-auto max-w-[1078px]">
        <div className="flex flex-col items-start justify-between gap-8 border-b border-white/10 pb-8 md:flex-row md:items-center">
          <div className="relative h-7 w-[130px]">
            <Image
              src="/logo green.png"
              alt="Case Lab"
              fill
              className="object-contain"
              loading="lazy"
              sizes="130px"
            />
          </div>

          <a
            href="mailto:hello@caselab.kz"
            className="text-[15px] font-light text-white/60 transition-colors duration-200 hover:text-white"
            style={{ fontFamily: "var(--font-body)" }}
          >
            hello@caselab.kz
          </a>

          <div className="flex flex-wrap items-center gap-5 md:gap-6">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[15px] font-light text-white/50 transition-colors duration-200 hover:text-white"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 pt-6 md:flex-row md:items-center">
          <span
            className="text-[12px] font-light text-white/40"
            style={{ fontFamily: "var(--font-body)" }}
          >
            © 2026 Case Lab. Все права защищены.
          </span>
          <a
            href="/privacy/"
            className="text-[12px] font-light text-white/40 transition-colors duration-200 hover:text-white/70"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Политика конфиденциальности
          </a>
        </div>
      </div>
    </footer>
  );
}
