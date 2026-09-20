"use client";

import { useCallback, useEffect, useState } from "react";

import styles from "./leaderboard.module.css";

type LeaderboardData = {
  entries: Array<{ displayName: string; points: number; rank: number }>;
  activeCase: { caseNumber: number; state: "open" | "analyzing" | "shortlist_ready" | "awarded" | "closed" } | null;
  podiumAnswers: Array<{ place: number; displayName: string; answer: string }>;
};

type ActiveCaseState = NonNullable<LeaderboardData["activeCase"]>["state"];

function statusLabel(state: ActiveCaseState): string {
  switch (state) {
    case "open": return "Ответы принимаются";
    case "analyzing": return "Идёт анализ ответов";
    case "shortlist_ready": return "Спикер выбирает победителей";
    case "awarded": return "Результаты кейса опубликованы";
    case "closed": return "Кейс завершён";
  }
}

export default function LeaderboardClient() {
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [error, setError] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/case-lab-3/live/leaderboard", { cache: "no-store" });
      if (!response.ok) throw new Error("leaderboard");
      setData(await response.json() as LeaderboardData);
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    queueMicrotask(() => setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches));
    queueMicrotask(() => void load());
    const interval = window.setInterval(() => void load(), data?.activeCase?.state === "open" || data?.activeCase?.state === "analyzing" ? 2000 : 5000);
    return () => window.clearInterval(interval);
  }, [data?.activeCase?.state, load]);

  return (
    <main className={`${styles.page} ${reducedMotion ? styles.reducedMotion : ""}`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <a href="/case-lab-3" className={styles.brand}>CASE LAB <strong>III</strong></a>
          <a href="/case-lab-3/live" className={styles.backLink}>Участнику</a>
        </header>
        <section className={styles.hero}>
          <p className={styles.kicker}>Результаты в реальном времени</p>
          <h1>Лидерборд</h1>
          <p>{data?.activeCase ? `Кейс ${data.activeCase.caseNumber}. ${statusLabel(data.activeCase.state)}` : "Следите за ответами участников"}</p>
        </section>
        {error ? <button type="button" className={styles.retry} onClick={() => void load()}>Обновить данные</button> : null}
        <section className={styles.board} aria-live="polite" aria-label="Топ-10 участников">
          <div className={styles.boardHeader}><h2>Топ-10</h2><span>Баллы</span></div>
          {data?.entries.length ? <ol>{data.entries.map((entry) => <li key={`${entry.displayName}-${entry.rank}`}><span>{entry.rank}</span><strong>{entry.displayName}</strong><b>{entry.points}</b></li>)}</ol> : <p className={styles.empty}>Первые ответы ещё не появились.</p>}
        </section>
        {data?.podiumAnswers.length ? <section className={styles.podium}><h2>Выбор спикера</h2><div className={styles.answerGrid}>{data.podiumAnswers.map((answer) => <article key={answer.place}><span>Место {answer.place}</span><h3>{answer.displayName}</h3><p>{answer.answer}</p></article>)}</div></section> : null}
      </div>
    </main>
  );
}
