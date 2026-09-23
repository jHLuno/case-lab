"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { IScannerControls } from "@zxing/browser";

type CheckInResult = "admitted" | "already_used" | "cancelled" | "invalid";

type CheckInResponse = {
  result: CheckInResult;
  checkedInAt: string | null;
  participant: {
    firstName: string;
    lastName: string;
  } | null;
};

const resultCopy: Record<CheckInResult, { title: string; description: string; className: string }> = {
  admitted: {
    title: "Вход разрешен",
    description: "Билет отмечен как использованный.",
    className: "border-emerald-200 bg-emerald-50 text-emerald-900",
  },
  already_used: {
    title: "Билет уже использован",
    description: "Этот билет ранее уже проходил чек-ин.",
    className: "border-amber-200 bg-amber-50 text-amber-900",
  },
  cancelled: {
    title: "Билет отменен",
    description: "Вход по отмененному билету запрещен.",
    className: "border-red-200 bg-red-50 text-red-900",
  },
  invalid: {
    title: "Билет не принят",
    description: "Проверьте QR-код, номер билета и код доступа.",
    className: "border-red-200 bg-red-50 text-red-900",
  },
};

function isCheckInResponse(value: unknown): value is CheckInResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const result = value as Partial<CheckInResponse>;
  const participant = result.participant;
  return (
    (result.result === "admitted" || result.result === "already_used" || result.result === "cancelled" || result.result === "invalid") &&
    (result.checkedInAt === null || typeof result.checkedInAt === "string") &&
    (participant === null || (
      typeof participant === "object" &&
      typeof participant.firstName === "string" &&
      typeof participant.lastName === "string"
    ))
  );
}

