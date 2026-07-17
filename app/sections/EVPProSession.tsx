"use client";

import { useState } from "react";
import EVPProcessCubes from "../components/EVPProcessCubes";

const stages = [
  {
    title: "Найти разрыв",
    description: "Сопоставим то, что компания обещает рынку, с тем, как её воспринимают внутри и снаружи.",
  },
  {
    title: "Определить выбор",
    description: "Зафиксируем, каких людей вы хотите привлекать и почему именно они должны выбрать вашу компанию.",
  },
  {
    title: "Собрать основу EVP",
    description: "Сформулируем опорную идею, на которой можно строить сообщения, опыт и решения для команды.",
  },
  {
    title: "Согласовать следующий шаг",
    description: "Выберем первые действия для HR, руководителей, PR и маркетинга после сессии.",
  },
];

export default function EVPProSession() {
  const [activeStage, setActiveStage] = useState(0);

  return (
    <section aria-labelledby="evp-session-title" className="bg-white px-4 py-14 md:px-10 md:py-20">
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
      </div>
    </section>
  );
}
