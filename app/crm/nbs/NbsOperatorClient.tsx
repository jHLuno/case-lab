"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

type Snapshot = {
  runId: string;
  state: "ready" | "open" | "analyzing" | "analysis_failed" | "published";
  stateVersion: number;
  startedAt: string | null;
  closedAt: string | null;
  participants: number;
  submissions: number;
  nonemptyAnswers: Array<{ questionNumber: number; count: number }>;
  jobs: Array<{ job_type: string; question_number: number | null; status: string; error_category: string | null }>;
};

type Props = { csrfToken: string };

function createIdempotencyKey(): string {
  return crypto.randomUUID();
}

function stateLabel(state: Snapshot["state"]): string {
  switch (state) {
    case "ready": return "Опрос готов к запуску";
    case "open": return "Ответы принимаются";
    case "analyzing": return "Идёт смысловой анализ";
    case "analysis_failed": return "Анализ требует повтора";
    case "published": return "Результаты опубликованы";
  }
}

export default function NbsOperatorClient({ csrfToken }: Props) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [clock, setClock] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const finishRef = useRef<HTMLButtonElement>(null);
  const confirmFinishRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const confirmResetRef = useRef<HTMLButtonElement>(null);
  const pendingResetRef = useRef<{ runId: string; expectedVersion: number; idempotencyKey: string } | null>(null);
  const previousConfirmation = useRef({ finish: false, reset: false });

  const refresh = useCallback(async (signal?: AbortSignal) => {
    try {
      const response = await fetch("/api/admin/nbs/", { cache: "no-store", signal });
      if (!response.ok) throw new Error("Не удалось загрузить состояние NBS.");
      const data = await response.json() as Snapshot;
      setSnapshot(data);
      setError("");
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить состояние NBS.");
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let running = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;
    const poll = async () => {
      if (stopped || running) return;
      running = true;
      controller = new AbortController();
      await refresh(controller.signal);
      running = false;
      if (!stopped) timer = window.setTimeout(() => void poll(), 5000);
    };
    void poll();
    return () => {
      stopped = true;
      controller?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [refresh]);

  useEffect(() => {
    const firstUpdate = window.setTimeout(() => setClock(Date.now()), 0);
    const timer = window.setInterval(() => setClock(Date.now()), 10_000);
    return () => {
      window.clearTimeout(firstUpdate);
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (confirmFinish) confirmFinishRef.current?.focus();
    else if (previousConfirmation.current.finish) finishRef.current?.focus();

    if (confirmReset) confirmResetRef.current?.focus();
    else if (previousConfirmation.current.reset) resetRef.current?.focus();

    previousConfirmation.current = { finish: confirmFinish, reset: confirmReset };
  }, [confirmFinish, confirmReset]);

  useEffect(() => {
    if (!confirmFinish && !confirmReset) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (confirmReset) setConfirmReset(false);
        if (confirmFinish) setConfirmFinish(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [confirmFinish, confirmReset]);

  const runCommand = async (operation: "start" | "finish" | "retry" | "reset") => {
    if (!snapshot || busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (operation === "reset" && !pendingResetRef.current) {
        pendingResetRef.current = {
          runId: snapshot.runId,
          expectedVersion: snapshot.stateVersion,
          idempotencyKey: createIdempotencyKey(),
        };
      }
      const resetCommand = operation === "reset" ? pendingResetRef.current : null;
      const response = await fetch("/api/admin/nbs/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
          "Idempotency-Key": resetCommand?.idempotencyKey ?? createIdempotencyKey(),
        },
        body: JSON.stringify({
          operation,
          command: resetCommand
            ? { runId: resetCommand.runId, expectedVersion: resetCommand.expectedVersion }
            : { runId: snapshot.runId, expectedVersion: snapshot.stateVersion },
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({})) as { error?: string };
        if (operation === "reset" && payload.error === "conflict") {
          pendingResetRef.current = null;
          setConfirmReset(false);
        }
        throw new Error(payload.error === "conflict" ? "Состояние уже изменилось. Обновляю данные." : "Команда не выполнена.");
      }
      if (operation === "reset") pendingResetRef.current = null;
      setConfirmFinish(false);
      setConfirmReset(false);
      setMessage(operation === "reset" ? "Данные очищены. Опрос готов к новому запуску."
        : operation === "start" ? "Сбор ответов открыт."
        : operation === "retry" ? "Повторный анализ поставлен в очередь."
        : "Сбор закрыт. Анализ поставлен в очередь.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Команда не выполнена.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const canStart = snapshot?.state === "ready";
  const canFinish = snapshot?.state === "open";
  const completedJobs = snapshot?.jobs.filter((job) => job.status === "completed").length ?? 0;
  const jobCount = snapshot?.jobs.length ?? 0;
  const elapsedMinutes = snapshot?.startedAt && clock !== null
    ? Math.max(0, Math.floor((clock - Date.parse(snapshot.startedAt)) / 60_000))
    : null;

  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
      <div className="rounded-[24px] border border-[#eadfdd] bg-white p-5 shadow-[0_18px_55px_rgba(67,27,27,.07)] sm:p-8 md:p-10">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[.18em] text-[#991e1e]">NBS Leadership Forum 2026</p>
        <h1 className="font-[var(--font-heading)] text-[clamp(2rem,6vw,5rem)] leading-[.98] tracking-[-.055em] text-[#2b2b2b] max-[639px]:text-[clamp(1.7rem,8.5vw,2.625rem)]">
          Управление опросом
        </h1>
        <p className="mt-5 text-sm leading-6 text-[#6f6564] sm:text-base">
          Начни приём перед выступлением. Когда участники ответят, закрой сбор и дождись общей публикации результатов.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={!canStart || busy}
            onClick={() => void runCommand("start")}
            className="min-h-12 rounded-full bg-[#991e1e] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#7a1818] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#e94848] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy && canStart ? "Открываю…" : "Начать"}
          </button>
          {snapshot?.state === "analysis_failed" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => void runCommand("retry")}
              className="min-h-12 rounded-full bg-[#991e1e] px-6 text-sm font-semibold text-white transition-colors hover:bg-[#7a1818] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#e94848] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Запускаю…" : "Повторить анализ"}
            </button>
          )}
          {confirmFinish ? (
            <div className="flex w-full flex-wrap items-center gap-3 rounded-2xl border border-[#eed2d0] bg-[#fff7f6] p-4" aria-label="Подтвердить завершение опроса">
              <span className="w-full text-sm text-[#6f2424]">Закрыть приём ответов и запустить анализ?</span>
              <button ref={confirmFinishRef} type="button" disabled={busy} onClick={() => void runCommand("finish")} className="min-h-11 rounded-full bg-[#991e1e] px-5 text-sm font-semibold text-white disabled:opacity-50">
                Подтвердить завершение
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmFinish(false)} className="min-h-11 rounded-full border border-[#d6c5c2] px-5 text-sm text-[#463d3b] disabled:opacity-50">
                Отмена
              </button>
            </div>
          ) : (
            <button
              ref={finishRef}
              type="button"
              disabled={!canFinish || busy}
              onClick={() => setConfirmFinish(true)}
              className="min-h-12 rounded-full border border-[#cdb8b5] bg-white px-6 text-sm font-semibold text-[#6d201e] transition-colors hover:bg-[#fff7f6] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-3 focus-visible:outline-[#e94848] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Закончить
            </button>
          )}
        </div>
        <div className="mt-5">
          {confirmReset ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#b94848] bg-[#fff7f6] p-4" role="group" aria-label="Подтвердить сброс данных NBS">
              <p className="m-0 w-full text-sm leading-6 text-[#6f2424]">
                Сброс очистит участников ({snapshot?.participants ?? 0}), отправленные анкеты ({snapshot?.submissions ?? 0}), все ответы и результаты анализа. Опрос вернётся в состояние готовности.
              </p>
              <button ref={confirmResetRef} type="button" disabled={busy} onClick={() => void runCommand("reset")} className="min-h-11 rounded-full bg-[#991e1e] px-5 text-sm font-semibold text-white hover:bg-[#7a1818] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#e94848] disabled:opacity-50">
                {busy ? "Сбрасываю…" : "Подтвердить сброс"}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirmReset(false)} className="min-h-11 rounded-full border border-[#d6c5c2] px-5 text-sm text-[#463d3b] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#991e1e] disabled:opacity-50">
                Отмена
              </button>
            </div>
          ) : (
            <button ref={resetRef} type="button" disabled={busy || !snapshot} onClick={() => { setConfirmFinish(false); setConfirmReset(true); }} className="min-h-11 rounded-full border border-[#991e1e] px-5 text-sm font-semibold text-[#991e1e] transition-colors hover:bg-[#fff1f0] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#e94848] disabled:cursor-not-allowed disabled:opacity-40">
              Сбросить всё
            </button>
          )}
        </div>
        {error && <p className="mt-5 rounded-xl bg-[#fff0ef] px-4 py-3 text-sm text-[#8c2422]" role="alert">{error}</p>}
        {message && <p className="mt-5 rounded-xl bg-[#f1f7f2] px-4 py-3 text-sm text-[#285c38]" role="status">{message}</p>}
      </div>

      <aside className="grid content-start gap-4">
        <div className="rounded-[24px] border border-[#eadfdd] bg-white p-5 sm:p-7">
          <h2 className="font-[var(--font-heading)] text-2xl font-normal tracking-[-.04em] text-[#2b2b2b]">Состояние</h2>
          <p className="mt-3 text-sm text-[#6f6564]" aria-live="polite">{snapshot ? stateLabel(snapshot.state) : "Загружаю…"}</p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <Metric label="Участники" value={snapshot?.participants ?? "—"} />
            <Metric label="Анкеты" value={snapshot?.submissions ?? "—"} />
            <Metric label="Непустых ответов, всего" value={snapshot?.nonemptyAnswers.reduce((sum, item) => sum + item.count, 0) ?? "—"} />
            <Metric label="С начала сбора" value={elapsedMinutes === null ? "—" : elapsedMinutes + " мин"} />
          </div>
          {snapshot?.state === "analyzing" && (
            <p className="mt-5 text-sm text-[#6f6564]" aria-live="polite">
              Выполнено задач: {completedJobs} из {jobCount || 7}
            </p>
          )}
        </div>
        <div className="rounded-[24px] border border-[#eadfdd] bg-white p-5 sm:p-7">
          <h2 className="font-[var(--font-heading)] text-2xl font-normal tracking-[-.04em] text-[#2b2b2b]">Ответы</h2>
          <dl className="mt-4 grid gap-3 text-sm">
            {(snapshot?.nonemptyAnswers ?? [1, 2, 3].map((questionNumber) => ({ questionNumber, count: 0 }))).map((entry) => (
              <div key={entry.questionNumber} className="flex items-center justify-between gap-4 border-b border-[#f1eae8] pb-3 last:border-0">
                <dt className="text-[#6f6564]">Вопрос {entry.questionNumber}</dt>
                <dd className="font-semibold tabular-nums text-[#2b2b2b]">{entry.count}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="rounded-[24px] border border-[#eadfdd] bg-white p-5 sm:p-7">
          <h2 className="font-[var(--font-heading)] text-2xl font-normal tracking-[-.04em] text-[#2b2b2b]">Ссылки и QR</h2>
          <nav className="mt-4 grid gap-2 text-sm">
            <Link className="text-[#991e1e] underline-offset-4 hover:underline" href="/narxoz-business-school/">Страница участника</Link>
            <Link className="text-[#991e1e] underline-offset-4 hover:underline" href="/narxoz-business-school/answers/">Короткие результаты</Link>
            <Link className="text-[#991e1e] underline-offset-4 hover:underline" href="/nbs-full-answers/">Полный отчёт</Link>
          </nav>
          <div className="mt-5 flex flex-wrap gap-2">
            <a className="inline-flex min-h-10 items-center justify-center rounded-full bg-[#991e1e] px-4 text-xs font-semibold text-white hover:bg-[#7a1818] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#e94848]" href="/api/admin/nbs/qr/?format=png">Скачать QR · PNG</a>
            <a className="inline-flex min-h-10 items-center justify-center rounded-full border border-[#cdb8b5] px-4 text-xs font-semibold text-[#6d201e] hover:bg-[#fff7f6] focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-[#e94848]" href="/api/admin/nbs/qr/?format=svg">Скачать QR · SVG</a>
          </div>
        </div>
      </aside>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-[#f8f5f4] p-4">
      <p className="m-0 text-xs text-[#766c6a]">{label}</p>
      <p className="mt-2 mb-0 font-[var(--font-heading)] text-3xl text-[#991e1e]">{value}</p>
    </div>
  );
}
