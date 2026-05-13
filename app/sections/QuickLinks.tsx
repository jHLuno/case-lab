"use client";

import { ArrowRight, ArrowUpRight } from "lucide-react";

const articles = [
  {
    tag: "Поток #2",
    title: "Как inDrive выстроил локальный бренд в Казахстане",
    desc: "Разбор кейса: от стратегии до метрик. Что сработало и почему.",
    href: "/insights/indrive-brand-kazakhstan/",
  },
  {
    tag: "Наблюдение",
    title: "Почему 70% SMB теряют деньги на одном и том же канале",
    desc: "Типичная слепая зона в маркетинге среднего бизнеса.",
    href: "/insights/smb-channel-blind-spot/",
  },
  {
    tag: "Экспертиза",
    title: "Диагностика vs аудит: в чём разница и зачем оба",
    desc: "Зачем проводить диагностику, если уже есть аудит от прошлого агентства.",
    href: "/insights/diagnostics-vs-audit/",
  },
  {
    tag: "Ивент",
    title: "Case Lab Meetup: позиционирование в кризис",
    desc: "Запись сессии с маркетинг-директорами FMCG и SaaS.",
    href: "/insights/meetup-positioning-crisis/",
  },
];

export default function QuickLinks() {
  return (
    <section id="insights" aria-label="База знаний" className="relative bg-white py-16 md:py-40 px-6 md:px-10 overflow-clip z-[3]">
      <div className="absolute top-0 left-0 w-full h-[1px] divider-gradient" />

      <div className="max-w-[1200px] mx-auto">
        {/* Header */}
        <div className="flex items-start justify-between mb-12 md:mb-20">
          <div>
            <span
              className="text-gray text-[11px] mb-3 block leading-[1.58] uppercase tracking-wider"
              style={{ fontFamily: "var(--font-body)" }}
            >
              База знаний
            </span>
            <h2
              className="text-black text-[clamp(22px,3.5vw,42px)] font-bold leading-[1.12] uppercase tracking-[0.02em]"
              style={{ fontFamily: "var(--font-heading)" }}
            >
              Из наблюдений
            </h2>
          </div>
          <span
            className="hidden md:inline-flex items-center gap-2 text-gray text-[14px] font-normal flex-shrink-0 mt-4"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Скоро
            <ArrowRight size={14} />
          </span>
        </div>

        {/* Articles grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-px md:bg-black/[0.08] md:rounded-[12px] md:overflow-hidden">
          {articles.map((article) => (
            <a
              key={article.title}
              href={article.href}
              className="group bg-white p-6 md:p-8 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.08)] md:shadow-none rounded-[12px] md:rounded-none hover:bg-[#040082]/[0.02] transition-colors duration-300"
            >
              <span
                className="inline-block text-[#040082] text-[11px] uppercase tracking-wider mb-4"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {article.tag}
              </span>
              <h3
                className="text-black text-[15px] md:text-[18px] lg:text-[20px] font-normal leading-[1.25] uppercase tracking-[0.02em] mb-3 group-hover:text-[#040082] transition-colors duration-300"
                style={{ fontFamily: "var(--font-heading)" }}
              >
                {article.title}
              </h3>
              <p
                className="text-black/60 text-[14px] md:text-[15px] leading-[1.4] font-light mb-6"
                style={{ fontFamily: "var(--font-body)" }}
              >
                {article.desc}
              </p>
                <span className="inline-flex items-center gap-2 text-gray text-[13px] font-light group-hover:text-[#040082] transition-colors duration-300" style={{ fontFamily: "var(--font-body)" }}>
                Читать
                <ArrowUpRight size={14} strokeWidth={1.5} className="transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </span>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
