import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Plus } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import HRIntensiveConfigurator from "../components/HRIntensiveConfigurator";
import HRIntensiveHeroBackground from "../components/HRIntensiveHeroBackground";

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
  { label: "Стоимость", value: "По запросу — пришлём КП" },
];

const symptoms = [
  {
    title: "Бренд знают мамы, но не дочери",
    text: "Косметическая компания: ядро покупателей — женщины 45+. Молодёжь бренд просто не знает, а команда и консультанты говорят на языке своего поколения.",
  },
  {
    title: "Наследник уходит к конкуренту",
    text: "Дистрибьютор агротехники: ферму принимает сын основателя и первым делом покупает другой бренд. Техника не хуже — просто лояльность держалась на убеждениях отца.",
  },
  {
    title: "Молодые не задерживаются",
    text: "Внутри компании руководители не понимают, как нанимать, мотивировать и удерживать молодых сотрудников. Текучка растёт, преемственности нет.",
  },
];

const modules = [
  {
    index: "01",
    title: "Зумерология",
    text: "Кто такие Gen Z и Alpha: как они думают, выбирают, покупают и работают. Ценности, мифы о поколении и навыки будущего — на данных и живых кейсах.",
  },
  {
    index: "02",
    title: "EJM — карта пути сотрудника",
    text: "Employee Journey Map: разбираем путь сотрудника от первого касания с компанией до ухода — где молодые таланты теряют интерес и что менять на каждом этапе.",
  },
  {
    index: "03",
    title: "EVP и бренд работодателя",
    text: "Тренды HR-брендинга, архетипы работодателя и из чего складывается позиционирование, которое привлекает и удерживает молодые таланты.",
  },
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
                className="evp-hero-enter evp-hero-enter-delay-1 mt-6 max-w-[60ch] text-[16px] leading-[1.5] text-white/80 md:mt-8 md:text-[19px]"
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
                  Что внутри
                </a>
              </div>

              <dl
                className="evp-hero-enter evp-hero-enter-delay-2 mt-14 grid gap-4 border-t border-white/20 pt-6 md:grid-cols-3 md:gap-8"
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
        <section
          id="problem"
          tabIndex={-1}
          aria-labelledby="hr-problem-title"
          className="bg-white px-6 py-24 md:px-10 md:py-36"
        >
          <div className="mx-auto max-w-[1160px]">
            <h2
              id="hr-problem-title"
              className="text-[clamp(26px,3.8vw,52px)] font-bold uppercase leading-[1.06] tracking-[0.02em] text-black"
              style={headingFont}
            >
              <span className="md:block md:whitespace-nowrap">Поколение сменилось.</span>{" "}
              <span className="md:block md:whitespace-nowrap">Ваши продажи — ещё нет</span>
            </h2>
            <p
              className="mt-6 max-w-[60ch] text-[16px] leading-[1.55] text-black/65 md:text-[18px]"
              style={bodyFont}
            >
              43% казахстанцев — моложе 25 лет. Компании, которые были на коне 10–15 лет назад, теряют выручку не из-за продукта, а потому что не понимают, как с этим поколением говорить: как с клиентами и как с сотрудниками.
            </p>

            <div className="mt-12 grid gap-4 md:mt-16 lg:grid-cols-3 lg:gap-6">
              {symptoms.map((item) => (
                <article
                  key={item.title}
                  className="flex flex-col rounded-[24px] border border-black/[0.08] bg-[#f5f5f5] p-7 md:p-9 lg:p-7 xl:p-10"
                >
                  <h3
                    className="text-[16px] font-bold uppercase leading-[1.2] tracking-[0.02em] text-[#040082] md:text-[19px] lg:text-[16px] xl:text-[19px]"
                    style={headingFont}
                  >
                    {item.title}
                  </h3>
                  <p className="mt-5 text-[15px] leading-[1.55] text-black/70" style={bodyFont}>
                    {item.text}
                  </p>
                </article>
              ))}
            </div>
            <p className="mt-8 text-[14px] leading-[1.5] text-black/50" style={bodyFont}>
              Реальные запросы, с которыми к нам приходят компании. Названия скрыты.
            </p>
          </div>
        </section>

        {/* Modules */}
        <section
          id="modules"
          tabIndex={-1}
          aria-labelledby="hr-modules-title"
          className="relative isolate overflow-hidden bg-[#040082] px-6 py-24 text-white md:px-10 md:py-36"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.14),transparent_40%)]"
          />
          <div className="relative z-10 mx-auto max-w-[1160px]">
            <h2
              id="hr-modules-title"
              className="text-[clamp(26px,3.8vw,52px)] font-bold uppercase leading-[1.06] tracking-[0.02em]"
              style={headingFont}
            >
              Три готовых блока
            </h2>
            <p
              className="mt-6 max-w-[58ch] text-[16px] leading-[1.55] text-white/70 md:text-[18px]"
              style={bodyFont}
            >
              Программа уже обкатана на конференциях и корпоративных сессиях. Вы выбираете, сколько времени готова уделить команда, — мы собираем из блоков нужный формат.
            </p>

            <ol className="mt-12 grid gap-4 md:mt-16 lg:grid-cols-3 lg:gap-6">
              {modules.map((module) => (
                <li
                  key={module.index}
                  className="flex flex-col rounded-[24px] border border-white/20 bg-white/[0.06] p-7 md:p-9 lg:p-7 xl:p-10"
                >
                  <span className="text-[13px] tracking-[0.12em] text-white/50" style={bodyFont}>
                    {module.index}
                  </span>
                  <h3
                    className="mt-4 text-[18px] font-bold uppercase leading-[1.15] tracking-[0.02em] md:text-[22px] lg:text-[18px] xl:text-[22px]"
                    style={headingFont}
                  >
                    {module.title}
                  </h3>
                  <p className="mt-5 text-[15px] leading-[1.55] text-white/75" style={bodyFont}>
                    {module.text}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </section>

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
