export const NBS_QUESTION_SET_VERSION = "nbs-leadership-forum-2026-v1" as const;

export const NBS_QUESTIONS = [
  {
    number: 1,
    text: "Что сегодня больше всего мешает вам быть эффективным руководителем?",
    shortText: "Что мешает быть эффективным руководителем?",
  },
  {
    number: 2,
    text: "Какое решение вы бы уже сегодня доверили AI?",
    shortText: "Что готовы доверить AI сегодня?",
  },
  {
    number: 3,
    text: "Какое решение вы никогда не доверите AI?",
    shortText: "Что никогда не доверите AI?",
  },
] as const;

export type NbsQuestionDefinition = (typeof NBS_QUESTIONS)[number];
