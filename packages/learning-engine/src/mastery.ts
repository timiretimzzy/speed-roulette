import type { LearningConfig } from "./config";

/** Structural subset of an attempt event (avoids coupling engine to storage). */
export interface AttemptLike {
  qid: string;
  isCorrect: boolean;
  mode: string;
  confidence: string;
  ts: number;
}

export type MasteryStatus = "limited" | "strong" | "developing" | "needs-attention";

/**
 * Demonstrated-performance statistics for one grouping (topic or concept).
 *
 * The reported `mastery` deliberately avoids a single-correct-answer => 100%
 * failure mode: it is a smoothed accuracy with a prior, nudged toward recent
 * evidence. `confidence` quantifies how much we trust that number.
 */
export interface MasteryStat {
  key: string;
  evidence: number;
  correct: number;
  accuracy: number;
  recentAccuracy: number;
  mastery: number;
  confidence: number;
  status: MasteryStatus;
  lastAttemptTs: number;
}

export function computeStat(attempts: AttemptLike[], key: string, cfg: LearningConfig): MasteryStat {
  const sorted = [...attempts].sort((a, b) => a.ts - b.ts);
  const n = sorted.length;
  const c = sorted.filter((a) => a.isCorrect).length;

  const recent = sorted.slice(-Math.min(cfg.recentWindow, n));
  const recentAcc = recent.length
    ? recent.filter((a) => a.isCorrect).length / recent.length
    : 0;

  const base = n > 0 ? (c + cfg.prior) / (n + 1) : 0;
  const recentW = n > 0 ? Math.min(cfg.recentWeightMax, n * cfg.recentWeightPerAttempt) : 0;
  const mastery = base * (1 - recentW) + recentAcc * recentW;
  const confidence = n / (n + cfg.confidenceDenominator);

  let status: MasteryStatus = "limited";
  if (n >= cfg.minEvidence) {
    if (mastery >= cfg.strongThreshold) status = "strong";
    else if (mastery >= cfg.developingThreshold) status = "developing";
    else status = "needs-attention";
  }

  return {
    key,
    evidence: n,
    correct: c,
    accuracy: n ? c / n : 0,
    recentAccuracy: recentAcc,
    mastery,
    confidence,
    status,
    lastAttemptTs: sorted.length ? sorted[sorted.length - 1]!.ts : 0,
  };
}

export function masteryBy(
  attempts: AttemptLike[],
  keyFor: (a: AttemptLike) => string,
  cfg: LearningConfig,
): MasteryStat[] {
  const groups = new Map<string, AttemptLike[]>();
  for (const a of attempts) {
    const k = keyFor(a);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(a);
  }
  return [...groups.entries()]
    .map(([key, as]) => computeStat(as, key, cfg))
    .sort((x, y) => x.key.localeCompare(y.key));
}