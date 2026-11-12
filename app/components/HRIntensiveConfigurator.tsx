"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, Check, CheckCircle, Loader2 } from "lucide-react";
import { trackMetaPixelEvent } from "./MetaPixel";

const formats = [
  { id: "3h", title: "3 часа", note: "Экспресс", maxBlocks: 1, text: "Один блок на выбор: лекция и ответы на вопросы." },
  { id: "5h", title: "Полдня", note: "5 часов", maxBlocks: 2, text: "Два блока — понимание поколения и что с этим делать." },
  { id: "8h", title: "Целый день", note: "8 часов", maxBlocks: 3, text: "Все блоки и практические упражнения с командой во второй половине дня." },
] as const;

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
  "w-full rounded-[12px] border border-black/[0.08] bg-white px-4 py-3 text-[15px] text-black placeholder:text-black/30 transition-[border-color,box-shadow] duration-200 focus:border-[#040082]/30 focus:outline-none focus:ring-1 focus:ring-[#040082]/10";

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

  return (
    <section
      id="request"
      tabIndex={-1}
      aria-labelledby="hr-request-title"
      className="bg-[#f5f5f5] px-6 py-24 md:px-10 md:py-36"
    >
      <div className="mx-auto max-w-[1160px]">
        <h2
          id="hr-request-title"
          className="text-[clamp(26px,3.8vw,52px)] font-bold uppercase leading-[1.06] tracking-[0.02em] text-black"
          style={headingFont}
        >
          Соберите программу
        </h2>
        <p className="mt-6 max-w-[58ch] text-[16px] leading-[1.55] text-black/65 md:text-[18px]" style={bodyFont}>
          Выберите формат и блоки — пришлём коммерческое предложение с программой и ценой. Стоимость рассчитываем под вашу команду.
        </p>

        <div className="mt-12 grid gap-6 md:mt-16 lg:grid-cols-[1.25fr_1fr]">
          {/* Configurator */}
          <div className="rounded-[24px] bg-white p-6 md:p-10">
            <fieldset>
              <legend className="text-[12px] uppercase tracking-[0.14em] text-black/50" style={bodyFont}>
                1. Формат
              </legend>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {formats.map((item) => {
                  const active = item.id === formatId;
                  return (
                    <label
                      key={item.id}
                      className={`relative flex cursor-pointer flex-col rounded-[16px] border p-4 transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#040082]/40 ${
                        active ? "border-[#040082] bg-[#040082] text-white" : "border-black/10 text-black hover:border-black/25"
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
                      <span className="text-[16px] font-bold uppercase tracking-[0.02em]" style={headingFont}>
                        {item.title}
                      </span>
                      <span className={`mt-1 text-[13px] ${active ? "text-white/70" : "text-black/50"}`} style={bodyFont}>
                        {item.note}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 text-[14px] leading-[1.5] text-black/60" style={bodyFont} aria-live="polite">
                {format.text}
              </p>
            </fieldset>

            <fieldset className="mt-8">
              <legend className="text-[12px] uppercase tracking-[0.14em] text-black/50" style={bodyFont}>
                2. Блоки · выбрано {selected.length} из {format.maxBlocks}
              </legend>
              <div className="mt-4 grid gap-3">
                {blocks.map((block) => {
                  const active = selected.includes(block.id);
                  return (
                    <label
                      key={block.id}
                      className={`flex cursor-pointer items-center justify-between gap-4 rounded-[16px] border px-5 py-4 transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#040082]/40 ${
                        active ? "border-[#040082] bg-[#040082]/[0.04]" : "border-black/10 hover:border-black/25"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleBlock(block.id)}
                        className="sr-only"
                      />
                      <span className="text-[16px] font-medium text-black" style={bodyFont}>
                        {block.title}
                      </span>
                      <span
                        aria-hidden="true"
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                          active ? "border-[#040082] bg-[#040082] text-white" : "border-black/20"
                        }`}
                      >
                        {active && <Check size={14} strokeWidth={2.5} />}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-3 text-[13px] leading-[1.5] text-black/50" style={bodyFont}>
                Добавите больше блоков, чем вмещает формат, — длительность увеличится автоматически.
              </p>
            </fieldset>

            <fieldset className="mt-8">
              <legend className="text-[12px] uppercase tracking-[0.14em] text-black/50" style={bodyFont}>
                3. Кто будет в зале · необязательно
              </legend>
              <div className="mt-4 flex flex-wrap gap-2">
                {audiences.map((value) => {
                  const active = audience.includes(value);
                  return (
                    <label
                      key={value}
                      className={`cursor-pointer rounded-full border px-4 py-2 text-[14px] transition-colors duration-200 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#040082]/40 ${
                        active ? "border-[#040082] bg-[#040082] text-white" : "border-black/15 text-black hover:border-black/30"
                      }`}
                      style={bodyFont}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleAudience(value)}
                        className="sr-only"
                      />
                      {value}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </div>

          {/* Request form */}
          <div className="rounded-[24px] bg-[#040082] p-6 text-white md:p-10">
            <p className="text-[12px] uppercase tracking-[0.14em] text-white/60" style={bodyFont}>
              Ваша программа
            </p>
            <p className="mt-3 text-[22px] font-bold uppercase leading-[1.15] tracking-[0.02em] md:text-[26px]" style={headingFont}>
              {format.title}
            </p>
            <ul className="mt-4 space-y-2" style={bodyFont}>
              {blocks
                .filter((block) => selected.includes(block.id))
                .map((block) => (
                  <li key={block.id} className="flex items-start gap-2.5 text-[15px] text-white/85">
                    <Check size={14} strokeWidth={2.5} className="mt-[4px] shrink-0 text-white/60" aria-hidden="true" />
                    {block.title}
                  </li>
                ))}
            </ul>
            <p className="mt-5 border-t border-white/15 pt-5 text-[15px] text-white/70" style={bodyFont}>
              Стоимость — по запросу
            </p>

            {status === "success" ? (
              <div className="mt-8 rounded-[16px] bg-white/10 p-6" role="status">
                <CheckCircle size={32} className="text-white" aria-hidden="true" />
                <p className="mt-4 text-[18px] font-bold uppercase tracking-[0.02em]" style={headingFont}>
                  Заявка отправлена
                </p>
                <p className="mt-2 text-[15px] leading-[1.5] text-white/75" style={bodyFont}>
                  Пришлём КП и свяжемся с вами в течение рабочего дня.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate className="mt-8 space-y-4">
                <div>
                  <label htmlFor="hr-name" className="mb-2 block text-[13px] text-white/80" style={bodyFont}>
                    Имя и фамилия <span aria-hidden="true">*</span>
                  </label>
                  <input id="hr-name" name="name" type="text" required autoComplete="name" placeholder="Арман Сериков" className={inputClass} style={bodyFont} />
                </div>
                <div>
                  <label htmlFor="hr-phone" className="mb-2 block text-[13px] text-white/80" style={bodyFont}>
                    Телефон <span aria-hidden="true">*</span>
                  </label>
                  <input id="hr-phone" name="phone" type="tel" required autoComplete="tel" placeholder="+7 7XX XXX XX XX" className={inputClass} style={bodyFont} />
                </div>
                <div>
                  <label htmlFor="hr-company" className="mb-2 block text-[13px] text-white/80" style={bodyFont}>
                    Компания <span aria-hidden="true">*</span>
                  </label>
                  <input id="hr-company" name="company" type="text" required autoComplete="organization" className={inputClass} style={bodyFont} />
                </div>
                <div>
                  <label htmlFor="hr-position" className="mb-2 block text-[13px] text-white/80" style={bodyFont}>
                    Должность
                  </label>
                  <input id="hr-position" name="position" type="text" autoComplete="organization-title" placeholder="HRD, CMO, коммерческий директор..." className={inputClass} style={bodyFont} />
                </div>

                <p className="text-[11px] leading-[1.5] text-white/60" style={bodyFont}>
                  Отправляя форму, вы соглашаетесь с{" "}
                  <a href="/privacy/" className="underline transition-colors hover:text-white">
                    Политикой конфиденциальности
                  </a>
                  .
                </p>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-7 py-3.5 text-[14px] text-[#040082] transition-colors duration-200 hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-60 md:py-4 md:text-[15px]"
                  style={bodyFont}
                >
                  {status === "loading" ? (
                    <>
                      <Loader2 size={16} className="animate-spin" aria-hidden="true" /> Отправка...
                    </>
                  ) : (
                    <>
                      Запросить КП <ArrowRight size={14} aria-hidden="true" />
                    </>
                  )}
                </button>

                {status === "error" && (
                  <p className="text-[13px] text-[#ffb4b4]" role="alert" style={bodyFont}>
                    {errorMsg}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
