import type { Metadata } from "next";
import Image from "next/image";
import { ArrowRight, Plus } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import HRIntensiveConfigurator from "../components/HRIntensiveConfigurator";
import HRIntensiveHeroBackground from "../components/HRIntensiveHeroBackground";
import HRIntensiveProblem from "../components/HRIntensiveProblem";
import HRIntensiveModules from "../components/HRIntensiveModules";
import HRIntensiveSteps from "../components/HRIntensiveSteps";

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

const facilitators = [
  {
    name: "Данияр Косназаров",
    role: "Основатель Case Lab",
    stat: "50+",
    statLabel: "компаний в консалтинге",
    text: "Советник президента Narxoz University, ex-CMO Qazaq Republic и KPMG.",
    photo: "/daniyar-kosnazarov.webp",
    position: "center 20%",
  },
  {
    name: "Арман Шокпаров",
    role: "Основатель On-Point",
    stat: "2",
    statLabel: "HR-компании: On-Point и People Consulting",
    text: "Хедхантер, эксперт по привлечению и развитию талантов.",
    photo: "/arman-shokparov.webp",
    position: "center 24%",
  },
  {
    name: "Амиржан Жампеисов",
    role: "CEO Founder's Hub",
    stat: "Case Lab",
    statLabel: "координатор проекта",
    text: "Работает с командами и предпринимательскими проектами.",
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
                className="evp-hero-enter evp-hero-enter-delay-2 mt-14 flex flex-col gap-4 border-t border-white/20 pt-6 md:flex-row md:gap-16 lg:gap-24"
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
        <HRIntensiveSteps />

        {/* Facilitators: dark portrait cards; the hovered / focused card turns blue and shows the bio */}
        <section
          aria-labelledby="hr-team-title"
          className="relative isolate overflow-hidden bg-[#000011] px-6 py-[48px] text-white md:px-10 md:py-14 lg:py-16"
        >
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10"
            style={{
              background:
                "radial-gradient(ellipse at 50% 0%, rgba(26,26,158,0.55) 0%, transparent 60%), radial-gradient(ellipse at 50% 100%, rgba(4,0,130,0.6) 0%, transparent 55%)",
            }}
          />
          <div className="mx-auto max-w-[1160px]">
            <span className="mb-3 block text-[11px] uppercase leading-[1.58] tracking-wider text-white/60" style={bodyFont}>
              Команда
            </span>
            <h2
              id="hr-team-title"
              className="text-[clamp(26px,3.8vw,52px)] font-bold uppercase leading-[1.06] tracking-[0.02em]"
              style={headingFont}
            >
              Кто проводит
            </h2>
            <ul className="mt-[32px] grid gap-4 sm:grid-cols-2 md:mt-[40px] lg:grid-cols-3 lg:gap-5">
              {facilitators.map((person) => (
                <li
                  key={person.name}
                  tabIndex={0}
                  className="group relative aspect-[3/4] overflow-hidden rounded-[20px] border border-white/10 bg-[#0a0a3a] outline-none focus-visible:ring-2 focus-visible:ring-white/70 sm:aspect-[4/5]"
                >
                  <Image
                    src={person.photo}
                    alt={person.name}
                    fill
                    sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                    className="object-cover transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-safe:group-hover:scale-[1.04]"
                    style={{ objectPosition: person.position }}
                  />
                  {/* Unifying blue tint + bottom shade for the caption */}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-[linear-gradient(180deg,rgba(4,0,130,0.15)_0%,rgba(0,0,17,0.15)_45%,rgba(0,0,17,0.85)_100%)]"
                  />

                  {/* Resting caption */}
                  <div className="absolute inset-x-0 bottom-0 p-5 transition-opacity duration-300 group-hover:opacity-0 group-focus:opacity-0 md:p-6 [@media(hover:none)]:hidden">
                    <h3 className="text-[16px] font-bold uppercase leading-[1.2] tracking-[0.03em] md:text-[18px]" style={headingFont}>
                      {person.name}
                    </h3>
                    <p className="mt-1 text-[13px] text-white/65" style={bodyFont}>
                      {person.role}
                    </p>
                  </div>

                  {/* Active state: blue panel with the bio (always shown on touch screens) */}
                  <div className="absolute inset-0 flex flex-col justify-between bg-[#040082]/90 p-5 opacity-0 backdrop-blur-[2px] transition-opacity duration-300 group-hover:opacity-100 group-focus:opacity-100 md:p-6 [@media(hover:none)]:inset-auto [@media(hover:none)]:bottom-0 [@media(hover:none)]:left-0 [@media(hover:none)]:right-0 [@media(hover:none)]:opacity-100">
                    <div>
                      <h3 className="text-[16px] font-bold uppercase leading-[1.2] tracking-[0.03em] md:text-[18px]" style={headingFont}>
                        {person.name}
                      </h3>
                      <p className="mt-1 text-[13px] text-white/70" style={bodyFont}>
                        {person.role}
                      </p>
                      <p className="mt-4 text-[14px] leading-[1.5] text-white/85 [@media(hover:none)]:mt-3" style={bodyFont}>
                        {person.text}
                      </p>
                    </div>
                    <div className="mt-5 flex items-end gap-3 border-t border-white/20 pt-4">
                      <span className="shrink-0 text-[30px] font-bold leading-none md:text-[34px]" style={headingFont}>
                        {person.stat}
                      </span>
                      <span className="pb-0.5 text-[12px] leading-[1.35] text-white/70" style={bodyFont}>
                        {person.statLabel}
                      </span>
                    </div>
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
            <ul className="mt-[48px] border-t border-black/10 md:mt-16">
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
