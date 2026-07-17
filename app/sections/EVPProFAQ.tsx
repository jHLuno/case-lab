"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

const faqItems = [
  {
    question: "Обязательно приходить командой?",
    answer:
      "Нет, участвовать можно и одному. Но EVP касается найма, бренда и репутации сразу, поэтому максимум пользы сессия даёт, когда руководитель, HR и маркетинг работают над ним вместе.",
  },
  {
    question: "Это лекция или практика?",
    answer:
      "Практическая сессия. Теории — минимум, необходимый для общего языка. Основное время вы работаете над EVP своей компании: ищете разрывы, формулируете основу, согласовываете следующие шаги.",
  },
  {
    question: "Подойдёт ли нам, если EVP ещё нет?",
    answer:
      "Да — сессия для этого и построена. Мы собираем основу EVP с нуля: от того, что компания уже обещает людям, до опорной идеи, на которой можно строить сообщения и решения.",
  },
  {
    question: "Что нужно подготовить заранее?",
    answer:
      "Ничего специального. Достаточно знать свою компанию изнутри: как устроен найм, что говорят кандидатам, как команда описывает место работы. Рабочие материалы выдадим на сессии.",
  },
  {
    question: "Как проходит запись?",
    answer:
      "Оставьте заявку через кнопку «Записаться» — мы свяжемся с вами в течение рабочего дня, ответим на вопросы и подтвердим участие.",
  },
];

export default function EVPProFAQ() {
  const [openItem, setOpenItem] = useState<number | null>(0);

  return (
    <section id="faq" aria-labelledby="evp-faq-title" className="bg-white px-6 py-24 md:px-10 md:py-40">
      <div data-evp-reveal className="text-center">
        <h2
          id="evp-faq-title"
          className="mx-auto max-w-none whitespace-nowrap text-[clamp(20px,3.6vw,50px)] font-bold leading-[1.06] tracking-[0.02em] uppercase text-black"
          style={{ fontFamily: "var(--font-heading)" }}
        >
          Вопросы перед записью
        </h2>
        <p
          className="mx-auto mt-6 max-w-[42ch] text-[16px] leading-[1.5] text-black/65 md:text-[18px]"
          style={{ fontFamily: "var(--font-body)" }}
        >
          Не нашли ответа — задайте вопрос в заявке, и мы вернёмся к вам в течение рабочего дня.
        </p>
      </div>

      <div className="mx-auto max-w-[900px]">
        <div data-evp-reveal className="mt-12 md:mt-16">
          <ul className="border-t border-black/10">
            {faqItems.map((item, index) => {
              const isOpen = index === openItem;

              return (
                <li key={item.question} className="border-b border-black/10">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenItem(isOpen ? null : index)}
                    className="flex w-full cursor-pointer items-center justify-between gap-6 py-5 text-left md:py-6"
                  >
                    <span
                      className={`text-[17px] font-bold leading-[1.3] transition-colors duration-200 md:text-[20px] ${
                        isOpen ? "text-[#075C43]" : "text-black"
                      }`}
                      style={{ fontFamily: "var(--font-body)" }}
                    >
                      {item.question}
                    </span>
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-[transform,border-color,color] duration-300 ${
                        isOpen ? "rotate-45 border-[#075C43] text-[#075C43]" : "border-black/15 text-black"
                      }`}
                    >
                      <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                    </span>
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p
                        className="max-w-[58ch] pb-6 text-[15px] leading-[1.55] text-black/65 md:text-[16px]"
                        style={{ fontFamily: "var(--font-body)" }}
                      >
                        {item.answer}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
