import type { Question } from "@zivvvo/content";

/**
 * Immediate, local, offline-safe scoring against the canonical key embedded in
 * the content model. AI never participates.
 */
export function gradeQuestion(question: Question, selected: number[]): boolean {
  if (selected.length === 0) return false;
  const correct = question.correctIndexes;
  if (correct.length === 0) return false;
  for (const s of selected) if (!correct.includes(s)) return false;
  return true;
}

export function isAnswered(question: Question): boolean {
  return question.status === "answered" && question.correctIndexes.length > 0;
}