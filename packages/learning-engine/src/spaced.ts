import type { LearningConfig } from "./config";

/**
 * Persistent spaced-repetition state per (learner, question).
 */
export interface ReviewState {
  qid: string;
  learnerId: string;
  stage: number; // index into reviewScheduleDays (0 = due again soon)
  last: number; // last reviewed epoch ms
  next: number; // next review epoch ms
  lapseCount: number; // number of incorrect answers since last consistent run
}

export interface AnswerReviewInput {
  isCorrect: boolean;
  confidence: string; // "sure" | "unsure" | "guess"
}

export const DAY_MS = 86_400_000;

export interface Clock {
  now(): number;
}
export const systemClock: Clock = { now: () => Date.now() };

function scheduleDays(cfg: LearningConfig, stage: number): number {
  const idx = Math.min(stage, cfg.reviewScheduleDays.length - 1);
  return cfg.reviewScheduleDays[idx] ?? cfg.reviewScheduleDays[cfg.reviewScheduleDays.length - 1]!;
}

/**
 * Deterministic scheduler.
 *   incorrect / lapse          -> stage 0 (due essentially immediately)
 *   correct but unsure/guess   -> review relatively soon (do not advance)
 *   correct & sure+           -> advance stage => longer interval
 */
export function applyAnswer(
  previous: ReviewState | null,
  learnerId: string,
  answer: AnswerReviewInput,
  cfg: LearningConfig,
  clock: Clock = systemClock,
): ReviewState {
  const now = clock.now();
  const base: ReviewState = previous ?? {
    qid: "",
    learnerId,
    stage: 0,
    last: now,
    next: now,
    lapseCount: 0,
  };

  if (!answer.isCorrect) {
    return {
      ...base,
      stage: 0,
      last: now,
      next: now + scheduleDays(cfg, 0) * DAY_MS,
      lapseCount: base.lapseCount + 1,
    };
  }

  const stage = answer.confidence === "sure" ? base.stage + 1 : Math.max(1, base.stage);
  return {
    ...base,
    stage,
    last: now,
    next: now + scheduleDays(cfg, stage) * DAY_MS,
  };
}

export function isDue(state: ReviewState, now: number): boolean {
  return state.next <= now;
}