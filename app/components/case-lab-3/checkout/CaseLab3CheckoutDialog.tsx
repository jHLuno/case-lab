"use client";

import { useEffect, useRef, useState, type Dispatch, type FormEvent, type KeyboardEvent } from "react";
import { ArrowUpRight, X } from "lucide-react";

import { formatKzt } from "../../../lib/case-lab-3/money";
import {
  initialCheckoutForm,
  type CheckoutEvent,
  type CheckoutForm,
  type CheckoutState,
} from "./checkout-machine";
import styles from "./CaseLab3CheckoutDialog.module.css";

const focusableSelector = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function fieldValue(form: CheckoutForm | undefined, field: keyof CheckoutForm): string | boolean {
  return form?.[field] ?? initialCheckoutForm[field];
}

function tierLabel(tier: "early_bird" | "standard" | undefined): string {
  return tier === "standard" ? "Обычный билет" : "Early Bird";
}

function isBusy(phase: CheckoutState["phase"]): boolean {
  return phase === "submitting" || phase === "reserved" || phase === "loading_widget" || phase === "payment_open" || phase === "verifying";
}

export default function CaseLab3CheckoutDialog({
  state,
  dispatch,
}: {
  state: CheckoutState;
  dispatch: Dispatch<CheckoutEvent>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const initialFocusRef = useRef<HTMLButtonElement>(null);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const isOpen = state.phase !== "idle";

  useEffect(() => {
    if (!isOpen) return;
    initialFocusRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    const reservationIsActive = ["reserved", "loading_widget", "payment_open", "verifying"].includes(state.phase);
    if (!isOpen || !reservationIsActive || !state.reservationExpiresAt) {
      // The countdown is an external clock derived from the server deadline.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSecondsLeft(null);
      return;
    }

    const updateCountdown = () => {
      const expiresAt = Date.parse(state.reservationExpiresAt as string);
      if (!Number.isFinite(expiresAt)) {
        setSecondsLeft(null);
        return;
      }

      setSecondsLeft(Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000)));
    };

    updateCountdown();
    const interval = window.setInterval(updateCountdown, 1000);
    return () => window.clearInterval(interval);
  }, [isOpen, state.phase, state.reservationExpiresAt]);

  useEffect(() => {
    if (!isOpen) return;
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      dispatch({ type: "CLOSE" });
      return;
    }

    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector);
    if (!focusable || focusable.length === 0) {
      event.preventDefault();
      dialogRef.current?.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (event.currentTarget.reportValidity()) dispatch({ type: "SUBMIT" });
  };

  const form = state.form ?? initialCheckoutForm;
  const showForm = state.phase === "form" || state.phase === "confirm_changed_offer" || state.phase === "submitting";
  const price = state.offer ? formatKzt(state.offer.amountMinor) : "";
  const retryWidget = Boolean(state.attemptId);
  const countdown = secondsLeft === null ? null : `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`;

  const renderStatus = () => {
    switch (state.phase) {
      case "loading_availability":
        return <p className={styles.status} aria-live="polite">Проверяем наличие билетов...</p>;
      case "temporarily_reserved":
        return <p className={styles.status} role="status" aria-live="polite">Early Bird временно зарезервирован. Попробуйте еще раз через минуту.</p>;
      case "sold_out":
        return <p className={styles.status} role="status" aria-live="polite">Билеты закончились. Оставьте окно открытым для повторной проверки.</p>;
      case "closed":
        return <p className={styles.status} role="status" aria-live="polite">Продажи закрыты.</p>;
      case "reserved":
      case "loading_widget":
        return (
          <div className={styles.status} aria-live="polite">
            <p>Готовим защищенную форму оплаты...</p>
            {countdown && <p className={styles.countdown}>Бронь действует еще <strong>{countdown}</strong></p>}
          </div>
        );
      case "payment_open":
        return (
          <div className={styles.status} aria-live="polite">
            <p>Ожидаем завершения оплаты...</p>
            {countdown && <p className={styles.countdown}>Бронь действует еще <strong>{countdown}</strong></p>}
          </div>
        );
      case "verifying":
        return (
          <div className={styles.status} aria-live="polite">
            <p>Проверяем оплату...</p>
            {countdown && <p className={styles.countdown}>Бронь действует еще <strong>{countdown}</strong></p>}
          </div>
        );
      case "paid":
        return (
          <div className={styles.result} aria-live="polite">
            <strong>Оплата подтверждена</strong>
            <p>Билет появится на email после формирования доступа.</p>
          </div>
        );
      case "failed":
        return (
          <div className={styles.result} aria-live="polite">
            <strong>Оплата не подтверждена</strong>
            <p>Можно повторить попытку. Новый платеж создается только после безопасной проверки.</p>
          </div>
        );
      case "review_required":
        return (
          <div className={styles.result} aria-live="assertive">
            <strong>Не оплачивайте повторно</strong>
            <p>Проверяем платеж вручную. Если понадобится помощь, напишите на hello@caselab.kz.</p>
          </div>
        );
      case "expired":
        return (
          <div className={styles.result} aria-live="polite">
            <strong>Время бронирования истекло</strong>
            <p>Проверьте актуальную цену и начните заново.</p>
          </div>
        );
      case "script_error":
        return <p className={styles.status} role="alert" aria-live="assertive">{state.errorMessage ?? "Платежный виджет временно недоступен."}</p>;
      default:
        return null;
    }
  };

  const retryLabel = state.phase === "failed" ? "Повторить попытку" : "Проверить еще раз";

  return (
    <div className={styles.backdrop} role="presentation">
      <div
        ref={dialogRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="case-lab-3-checkout-title"
        aria-describedby="case-lab-3-checkout-description"
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.header}>
          <div>
            <p className={styles.kicker}>Case Lab III · 24 сентября 2026</p>
            <h2 id="case-lab-3-checkout-title">Купить билет</h2>
          </div>
          <button
            ref={initialFocusRef}
            type="button"
            className={styles.closeButton}
            onClick={() => dispatch({ type: "CLOSE" })}
            aria-label="Закрыть окно покупки"
          >
            <X size={19} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>

        <p id="case-lab-3-checkout-description" className={styles.description}>
          Один билет на все четыре часа программы в Narxoz Business School.
        </p>

        {showForm && (
          <form className={styles.form} onSubmit={handleSubmit} noValidate={false}>
            <div className={styles.offerRow}>
              <span>{tierLabel(state.offer?.tier)}</span>
              <strong>{price}</strong>
            </div>

            {state.phase === "confirm_changed_offer" && (
              <p className={styles.notice} role="alert">Цена изменилась. Подтвердите новую стоимость, чтобы продолжить.</p>
            )}

            <div className={styles.fields}>
              <label>
                Имя
                <input
                  name="firstName"
                  value={String(fieldValue(form, "firstName"))}
                  onChange={(event) => dispatch({ type: "FIELD_CHANGED", field: "firstName", value: event.target.value })}
                  required
                  maxLength={100}
                  autoComplete="given-name"
                />
              </label>
              <label>
                Фамилия
                <input
                  name="lastName"
                  value={String(fieldValue(form, "lastName"))}
                  onChange={(event) => dispatch({ type: "FIELD_CHANGED", field: "lastName", value: event.target.value })}
                  required
                  maxLength={100}
                  autoComplete="family-name"
                />
              </label>
              <label className={styles.fullField}>
                Email
                <input
                  name="email"
                  type="email"
                  value={String(fieldValue(form, "email"))}
                  onChange={(event) => dispatch({ type: "FIELD_CHANGED", field: "email", value: event.target.value })}
                  required
                  maxLength={254}
                  autoComplete="email"
                  aria-describedby="case-lab-3-email-note"
                />
                <small id="case-lab-3-email-note">На этот email отправим билет и фискальный чек</small>
              </label>
              <label>
                Телефон <span>(необязательно)</span>
                <input
                  name="phone"
                  value={String(fieldValue(form, "phone"))}
                  onChange={(event) => dispatch({ type: "FIELD_CHANGED", field: "phone", value: event.target.value })}
                  maxLength={32}
                  autoComplete="tel"
                />
              </label>
              <label>
                Компания <span>(необязательно)</span>
                <input
                  name="company"
                  value={String(fieldValue(form, "company"))}
                  onChange={(event) => dispatch({ type: "FIELD_CHANGED", field: "company", value: event.target.value })}
                  maxLength={200}
                  autoComplete="organization"
                />
              </label>
              <label className={styles.fullField}>
                Должность <span>(необязательно)</span>
                <input
                  name="position"
                  value={String(fieldValue(form, "position"))}
                  onChange={(event) => dispatch({ type: "FIELD_CHANGED", field: "position", value: event.target.value })}
                  maxLength={200}
                  autoComplete="organization-title"
                />
              </label>
            </div>

            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                name="acceptedTerms"
                checked={Boolean(fieldValue(form, "acceptedTerms"))}
                onChange={(event) => dispatch({ type: "FIELD_CHANGED", field: "acceptedTerms", value: event.target.checked })}
                required
              />
              <span>Принимаю <a href="/offer/" target="_blank" rel="noreferrer">договор оферты</a> и <a href="/privacy/" target="_blank" rel="noreferrer">политику конфиденциальности</a>.</span>
            </label>
            <label className={styles.checkboxLabel}>
              <input
                type="checkbox"
                checked={Boolean(fieldValue(form, "marketingConsent"))}
                onChange={(event) => dispatch({ type: "FIELD_CHANGED", field: "marketingConsent", value: event.target.checked })}
              />
              <span>Хочу получать новости Case Lab.</span>
            </label>

            <button type="submit" className={styles.submitButton} disabled={isBusy(state.phase)}>
              <span>{state.phase === "confirm_changed_offer" ? `Подтвердить за ${price}` : state.phase === "submitting" ? "Создаем заказ..." : `Продолжить за ${price}`}</span>
              <ArrowUpRight size={17} strokeWidth={2} aria-hidden="true" />
            </button>
          </form>
        )}

        {!showForm && renderStatus()}

        {(state.phase === "temporarily_reserved" || state.phase === "sold_out" || state.phase === "closed") && (
          <button type="button" className={styles.secondaryButton} onClick={() => dispatch({ type: "RETRY_AVAILABILITY" })}>
            Проверить еще раз
          </button>
        )}
        {state.phase === "script_error" && (
          <button type="button" className={styles.secondaryButton} onClick={() => dispatch(retryWidget ? { type: "RETRY_WIDGET" } : { type: "RETRY_AVAILABILITY" })}>
            Повторить загрузку
          </button>
        )}
        {(state.phase === "failed" || state.phase === "expired") && (
          <button type="button" className={styles.secondaryButton} onClick={() => dispatch({ type: "RETRY_PAYMENT" })}>
            {retryLabel}
          </button>
        )}
        {(state.phase === "paid" || state.phase === "review_required") && (
          <button type="button" className={styles.secondaryButton} onClick={() => dispatch({ type: "CLOSE" })}>
            Закрыть
          </button>
        )}
      </div>
    </div>
  );
}
