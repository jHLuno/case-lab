"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Check, CheckCircle, Loader2, Plus } from "lucide-react";
import { trackMetaPixelEvent } from "./MetaPixel";

const formats = [
  {
    id: "3h",
    title: "Экспресс",
    hours: "3",
    unit: "часа",
    maxBlocks: 1,
    includes: ["1 блок на выбор", "Лекция и ответы на вопросы"],
    text: "Один блок на выбор: лекция и ответы на вопросы.",
  },
  {
    id: "5h",
    title: "Полдня",
    hours: "5",
    unit: "часов",
    maxBlocks: 2,
    includes: ["2 блока на выбор", "Лекция и ответы на вопросы"],
    text: "Два блока — понимание поколения и что с этим делать.",
  },
  {
    id: "8h",
    title: "Целый день",
    hours: "8",
    unit: "часов",
    maxBlocks: 3,
    includes: ["Все 3 блока", "Практика с командой во второй половине дня"],
    text: "Все блоки и практические упражнения с командой во второй половине дня.",
  },
] as const;

// Highlighted tier, as in the chosen pricing reference.
const RECOMMENDED: (typeof formats)[number]["id"] = "5h";

const blocks = [
  { id: "zoomer", title: "Зумерология" },
  { id: "ejm", title: "EJM — карта пути сотрудника" },
  { id: "evp", title: "EVP и бренд работодателя" },
] as const;

const audiences = ["Коммерция и продажи", "Маркетинг", "HR", "Руководство"] as const;

type FormatId = (typeof formats)[number]["id"];
type BlockId = (typeof blocks)[number]["id"];

const bodyFont = { fontFamily: "var(--font-body)" };
const headingFont = { fontFamily: "var(--font-heading)" };
const inputClass =
  "w-full rounded-[12px] border border-black/[0.08] bg-[#f5f5f5] px-4 py-3.5 text-[15px] text-black placeholder:text-black/35 transition-[border-color,box-shadow,background-color] duration-200 focus:border-[#040082]/30 focus:bg-white focus:outline-none focus:ring-1 focus:ring-[#040082]/10";
const focusRing = "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#040082]/40 has-[:focus-visible]:ring-offset-2";
const stepLabel = "text-[12px] uppercase tracking-[0.14em] text-black/45";

function formatFor(count: number): FormatId {
  return formats.find((format) => format.maxBlocks >= count)?.id ?? "8h";
}

