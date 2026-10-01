"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { answerLength, participantNameLength } from "@/lib/nbs/text";
import type { NbsAnswerSet, NbsParticipantState } from "@/lib/nbs/contracts";
import { NBS_QUESTIONS } from "@/lib/nbs/questions";
import styles from "@/components/nbs/NbsTheme.module.css";

type FormState = NbsParticipantState | null;

function createKey(storageKey: string, memoryKey: { current: string | null }): string {
  if (memoryKey.current) return memoryKey.current;
  try {
    const existing = window.sessionStorage.getItem(storageKey);
    if (existing) {
      memoryKey.current = existing;
      return existing;
    }
    const created = crypto.randomUUID();
    window.sessionStorage.setItem(storageKey, created);
    memoryKey.current = created;
    return created;
  } catch {
    memoryKey.current = crypto.randomUUID();
    return memoryKey.current;
  }
}

function stateText(state: NbsParticipantState["state"] | null): { title: string; text: string } {
  if (state === "ready") return { title: "Опрос скоро начнётся", text: "Вы можете зарегистрироваться заранее. Когда ведущий откроет сбор, форма появится здесь." };
  if (state === "open") return { title: "Приём ответов открыт", text: "Ответьте на три вопроса. Можно пропустить отдельные вопросы, но отправить нужно хотя бы один ответ." };
  if (state === "analyzing") return { title: "Ответы анализируются", text: "Сбор завершён. Мы объединяем похожие ответы по смыслу и готовим общие результаты." };
  if (state === "analysis_failed") return { title: "Результаты готовятся", text: "Анализ временно приостановлен. Организаторы уже видят его состояние в CRM." };
  if (state === "published") return { title: "Спасибо за участие", text: "Ваш ответ учтён в итоговых результатах форума." };
  return { title: "Загружаем опрос", text: "Подождите немного, скоро можно будет ответить." };
}

