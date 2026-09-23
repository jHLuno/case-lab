"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { analysisDelayMs, isAnalysisReady, LIVE_ROUND_SETTLE_GRACE_MS } from "@/lib/case-lab-3/live/timing";

const LIVE_ENVIRONMENT = "live" as const;
type CaseState = "draft" | "ready" | "open" | "analyzing" | "shortlist_ready" | "awarded" | "closed";
type LiveCase = {
  id: string;
  caseNumber: number;
  questionNumber: number;
  speakerLabel: string;
  title: string;
  question: string;
  speakerReferenceAnswer: string;
  context: string | null;
  keyInsight: string | null;
  generatedRubric: { criteria?: Array<{ name: string; description: string; weight: number }> };
  approvedRubric: { criteria?: Array<{ name: string; description: string; weight: number }> };
  state: CaseState;
  closesAt: string | null;
  stateVersion: number;
};
type Snapshot = {
  environment: typeof LIVE_ENVIRONMENT;
  cases: LiveCase[];
  participants: Array<{ id: string; displayName: string; claimStatus: string }>;
  submissions: Array<{ id: string; caseId: string; participantId: string; displayName: string; answer: string; points: number; validityState: string }>;
  aiRuns: Array<{ id: string; caseId: string; runNumber: number; servedModel: string | null; status: string; latencyMs: number | null; errorCategory: string | null }>;
  shortlist: Array<{ id: string; caseId: string; submissionId: string; aiOrder: number | null; aiScore: number | null; aiReason: string | null; approachLabel: string | null; included: boolean; finalOrder: number | null; operatorReason: string | null }>;
  awards: Array<{ caseId: string; submissionId: string; place: number; bonusPoints: number; active: boolean }>;
  leaderboard: Array<{ participantId: string; displayName: string; points: number; rank: number }>;
};

type Draft = {
  speakerLabel: string;
  title: string;
  question: string;
  referenceAnswer: string;
  context: string;
  keyInsight: string;
};

function draftFromCase(liveCase: LiveCase | undefined, caseNumber: number): Draft {
  return {
    speakerLabel: liveCase?.speakerLabel ?? `Спикер ${caseNumber}`,
    title: liveCase?.title ?? "",
    question: liveCase?.question ?? "",
    referenceAnswer: liveCase?.speakerReferenceAnswer ?? "",
    context: liveCase?.context ?? "",
    keyInsight: liveCase?.keyInsight ?? "",
  };
}

function ConfirmDialog({ title, description, reason, onReasonChange, onCancel, onConfirm }: {
  title: string;
  description: string;
  reason: string;
  onReasonChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const confirmRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    confirmRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [onCancel]);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onCancel(); }}>
      <section className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="live-confirm-title">
        <h2 id="live-confirm-title" className="text-xl font-semibold text-black" style={{ fontFamily: "var(--font-heading)" }}>{title}</h2>
        <p className="mt-3 text-sm leading-6 text-black/60" style={{ fontFamily: "var(--font-body)" }}>{description}</p>
        <label className="mt-5 grid gap-2 text-sm text-black/70" style={{ fontFamily: "var(--font-body)" }}>
          Причина
          <textarea value={reason} onChange={(event) => onReasonChange(event.target.value)} rows={3} className="rounded-xl border border-black/15 px-3 py-2 outline-none focus:border-[#040082] focus:ring-2 focus:ring-[#040082]/15" />
        </label>
        <div className="mt-5 flex justify-end gap-2" style={{ fontFamily: "var(--font-body)" }}>
          <button type="button" onClick={onCancel} className="rounded-full px-4 py-2 text-sm text-black/60 hover:bg-black/5">Отмена</button>
          <button ref={confirmRef} type="button" onClick={onConfirm} disabled={reason.trim().length < 3} className="rounded-full bg-black px-4 py-2 text-sm text-white disabled:opacity-40">Подтвердить</button>
        </div>
      </section>
    </div>
  );
}

