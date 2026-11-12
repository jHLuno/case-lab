import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Plus } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import HRIntensiveConfigurator from "../components/HRIntensiveConfigurator";
import HRIntensiveHeroBackground from "../components/HRIntensiveHeroBackground";
import HRIntensiveProblem from "../components/HRIntensiveProblem";
import HRIntensiveModules from "../components/HRIntensiveModules";

export const metadata: Metadata = {
  title: "Корпоративный интенсив о новом поколении | Case Lab",
  description:
    "Готовая программа для коммерции, маркетинга и HR: как продавать, нанимать и удерживать зумеров. 3 часа, полдня или целый день.",
  alternates: {
    canonical: "/hr-intensive/",
  },
  // Targeted outreach link, not for organic search.
  robots: { index: false, follow: false },
};

const navLinks = [
  { label: "Проблема", href: "#problem" },
  { label: "Блоки", href: "#modules" },
  { label: "Форматы", href: "#request" },
  { label: "Вопросы", href: "#faq" },
];

const heroFacts = [
  { label: "Длительность", value: "3 часа, полдня или целый день" },
  { label: "Для кого", value: "Коммерция, маркетинг, HR, руководство" },
];

const steps = [
  { title: "Собираете программу", text: "Выбираете длительность и блоки в конфигураторе ниже." },
  { title: "Получаете КП", text: "В течение рабочего дня присылаем предложение с программой и стоимостью." },
  { title: "Согласуем детали", text: "Дату, площадку и состав участников: коммерция, маркетинг, HR, руководство." },
  { title: "Проводим сессию", text: "Приходим к вашей команде с готовой программой и практикой." },
];

const facilitators = [
  {
    name: "Данияр Косназаров",
    text: "Основатель Case Lab, советник президента Narxoz University, ex-CMO Qazaq Republic и KPMG. 50+ компаний в консалтинге.",
    photo: "/daniyar-kosnazarov.webp",
    position: "center 20%",
  },
  {
    name: "Арман Шокпаров",
    text: "Основатель On-Point и сооснователь People Consulting. Хедхантер, эксперт по привлечению и развитию талантов.",
    photo: "/arman-shokparov.webp",
    position: "center 24%",
  },
  {
    name: "Амиржан Жампеисов",
    text: "CEO Founder's Hub, координатор проекта Case Lab. Работает с командами и предпринимательскими проектами.",
    photo: "/amirzhan-zhampeisov.webp",
    position: "center 15%",
  },
];

const faqItems = [
  {
    question: "Чем это отличается от обычного тренинга?",
    answer:
      "Программа собрана на исследованиях поколений и кейсах казахстанских компаний. Мы говорим не только о молодых сотрудниках, но и о молодых клиентах — тех, кто через несколько лет будет приносить вам основную выручку.",
  },
  {
    question: "Можно адаптировать программу под нашу компанию?",
    answer:
      "Базовые блоки одинаковы для всех — поэтому их можно провести быстро. Примеры и акценты подбираем под вашу отрасль и состав участников, это обсудим после КП.",
  },
  {
    question: "Сколько стоит?",
    answer:
      "Стоимость зависит от формата, количества участников и блоков. Оставьте заявку — пришлём КП с ценой в течение рабочего дня.",
  },
  {
    question: "Кому из команды стоит прийти?",
    answer:
      "Максимум пользы, когда в зале и коммерция, и маркетинг, и HR, и руководство: проблема смены поколений затрагивает продажи, бренд и найм одновременно.",
  },
];

const headingFont = { fontFamily: "var(--font-heading)" };
const bodyFont = { fontFamily: "var(--font-body)" };

