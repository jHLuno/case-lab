"use client";

import { ArrowRight } from "lucide-react";

const takeaways = [
  {
    title: "Сформулированное EVP",
    description: "Поймёте, что именно компания обещает сотрудникам и почему сильным специалистам стоит выбрать вас.",
  },
  {
    title: "Связь с бизнес-целями",
    description: "Свяжете EVP с задачами бизнеса, ростом и реальными приоритетами без абстрактных HR-формулировок.",
  },
  {
    title: "Основа HR-бренда и коммуникаций",
    description: "Получите смысловой каркас для вакансий, внутренних коммуникаций, карьерной страницы и внешнего продвижения.",
  },
  {
    title: "Понятный план действий",
    description: "Определите следующие шаги: что доработать, какие сообщения проверить и как превратить EVP в рабочий инструмент.",
  },
];

export default function EVPProAudience() {
  return (
    <section aria-labelledby="evp-takeaways-title" className="bg-white px-6 py-16 md:px-10 md:py-24">
      <div className="mx-auto max-w-[1240px]">
        <header data-evp-reveal className="mx-auto max-w-[900px] text-center">
          <h2
            id="evp-takeaways-title"
            className="text-[clamp(24px,4.4vw,58px)] font-bold leading-[1.04] tracking-[0.02em] uppercase text-black"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            <span className="block whitespace-nowrap">С чем вы уйдёте</span>
            <span className="block whitespace-nowrap">после EVP PRO</span>
          </h2>
        </header>

        <div className="mt-14 grid gap-10 md:mt-20 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1fr)] lg:items-center lg:gap-20">
          <div data-evp-reveal>
            <div
              aria-label="Место для фотографии"
              data-evp-photo-slot
              className="aspect-[1.05] w-full rounded-[10px] bg-[#f5f6f8]"
            />
          </div>

          <div className="flex flex-col gap-8 md:gap-10">
            {takeaways.map((takeaway, index) => (
              <article
                key={takeaway.title}
                data-evp-reveal
                style={{ transitionDelay: `${index * 90}ms` }}
                className="grid grid-cols-[24px_minmax(0,1fr)] gap-4 md:grid-cols-[28px_minmax(0,1fr)] md:gap-5"
              >
                <ArrowRight aria-hidden="true" className="h-5 w-5 text-[#075C43] md:h-6 md:w-6" strokeWidth={1.8} />
                <div>
                  <h3
                    className="text-[20px] font-bold leading-[1.1] tracking-[0.01em] text-black md:text-[25px]"
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {takeaway.title}
                  </h3>
                  <p
                    className="mt-3 max-w-[52ch] text-[15px] leading-[1.5] text-black/60 md:mt-4 md:text-[17px]"
                    style={{ fontFamily: "var(--font-body)" }}
                  >
                    {takeaway.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
