import type { Question } from "@zivvvo/content";

export type LearningMode =
  | "diagnostic"
  | "learn"
  | "smart"
  | "quick"
  | "review"
  | "weakness"
  | "recovery"
  | "mock"
  | "challenge";

export type Confidence = "sure" | "unsure" | "guess";

/**
 * The spine of the learner performance record. Device-first, append-only,
 * idempotent sync. Topic/concept/difficulty are NOT duplicated here -- they
 * are derived from the content model via qid (docs/DATABASE.md).
 */
export interface AttemptEvent {
  id: string;
  learnerId: string;
  qid: string;
  sessionId: string | null;
  mode: LearningMode;
  selected: number[];
  isCorrect: boolean;
  confidence: Confidence;
  durationMs: number;
  ts: number;
  syncedAt: number | null;
}

export type SessionType = "diagnostic" | "smart" | "quick" | "review" | "weakness" | "recovery" | "mock" | "mistake-review";

export interface LearningSession {
  id: string;
  learnerId: string;
  type: SessionType;
  title: string;
  purpose: string;
  estimatedMinutes: number;
  createdAt: number;
  questions: Question[];
  completedAt: number | null;
}