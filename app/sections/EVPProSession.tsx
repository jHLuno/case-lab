"use client";

import { useState } from "react";
import EVPProcessCubes from "../components/EVPProcessCubes";

const stages = [
  {
    title: "Бизнес-стратегия и цели",
    description: "Разберём цели компании, точки роста и задачи бизнеса, чтобы связать HR-бренд с реальными приоритетами, а не с оторванным от бизнеса слоганом.",
  },
  {
    title: "Четыре ключевые аудитории",
    description: "Определим четыре критически важные аудитории для привлечения в компанию и разберём их мотивацию, ожидания и критерии выбора работодателя.",
  },
  {
    title: "Архетип и EVP-обещание",
    description: "Найдём характер компании как работодателя и сформулируем EVP-обещание: что именно компания даёт сотрудникам и почему этому можно верить.",
  },
  {
    title: "Месседжи для аудиторий",
    description: "Разработаем ключевые сообщения для каждой из четырёх аудиторий: что говорить, какие смыслы подчёркивать и как связывать их с бизнес-целями.",
  },
  {
    title: "Каналы и способы коммуникации",
    description: "Выберем способы и каналы донесения месседжей: от внутренних коммуникаций до внешнего продвижения бренда работодателя.",
  },
  {
    title: "Лучшие кейсы EVP и HR-бренда",
    description: "Разберём лучшие кейсы компаний, посмотрим, как они превращают EVP в реальные коммуникации и решения, и возьмём применимые практики.",
  },
];

export default function EVPProSession() {
  const [activeStage, setActiveStage] = useState(0);

  return (
    <section id="session" aria-labelledby="evp-session-title" className="bg-white px-4 py-14 md:px-10 md:py-20">
      <div className="mx-auto max-w-[1440px] rounded-[6px] border-2 border-[#075C43] px-5 py-8 md:px-12 md:py-14">
        <header className="relative pb-9 pl-4 md:pb-14 md:pl-6 md:pr-40">
          <div className="relative">
            <h2
              id="evp-session-title"
              className="text-[clamp(30px,4vw,58px)] font-bold leading-[1.05] tracking-[0.02em] text-black"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              <span className="md:whitespace-nowrap">Шесть часов, чтобы</span><br />
              <span className="md:whitespace-nowrap">собрать основу EVP</span>
            </h2>
            <p
              className="mt-6 max-w-[62ch] text-[15px] leading-[1.5] text-black/65 md:mt-8 md:text-[18px]"
              style={{ fontFamily: "var(--font-body)" }}
            >
              Практический тренинг, где вы превратите бизнес-цели компании в конкретные шаги по привлечению талантов. На каждом модуле — практические занятия, разборы и инструменты, которые можно использовать сразу.
            </p>
            <EVPProcessCubes />
          </div>
        </header>

        <ol className="border-t-2 border-dashed border-black/80">
          {stages.map((stage, index) => {
            const isActive = index === activeStage;

            return (
              <li
                key={stage.title}
                onMouseEnter={() => setActiveStage(index)}
                onFocus={() => setActiveStage(index)}
                tabIndex={0}
                className="group grid cursor-default grid-cols-[88px_minmax(0,1fr)] items-center gap-7 border-b-2 border-dashed border-black/80 py-6 pl-4 md:grid-cols-[160px_minmax(0,1fr)] md:gap-10 md:py-7 md:pl-6"
              >
                <span
                  className={`justify-self-center text-[clamp(42px,5.5vw,80px)] leading-none tracking-[-0.05em] transition-colors duration-500 ${isActive ? "text-[#075C43]" : "text-black/20"}`}
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  0{index + 1}
                </span>

                <div className="flex min-w-0 flex-col justify-center self-stretch">
                  <h3
                    className={`text-[clamp(23px,2.6vw,40px)] leading-[1.1] transition-colors duration-500 ${isActive ? "text-[#075C43]" : "text-black"}`}
                    style={{ fontFamily: "var(--font-heading)" }}
                  >
                    {stage.title}
                  </h3>
                  <div className={`grid transition-[grid-template-rows,opacity] duration-500 ease-out ${isActive ? "mt-3 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0"}`}>
                    <div className="overflow-hidden">
                      <p className="max-w-[64ch] text-[15px] leading-[1.5] text-black/65 md:text-[18px]" style={{ fontFamily: "var(--font-body)" }}>
                        {stage.description}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <p
          className="pt-7 pl-4 text-[15px] leading-[1.5] text-[#075C43] md:pt-9 md:pl-6 md:text-[18px]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          На выходе — драфт плана по продвижению бренда работодателя и понятные шаги по привлечению талантов.
        </p>
      </div>
    </section>
  );
}
