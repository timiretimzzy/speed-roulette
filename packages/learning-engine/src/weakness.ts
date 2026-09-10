import type { LearningConfig } from "./config";
import type { MasteryStat } from "./mastery";
import { DAY_MS } from "./spaced";

export type WeaknessKind = "early" | "recurring" | "deteriorating" | "long-unreviewed" | "none";

export interface WeaknessSignal {
  key: string;
  kind: WeaknessKind;
  reasons: string[];
  stat: MasteryStat;
}

/**
 * Evidence-aware weakness detection. A low accuracy is NOT weak on its own:
 * 3 attempts at 33% differs materially from 50 attempts at 33%.
 * Rules (all configurable; see config.ts):
 *   1. insufficient evidence: no label until evidence >= minEvidence
 *   2. recurring: >= recurringMissCount misses inside the last
 *      recurringMissWindow attempts
 *   3. deteriorating: recent accuracy slips >= deteriorationMargin below
 *      overall accuracy while still below recentWeakThreshold
 *   4. long-unreviewed: weak and untouched for weakGapDays
 */
export function detectWeakness(
  stat: MasteryStat,
  cfg: LearningConfig,
  now: number,
): WeaknessSignal {
  if (stat.evidence < cfg.minEvidence) {
    return { key: stat.key, kind: "none", reasons: ["Not enough attempts yet."], stat };
  }

  if (stat.mastery >= cfg.developingThreshold) {
    return { key: stat.key, kind: "none", reasons: [], stat };
  }

  const reasons: string[] = [`Accuracy on this topic is ${Math.round(stat.accuracy * 100)}%.`];
  let kind: WeaknessKind = "early";

  if (stat.recentAccuracy < cfg.recentWeakThreshold) {
    // recurring / deteriorating passed in via composed signals
  }

  const stale = stat.lastAttemptTs > 0 && now - stat.lastAttemptTs > cfg.weakGapDays * DAY_MS;
  if (stale) {
    kind = "long-unreviewed";
    reasons.push(`This topic has not been reviewed for ${cfg.weakGapDays}+ days.`);
  }

  return { key: stat.key, kind, reasons, stat };
}

/** Resolves recurring / deteriorating flags from the raw attempt stream. */
export function classifyPattern(attempts: { isCorrect: boolean; ts: number }[], cfg: LearningConfig): Pick<WeaknessSignal, "kind" | "reasons"> {
  const sorted = [...attempts].sort((a, b) => a.ts - b.ts);
  const recent = sorted.slice(-cfg.recurringMissWindow);
  const misses = recent.filter((a) => !a.isCorrect).length;
  if (recent.length >= cfg.minEvidence && misses >= cfg.recurringMissCount) {
    return { kind: "recurring", reasons: ["Several recent attempts missed."] };
  }
  if (sorted.length >= cfg.minEvidence * 2) {
    const recentAcc = recent.length ? recent.filter((a) => a.isCorrect).length / recent.length : 0;
    const allAcc = sorted.filter((a) => a.isCorrect).length / sorted.length;
    if (recentAcc < cfg.recentWeakThreshold && allAcc - recentAcc >= cfg.deteriorationMargin) {
      return { kind: "deteriorating", reasons: ["Recent performance has dropped below your usual level."] };
    }
  }
  return { kind: "none", reasons: [] };
}