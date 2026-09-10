import type { Question } from "@zivvvo/content";
import { mulberry32, seededShuffle } from "./random";
import { difficultyOrder } from "./difficulty";

/**
 * MISTAKE REVIEW VARIANTS (docs/PRODUCT_VISION.md §17).
 *
 * "Never the same question." Reviews must not replay the exact mistake as-is,
 * or the learner memorises the position/pattern instead of the rule. Variants
 * are composed at runtime from the content already in the pack:
 *
 *  - `rotate` — same stem and options, different (deterministic) option order.
 *  - `swap`   — same stem, but distractors are pulled from sibling questions in
 *    the same topic, preferring *harder* distractors (the "original → variant →
 *    harder" step). Author difficulty guides hardness until empirical data
 *    (S2) takes over.
 *  - `original` — last resort when nothing can be composed (e.g. one-option
 *    questions).
 *
 * A variant is presented like any question but carries `variant.of = baseQid`,
 * so recorded attempts still count toward the *concept's* mastery, not a
 * phantom id.
 */

export type VariantMutation = "rotate" | "swap" | "original";

export interface VariantQuestion extends Question {
  variant?: {
    of: string;
    mutation: VariantMutation;
    seed: number;
  };
}

/** Deterministic 32-bit hash (FNV-1a) so base qid -> seed is stable across builds. */
export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

function rotateOptions(options: Question["options"], rng: () => number): { options: Question["options"]; correctIndexes: number[] } {
  const indexes = options.map((_, i) => i);
  let order = seededShuffle(indexes, rng);
  let guard = 0;
  while (
    options.length > 1 &&
    order.every((v, i) => v === i) &&
    guard++ < 5
  ) {
    order = seededShuffle(indexes, rng);
  }
  const next = order.map((i) => ({ ...options[i]! }));
  const correct = new Set(options.map((o, i) => (o.isCorrect ? i : -1)).filter((i) => i >= 0));
  const correctIndexes = order.flatMap((orig, pos) => (correct.has(orig) ? [pos] : []));
  return { options: next, correctIndexes };
}

interface Candidate {
  text: string;
  weight: number;
}

/**
 * Compose one variant for a mistaken question.
 * @param siblings questions in the same topic (used as the distractor pool).
 */
export function composeVariant(
  base: Question,
  siblings: Question[],
  seed: number,
  preferHard = true,
): VariantQuestion {
  const rng = mulberry32(seed >>> 0);

  const swapableSlots = base.options.map((o, i) => (o.isCorrect ? -1 : i)).filter((i) => i >= 0);
  const couldSwap = swapableSlots.length > 0 && siblings.length > 0;
  const existing = new Set(base.options.map((o) => o.text));

  if (couldSwap) {
    const ranked = new Map<string, number>();
    for (const sib of siblings) {
      const weight = difficultyOrder(sib.difficulty ?? "standard");
      for (const opt of sib.options) {
        if (existing.has(opt.text)) continue;
        const prev = ranked.get(opt.text);
        if (prev === undefined || (preferHard ? weight > prev : weight < prev)) ranked.set(opt.text, weight);
      }
    }
    const candidates: Candidate[] = [...ranked.entries()]
      .map(([text, weight]) => ({ text, weight }))
      .sort((a, b) => (preferHard ? b.weight - a.weight : a.weight - b.weight));

    const slotsToSwap = swapableSlots.length >= 2 ? 2 : 1;
    if (candidates.length >= 1) {
      const picks = candidates.slice(0, slotsToSwap);
      if (picks.length >= 1) {
        const options = base.options.map((o) => ({ ...o }));
        for (let i = 0; i < picks.length; i++) options[swapableSlots[i]!] = { ...options[swapableSlots[i]!]!, text: picks[i]!.text };
        return { ...base, options, correctIndexes: [...base.correctIndexes], variant: { of: base.qid, mutation: "swap", seed } };
      }
    }
  }

  if (base.options.length > 1) {
    const { options, correctIndexes } = rotateOptions(base.options, rng);
    return { ...base, options, correctIndexes, variant: { of: base.qid, mutation: "rotate", seed } };
  }

  return { ...base, variant: { of: base.qid, mutation: "original", seed } };
}

/** qid to record an attempt against: variant attempts belong to the base concept. */
export function baseQidOf(q: Question): string {
  return (q as VariantQuestion).variant?.of ?? q.qid;
}

/** Deterministic per-question seed derived from a session seed + qid. */
export function variantSeed(sessionSeed: number, qid: string): number {
  return (sessionSeed ^ hashString(qid)) >>> 0;
}