export default function NbsParticipantClient() {
  const [state, setState] = useState<FormState>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [answers, setAnswers] = useState<NbsAnswerSet>({ 1: "", 2: "", 3: "" });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const previousStateRef = useRef<FormState>(null);
  const memoryRegistrationKey = useRef<string | null>(null);
  const memorySubmissionKey = useRef<string | null>(null);
  const runId = state?.runId ?? "";
  const storagePrefix = useMemo(() => "nbs:" + runId + ":", [runId]);

  const refresh = useCallback(async (signal?: AbortSignal): Promise<NbsParticipantState | null> => {
    try {
      const response = await fetch("/api/nbs/state/", { cache: "no-store", signal });
      if (!response.ok) throw new Error("Не удалось загрузить опрос. Попробуйте обновить страницу.");
      const next = await response.json() as NbsParticipantState;
      const previous = previousStateRef.current;
      if (next.state === "ready" && next.participant === null
          && (previous?.state !== "ready" || previous.participant !== null)) {
        setFirstName("");
        setLastName("");
        setAnswers({ 1: "", 2: "", 3: "" });
        setMessage("");
        setError("");
        memoryRegistrationKey.current = null;
        memorySubmissionKey.current = null;
        try {
          window.sessionStorage.removeItem("nbs:" + next.runId + ":registration");
          window.sessionStorage.removeItem("nbs:" + next.runId + ":submission");
        } catch { /* session storage may be disabled */ }
      }
      previousStateRef.current = next;
      setState(next);
      setError("");
      if (next.participant?.submitted && next.participant.answers) setAnswers(next.participant.answers);
      return next;
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return null;
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить опрос.");
      return null;
    }
  }, []);

  useEffect(() => {
    let stopped = false;
    let timer: number | undefined;
    let controller: AbortController | null = null;
    let running = false;
    const poll = async () => {
      if (stopped || running) return;
      running = true;
      controller = new AbortController();
      const result = await refresh(controller.signal);
      running = false;
      if (!stopped && result?.state !== "published") timer = window.setTimeout(() => void poll(), 5000);
    };
    const onVisibility = () => {
      if (!document.hidden && !stopped) {
        if (timer !== undefined) window.clearTimeout(timer);
        void poll();
      }
    };
    void poll();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onVisibility);
    return () => {
      stopped = true;
      controller?.abort();
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onVisibility);
    };
  }, [refresh]);

  const answerErrors = useMemo(() => ({
    1: answerLength(answers[1]) > 200,
    2: answerLength(answers[2]) > 200,
    3: answerLength(answers[3]) > 200,
  }), [answers]);
  const canSubmit = Object.values(answers).some((answer) => answer.trim().length > 0)
    && !Object.values(answerErrors).some(Boolean)
    && !busy;
  const validName = participantNameLength(firstName) > 0
    && participantNameLength(firstName) <= 100
    && participantNameLength(lastName) > 0
    && participantNameLength(lastName) <= 100;

  const register = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state || busy) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/nbs/session/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": createKey(storagePrefix + "registration", memoryRegistrationKey) },
        body: JSON.stringify({ runId: state.runId, firstName, lastName }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? "Регистрация на этот запуск уже закрыта." : "Не удалось сохранить имя. Проверьте поля и попробуйте ещё раз.");
      setMessage("Имя сохранено. Страница сама обновится, когда ведущий начнёт сбор.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось сохранить имя.");
    } finally {
      setBusy(false);
    }
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!state || !canSubmit) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/nbs/responses/", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": createKey(storagePrefix + "submission", memorySubmissionKey) },
        body: JSON.stringify({ runId: state.runId, answers }),
      });
      if (!response.ok) throw new Error(response.status === 409 ? "Приём ответов уже завершён. Ваш черновик сохранён на этой странице." : "Не удалось отправить ответы. Попробуйте ещё раз.");
      try { window.sessionStorage.removeItem(storagePrefix + "submission"); } catch { /* session storage may be disabled */ }
      memorySubmissionKey.current = null;
      setMessage("Спасибо. Ваши ответы сохранены.");
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось отправить ответы.");
    } finally {
      setBusy(false);
    }
  };

  const status = stateText(state?.state ?? null);
  const submitted = state?.participant?.submitted ?? false;
  const canEnterAnswers = state?.state === "open" && state.participant !== null && !submitted;

  return (
    <div className={styles.root}>
      <div className={styles.shell}>
        <header className={styles.topline}>
          <a href="https://nbs.narxoz.kz/" className={styles.logoLink}>
            <Image src="/NBS Logo Full.png" width={1726} height={122} alt="Narxoz Business School" className={styles.logo} preload />
          </a>
          <span className={styles.forumTag}>Leadership Forum · 2026</span>
        </header>
        <section className={styles.hero} aria-labelledby="nbs-title">
          <div>
            <p className={styles.eyebrow}>Голос руководителей</p>
            <h1 id="nbs-title" className={styles.title}>NBS Leadership Forum 2026</h1>
          </div>
          <p className={styles.heroText}>
            Поделитесь взглядом на лидерство и решения, которые можно доверить искусственному интеллекту. Ответы будут показаны аудитории в виде общих смыслов.
          </p>
        </section>
        <main className={styles.content}>
          <section className={styles.panel + " " + styles.formPanel}>
            <h2 className={styles.sectionHeading}>{canEnterAnswers ? "Ваши ответы" : "Участие в опросе"}</h2>
            <p className={styles.sectionIntro}>{canEnterAnswers ? "Пишите своими словами. Можно отвечать коротко и переходить на новую строку." : "Введите имя и фамилию, чтобы сохранить участие и дождаться начала сбора."}</p>

            {!state?.participant && (
              <form className={styles.names} onSubmit={(event) => void register(event)}>
                <label className={styles.field}>
                  Имя
                  <input className={styles.input} autoComplete="given-name" required value={firstName} onChange={(event) => setFirstName(event.target.value)} placeholder="Ваше имя" />
                </label>
                <label className={styles.field}>
                  Фамилия
                  <input className={styles.input} autoComplete="family-name" required value={lastName} onChange={(event) => setLastName(event.target.value)} placeholder="Ваша фамилия" />
                </label>
                {(state?.state === "ready" || state?.state === "open") && (
                  <button className={styles.primaryButton} type="submit" disabled={busy || !validName}>
                    {busy ? "Сохраняю…" : "Продолжить"}
                  </button>
                )}
              </form>
            )}

            {canEnterAnswers && (
              <form onSubmit={(event) => void submit(event)}>
                <div className={styles.questionList}>
                  {NBS_QUESTIONS.map((question) => {
                    const tooLong = answerErrors[question.number];
                    const count = answerLength(answers[question.number]);
                    const fieldId = "nbs-answer-" + question.number;
                    const countId = fieldId + "-count";
                    const errorId = fieldId + "-error";
                    return (
                      <div className={styles.question} key={question.number}>
                        <div className={styles.questionHeader}>
                          <label className={styles.questionLabel} htmlFor={fieldId}>
                            <span className={styles.questionNumber}>0{question.number}</span>
                            <span>{question.text}</span>
                          </label>
                          <span id={countId} className={styles.counter + (tooLong ? " " + styles.counterError : "")} aria-live="off">{count}/200</span>
                        </div>
                        <textarea
                          id={fieldId}
                          className={styles.textarea}
                          value={answers[question.number]}
                          onChange={(event) => setAnswers((current) => ({ ...current, [question.number]: event.target.value }))}
                          aria-invalid={tooLong}
                          aria-describedby={tooLong ? countId + " " + errorId : countId}
                          placeholder="Ваш ответ…"
                          rows={4}
                        />
                        {tooLong && <p id={errorId} className={styles.errorText}>Сократите ответ до 200 символов. Текст не был обрезан.</p>}
                      </div>
                    );
                  })}
                </div>
                <div className={styles.formFooter}>
                  <p className={styles.helper}>Имя и фамилия нужны для регистрации и не передаются в анализ. Не указывайте в ответах чужие имена, телефоны или email. Отдельные вопросы можно пропустить; после отправки редактировать ответы нельзя.</p>
                  <button type="submit" className={styles.primaryButton} disabled={!canSubmit}>{busy ? "Отправляю…" : "Отправить ответы"}</button>
                </div>
              </form>
            )}

            {state?.participant && !submitted && !canEnterAnswers && (
              <div className={styles.waiting}>
                <strong>{state.participant.displayName}, вы зарегистрированы.</strong>
                <p className={styles.sideText}>{status.text}</p>
              </div>
            )}
            {submitted && (
              <div className={styles.waiting}>
                <strong>Спасибо, {state?.participant?.displayName}.</strong>
                <p className={styles.sideText}>Ответы сохранены. Их содержание не будет опубликовано по отдельности.</p>
              </div>
            )}
            {error && <p className={styles.alert} role="alert">{error}</p>}
            {message && <p className={styles.notice} role="status">{message}</p>}
          </section>
          <aside className={styles.panel + " " + styles.sidePanel}>
            <span className={styles.statusLabel} aria-live="polite"><span className={styles.statusDot} />{state?.state === "open" ? "Идёт сбор" : state?.state === "analyzing" ? "Идёт анализ" : state?.state === "published" ? "Итоги доступны" : state?.state === "analysis_failed" ? "Анализ продолжается" : state ? "Ожидание начала" : "Загрузка"}</span>
            <h2 className={styles.sideTitle}>{status.title}</h2>
            <p className={styles.sideText}>{status.text}</p>
            {(state?.state === "analyzing" || state?.state === "analysis_failed" || state?.state === "published") && (
              <a className={styles.link} href="/narxoz-business-school/answers/">Перейти к результатам</a>
            )}
            <p className={styles.finePrint}>Публично показываются только агрегированные темы. Имена и отдельные ответы не выводятся на экран.</p>
          </aside>
        </main>
      </div>
    </div>
  );
}