export default function Page() {
  return (
    <div className="relative">
      <Navbar
        navLinks={navLinks}
        basePath="/hr-intensive/"
        ctaLabel="Запросить КП"
        ctaHref="#request"
        menuDescription="Корпоративный интенсив о новом поколении клиентов и сотрудников."
      />
      <main id="main" tabIndex={-1}>
        {/* Hero */}
        <section
          aria-labelledby="hr-intensive-title"
          className="relative isolate flex min-h-[100dvh] w-full items-end overflow-hidden bg-[#000011] text-white"
        >
          <HRIntensiveHeroBackground />

          <div className="relative z-10 w-full px-6 pb-16 pt-32 md:px-10 md:pb-[46px] md:pt-[178px]">
            <div className="mx-auto max-w-[1440px]">
              <p
                className="evp-hero-enter text-[12px] uppercase tracking-[0.14em] text-white/60 md:text-[13px]"
                style={bodyFont}
              >
                Корпоративный интенсив Case Lab
              </p>
              <h1
                id="hr-intensive-title"
                className="evp-hero-enter mt-5 text-[clamp(24px,7vw,30px)] font-bold uppercase leading-[1.08] tracking-[0.02em] md:text-[clamp(26px,calc((100vw-80px)/23.5),60px)]"
                style={headingFont}
              >
                {/* Two fixed lines from md up; font scales with the container so the longer line always fits. */}
                <span className="md:block md:whitespace-nowrap">Ваши следующие клиенты</span>{" "}
                <span className="md:block md:whitespace-nowrap">и сотрудники — зумеры</span>
              </h1>
              <p
                className="evp-hero-enter evp-hero-enter-delay-1 mt-6 max-w-[740px] text-balance text-[15px] leading-[1.5] text-white/80 md:mt-8 lg:text-[17px]"
                style={bodyFont}
              >
                Готовая программа для вашей команды: почему молодёжь не покупает и не остаётся — и как компании перестроить продажи, маркетинг и найм под новое поколение.
              </p>
              <div className="evp-hero-enter evp-hero-enter-delay-2 mt-8 flex flex-wrap items-center gap-3 md:mt-10">
                <a
                  href="#request"
                  className="inline-flex items-center gap-3 rounded-full bg-white px-7 py-3.5 text-[14px] text-[#040082] transition-[gap] duration-200 hover:gap-4 md:px-10 md:py-5 md:text-[15px]"
                  style={bodyFont}
                >
                  Собрать программу
                  <ArrowRight size={16} strokeWidth={2} aria-hidden="true" />
                </a>
                <a
                  href="#modules"
                  className="inline-flex items-center rounded-full border border-white/30 px-7 py-3.5 text-[14px] text-white transition-colors duration-200 hover:bg-white/10 md:px-10 md:py-5 md:text-[15px]"
                  style={bodyFont}
                >
                  Смотреть программу
                </a>
              </div>

              <dl
                className="evp-hero-enter evp-hero-enter-delay-2 mt-14 grid gap-4 border-t border-white/20 pt-6 md:grid-cols-2 md:gap-8"
                style={bodyFont}
              >
                {heroFacts.map((fact) => (
                  <div key={fact.label}>
                    <dt className="text-[12px] uppercase tracking-[0.12em] text-white/50">{fact.label}</dt>
                    <dd className="mt-2 text-[15px] leading-[1.35] text-white md:text-[17px]">{fact.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* Problem */}
        <HRIntensiveProblem />

        {/* Modules */}
        <HRIntensiveModules />

        {/* Configurator + request form */}
        <HRIntensiveConfigurator />

        {/* How it works */}
        <section aria-labelledby="hr-steps-title" className="bg-white px-6 py-24 md:px-10 md:py-32">
          <div className="mx-auto max-w-[1160px]">
            <h2
              id="hr-steps-title"
              className="text-[clamp(26px,3.8vw,52px)] font-bold uppercase leading-[1.06] tracking-[0.02em] text-black"
              style={headingFont}
            >
              Как это работает
            </h2>
            <ol className="mt-12 grid gap-8 border-t border-black/10 pt-10 md:mt-16 md:grid-cols-4 md:gap-6">
              {steps.map((step, index) => (
                <li key={step.title}>
                  <span className="text-[13px] tracking-[0.12em] text-[#040082]" style={bodyFont}>
                    0{index + 1}
                  </span>
                  <h3 className="mt-3 text-[18px] font-bold leading-[1.3] text-black" style={bodyFont}>
                    {step.title}
                  </h3>
                  <p className="mt-2 text-[15px] leading-[1.5] text-black/60" style={bodyFont}>
                    {step.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Facilitators */}
        <section aria-labelledby="hr-team-title" className="bg-[#f5f5f5] px-6 py-24 md:px-10 md:py-32">
          <div className="mx-auto max-w-[1160px]">
            <h2
              id="hr-team-title"
              className="text-[clamp(26px,3.8vw,52px)] font-bold uppercase leading-[1.06] tracking-[0.02em] text-black"
              style={headingFont}
            >
              Кто проводит
            </h2>
            <ul className="mt-12 grid gap-6 md:mt-16 md:grid-cols-3">
              {facilitators.map((person) => (
                <li key={person.name} className="overflow-hidden rounded-[24px] bg-white">
                  <div className="relative aspect-[4/3] w-full bg-black/5">
                    <Image
                      src={person.photo}
                      alt={person.name}
                      fill
                      sizes="(min-width: 768px) 33vw, 100vw"
                      className="object-cover"
                      style={{ objectPosition: person.position }}
                    />
                  </div>
                  <div className="p-7 md:p-8">
                    <h3
                      className="text-[17px] font-bold uppercase tracking-[0.02em] text-black md:text-[19px]"
                      style={headingFont}
                    >
                      {person.name}
                    </h3>
                    <p className="mt-3 text-[15px] leading-[1.5] text-black/65" style={bodyFont}>
                      {person.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* FAQ */}
        <section
          id="faq"
          tabIndex={-1}
          aria-labelledby="hr-faq-title"
          className="bg-white px-6 py-24 md:px-10 md:py-32"
        >
          <div className="mx-auto max-w-[900px]">
            <h2
              id="hr-faq-title"
              className="text-center text-[clamp(24px,3.6vw,50px)] font-bold uppercase leading-[1.06] tracking-[0.02em] text-black"
              style={headingFont}
            >
              Частые вопросы
            </h2>
            <ul className="mt-12 border-t border-black/10 md:mt-16">
              {faqItems.map((item) => (
                <li key={item.question} className="border-b border-black/10">
                  <details className="group">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-left md:py-6 [&::-webkit-details-marker]:hidden">
                      <span
                        className="text-[17px] font-bold leading-[1.3] text-black transition-colors duration-200 group-open:text-[#040082] md:text-[20px]"
                        style={bodyFont}
                      >
                        {item.question}
                      </span>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-black/15 text-black transition-[transform,border-color,color] duration-300 group-open:rotate-45 group-open:border-[#040082] group-open:text-[#040082]">
                        <Plus size={16} strokeWidth={1.5} aria-hidden="true" />
                      </span>
                    </summary>
                    <p
                      className="max-w-[58ch] pb-6 text-[15px] leading-[1.55] text-black/65 md:text-[16px]"
                      style={bodyFont}
                    >
                      {item.answer}
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>
      <Footer
        ctaHeading="Обсудим программу?"
        ctaDescription="Соберите формат в конфигураторе — пришлём КП в течение рабочего дня."
        ctaLabel="Запросить КП"
        ctaHref="#request"
      />
    </div>
  );
}