export default function CheckInClient({ csrfToken }: { csrfToken: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const scanLockedRef = useRef(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResponse | null>(null);

  const stopCamera = useCallback((resetScanLock = true) => {
    controlsRef.current?.stop();
    controlsRef.current = null;

    const video = videoRef.current;
    const stream = video?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    if (resetScanLock) scanLockedRef.current = false;
    setCameraActive(false);
  }, []);

  useEffect(() => stopCamera, [stopCamera]);

  const submitCheckIn = useCallback(async (input: { mode: "qr"; payload: string } | { mode: "manual"; ticketNumber: string; code: string }) => {
    setBusy(true);
    setRequestError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/case-lab-3/check-ins", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
          "Idempotency-Key": crypto.randomUUID(),
        },
        body: JSON.stringify(input),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok || !isCheckInResponse(payload)) {
        setRequestError(response.status === 401 || response.status === 403 ? "Сессия CRM истекла. Обновите страницу." : "Не удалось выполнить чек-ин.");
        return;
      }
      setResult(payload);
    } catch {
      setRequestError("Нет связи с сервером. Попробуйте еще раз.");
    } finally {
      setBusy(false);
    }
  }, [csrfToken]);

  const startCamera = async () => {
    if (cameraLoading || cameraActive || !videoRef.current) return;
    setCameraLoading(true);
    setCameraError(null);
    setRequestError(null);
    setResult(null);
    scanLockedRef.current = false;

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (decoded, _error, scannerControls) => {
        if (!decoded || scanLockedRef.current) return;
        scanLockedRef.current = true;
        controlsRef.current = scannerControls;
        stopCamera(false);
        void submitCheckIn({ mode: "qr", payload: decoded.getText() });
      });
      if (scanLockedRef.current) {
        controls.stop();
        return;
      }
      controlsRef.current = controls;
      setCameraActive(true);
    } catch {
      stopCamera();
      setCameraError("Не удалось включить камеру. Проверьте разрешение браузера или используйте ручной ввод.");
    } finally {
      setCameraLoading(false);
    }
  };

  const handleManualSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void submitCheckIn({ mode: "manual", ticketNumber: ticketNumber.trim(), code });
  };

  return (
    <section aria-labelledby="check-in-title" className="rounded-[28px] border border-black/[0.08] bg-white p-5 shadow-[0_18px_60px_rgba(0,0,0,0.05)] md:p-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-black/40" style={{ fontFamily: "var(--font-body)" }}>Case Lab III</p>
          <h1 id="check-in-title" className="mt-2 text-3xl tracking-[-0.04em] text-black md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>Чек-ин гостей</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-black/55" style={{ fontFamily: "var(--font-body)" }}>
            Сканируйте QR-код с билета. Если камера недоступна, используйте номер билета и ручной код.
          </p>
        </div>
        <span className="rounded-full bg-black/[0.04] px-3 py-1.5 text-xs text-black/50" style={{ fontFamily: "var(--font-body)" }}>Доступ только для CRM</span>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-2xl border border-black/[0.08] bg-[#fafafa] p-4 md:p-5">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg tracking-[-0.02em] text-black" style={{ fontFamily: "var(--font-display)" }}>Сканер QR-кода</h2>
            {cameraActive && <span className="text-xs text-emerald-700" style={{ fontFamily: "var(--font-body)" }}>Камера включена</span>}
          </div>
          <div className="mt-4 overflow-hidden rounded-xl bg-black">
            <video ref={videoRef} className="aspect-[4/3] w-full object-cover" muted playsInline aria-label="Предпросмотр камеры для сканирования QR-кода" />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            {!cameraActive ? (
              <button type="button" onClick={() => void startCamera()} disabled={cameraLoading || busy} className="rounded-full bg-black px-5 py-3 text-sm text-white transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40" style={{ fontFamily: "var(--font-body)" }}>
                {cameraLoading ? "Запускаем камеру..." : "Включить камеру"}
              </button>
            ) : (
              <button type="button" onClick={() => stopCamera()} className="rounded-full border border-black/[0.12] bg-white px-5 py-3 text-sm text-black transition-colors hover:bg-black/[0.04]" style={{ fontFamily: "var(--font-body)" }}>
                Выключить камеру
              </button>
            )}
          </div>
          {cameraError && <p className="mt-3 text-sm text-red-700" role="alert" style={{ fontFamily: "var(--font-body)" }}>{cameraError}</p>}
        </div>

        <form onSubmit={handleManualSubmit} className="rounded-2xl border border-black/[0.08] p-4 md:p-5">
          <h2 className="text-lg tracking-[-0.02em] text-black" style={{ fontFamily: "var(--font-display)" }}>Ручной ввод</h2>
          <div className="mt-5 grid gap-4">
            <label className="grid gap-2 text-sm text-black/70" style={{ fontFamily: "var(--font-body)" }}>
              Номер билета
              <input value={ticketNumber} onChange={(event) => setTicketNumber(event.target.value)} required maxLength={100} autoComplete="off" className="rounded-xl border border-black/[0.12] bg-white px-4 py-3 text-black outline-none transition-shadow focus:ring-2 focus:ring-[#040082]/30" />
            </label>
            <label className="grid gap-2 text-sm text-black/70" style={{ fontFamily: "var(--font-body)" }}>
              Код чек-ина
              <input value={code} onChange={(event) => setCode(event.target.value)} required maxLength={32} autoComplete="off" inputMode="text" className="rounded-xl border border-black/[0.12] bg-white px-4 py-3 font-mono uppercase text-black outline-none transition-shadow focus:ring-2 focus:ring-[#040082]/30" />
            </label>
          </div>
          <button type="submit" disabled={busy} className="mt-5 w-full rounded-full bg-[#040082] px-5 py-3 text-sm text-white transition-opacity hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-40" style={{ fontFamily: "var(--font-body)" }}>
            {busy ? "Проверяем..." : "Проверить билет"}
          </button>
          <p className="mt-3 text-xs leading-5 text-black/45" style={{ fontFamily: "var(--font-body)" }}>Код не является паролем гостя и действует только для текущей версии билета.</p>
        </form>
      </div>

      {requestError && <p className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert" style={{ fontFamily: "var(--font-body)" }}>{requestError}</p>}
      {result && (
        <div className={`mt-6 rounded-xl border px-4 py-4 ${resultCopy[result.result].className}`} role="status" aria-live="polite">
          <strong className="block text-base" style={{ fontFamily: "var(--font-display)" }}>{resultCopy[result.result].title}</strong>
          <span className="mt-1 block text-sm" style={{ fontFamily: "var(--font-body)" }}>{resultCopy[result.result].description}</span>
          {result.participant && (
            <span className="mt-3 block text-sm font-semibold" style={{ fontFamily: "var(--font-body)" }}>
              Участник: {result.participant.firstName} {result.participant.lastName}
            </span>
          )}
        </div>
      )}
    </section>
  );
}