export default function HRIntensiveConfigurator() {
  const [formatId, setFormatId] = useState<FormatId>("5h");
  const [selected, setSelected] = useState<BlockId[]>(["zoomer", "ejm"]);
  const [audience, setAudience] = useState<string[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const format = formats.find((item) => item.id === formatId) ?? formats[1];

  const chooseFormat = (id: FormatId) => {
    const next = formats.find((item) => item.id === id);
    if (!next) return;
    setFormatId(id);
    setSelected(id === "8h" ? blocks.map((block) => block.id) : selected.slice(0, next.maxBlocks));
  };

  const toggleBlock = (id: BlockId) => {
    if (selected.includes(id)) {
      if (selected.length > 1) setSelected(selected.filter((item) => item !== id));
      return;
    }
    const next = [...selected, id];
    setSelected(next);
    if (next.length > format.maxBlocks) setFormatId(formatFor(next.length));
  };

  const toggleAudience = (value: string) => {
    setAudience((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : [...current, value]
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const company = String(fd.get("company") || "").trim();
    const position = String(fd.get("position") || "").trim();

    if (!name || !phone || !company) {
      setStatus("error");
      setErrorMsg("Заполните обязательные поля");
      return;
    }

    if (!/^(\+?7|8)(7\d{2})\d{7}$/.test(phone.replace(/[\s\-()]/g, ""))) {
      setStatus("error");
      setErrorMsg("Введите казахстанский номер: +7 7XX XXX XX XX");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/hr-intensive-leads/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          company,
          position: position || null,
          format: formatId,
          blocks: selected,
          audience,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка отправки");
      }

      trackMetaPixelEvent("Lead");
      setStatus("success");
      form.reset();
    } catch (err: unknown) {
      setStatus("error");
      setErrorMsg(err instanceof Error ? err.message : "Ошибка отправки. Попробуйте позже.");
    }
  };

  const selectedBlocks = blocks.filter((block) => selected.includes(block.id));

  return (
    <section
      id="request"
      tabIndex={-1}
      aria-labelledby="hr-request-title"
      className="bg-[#f5f5f5] px-6 py-[48px] md:px-10 md:py-14 lg:py-16"
    >
      <div className="mx-auto max-w-[1160px]">
        <span className="mb-3 block text-[11px] uppercase leading-[1.58] tracking-wider text-[#040082]" style={bodyFont}>
          Конфигуратор
        </span>
        <h2
          id="hr-request-title"
          className="text-[clamp(26px,3.8vw,52px)] font-bold uppercase leading-[1.06] tracking-[0.02em] text-black"
          style={headingFont}
        >
          Соберите программу
        </h2>
        <p className="mt-5 max-w-[58ch] text-[15px] leading-[1.55] text-black/65 md:mt-6 lg:text-[17px]" style={bodyFont}>
          Выберите формат и блоки — пришлём коммерческое предложение с программой и ценой. Стоимость рассчитываем под вашу команду.
        </p>

        {/* Summary stage: the current build (configurator reference) */}
        <div
          className="relative mt-6 overflow-hidden rounded-[24px] bg-white p-6 md:mt-10 md:p-10"
          aria-live="polite"
        >
          <div className="relative grid gap-[32px] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <p className={stepLabel} style={bodyFont}>
                Ваша программа
              </p>
              <p
                className="mt-3 text-[28px] font-bold uppercase leading-[1.05] tracking-[0.02em] text-[#040082] md:text-[40px]"
                style={headingFont}
              >
                {format.title}
              </p>
              <ul className="mt-5 flex flex-wrap gap-2" style={bodyFont}>
                {selectedBlocks.map((block) => (
                  <li
                    key={block.id}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[#040082]/[0.06] px-3.5 py-1.5 text-[13px] text-[#040082]"
                  >
                    <Check size={13} strokeWidth={2.5} aria-hidden="true" />
                    {block.title}
                  </li>
                ))}
              </ul>
            </div>

            <dl className="grid grid-cols-1 gap-3 border-t border-black/10 pt-5 sm:grid-cols-3 sm:gap-[32px] lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0" style={bodyFont}>
              {[
                { label: "Длительность", value: `${format.hours} ${format.unit}` },
                { label: "Блоков", value: `${selected.length} из 3` },
                { label: "Стоимость", value: "По запросу" },
              ].map((spec) => (
                <div key={spec.label}>
                  <dt className="text-[11px] uppercase tracking-[0.12em] text-black/45">{spec.label}</dt>
                  <dd className="mt-1.5 whitespace-nowrap text-[15px] font-medium text-black md:text-[17px]">{spec.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          {/* Choices */}
          <div className="rounded-[24px] bg-white p-6 md:p-[32px]">
            <fieldset>
              <legend className={stepLabel} style={bodyFont}>
                1. Формат
              </legend>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
                {formats.map((item) => {
                  const active = item.id === formatId;
                  return (
                    <label
                      key={item.id}
                      className={`relative flex cursor-pointer items-center gap-4 rounded-[18px] border px-4 py-3.5 transition-[background-color,border-color,color,box-shadow] duration-200 sm:flex-col sm:items-stretch sm:gap-0 sm:p-5 ${focusRing} ${
                        active
                          ? "border-[#040082] bg-[#040082] text-white shadow-[0_18px_40px_-18px_rgba(4,0,130,0.6)]"
                          : "border-black/10 bg-white text-black hover:border-[#040082]/40"
                      }`}
                    >
                      <input
                        type="radio"
                        name="format"
                        value={item.id}
                        checked={active}
                        onChange={() => chooseFormat(item.id)}
                        className="sr-only"
                      />
                      {item.id === RECOMMENDED && (
                        <span
                          className={`absolute -top-2.5 right-4 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.08em] sm:left-5 sm:right-auto ${
                            active ? "bg-white text-[#040082]" : "bg-[#040082] text-white"
                          }`}
                          style={bodyFont}
                        >
                          Рекомендуем
                        </span>
                      )}
                      <span className="flex items-baseline gap-1.5" style={headingFont}>
                        <span className="text-[28px] font-bold leading-none sm:text-[40px]">{item.hours}</span>
                        <span className={`text-[11px] uppercase sm:text-[12px] ${active ? "text-white/70" : "text-black/45"}`} style={bodyFont}>
                          {item.unit}
                        </span>
                      </span>
                      <span className="text-[15px] font-medium sm:mt-2" style={bodyFont}>
                        {item.title}
                      </span>
                      <ul className={`mt-3 hidden space-y-1.5 text-[13px] leading-[1.4] sm:block ${active ? "text-white/80" : "text-black/60"}`} style={bodyFont}>
                        {item.includes.map((line) => (
                          <li key={line} className="flex items-start gap-1.5">
                            <Check size={13} strokeWidth={2.5} className="mt-[3px] shrink-0" aria-hidden="true" />
                            {line}
                          </li>
                        ))}
                      </ul>
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 text-[13px] leading-[1.5] text-black/55 sm:hidden" style={bodyFont}>
                {format.text}
              </p>
            </fieldset>

            <fieldset className="mt-[32px]">
              <legend className={stepLabel} style={bodyFont}>
                2. Блоки · {selected.length} из {format.maxBlocks}
              </legend>
              <div className="mt-4 flex flex-wrap gap-2">
                {blocks.map((block) => {
                  const active = selected.includes(block.id);
                  return (
                    <label
                      key={block.id}
                      className={`inline-flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2.5 text-[14px] transition-colors duration-200 ${focusRing} ${
                        active ? "border-[#040082] bg-[#040082] text-white" : "border-black/15 text-black hover:border-[#040082]/40"
                      }`}
                      style={bodyFont}
                    >
                      <input type="checkbox" checked={active} onChange={() => toggleBlock(block.id)} className="sr-only" />
                      {active ? <Check size={14} strokeWidth={2.5} aria-hidden="true" /> : <Plus size={14} strokeWidth={2} aria-hidden="true" />}
                      {block.title}
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 text-[12px] leading-[1.5] text-black/45" style={bodyFont}>
                Добавите больше блоков, чем вмещает формат, — длительность увеличится автоматически.
              </p>
            </fieldset>

            <fieldset className="mt-[32px]">
              <legend className={stepLabel} style={bodyFont}>
                3. Кто будет в зале · необязательно
              </legend>
              <div className="mt-4 flex flex-wrap gap-2">
                {audiences.map((value) => {
                  const active = audience.includes(value);
                  return (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-full border px-4 py-2.5 text-[14px] transition-colors duration-200 ${focusRing} ${
                        active ? "border-[#040082] bg-[#040082] text-white" : "border-black/15 text-black hover:border-[#040082]/40"
                      }`}
                      style={bodyFont}
                    >
                      <input type="checkbox" checked={active} onChange={() => toggleAudience(value)} className="sr-only" />
                      {value}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {/* Request form (quote-form reference) */}
          <div className="rounded-[24px] bg-white p-6 md:p-[32px]">
            {status === "success" ? (
              <div className="flex h-full flex-col justify-center" role="status">
                <CheckCircle size={36} className="text-[#040082]" aria-hidden="true" />
                <p className="mt-4 text-[20px] font-bold uppercase tracking-[0.02em] text-black" style={headingFont}>
                  Заявка отправлена
                </p>
                <p className="mt-2 text-[15px] leading-[1.5] text-black/60" style={bodyFont}>
                  Пришлём КП и свяжемся с вами в течение рабочего дня.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <p className={stepLabel} style={bodyFont}>
                  4. Контакты
                </p>
                <p className="mt-3 text-[20px] font-bold uppercase leading-[1.15] tracking-[0.02em] text-black md:text-[22px]" style={headingFont}>
                  Получить КП
                </p>
                <p className="mt-2 text-[14px] leading-[1.5] text-black/55" style={bodyFont}>
                  Пришлём предложение с программой и ценой в течение рабочего дня.
                </p>

                <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div>
                    <label htmlFor="hr-name" className="sr-only">Имя и фамилия</label>
                    <input id="hr-name" name="name" type="text" required autoComplete="name" placeholder="Имя и фамилия *" className={inputClass} style={bodyFont} />
                  </div>
                  <div>
                    <label htmlFor="hr-phone" className="sr-only">Телефон</label>
                    <input id="hr-phone" name="phone" type="tel" required autoComplete="tel" placeholder="Телефон *" className={inputClass} style={bodyFont} />
                  </div>
                  <div>
                    <label htmlFor="hr-company" className="sr-only">Компания</label>
                    <input id="hr-company" name="company" type="text" required autoComplete="organization" placeholder="Компания *" className={inputClass} style={bodyFont} />
                  </div>
                  <div>
                    <label htmlFor="hr-position" className="sr-only">Должность</label>
                    <input id="hr-position" name="position" type="text" autoComplete="organization-title" placeholder="Должность" className={inputClass} style={bodyFont} />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#040082] px-7 py-4 text-[15px] text-white transition-colors duration-200 hover:bg-[#0600a8] disabled:cursor-not-allowed disabled:opacity-60"
                  style={bodyFont}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Отправка...
                    </>
                  ) : (
                    <>
                      Запросить КП · {format.title} <ArrowRight size={15} aria-hidden="true" />
                    </>
                  )}
                </button>

                {status === "error" && (
                  <p className="mt-3 text-[13px] text-red-600" role="alert" style={bodyFont}>
                    {errorMsg}
                  </p>
                )}

                <p className="mt-4 text-[11px] leading-[1.5] text-black/45" style={bodyFont}>
                  Отправляя форму, вы соглашаетесь с{" "}
                  <a href="/privacy/" className="underline transition-colors hover:text-[#040082]">
                    Политикой конфиденциальности
                  </a>
                  .
                </p>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
