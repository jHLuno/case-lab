"use client";

import { useEffect, FormEvent, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowRight, CheckCircle, Loader2 } from "lucide-react";
import { useLeadPopup } from "../lib/LeadPopupContext";

const inputFont = { fontFamily: "var(--font-body)" };

const endpointBySource = {
  main: "/api/leads/",
  "evp-pro": "/api/evp-pro-leads/",
} as const;

export default function LeadPopup() {
  const { isOpen, source, closePopup } = useLeadPopup();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const isEvpPro = source === "evp-pro";
  const inputClass = isEvpPro
    ? "w-full px-4 py-3 rounded-[12px] border border-black/[0.08] bg-white text-black text-[15px] placeholder:text-black/30 focus:outline-none focus:border-[#075C43]/30 focus:ring-1 focus:ring-[#075C43]/10 transition-[border-color,box-shadow] duration-200"
    : "w-full px-4 py-3 rounded-[12px] border border-black/[0.08] bg-white text-black text-[15px] placeholder:text-black/30 focus:outline-none focus:border-[#040082]/30 focus:ring-1 focus:ring-[#040082]/10 transition-[border-color,box-shadow] duration-200";
  const accentTextClass = isEvpPro ? "text-[#075C43]" : "text-[#040082]";
  const accentButtonClass = isEvpPro
    ? "bg-[#075C43] hover:bg-[#064B36]"
    : "bg-[#040082] hover:bg-[#0600a8]";
  const accentLinkClass = isEvpPro
    ? "underline hover:text-[#075C43] transition-colors"
    : "underline hover:text-[#040082] transition-colors";
  const buttonWeightClass = isEvpPro ? "font-medium" : "font-normal";

  useEffect(() => {
    if (!isOpen) return;
    const scrollY = window.scrollY;
    const prev = document.body.style.overflow;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;

    document.body.style.overflow = "hidden";
    html.style.overflow = "hidden";
    // iOS Safari: prevent background scroll
    document.body.style.position = "fixed";
    document.body.style.top = `-${scrollY}px`;
    document.body.style.left = "0";
    document.body.style.right = "0";
    document.body.style.width = "100%";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePopup();
    };
    document.addEventListener("keydown", onKey);

    return () => {
      document.body.style.overflow = prev;
      html.style.overflow = prevHtml;
      document.body.style.position = "";
      document.body.style.top = "";
      document.body.style.left = "";
      document.body.style.right = "";
      document.body.style.width = "";
      window.scrollTo(0, scrollY);
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

    // Validate Kazakhstan phone number
    const cleanPhone = phone.replace(/[\s\-\(\)]/g, "");
    const kzPhoneRegex = /^(\+?7|8)(7\d{2})\d{7}$/;
    if (!kzPhoneRegex.test(cleanPhone)) {
      setStatus("error");
      setErrorMsg("Введите казахстанский номер: +7 7XX XXX XX XX");
      return;
    }

    try {
      const res = await fetch(endpointBySource[source], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          position: position || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Ошибка отправки");
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
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overscroll-none touch-none"
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
            className="relative w-full max-w-[500px] bg-white rounded-[20px] shadow-2xl overflow-y-auto max-h-[90vh] touch-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closePopup}
              className="absolute top-4 right-4 md:top-10 md:right-10 w-10 h-10 flex items-center justify-center rounded-full bg-black/5 hover:bg-black/10 transition-colors text-black/40 hover:text-black/60 z-10"
              aria-label="Закрыть"
            >
              <X size={20} />
            </button>

            {status === "success" ? (
              <div className="px-6 py-14 pt-14 md:px-10 md:py-16 text-center">
                <CheckCircle size={40} className={`${accentTextClass} mx-auto mb-5`} />
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
                  className={`w-full inline-flex items-center justify-center gap-2 text-white px-7 py-3.5 text-[14px] md:px-8 md:py-4 md:text-[15px] rounded-full transition-colors duration-200 ${buttonWeightClass} ${accentButtonClass}`}
                  style={inputFont}
                >
                  Хорошо
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="px-6 pt-14 pb-10 md:px-10 md:pt-14 md:pb-14">
                <h2
                  className="text-black text-[20px] md:text-[24px] font-bold leading-[1.15] uppercase tracking-[0.02em] mb-3"
                  style={{ fontFamily: "var(--font-heading)" }}
                >
                  Записаться
                </h2>
                <p className="text-black/60 text-[14px] leading-[1.5] font-light mb-8" style={inputFont}>
                  Оставьте контакты — мы свяжемся в течение рабочего дня.
                </p>

                <div className="space-y-5">
                  <div>
                    <label htmlFor="popup-name" className="block text-black text-[13px] font-normal mb-2" style={inputFont}>
                      Имя и фамилия <span className={accentTextClass}>*</span>
                    </label>
                    <input
                      type="text" id="popup-name" name="name" required
                      placeholder="Арман Сериков"
                      className={inputClass}
                      style={inputFont}
                    />
                  </div>

                  <div>
                    <label htmlFor="popup-phone" className="block text-black text-[13px] font-normal mb-2" style={inputFont}>
                      Телефон <span className={accentTextClass}>*</span>
                    </label>
                    <input
                      type="tel" id="popup-phone" name="phone" required
                      placeholder="+7 7XX XXX XX XX"
                      defaultValue="+77"
                      className={inputClass}
                      style={inputFont}
                      onKeyDown={(e) => {
                        const input = e.currentTarget;
                        // Prevent deleting the +77 prefix
                        if ((e.key === "Backspace" || e.key === "Delete") && input.selectionStart !== null && input.selectionStart <= 3) {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => {
                        let val = e.target.value;
                        // Ensure starts with +77
                        if (!val.startsWith("+77")) {
                          val = "+77" + val.replace(/^\+?7?7?/, "");
                        }
                        // Only allow digits after +77
                        val = "+77" + val.slice(3).replace(/\D/g, "");
                        // Max length: +77XXXXXXXXX (12 chars)
                        if (val.length > 12) val = val.slice(0, 12);
                        e.target.value = val;
                      }}
                    />
                  </div>

                  <div>
                    <label htmlFor="popup-position" className="block text-black text-[13px] font-normal mb-2" style={inputFont}>
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

                <p className="text-black/50 text-[11px] leading-[1.5] font-light mt-5" style={inputFont}>
                  Отправляя форму, вы соглашаетесь с{" "}
                  <a href="/privacy/" className={accentLinkClass}>
                    Политикой конфиденциальности
                  </a>
                  .
                </p>

                <button
                  type="submit"
                  disabled={status === "loading"}
                  className={`w-full mt-6 inline-flex items-center justify-center gap-2 text-white px-7 py-3.5 text-[14px] md:px-8 md:py-4 md:text-[15px] rounded-full transition-colors duration-200 disabled:opacity-60 disabled:cursor-not-allowed ${buttonWeightClass} ${accentButtonClass}`}
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
