import { ArrowUpRight } from "lucide-react";
import Image from "next/image";

export default function CaseLab3Footer() {
  return (
    <footer className="relative z-[2] bg-white px-6 pb-8 pt-20 md:px-10 md:pt-32">
      <div className="absolute top-0 left-0 h-[1px] w-full divider-gradient" />

      <div className="mx-auto max-w-[1078px]">
        <div className="mb-20 text-center md:mb-28">
          <h2
            className="text-[clamp(24px,4vw,48px)] font-bold uppercase leading-[1.05] tracking-[0.02em] text-black md:max-w-none"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <span className="md:whitespace-nowrap">Увидимся на Case Lab III</span>
          </h2>
          <p
            className="mx-auto mb-10 max-w-md text-[15px] font-light leading-[1.4] text-black/60 md:mb-10 md:text-[18px]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Первые 20 билетов стоят 7 890 ₸. Дальше цена будет 15 000 ₸.
          </p>
          <button
            type="button"
            disabled
            aria-disabled="true"
            className="inline-flex items-center gap-3 rounded-full bg-[#040082] px-7 py-3.5 text-[14px] font-normal text-white transition-[gap,background-color] duration-200 hover:gap-4 hover:bg-[#0600a0] md:px-10 md:py-5 md:text-[15px]"
            style={{ fontFamily: "var(--font-body)" }}
          >
            <span>Купить билет</span>
            <ArrowUpRight size={16} strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <div className="mb-12 flex flex-col items-start gap-8 md:grid md:grid-cols-3 md:items-center">
          <div className="relative h-7 w-[130px] md:justify-self-start">
            <Image
              src="/Logo.png"
              alt="Case Lab"
              fill
              className="object-contain"
              loading="lazy"
              sizes="160px"
            />
          </div>

          <div className="w-full text-center">
            <a
              href="mailto:hello@caselab.kz"
              className="inline-flex min-h-11 items-center text-[15px] font-light text-black/60 transition-colors duration-200 hover:text-black"
              style={{ fontFamily: "var(--font-body)" }}
            >
              hello@caselab.kz
            </a>
          </div>

          <div className="flex flex-wrap items-center gap-4 md:justify-self-end md:gap-6">
            <a
              href="https://instagram.com/caselabkz"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-[15px] font-light text-gray transition-colors duration-200 hover:text-black"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Instagram Case Lab
            </a>
            <a
              href="https://www.linkedin.com/in/daniyar-kosnazarov-300806110/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center text-[15px] font-light text-gray transition-colors duration-200 hover:text-black"
              style={{ fontFamily: "var(--font-body)" }}
            >
              LinkedIn
            </a>
          </div>
        </div>

        <div className="flex flex-col items-start justify-between gap-4 border-t border-black/5 pt-6 md:flex-row md:items-center">
          <span className="text-[12px] font-light text-black/60" style={{ fontFamily: "var(--font-body)" }}>
            &copy; 2026 Case Lab. Все права защищены.
          </span>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <a
              href="/privacy/"
              className="inline-flex min-h-11 items-center text-[12px] font-light text-black/60 transition-colors duration-200 hover:text-black/80"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Политика конфиденциальности
            </a>
            <a
              href="/offer/"
              className="inline-flex min-h-11 items-center text-[12px] font-light text-black/60 transition-colors duration-200 hover:text-black/80"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Договор оферты
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
