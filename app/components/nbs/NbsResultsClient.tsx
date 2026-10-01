"use client";

import { useEffect, useState } from "react";

import type { NbsQuestionReport, NbsRunState, NbsScreenReport } from "@/lib/nbs/contracts";
import styles from "./NbsTheme.module.css";

type ScreenData = { status: NbsRunState; view: "screen"; report: NbsScreenReport | null };
type FullData = { status: NbsRunState; view: "full"; report: {
  reportId: string;
  reportVersion: number;
  publishedAt: string;
  questions: [NbsQuestionReport, NbsQuestionReport, NbsQuestionReport];
  comparison: string;
} | null };
type Props = { view: "screen" | "full" };

function waitingCopy(status: NbsRunState | null): { title: string; text: string } {
  if (status === "ready") return { title: "Опрос ещё не начался", text: "Результаты появятся здесь после сбора ответов и завершения анализа." };
  if (status === "open") return { title: "Участники отвечают", text: "Сбор продолжается. Обновите эту страницу после его завершения." };
  if (status === "analysis_failed") return { title: "Результаты готовятся", text: "Организаторы получили уведомление о сбое и могут повторить анализ." };
  return { title: "Собираем результаты", text: "Анализируем ответы участников и объединяем похожие мысли по смыслу." };
}

export default function NbsResultsClient({ view }: Props) {
  const [data, setData] = useState<ScreenData | FullData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let stopped = false;
    let controller: AbortController | null = null;
    let timer: number | undefined;
    let running = false;
    const poll = async () => {
      if (stopped || running) return;
      running = true;
      controller = new AbortController();
      try {
        const response = await fetch("/api/nbs/results/?view=" + view, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("results_unavailable");
        const next = await response.json() as ScreenData | FullData;
        if (next.view !== view) throw new Error("results_view_mismatch");
        setData(next);
        setError(false);
        if (next.status !== "published" && !stopped) timer = window.setTimeout(() => void poll(), 5000);
      } catch (cause) {
        if (!(cause instanceof DOMException && cause.name === "AbortError")) setError(true);
        if (!stopped) timer = window.setTimeout(() => void poll(), 5000);
      } finally {
        running = false;
      }
    };
    const onVisibility = () => {
      if (!document.hidden && !stopped && data?.status !== "published") {
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
  }, [data?.status, view]);

  const published = data?.status === "published" && data.view === view ? data : null;
  return (
    <div className={styles.root}>
      <main className={styles.resultsShell}>
        <header className={styles.resultsTop}>
          <a href="https://nbs.narxoz.kz/" className={styles.wordmark}>NARXOZ BUSINESS SCHOOL</a>
          <span className={styles.forumTag}>Leadership Forum · 2026</span>
        </header>
        {view === "screen" ? (
          <h1 className={styles.resultsHeading}>Голоса участников</h1>
        ) : (
          <h1 className={styles.resultsHeading}>Результаты форума</h1>
        )}
        {published?.view === "screen" && published.report ? (
          <div className={styles.screenGrid}>
            {published.report.questions.map((question) => (
              <section className={styles.screenCard} key={question.questionNumber} aria-labelledby={"nbs-question-" + question.questionNumber}>
                <h2 id={"nbs-question-" + question.questionNumber} className={styles.screenQuestion}>{question.shortQuestion}</h2>
                <ol className={styles.screenRows}>
                  {question.clusters.map((cluster, index) => (
                    <li className={styles.screenRow} key={index}>
                      <span className={styles.screenRank}>{String(index + 1).padStart(2, "0")}</span>
                      <span className={styles.screenCluster}>{cluster.title}</span>
                      <span className={styles.screenPercent}>{cluster.percent}%</span>
                    </li>
                  ))}
                </ol>
                {question.insufficientClusters && <p className={styles.insufficient}>Устойчивых смысловых тем меньше пяти.</p>}
              </section>
            ))}
          </div>
        ) : published?.view === "full" && published.report ? (
          <>
            <div className={styles.fullQuestions}>
              {published.report.questions.map((question) => (
                <section className={styles.fullCard} key={question.questionNumber}>
                  <h2 className={styles.fullQuestion}>{question.question}</h2>
                  <div className={styles.stats}>
                    <span>Всего ответов: <strong>{question.total}</strong></span>
                    <span>Валидных: <strong>{question.valid}</strong></span>
                    <span>Нерелевантных / пустых: <strong>{question.ignored}</strong></span>
                  </div>
                  {question.clusters.length > 0 ? (
                    <ol className={styles.fullRows}>
                      {question.clusters.map((cluster, index) => (
                        <li className={styles.fullRow} key={index}>
                          <p className={styles.fullClusterTitle}>{String(index + 1).padStart(2, "0")} · {cluster.title} — {cluster.percent}%</p>
                          <span className={styles.fullCount}>{cluster.count} ответов</span>
                          <p className={styles.fullExplanation}>{cluster.explanation}</p>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className={styles.sideText}>Для выделения смысловых кластеров недостаточно валидных ответов.</p>
                  )}
                  <p className={styles.conclusion}>{question.conclusion}</p>
                </section>
              ))}
            </div>
            <section className={styles.comparison}>
              <h2>Общий вывод</h2>
              <p>{published.report.comparison}</p>
            </section>
          </>
        ) : (
          <div className={styles.waitingReport} aria-live="polite">
            <h2>{waitingCopy(data?.status ?? null).title}</h2>
            <p>{error ? "Не удалось обновить данные. Попробуем снова через несколько секунд." : waitingCopy(data?.status ?? null).text}</p>
          </div>
        )}
      </main>
    </div>
  );
}
