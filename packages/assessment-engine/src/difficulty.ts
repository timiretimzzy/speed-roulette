import type { Question } from "@zivvvo/content";
import type { AttemptEvent } from "./types";

/**
 * DIFFICULTY SYSTEM (docs/PRODUCT_VISION.md §49).
 *
 * Every question carries an author difficulty; the engine adds an *empirical*
 * difficulty derived from how learners actually perform on it, and a ramp that
 * lets a session get "harder" as a learner stays correct — the vision's
 * "Let's make it harder" loop. Author data is the fallback until real data
 * takes over.
 */

export type DifficultyTier = "easy" | "standard" | "hard";
export type DifficultyMode = "auto" | DifficultyTier;

export const DIFFICULTY_LABEL: Record<DifficultyTier, string> = {
  easy: "Easy",
  standard: "Standard",
  hard: "Hard",
};

/** Coarse numeric order so tiers can be compared. */
export function difficultyOrder(tier: DifficultyTier): number {
  return tier === "easy" ? 0 : tier === "standard" ? 1 : 2;
}

/** Author difficulty, with a safe default when the source gave no signal. */
export function questionDifficulty(q: Question): DifficultyTier {
  return q.difficulty ?? "standard";
}

export interface EmpiricalDifficulty {
  attempts: number;
  correctRate: number | null;
  /** Empirical tier; null until there is enough evidence to trust it. */
  label: DifficultyTier | null;
}

/**
 * Empirical difficulty of one question from observed attempts. Mirrors the
 * vision: "Author difficulty: Medium / Actual difficulty: Hard / Correct rate:
 * 34%".
 */
export function empiricalDifficulty(attemptsForQid: AttemptEvent[], minEvidence = 4): EmpiricalDifficulty {
  if (attemptsForQid.length === 0) return { attempts: 0, correctRate: null, label: null };
  const correctRate = attemptsForQid.filter((a) => a.isCorrect).length / attemptsForQid.length;
  if (attemptsForQid.length < minEvidence) return { attempts: attemptsForQid.length, correctRate, label: null };
  const label: DifficultyTier = correctRate >= 0.8 ? "easy" : correctRate >= 0.5 ? "standard" : "hard";
  return { attempts: attemptsForQid.length, correctRate, label };
}

export interface RampResult {
  next: DifficultyTier;
  /** Learner-facing signal when the ramp promotes ("Let's make it harder."). */
  promoteMessage: string | null;
}

/**
 * Difficulty ramp: after a run of consecutive correct answers at the current
 * tier, promote one notch (the vision's micro-learning "Let's make it
 * harder"). Never rewards streaks by making things *easier*.
 */
export function rampDifficulty(current: DifficultyTier | null, correctStreak: number, promoteAfter = 3): RampResult {
  const base = current ?? "standard";
  if (correctStreak >= promoteAfter && base !== "hard") {
    const next: DifficultyTier = base === "easy" ? "standard" : "hard";
    return { next, promoteMessage: "Let's make it harder." };
  }
  return { next: base, promoteMessage: null };
}

/** Restrict a question pool to one tier (or keep everything in "auto"). */
export function poolForDifficulty(all: Question[], mode: DifficultyMode): Question[] {
  if (mode === "auto") return all;
  const order = difficultyOrder(mode);
  return all.filter((q) => difficultyOrder(questionDifficulty(q)) === order);
}