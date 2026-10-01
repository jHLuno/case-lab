export function normalizeAnswer(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/gu, "\n").replace(/\t/gu, " ");
}

export function answerLength(value: string): number {
  return Array.from(normalizeAnswer(value)).length;
}

export function normalizeParticipantName(value: string): string {
  return value.normalize("NFC").trim().replace(/\s+/gu, " ");
}

export function participantNameLength(value: string): number {
  return Array.from(normalizeParticipantName(value)).length;
}