export default function LiveOperatorClient({ csrfToken }: { csrfToken: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [selectedCase, setSelectedCase] = useState(1);
  const [selectedQuestion, setSelectedQuestion] = useState(1);
  const [awardSelections, setAwardSelections] = useState<Record<number, string>>({});
  const [message, setMessage] = useState("Загрузка live-состояния");
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [dialog, setDialog] = useState<null | { kind: "awards" | "reset"; id: string }>(null);
  const [dialogReason, setDialogReason] = useState("");
  const [clockMs, setClockMs] = useState(0);
  const [speakerUrl, setSpeakerUrl] = useState<string | null>(null);
  const autoAnalyzedRounds = useRef(new Set<string>());

  const draftKey = `${selectedCase}:${selectedQuestion}`;

  const loadSnapshot = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`/api/admin/case-lab-3/live?environment=${LIVE_ENVIRONMENT}`, { cache: "no-store" });
      if (!response.ok) throw new Error("snapshot");
      const data = await response.json() as Snapshot;
      setSnapshot(data);
      setDrafts((current) => {
        const next = { ...current };
        for (const item of data.cases) {
          const key = `${item.caseNumber}:${item.questionNumber}`;
          next[key] ??= draftFromCase(item, item.caseNumber);
        }
        return next;
      });
      setMessage("Live-состояние обновлено");
    } catch {
      setMessage("Не удалось загрузить live-состояние");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { queueMicrotask(() => void loadSnapshot()); }, [loadSnapshot]);
  useEffect(() => {
    const interval = window.setInterval(() => { void loadSnapshot(); }, 5000);
    return () => window.clearInterval(interval);
  }, [loadSnapshot]);
  useEffect(() => {
    const interval = window.setInterval(() => setClockMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function mutate(path: string, body: Record<string, unknown>, method = "POST"): Promise<boolean> {
    setPending(true);
    try {
      const response = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken, "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const result = await response.json().catch(() => ({})) as { error?: string };
        setMessage(result.error === "conflict" ? "Состояние изменилось. Обновите страницу данных" : "Операция не выполнена");
        return false;
      }
      return true;
    } catch {
      setMessage("Сервис оператора временно недоступен");
      return false;
    } finally {
      setPending(false);
    }
  }

  function updateDraft(caseNumber: number, field: keyof Draft, value: string) {
    const key = `${caseNumber}:${selectedQuestion}`;
    setDrafts((current) => ({
      ...current,
      [key]: { ...(current[key] ?? draftFromCase(undefined, caseNumber)), [field]: value },
    }));
  }

  async function saveCase(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const draft = drafts[draftKey] ?? draftFromCase(liveCase, selectedCase);
    if (!draft) return;
    if (await mutate("/api/admin/case-lab-3/live", {
      id: liveCase?.id,
      caseNumber: selectedCase,
      questionNumber: selectedQuestion,
      ...draft,
      environment: LIVE_ENVIRONMENT,
    }, "PUT")) {
      setMessage("Данные кейса сохранены");
      await loadSnapshot();
    }
  }

  async function generateRubric() {
    const liveCase = snapshot?.cases.find((item) => item.caseNumber === selectedCase && item.questionNumber === selectedQuestion);
    if (!liveCase) return setMessage("Сначала сохраните кейс");
    if (await mutate(`/api/admin/case-lab-3/live/cases/${liveCase.id}/rubric`, {})) {
      setMessage("Критерии сгенерированы как черновик");
      await loadSnapshot();
    }
  }

  async function approveRubric() {
    const liveCase = snapshot?.cases.find((item) => item.caseNumber === selectedCase && item.questionNumber === selectedQuestion);
    if (!liveCase || !liveCase.generatedRubric.criteria?.length) return;
    if (await mutate("/api/admin/case-lab-3/live", { id: liveCase.id, caseNumber: liveCase.caseNumber, questionNumber: liveCase.questionNumber, speakerLabel: liveCase.speakerLabel, title: liveCase.title, question: liveCase.question, referenceAnswer: liveCase.speakerReferenceAnswer, context: liveCase.context, keyInsight: liveCase.keyInsight, approvedRubric: liveCase.generatedRubric, environment: LIVE_ENVIRONMENT }, "PUT")) {
      setMessage("Критерии утверждены");
      await loadSnapshot();
    }
  }

  async function transition(state: CaseState, closesAt: string | null = null) {
    const liveCase = snapshot?.cases.find((item) => item.caseNumber === selectedCase && item.questionNumber === selectedQuestion);
    if (!liveCase) return;
    if (await mutate(`/api/admin/case-lab-3/live/cases/${liveCase.id}/transition`, { expectedVersion: liveCase.stateVersion, state, closesAt })) {
      setMessage(`Состояние кейса: ${state}`);
      await loadSnapshot();
    }
  }

  async function analyze() {
    const liveCase = snapshot?.cases.find((item) => item.caseNumber === selectedCase && item.questionNumber === selectedQuestion);
    if (!liveCase) return;
    if (await mutate(`/api/admin/case-lab-3/live/cases/${liveCase.id}/analyze`, { expectedVersion: liveCase.stateVersion })) {
      setMessage("AI-анализ завершён или переведён в ручной режим");
      await loadSnapshot();
    }
  }

  async function resetTimer() {
    const liveCase = snapshot?.cases.find((item) => item.caseNumber === selectedCase && item.questionNumber === selectedQuestion);
    if (!liveCase || liveCase.state !== "open") return;
    if (await mutate(`/api/admin/case-lab-3/live/cases/${liveCase.id}/reset-timer`, { expectedVersion: liveCase.stateVersion })) {
      setMessage("Таймер сброшен: участникам добавлены новые 3 минуты");
      await loadSnapshot();
    }
  }

  async function createSpeakerLink() {
    const currentCase = snapshot?.cases.find((item) => item.caseNumber === selectedCase && item.questionNumber === selectedQuestion);
    if (!currentCase || currentCase.state !== "shortlist_ready") return;
    setPending(true);
    try {
      const response = await fetch("/api/admin/case-lab-3/live/speaker-session", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfToken, "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ caseId: currentCase.id, expectedVersion: currentCase.stateVersion }),
      });
      const result = await response.json().catch(() => ({})) as { url?: string; error?: string };
      if (!response.ok || !result.url) {
        setMessage(result.error === "conflict" ? "Состояние изменилось. Обновите live-состояние" : "Не удалось открыть режим спикера");
        return;
      }
      setSpeakerUrl(result.url);
      setMessage("Ссылка для выбора спикером создана");
      window.open(result.url, "case-lab-3-speaker", "noopener,noreferrer");
    } catch {
      setMessage("Сервис режима спикера временно недоступен");
    } finally {
      setPending(false);
    }
  }

  async function addToShortlist(submissionId: string) {
    if (!liveCase) return;
    const nextOrder = selectedSubmissions.reduce((max, entry) => Math.max(max, entry.finalOrder ?? 0), 0) + 1;
    if (await mutate(`/api/admin/case-lab-3/live/cases/${liveCase.id}/shortlist`, {
      environment: LIVE_ENVIRONMENT,
      entries: [{ submissionId, included: true, finalOrder: nextOrder, operatorReason: "Добавлено оператором вручную" }],
    }, "PATCH")) {
      setMessage("Ответ добавлен в shortlist");
      await loadSnapshot();
    }
  }

  async function publishAwards() {
    const liveCase = snapshot?.cases.find((item) => item.caseNumber === selectedCase && item.questionNumber === selectedQuestion);
    if (!liveCase) return;
    const awards = [1, 2, 3].map((place) => ({ place, submissionId: awardSelections[place] })).filter((entry) => entry.submissionId);
    if (awards.length !== 3 || new Set(awards.map((entry) => entry.submissionId)).size !== 3) return setMessage("Выберите трёх разных участников");
    if (await mutate(`/api/admin/case-lab-3/live/cases/${liveCase.id}/awards`, { expectedVersion: liveCase.stateVersion, awards, reason: dialogReason.trim() || null })) {
      setDialog(null);
      setDialogReason("");
      setMessage("Топ-3 опубликован");
      await loadSnapshot();
    }
  }

  async function resetParticipant() {
    if (!dialog) return;
    if (await mutate(`/api/admin/case-lab-3/live/participants/${dialog.id}/reset`, { reason: dialogReason.trim() })) {
      setDialog(null);
      setDialogReason("");
      setMessage("Сессия участника сброшена");
      await loadSnapshot();
    }
  }

  const liveCase = snapshot?.cases.find((item) => item.caseNumber === selectedCase && item.questionNumber === selectedQuestion);
  const selectedSubmissions = snapshot?.shortlist.filter((entry) => entry.caseId === liveCase?.id && entry.included).sort((a, b) => (a.finalOrder ?? 99) - (b.finalOrder ?? 99)) ?? [];
  const caseSubmissions = snapshot?.submissions.filter((entry) => entry.caseId === liveCase?.id) ?? [];
  const latestRun = snapshot?.aiRuns.find((run) => run.caseId === liveCase?.id);

  useEffect(() => {
    if (!liveCase || liveCase.state !== "open" || !liveCase.closesAt || autoAnalyzedRounds.current.has(liveCase.id)) return;
    const delay = analysisDelayMs(Date.parse(liveCase.closesAt), Date.now());
    const timer = window.setTimeout(() => {
      if (autoAnalyzedRounds.current.has(liveCase.id)) return;
      autoAnalyzedRounds.current.add(liveCase.id);
      void analyze();
    }, delay);
    return () => window.clearTimeout(timer);
  // The selected round id/state/deadline are the intentional trigger; the callback uses the matching snapshot.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveCase?.id, liveCase?.state, liveCase?.closesAt]);

  return (
    <div style={{ fontFamily: "var(--font-body)" }}>
      <header className="mb-7 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-[0.16em] text-black/40">Case Lab III / CRM</p>
          <h1 className="text-3xl font-bold uppercase tracking-[0.02em] text-black" style={{ fontFamily: "var(--font-heading)" }}>Live-оператор</h1>
          <p className="mt-2 text-sm text-black/50" aria-live="polite">{message}</p>
        </div>
      </header>

      {loading && !snapshot ? <p className="rounded-2xl bg-white p-6 text-sm text-black/50">Загрузка live-состояния...</p> : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,.6fr)]">
        <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm md:p-7">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold text-black" style={{ fontFamily: "var(--font-heading)" }}>Подготовка кейсов</h2>
              <p className="mt-1 text-sm text-black/50">Эталон спикера и вопрос задаются до начала эфира.</p>
            </div>
            <div className="flex gap-2">
              {[1, 2, 3].map((number) => <button key={number} type="button" onClick={() => { setSelectedCase(number); setSelectedQuestion(1); }} className={`rounded-full px-4 py-2 text-sm ${selectedCase === number ? "bg-black text-white" : "border border-black/10 text-black/55"}`}>Кейс {number}</button>)}
            </div>
          </div>
          <div className="mb-5 flex flex-wrap items-center gap-2" aria-label="Вопросы кейса">
            <span className="mr-1 text-sm text-black/50">Вопрос:</span>
            {[1, 2, 3].map((number) => {
              const questionCase = snapshot?.cases.find((item) => item.caseNumber === selectedCase && item.questionNumber === number);
              return <button key={number} type="button" onClick={() => setSelectedQuestion(number)} className={`rounded-full px-3 py-1.5 text-sm ${selectedQuestion === number ? "bg-[#040082] text-white" : "border border-black/10 text-black/55"}`}>#{number}{questionCase ? ` · ${questionCase.state}` : ""}</button>;
            })}
          </div>
          <form onSubmit={saveCase} className="grid gap-4">
            {(["speakerLabel", "title", "question", "referenceAnswer", "context", "keyInsight"] as const).map((field) => (
              <label key={field} className="grid gap-1.5 text-sm text-black/70">
                {({ speakerLabel: "Спикер", title: "Название", question: "Вопрос аудитории", referenceAnswer: "Действительный ответ спикера", context: "Контекст", keyInsight: "Главный инсайт" } as Record<string, string>)[field]}
                {field === "question" || field === "referenceAnswer" || field === "context" || field === "keyInsight" ? <textarea value={drafts[draftKey]?.[field] ?? draftFromCase(liveCase, selectedCase)[field]} onChange={(event) => updateDraft(selectedCase, field, event.target.value)} rows={field === "referenceAnswer" ? 4 : 2} className="rounded-xl border border-black/10 px-3 py-2 text-black outline-none focus:border-[#040082] focus:ring-2 focus:ring-[#040082]/10" /> : <input value={drafts[draftKey]?.[field] ?? draftFromCase(liveCase, selectedCase)[field]} onChange={(event) => updateDraft(selectedCase, field, event.target.value)} className="rounded-xl border border-black/10 px-3 py-2 text-black outline-none focus:border-[#040082] focus:ring-2 focus:ring-[#040082]/10" />}
              </label>
            ))}
            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={pending} className="rounded-full bg-black px-5 py-2.5 text-sm text-white disabled:opacity-40">Сохранить кейс</button>
              <button type="button" disabled={pending || !liveCase} onClick={() => void generateRubric()} className="rounded-full border border-black/10 px-5 py-2.5 text-sm text-black disabled:opacity-40">Сгенерировать критерии</button>
              <button type="button" disabled={pending || !liveCase?.generatedRubric.criteria?.length} onClick={() => void approveRubric()} className="rounded-full border border-black/10 px-5 py-2.5 text-sm text-black disabled:opacity-40">Утвердить критерии</button>
            </div>
          </form>
          {liveCase?.generatedRubric.criteria?.length ? <div className="mt-5 rounded-xl bg-[#f5f4fb] p-4 text-sm text-black/65"><strong className="text-black">Черновик критериев:</strong> {liveCase.generatedRubric.criteria.map((criterion) => criterion.name).join(", ")}</div> : null}
        </section>

        <div className="grid content-start gap-5">
          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-semibold text-black" style={{ fontFamily: "var(--font-heading)" }}>Управление эфиром</h2><p className="mt-1 text-sm text-black/50">Текущее состояние: {liveCase?.state ?? "draft"}</p></div><span className="rounded-full bg-[#f5f4fb] px-3 py-1 text-xs text-black/55">v{liveCase?.stateVersion ?? 1}</span></div>
            <div className="mt-5 grid gap-2">
              {liveCase?.state === "draft" ? <button type="button" onClick={() => void transition("ready")} className="rounded-xl bg-black px-4 py-3 text-left text-sm text-white">Подготовка завершена</button> : null}
              {liveCase?.state === "ready" ? <button type="button" onClick={() => void transition("open", new Date(Date.now() + 3 * 60 * 1000).toISOString())} className="rounded-xl bg-[#040082] px-4 py-3 text-left text-sm text-white">Открыть ответы на 3 минуты</button> : null}
              {liveCase?.state === "open" ? <div className="grid gap-2 rounded-xl bg-[#f5f4fb] px-4 py-3 text-sm text-black/65"><span>Ответы закроются автоматически. AI-анализ запустится через {LIVE_ROUND_SETTLE_GRACE_MS / 1000} секунд после дедлайна.</span><button type="button" disabled={pending} onClick={() => void resetTimer()} className="justify-self-start rounded-full border border-black/15 px-3 py-1.5 text-xs text-black hover:bg-white disabled:opacity-40">Сбросить таймер (+3 минуты)</button></div> : null}
              {liveCase?.state === "open" && liveCase.closesAt && isAnalysisReady(Date.parse(liveCase.closesAt), clockMs) ? <button type="button" onClick={() => void analyze()} className="rounded-xl bg-black px-4 py-3 text-left text-sm text-white">Запустить AI-анализ</button> : null}
              {liveCase?.state === "analyzing" ? <button type="button" onClick={() => void transition("shortlist_ready")} className="rounded-xl border border-black/10 px-4 py-3 text-left text-sm text-black">Ручной режим: открыть shortlist</button> : null}
              {liveCase?.state === "shortlist_ready" ? <div className="grid gap-2"><button type="button" disabled={pending} onClick={() => void createSpeakerLink()} className="rounded-xl bg-[#040082] px-4 py-3 text-left text-sm text-white disabled:opacity-40">Открыть выбор спикера</button><button type="button" disabled={pending} onClick={() => { setDialog({ kind: "awards", id: liveCase.id }); setDialogReason(""); }} className="rounded-xl bg-black px-4 py-3 text-left text-sm text-white disabled:opacity-40">Опубликовать топ-3 вручную</button></div> : null}
            </div>
            {speakerUrl ? <div className="mt-4 rounded-xl bg-[#f5f4fb] p-3 text-sm"><p className="text-black/60">Ссылка действует 15 минут и привязана к текущему shortlist.</p><a href={speakerUrl} target="_blank" rel="noreferrer" className="mt-2 block break-all text-[#040082] underline">Открыть экран спикера</a></div> : null}
            {latestRun?.status === "failed" ? <p className="mt-4 rounded-xl bg-[#fff4f1] p-3 text-sm text-[#9a3325]">AI недоступен. Используйте ручной режим.</p> : null}
          </section>

          <section className="rounded-2xl border border-black/10 bg-white p-5 shadow-sm">
            <h2 className="text-xl font-semibold text-black" style={{ fontFamily: "var(--font-heading)" }}>Участники</h2>
            <p className="mt-1 text-sm text-black/50">Заявлено: {snapshot?.participants.length ?? 0}. Полные данные видны только CRM.</p>
            <div className="mt-4 grid gap-2">
              {(snapshot?.participants ?? []).slice(0, 8).map((participant) => <div key={participant.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f5f4fb] px-3 py-2 text-sm"><span className="truncate text-black">{participant.displayName}</span><button type="button" onClick={() => { setDialog({ kind: "reset", id: participant.id }); setDialogReason(""); }} className="shrink-0 text-xs text-black/55 underline">Сбросить участника</button></div>)}
            </div>
          </section>
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-black/10 bg-white p-5 shadow-sm md:p-7">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold text-black" style={{ fontFamily: "var(--font-heading)" }}>Ответы и shortlist</h2><p className="mt-1 text-sm text-black/50">AI помогает сузить выбор. Баллы начисляются только сервером после решения спикера.</p></div><span className="text-sm text-black/45">Ответов: {caseSubmissions.length} · В shortlist: {selectedSubmissions.length}</span></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {caseSubmissions.map((submission) => { const shortlistEntry = snapshot?.shortlist.find((entry) => entry.submissionId === submission.id); return <article key={submission.id} className="rounded-xl border border-black/10 p-4"><div className="flex justify-between gap-3 text-xs text-black/45"><span className="font-medium text-black/70">{submission.displayName}</span><span>{shortlistEntry?.approachLabel ?? "Ответ участника"} · {shortlistEntry?.aiScore ?? "без оценки"}</span></div><p className="mt-3 text-sm leading-6 text-black/75">{submission.answer}</p>{liveCase?.state === "shortlist_ready" && !shortlistEntry?.included && selectedSubmissions.length < 5 ? <button type="button" disabled={pending} onClick={() => void addToShortlist(submission.id)} className="mt-4 rounded-full border border-black/15 px-3 py-1.5 text-xs text-black hover:bg-black/5 disabled:opacity-40">Добавить в shortlist</button> : null}{shortlistEntry?.included ? <p className="mt-4 text-xs text-black/45">В shortlist</p> : null}</article>; })}
        </div>
        {liveCase?.state === "shortlist_ready" ? <div className="mt-6 grid gap-3 border-t border-black/10 pt-5 md:grid-cols-3">{[1, 2, 3].map((place) => <label key={place} className="grid gap-1 text-sm text-black/65">Место {place}<select value={awardSelections[place] ?? ""} onChange={(event) => setAwardSelections((current) => ({ ...current, [place]: event.target.value }))} className="rounded-xl border border-black/10 bg-white px-3 py-2 text-black"><option value="">Выберите ответ</option>{selectedSubmissions.map((entry) => { const submission = caseSubmissions.find((item) => item.id === entry.submissionId); return <option key={entry.submissionId} value={entry.submissionId}>{submission?.displayName ?? "Участник"}{entry.aiScore === null ? "" : ` · ${entry.aiScore} баллов AI`}</option>; })}</select></label>)}</div> : null}
      </section>

      {dialog ? <ConfirmDialog title={dialog.kind === "awards" ? "Опубликовать топ-3?" : "Сбросить сессию участника?"} description={dialog.kind === "awards" ? "После публикации места и бонусные баллы фиксируются сервером." : "Участник сможет пройти проверку заново."} reason={dialogReason} onReasonChange={setDialogReason} onCancel={() => setDialog(null)} onConfirm={() => void (dialog.kind === "awards" ? publishAwards() : resetParticipant())} /> : null}
    </div>
  );
}
