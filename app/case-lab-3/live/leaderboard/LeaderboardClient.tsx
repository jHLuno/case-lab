"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

import styles from "./leaderboard.module.css";

type CaseState = "draft" | "ready" | "open" | "analyzing" | "shortlist_ready" | "awarded" | "closed";
type QuestionAnswer = { displayName: string; answer: string };
type QuestionAnswers = {
  id: string;
  caseNumber: number;
  questionNumber: number;
  question: string;
  state: CaseState;
  answers: QuestionAnswer[];
};
type LeaderboardData = {
  entries: Array<{ displayName: string; points: number; rank: number }>;
  activeCase: { caseNumber: number; questionNumber: number; state: CaseState } | null;
  podiumAnswers: Array<{ place: number; displayName: string; answer: string }>;
  questionAnswers: QuestionAnswers[];
};

type ActiveCaseState = NonNullable<LeaderboardData["activeCase"]>["state"];

function statusLabel(state: ActiveCaseState): string {
  switch (state) {
    case "draft": return "Кейс готовится";
    case "ready": return "Кейс скоро откроется";
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
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [selectedCandidateIndexes, setSelectedCandidateIndexes] = useState<number[]>([]);
  const [selectionPending, setSelectionPending] = useState(false);
  const [selectionMessage, setSelectionMessage] = useState<string | null>(null);

  useEffect(() => {
    queueMicrotask(() => {
      setReducedMotion(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    });
  }, []);

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
    queueMicrotask(() => void load());
    const interval = window.setInterval(() => void load(), data?.activeCase?.state === "open" || data?.activeCase?.state === "analyzing" ? 2000 : 5000);
    return () => window.clearInterval(interval);
  }, [data?.activeCase?.state, load]);

  useEffect(() => {
    if (!data?.questionAnswers.length) return;
    const currentQuestion = data.activeCase
      ? data.questionAnswers.find((question) => question.caseNumber === data.activeCase?.caseNumber && question.questionNumber === data.activeCase?.questionNumber)
      : undefined;
    const selectedQuestion = data.questionAnswers.find((question) => question.id === selectedQuestionId);
    const next = selectedQuestion
      ? selectedQuestion.state !== "shortlist_ready" && currentQuestion ? currentQuestion.id : selectedQuestion.id
      : currentQuestion?.id ?? data.questionAnswers[0].id;
    if (next === selectedQuestionId) return;
    queueMicrotask(() => {
      setSelectedQuestionId(next);
      setSelectedCandidateIndexes([]);
      setSelectionMessage(null);
    });
  }, [data?.activeCase, data?.questionAnswers, selectedQuestionId]);

  const selectedQuestion = useMemo(
    () => data?.questionAnswers.find((question) => question.id === selectedQuestionId) ?? data?.questionAnswers[0] ?? null,
    [data?.questionAnswers, selectedQuestionId],
  );
  const speakerMode = selectedQuestion?.state === "shortlist_ready";

  function chooseQuestion(id: string) {
    setSelectedQuestionId(id);
    setSelectedCandidateIndexes([]);
    setSelectionMessage(null);
  }

  function toggleCandidate(index: number) {
    setSelectionMessage(null);
    setSelectedCandidateIndexes((current) => current.includes(index)
      ? current.filter((candidateIndex) => candidateIndex !== index)
      : current.length < 3 ? [...current, index] : current);
  }

  async function publishSelection() {
    if (!selectedQuestion || selectedQuestion.state !== "shortlist_ready" || selectedCandidateIndexes.length !== 3) return;
    setSelectionPending(true);
    setSelectionMessage(null);
    try {
      const response = await fetch("/api/case-lab-3/live/selection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: selectedQuestion.id, candidateIndexes: selectedCandidateIndexes }),
      });
      const result = await response.json().catch(() => ({})) as { status?: string; error?: string };
      if (!response.ok) {
        setSelectionMessage(result.error === "conflict" ? "Этот выбор уже изменился. Обновите экран." : "Не удалось сохранить выбор.");
        return;
      }
      setSelectionMessage("Топ-3 опубликован. Спасибо!");
      setSelectedCandidateIndexes([]);
      await load();
    } catch {
      setSelectionMessage("Не удалось связаться с сервером.");
    } finally {
      setSelectionPending(false);
    }
  }

  return (
    <main className={`${styles.page} ${reducedMotion ? styles.reducedMotion : ""}`}>
      <div className={styles.shell}>
        <header className={styles.header}>
          <a href="/case-lab-3" className={styles.brand} aria-label="Case Lab III">
            <Image src="/logo white.png" alt="Case Lab" width={164} height={34} priority className={styles.logoImage} />
          </a>
        </header>

        <section className={styles.hero}>
          <h1>Лидерборд</h1>
          <p>{data?.activeCase ? `Кейс ${data.activeCase.caseNumber}. ${statusLabel(data.activeCase.state)}` : "Следите за ответами участников"}</p>
        </section>

        {error ? <button type="button" className={styles.retry} onClick={() => void load()}>Обновить данные</button> : null}

        <div className={styles.layout}>
          <section className={styles.board} aria-live="polite" aria-label="Топ-10 участников">
            <div className={styles.boardHeader}><div><p className={styles.sectionKicker}>Общий результат потока</p><h2>Топ-10</h2></div><span>Баллы</span></div>
            {data?.entries.length ? <ol>{data.entries.map((entry) => <li key={`${entry.displayName}-${entry.rank}`}><span className={styles.rank}>{entry.rank}</span><strong>{entry.displayName}</strong><b>{entry.points}</b></li>)}</ol> : <p className={styles.empty}>Первые ответы ещё не появились.</p>}
          </section>

          <section className={styles.questions} aria-label="Ответы по кейсам">
            <div className={styles.questionsHeader}><div><p className={styles.sectionKicker}>Разбор ответов</p><h2>Ответы участников</h2></div></div>
            {data?.questionAnswers.length ? <>
              <nav className={styles.questionNav} aria-label="Выбор вопроса">
                {data.questionAnswers.map((question) => <button key={question.id} type="button" className={question.id === selectedQuestion?.id ? styles.questionTabActive : styles.questionTab} onClick={() => chooseQuestion(question.id)} aria-pressed={question.id === selectedQuestion?.id}>Кейс {question.caseNumber} · Вопрос {question.questionNumber}</button>)}
              </nav>
              {selectedQuestion ? <div className={styles.questionPanel}>
                <div className={styles.questionMeta}><span>Кейс {selectedQuestion.caseNumber} · Вопрос {selectedQuestion.questionNumber}</span><span>{statusLabel(selectedQuestion.state)}</span></div>
                <h3 className={styles.questionTitle}>{selectedQuestion.question}</h3>
                {speakerMode ? <p className={styles.speakerHint}>Режим спикера · выберите 3 ответа</p> : null}
                <div className={styles.answerGrid}>
                  {selectedQuestion.answers.length ? selectedQuestion.answers.map((answer, answerIndex) => {
                    const selectedIndex = selectedCandidateIndexes.indexOf(answerIndex);
                    const card = <article className={`${styles.answerCard} ${selectedIndex >= 0 ? styles.answerCardSelected : ""}`}>
                      <div className={styles.answerCardTop}>{selectedIndex >= 0 ? <span className={styles.selectionChip}>Выбрано {selectedIndex + 1}</span> : null}</div>
                      <h4>{answer.displayName}</h4>
                      <p>{answer.answer}</p>
                    </article>;
                    return speakerMode ? <button key={`${answer.displayName}-${answer.answer}`} type="button" className={styles.answerButton} onClick={() => toggleCandidate(answerIndex)} aria-pressed={selectedIndex >= 0}>{card}</button> : <div key={`${answer.displayName}-${answer.answer}`} className={styles.answerButton}>{card}</div>;
                  }) : <p className={styles.empty}>Топ-5 каждого вопроса.</p>}
                </div>
                {speakerMode ? <div className={styles.speakerActions}><span>{selectedCandidateIndexes.length} из 3 выбрано</span><button type="button" className={styles.primaryButton} disabled={selectionPending || selectedCandidateIndexes.length !== 3} onClick={() => void publishSelection()}>Выбрать топ-3</button></div> : null}
                {selectionMessage ? <p className={styles.selectionMessage} role="status">{selectionMessage}</p> : null}
              </div> : null}
            </> : <p className={styles.empty}>Топ-5 каждого вопроса.</p>}
          </section>
        </div>

        {data?.podiumAnswers.length ? <section className={styles.podium}><div className={styles.questionsHeader}><div><p className={styles.sectionKicker}>Результат выбора</p><h2>Победители вопроса</h2></div></div><div className={styles.answerGrid}>{data.podiumAnswers.map((answer) => <article key={answer.place} className={styles.answerCard}><div className={styles.answerCardTop}><span className={styles.selectionChip}>Место {answer.place}</span></div><h4>{answer.displayName}</h4><p>{answer.answer}</p></article>)}</div></section> : null}
      </div>
    </main>
  );
}
