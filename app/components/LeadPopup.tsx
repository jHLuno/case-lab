"use client";

import { useEffect, FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { useLeadPopup } from "../lib/LeadPopupContext";
import { supabase } from "../lib/supabase";
import emailjs from "@emailjs/browser";

const EMAILJS_SERVICE_ID = process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || "";
const EMAILJS_TEMPLATE_ID = process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || "";
const EMAILJS_PUBLIC_KEY = process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || "";

const inputClass =
  "w-full px-4 py-3 rounded-[12px] border border-black/[0.08] bg-white text-black text-[15px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30 focus:ring-1 focus:ring-[#040082]/10 transition-all duration-200";
const inputFont = { fontFamily: "var(--font-body)" };

export default function LeadPopup() {
  const { isOpen, closePopup } = useLeadPopup();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    html.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopup();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      html.style.overflow = prevHtml;
      document.removeEventListener("keydown", onKey);
    };
  }, [isOpen, closePopup]);

  useEffect(() => {
    if (!isOpen) {
      setStatus("idle");
      setErrorMsg("");
    }
  }, [isOpen]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus("loading");

    const form = e.currentTarget;
    const fd = new FormData(form);

    const name = String(fd.get("name") || "").trim();
    const phone = String(fd.get("phone") || "").trim();
    const position = String(fd.get("position") || "").trim();

    if (!name || !phone) {
      setStatus("error");
      setErrorMsg("Заполните обязательные поля");
      return;
    }

    try {
      const lead = {
        name,
        email: `${phone}@popup.caselab.kz`,
        company: null,
        phone,
        position: position || null,
        message: null,
        status: "new" as const,
      };

      const { error: dbError } = await (supabase.from("leads") as any).insert(lead);
      if (dbError) throw dbError;

      if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            from_name: name,
            from_email: "—",
            company: "—",
            phone,
            message: position ? `Должность: ${position}` : "—",
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

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="lead-popup-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) closePopup();
          }}
        >
          <motion.div
            key="lead-popup-panel"
            initial={{ opacity: 0, scale: 0.96, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[440px] bg-white rounded-[20px] shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closePopup}
              className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors text-black/40 hover:text-black/60 z-10"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>

            {status === "success" ? (
              <div className="px-8 py-12 text-center">
                <CheckCircle size={40} className="text-[#040082] mx-auto mb-5" />
                <h2
                  className="text-black text-[20px] md:text-[24px] font-bold leading-[1.15] uppercase tracking-[0.02em] mb-3"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Заявка отправлена
                </h2>
                <p className="text-black/60 text-[14px] leading-[1.5] font-light mb-6" style={inputFont}>
                  Мы свяжемся с вами в течение рабочего дня.
                </p>
                <button
                  onClick={closePopup}
                  className="inline-flex items-center gap-2 bg-[#040082] text-white px-6 py-3 rounded-full text-[14px] font-normal hover:bg-[#0600a8] transition-colors duration-300"
                  style={inputFont}
                >
                  Хорошо
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-8 pt-10 pb-8">
                <h2
                  className="text-black text-[20px] md:text-[24px] font-bold leading-[1.15] uppercase tracking-[0.02em] mb-2"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Записаться
                </h2>
                <p className="text-black/60 text-[14px] leading-[1.5] font-light mb-6" style={inputFont}>
                  Оставьте контакты — мы свяжемся в течение рабочего дня.
                </p>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="popup-name" className="block text-black text-[13px] font-normal mb-1.5" style={inputFont}>
                      Имя и фамилия <span className="text-[#040082]">*</span>
                    </label>
                    <input
                      type="text" id="popup-name" name="name" required
                      placeholder="Арман Сериков"
                      className={inputClass}
                      style={inputFont}
                    />
                  </div>

                  <div>
                    <label htmlFor="popup-phone" className="block text-black text-[13px] font-normal mb-1.5" style={inputFont}>
                      Телефон <span className="text-[#040082]">*</span>
                    </label>
                    <input
                      type="tel" id="popup-phone" name="phone" required
                      placeholder="+7 (___) ___-__-__"
                      className={inputClass}
                      style={inputFont}
                    />
                  </div>

                  <div>
                    <label htmlFor="popup-position" className="block text-black text-[13px] font-normal mb-1.5" style={inputFont}>
                      Должность
                    </label>
                    <input
                      type="text" id="popup-position" name="position"
                      placeholder="CEO, CMO, Founder..."
                      className={inputClass}
                      style={inputFont}
                    />
                  </div>
                </div>

                <p className="text-black/30 text-[11px] leading-[1.5] font-light mt-4" style={inputFont}>
                  Отправляя форму, вы соглашаетесь с{" "}
                  <a href="/privacy/" className="underline hover:text-[#040082] transition-colors">
                    Политикой конфиденциальности
                  </a>
                  .
                </p>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full mt-5 inline-flex items-center justify-center gap-2 bg-[#040082] text-white px-6 py-3.5 rounded-full text-[14px] font-normal hover:bg-[#0600a8] transition-colors duration-300 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={inputFont}
                >
                  {status === "loading" ? (
                    <><Loader2 size={16} className="animate-spin" /> Отправка...</>
                  ) : (
                    <>Отправить заявку <ArrowRight size={14} /></>
                  )}
                </button>

                {status === "error" && (
                  <p className="text-red-600 text-[13px] font-light mt-3" style={inputFont}>
                    {errorMsg}
                  </p>
                )}
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
