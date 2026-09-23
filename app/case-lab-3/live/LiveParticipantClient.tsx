"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";

import type { LiveParticipantStateResponse } from "@/lib/case-lab-3/live/contracts";
import styles from "./live.module.css";

type Phase = "loading" | "claim" | "ready" | "error";

const STATE_ENDPOINT = "/api/case-lab-3/live/state";
const SESSION_ENDPOINT = "/api/case-lab-3/live/session";

async function responseJson<T>(response: Response): Promise<T> {
  return await response.json() as T;
}

function stateLabel(state: LiveParticipantStateResponse["activeCase"] extends infer T
  ? T extends { state: infer S } ? S : never
  : never): string {
  switch (state) {
    case "open": return "Приём ответов открыт";
    case "analyzing": return "Ответы анализируются";
    case "shortlist_ready": return "Спикер выбирает победителей";
    case "awarded": return "Результаты опубликованы";
    default: return "Кейс готовится";
  }
}

function formatDeadline(value: string | null): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Intl.DateTimeFormat("ru-KZ", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  }).format(timestamp);
}

function formatRemaining(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

export default function LiveParticipantClient() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [view, setView] = useState<LiveParticipantStateResponse | null>(null);
  const [answer, setAnswer] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("Загрузка live-сессии");
  const [remainingMs, setRemainingMs] = useState(0);
  const activeCaseId = useRef<string | null>(null);
  const answerDirty = useRef(false);
  const timeoutSubmissionStarted = useRef(false);

  const loadState = useCallback(async (signal?: AbortSignal, silent = false) => {
    try {
      const response = await fetch(STATE_ENDPOINT, { cache: "no-store", signal });
      if (response.status === 401) {
        setView(null);
        setPhase("claim");
        if (!silent) setNotice("Введите имя и фамилию");
        return;
      }
      if (!response.ok) throw new Error("state_unavailable");

      const next = await responseJson<LiveParticipantStateResponse>(response);
      const nextCaseId = next.activeCase?.id ?? null;
      if (nextCaseId !== activeCaseId.current) {
        activeCaseId.current = nextCaseId;
        answerDirty.current = false;
        timeoutSubmissionStarted.current = false;
        setAnswer(next.activeCase?.answer ?? "");
      } else if (!answerDirty.current && next.activeCase?.answer !== undefined) {
        setAnswer(next.activeCase?.answer ?? "");
      }
      setView(next);
      setPhase("ready");
      if (!silent) setNotice("Live-сессия подключена");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!silent) {
        setPhase("error");
        setNotice("Не удалось загрузить live-сессию");
      }
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    queueMicrotask(() => void loadState(controller.signal));
    return () => controller.abort();
  }, [loadState]);

  useEffect(() => {
    if (phase !== "ready") return;
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void loadState(undefined, true);
    }, 3000);
    return () => window.clearInterval(interval);
  }, [loadState, phase]);

  const activeCase = view?.activeCase ?? null;

  const saveAnswer = useCallback(async (mode: "manual" | "timeout" = "manual", event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    if (!activeCase || activeCase.state !== "open" || activeCase.answerLocked || !answer.trim()) return;
    if (mode === "manual" && (answer.length < 30 || answer.length > 350)) return;
    setPending(true);
    setNotice(mode === "timeout" ? "Время вышло. Отправляем ответ" : "Сохраняем ответ");
    try {
      const response = await fetch(`/api/case-lab-3/live/cases/${activeCase.id}/submission`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answer, mode }),
      });
      if (response.status === 409) {
        setNotice("Приём ответов уже закрыт");
        await loadState(undefined, true);
        return;
      }
      if (!response.ok) {
        const result = await responseJson<{ error?: string }>(response);
        if (result.error === "already_submitted") {
          setNotice("Ответ на этот вопрос уже отправлен");
          await loadState(undefined, true);
          return;
        }
        if (result.error === "invalid_request") {
          setNotice(mode === "timeout" ? "Не удалось отправить ответ" : "Ответ должен содержать от 30 до 350 символов");
          return;
        }
        throw new Error("save_unavailable");
      }
      answerDirty.current = false;
      setNotice("Ответ сохранён. Начислено 10 баллов");
      await loadState(undefined, true);
    } catch {
      setNotice("Не удалось сохранить ответ. Попробуйте ещё раз");
    } finally {
      setPending(false);
    }
  // Only the scalar round fields read above are reactive; the object identity changes during polling.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCase?.id, activeCase?.state, activeCase?.answerLocked, answer, loadState]);

  useEffect(() => {
    if (!activeCase || activeCase.state !== "open" || activeCase.answerLocked || !activeCase.closesAt) {
      return;
    }
    const deadline = Date.parse(activeCase.closesAt);
    const tick = () => {
      const nextRemaining = deadline - Date.now();
      setRemainingMs(Math.max(0, nextRemaining));
      if (nextRemaining <= 0 && !timeoutSubmissionStarted.current) {
        timeoutSubmissionStarted.current = true;
        if (answer.trim()) void saveAnswer("timeout");
        else setNotice("Время вышло. Ответ не был отправлен");
      }
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  // Only the scalar round fields read above are reactive; the object identity changes during polling.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCase?.id, activeCase?.state, activeCase?.answerLocked, activeCase?.closesAt, answer, saveAnswer]);

  async function claimParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice("Подключаем участника");
    const form = new FormData(event.currentTarget);
    const payload = {
      firstName: String(form.get("firstName") ?? ""),
      lastName: String(form.get("lastName") ?? ""),
    };

    try {
      const response = await fetch(SESSION_ENDPOINT, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await responseJson<{ status?: string; error?: string }>(response);
      if (!response.ok) {
        setNotice("Не удалось подключиться. Попробуйте ещё раз");
        return;
      }
      if (result.status !== "claimed") {
        setNotice("Не удалось подключиться. Попробуйте ещё раз");
        return;
      }

      await loadState();
    } catch {
      setNotice("Сервис временно недоступен. Попробуйте ещё раз");
    } finally {
      setPending(false);
    }
  }

  const deadline = formatDeadline(activeCase?.closesAt ?? null);
  const canSubmit = activeCase?.state === "open" && !activeCase.answerLocked && answer.length >= 30 && answer.length <= 350 && !pending;

  return (
    <div className={`${styles.shell} ${phase === "claim" ? styles.claimShell : ""}`}>
      <header className={styles.header}>
        <a href="/case-lab-3" className={styles.brand} aria-label="Case Lab III">
          <Image src="/logo white.png" alt="Case Lab" width={164} height={34} priority className={styles.logoImage} />
        </a>
        {view ? (
          <div className={styles.score} aria-label={`Ваши баллы: ${view.participant.points}`}>
            <span>Баллы</span>
            <strong>{view.participant.points}</strong>
          </div>
        ) : null}
      </header>

      {notice && !(phase === "claim" && notice === "Введите имя и фамилию") ? (
        <p className={styles.liveNotice} aria-live="polite">{notice}</p>
      ) : null}

      {phase === "loading" ? (
        <section className={styles.loading} aria-label="Загрузка">
          <span className={styles.loadingLine} />
          <span className={styles.loadingTitle} />
          <span className={styles.loadingLine} />
        </section>
      ) : null}

      {phase === "error" ? (
        <section className={styles.messagePanel}>
          <p>Связь с live-сессией прервалась.</p>
          <button className={styles.primaryButton} type="button" onClick={() => void loadState()}>
            Повторить
          </button>
        </section>
      ) : null}

      {phase === "claim" ? (
        <section className={styles.claimPanel}>
          <div className={styles.intro}>
            <h1>
              <span>Попадите в топ-3 лидерборда</span>
              <span>и получите ценные призы!</span>
            </h1>
            <p>Введите имя и фамилию. Они будут отображаться в лидерборде.</p>
          </div>
          <form className={styles.form} onSubmit={claimParticipant}>
            <label className={styles.field}>
              <span>Имя</span>
              <input name="firstName" autoComplete="given-name" maxLength={100} required />
            </label>
            <label className={styles.field}>
              <span>Фамилия</span>
              <input name="lastName" autoComplete="family-name" maxLength={100} required />
            </label>
            <button className={styles.primaryButton} type="submit" disabled={pending}>
              {pending ? "Подключаем" : "Подключиться"}
            </button>
          </form>
        </section>
      ) : null}

      {phase === "ready" && view ? (
        <div className={styles.liveGrid}>
          <section className={styles.casePanel}>
            <div className={styles.caseMeta}>
              <span>{activeCase ? `Кейс ${activeCase.caseNumber} · Вопрос ${activeCase.questionNumber}` : "Live"}</span>
              {view.participant.rank ? <span>Ваше место: {view.participant.rank}</span> : null}
            </div>

            {activeCase ? (
              <>
                <p className={styles.speaker}>{activeCase.speakerLabel}</p>
                <h1 className={styles.question}>{activeCase.question}</h1>
                <div className={styles.caseStatus}>
                  <strong>{stateLabel(activeCase.state)}</strong>
                  {activeCase.state === "open" && deadline ? <span>до {deadline} · Осталось {formatRemaining(remainingMs)}</span> : null}
                </div>

                {activeCase.state === "open" && !activeCase.answerLocked ? (
                  <form className={styles.answerForm} onSubmit={(event) => void saveAnswer("manual", event)}>
                    <label className={styles.field}>
                      <span>Ваш ответ</span>
                      <textarea
                        name="answer"
                        value={answer}
                        minLength={30}
                        maxLength={350}
                        rows={4}
                        onChange={(event) => {
                          answerDirty.current = true;
                          setAnswer(event.target.value);
                        }}
                        placeholder="Опишите решение и коротко объясните, почему оно сработает"
                        required
                      />
                    </label>
                    <div className={styles.answerFooter}>
                      <span className={answer.length > 350 ? styles.counterError : undefined}>
                        {answer.length} / 350
                      </span>
                      <button className={styles.primaryButton} type="submit" disabled={!canSubmit}>
                        {pending ? "Сохраняем" : "Отправить ответ"}
                      </button>
                    </div>
                    <p className={styles.helper}>Один ответ на вопрос · максимум 350 символов · при таймере ответ отправится автоматически.</p>
                  </form>
                ) : (
                  <div className={styles.lockedAnswer}>
                    <span>Ваш ответ</span>
                    <p>{activeCase.answer ?? "Вы не отправили ответ на этот кейс."}</p>
                    {activeCase.answer ? <p className={styles.aiNotice} role="status">ИИ анализирует релевантность ответа и его соответствие реальному ответу кейса. Топ-5 появится после анализа.</p> : null}
                  </div>
                )}
              </>
            ) : (
              <div className={styles.waiting}>
                <h1>Пока нет активного кейса</h1>
                <p>Оставьте страницу открытой. Вопрос появится автоматически.</p>
              </div>
            )}
          </section>

          <aside className={styles.leaderboard} aria-label="Лидерборд">
            <div className={styles.leaderboardHeader}>
              <h2>Лидерборд</h2>
              <span>Топ-5</span>
            </div>
            {view.leaderboard.length > 0 ? (
              <ol>
                {view.leaderboard.slice(0, 5).map((entry) => (
                  <li key={entry.participantId}>
                    <span className={styles.rank}>{entry.rank}</span>
                    <span className={styles.participantName}>{entry.displayName}</span>
                    <strong>{entry.points}</strong>
                  </li>
                ))}
              </ol>
            ) : (
              <p className={styles.emptyLeaderboard}>Первые баллы появятся после ответов.</p>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
