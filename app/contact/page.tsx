"use client";

import { useState, FormEvent } from "react";
import { ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import emailjs from "emailjs-com";

const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "";
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "";
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "";

// RECIPIENTS: Set these in your EmailJS template "To" field:
// hello@caselab.kz, amirzhan.zhampeissov@narxoz.kz, assylbek.nugumanov@narxoz.kz, daniyar.kosnazarov@narxoz.kz

export default function ContactPage() {
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");

    const form = e.currentTarget;
    const formData = new FormData(form);

    const lead = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      company: String(formData.get("company") || "").trim() || null,
      phone: String(formData.get("phone") || "").trim() || null,
      message: String(formData.get("message") || "").trim() || null,
      status: "new" as const,
    };

    try {
      // 1. Save to Supabase
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: dbError } = await (supabase.from("leads") as any).insert(lead);
      if (dbError) throw dbError;

      // 2. Send email notification via EmailJS
      if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            from_name: lead.name,
            from_email: lead.email,
            company: lead.company || "—",
            phone: lead.phone || "—",
            message: lead.message || "—",
          },
          EMAILJS_PUBLIC_KEY
        );
      }

      setStatus("success");
      form.reset();
    } catch (err: any) {
      setStatus("error");
      setErrorMsg(err?.message || "Ошибка отправки. Попробуйте позже.");
    }
  };

  if (status === "success") {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-[#040082] mx-auto mb-6" />
          <h1
            className="text-black text-[24px] md:text-[32px] font-bold leading-[1.15] uppercase tracking-[0.02em] mb-4"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Заявка отправлена
          </h1>
          <p className="text-black/60 text-[16px] leading-[1.5] font-light mb-8" style={{ fontFamily: "var(--font-body)" }}>
            Мы свяжемся с вами в течение рабочего дня. Проверьте почту — пришлём подтверждение.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 bg-[#040082] text-white px-6 py-3 rounded-full text-[14px] font-normal hover:bg-[#0600a8] transition-colors duration-300"
            style={{ fontFamily: "var(--font-body)" }}
          >
            На главную
            <ArrowRight size={14} />
          </a>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white px-6 md:px-10 py-24 md:py-32">
      <div className="max-w-[600px] mx-auto">
        <div className="mb-10 md:mb-14">
          <span
            className="text-gray text-[11px] mb-3 block leading-[1.58] uppercase tracking-wider"
            style={{ fontFamily: "var(--font-body)" }}
          >
            Запись на диагностику
          </span>
          <h1
            className="text-black text-[clamp(24px,3.5vw,42px)] font-bold leading-[1.12] uppercase tracking-[0.02em] mb-4"
            style={{ fontFamily: "var(--font-heading)" }}
          >
            Записаться на сессию
          </h1>
          <p className="text-black/60 text-[16px] leading-[1.5] font-light" style={{ fontFamily: "var(--font-body)" }}>
            Заполните форму — мы свяжемся в течение рабочего дня для согласования времени и деталей.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-black text-[14px] font-normal mb-2" style={{ fontFamily: "var(--font-body)" }}>
              Имя и фамилия <span className="text-[#040082]">*</span>
            </label>
            <input
              type="text" id="name" name="name" required
              placeholder="Арман Сериков"
              className="w-full px-4 py-3 rounded-[12px] border border-black/[0.08] bg-white text-black text-[15px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30 focus:ring-1 focus:ring-[#040082]/10 transition-all duration-200"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-black text-[14px] font-normal mb-2" style={{ fontFamily: "var(--font-body)" }}>
              Email <span className="text-[#040082]">*</span>
            </label>
            <input
              type="email" id="email" name="email" required
              placeholder="arman@company.kz"
              className="w-full px-4 py-3 rounded-[12px] border border-black/[0.08] bg-white text-black text-[15px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30 focus:ring-1 focus:ring-[#040082]/10 transition-all duration-200"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>

          <div>
            <label htmlFor="company" className="block text-black text-[14px] font-normal mb-2" style={{ fontFamily: "var(--font-body)" }}>
              Компания
            </label>
            <input
              type="text" id="company" name="company"
              placeholder="Название вашей компании"
              className="w-full px-4 py-3 rounded-[12px] border border-black/[0.08] bg-white text-black text-[15px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30 focus:ring-1 focus:ring-[#040082]/10 transition-all duration-200"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-black text-[14px] font-normal mb-2" style={{ fontFamily: "var(--font-body)" }}>
              Телефон <span className="text-black/30 text-[12px]">(опционально)</span>
            </label>
            <input
              type="tel" id="phone" name="phone"
              placeholder="+7 (___) ___-__-__"
              className="w-full px-4 py-3 rounded-[12px] border border-black/[0.08] bg-white text-black text-[15px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30 focus:ring-1 focus:ring-[#040082]/10 transition-all duration-200"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>

          <div>
            <label htmlFor="message" className="block text-black text-[14px] font-normal mb-2" style={{ fontFamily: "var(--font-body)" }}>
              Что хотите разобрать? <span className="text-black/30 text-[12px]">(опционально)</span>
            </label>
            <textarea
              id="message" name="message" rows={4}
              placeholder="Кратко о задаче: продукт, текущие каналы, что непонятно..."
              className="w-full px-4 py-3 rounded-[12px] border border-black/[0.08] bg-white text-black text-[15px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30 focus:ring-1 focus:ring-[#040082]/10 transition-all duration-200 resize-none"
              style={{ fontFamily: "var(--font-body)" }}
            />
          </div>

          <p className="text-black/40 text-[12px] leading-[1.5] font-light" style={{ fontFamily: "var(--font-body)" }}>
            Отправляя форму, вы соглашаетесь с{" "}
            <a href="/privacy/" className="underline hover:text-[#040082] transition-colors">
              Политикой конфиденциальности
            </a>
            . Мы не передаём данные третьим лицам.
          </p>

          <button
            type="submit"
            disabled={status === "loading"}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#040082] text-white px-6 py-4 rounded-full text-[15px] font-normal hover:bg-[#0600a8] transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ fontFamily: "var(--font-body)" }}
          >
            {status === "loading" ? (
              <><Loader2 size={16} className="animate-spin" /> Отправка...</>
            ) : (
              <>Записаться на диагностику <ArrowRight size={16} /></>
            )}
          </button>

          {status === "error" && (
            <p className="text-red-600 text-[14px] font-light" style={{ fontFamily: "var(--font-body)" }}>
              {errorMsg}
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
