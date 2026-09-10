import type { ContentPack } from "@zivvvo/content";
import { computeStat, type LearningConfig } from "@zivvvo/learning-engine";
import type { AttemptEvent } from "./types";

/**
 * READINESS v2 — the weighted, exam-facing score the whole product is built
 * around (docs/PRODUCT_VISION.md §19). Never a pass guarantee; always a
 * "how prepared do you *demonstrably* look" number with an explainable
 * breakdown.
 *
 * Weights come from the vision: topic mastery 30%, recent performance 20%,
 * mock performance 20%, consistency 10%, response confidence 10%, speed 10%.
 * Components without evidence are left out and their weight renormalised over
 * the components that do have evidence, so a new learner is not punished for
 * an un-taken mock exam yet still sees an honest early score.
 */

export type ReadinessBand = "getting-started" | "building" | "almost-ready" | "strong" | "exam-ready";

export const RANK_ORDER: ReadinessBand[] = [
  "getting-started",
  "building",
  "almost-ready",
  "strong",
  "exam-ready",
];

export const BAND_LABEL: Record<ReadinessBand, string> = {
  "getting-started": "Getting Started",
  building: "Building Knowledge",
  "almost-ready": "Almost Ready",
  strong: "Strong Preparation",
  "exam-ready": "Exam Ready",
};

/** Tone hints for the design system (ok/warn/bad/neutral). */
export const BAND_TONE: Record<ReadinessBand, "ok" | "warn" | "bad" | "neutral"> = {
  "getting-started": "bad",
  building: "warn",
  "almost-ready": "warn",
  strong: "ok",
  "exam-ready": "ok",
};

const BAND_MESSAGE: Record<ReadinessBand, string> = {
  "getting-started": "Focus on the fundamentals first.",
  building: "You're learning, but major gaps remain.",
  "almost-ready": "Focused practice can make a big difference now.",
  strong: "You're performing consistently. Keep the frequency up.",
  "exam-ready": "Based on your demonstrated performance, you're showing strong readiness.",
};

const BAND_THRESHOLDS: [number, ReadinessBand][] = [
  [0.31, "getting-started"],
  [0.56, "building"],
  [0.76, "almost-ready"],
  [0.91, "strong"],
  [Infinity, "exam-ready"],
];

/** Perceived-confidence band (from onboarding) mapped to a 0..1 self-assessment. */
export const PERCEIVED_CONFIDENCE: Record<string, number> = {
  none: 0.15,
  some: 0.35,
  fairly: 0.6,
  confident: 0.85,
};

const CONFIDENCE_WEIGHT: Record<AttemptEvent["confidence"], number> = {
  sure: 1,
  unsure: 0.5,
  guess: 0.2,
};

function speedFromMedian(medianMs: number): number {
  if (medianMs <= 25_000) return 1;
  if (medianMs <= 40_000) return 0.75;
  if (medianMs <= 60_000) return 0.5;
  return 0.3;
}

export interface ReadinessTopic {
  topicId: string;
  label: string;
  seen: number;
  answerable: number;
  coverage: number;
  mastery: number;
  evidence: number;
}

export type ReadinessComponentId =
  | "topic-mastery"
  | "recent-performance"
  | "mock-performance"
  | "consistency"
  | "confidence"
  | "speed";

export interface ReadinessComponent {
  id: ReadinessComponentId;
  label: string;
  /** Share of the *evidence-present* weights (renormalised). */
  weight: number;
  /** Raw value, 0..1 (excluding weight). */
  value: number;
  /** value × weight — what this component contributed to the score. */
  contribution: number;
  hasEvidence: boolean;
}

export interface ReadinessResult {
  score: number;
  band: ReadinessBand;
  components: ReadinessComponent[];
  coverage: number;
  masteryMean: number;
  evidence: number;
  topics: ReadinessTopic[];
  /** The onboarding self-assessment (0..1) when provided; null otherwise. */
  perceivedConfidence: number | null;
  /** actual − perceived. Negative = the learner under-rates themselves. */
  perceivedDelta: number | null;
  /** One-line, learner-facing band copy (never a pass guarantee). */
  message: string;
  note: string;
}

const COMPONENT_DEFS: { id: ReadinessComponentId; label: string; weight: number }[] = [
  { id: "topic-mastery", label: "Topic mastery", weight: 0.3 },
  { id: "recent-performance", label: "Recent performance", weight: 0.2 },
  { id: "mock-performance", label: "Mock exam performance", weight: 0.2 },
  { id: "consistency", label: "Consistency", weight: 0.1 },
  { id: "confidence", label: "Response confidence", weight: 0.1 },
  { id: "speed", label: "Speed", weight: 0.1 },
];

function bandOf(score: number): ReadinessBand {
  return BAND_THRESHOLDS.find(([threshold]) => score < threshold)?.[1] ?? "exam-ready";
}

function recentAccuracy(attempts: AttemptEvent[], config: LearningConfig): { value: number; hasEvidence: boolean } {
  const recent = [...attempts].sort((a, b) => b.ts - a.ts).slice(0, config.recentWindow);
  if (recent.length < config.minEvidence) return { value: 0, hasEvidence: false };
  const correct = recent.filter((a) => a.isCorrect).length;
  return { value: correct / recent.length, hasEvidence: true };
}

function mockPerformance(attempts: AttemptEvent[], passMark: number): { value: number; hasEvidence: boolean } {
  const mockRuns = new Map<string, { correct: number; total: number; latestTs: number }>();
  for (const a of attempts) {
    if (a.mode !== "mock" || !a.sessionId) continue;
    const run = mockRuns.get(a.sessionId) ?? { correct: 0, total: 0, latestTs: 0 };
    run.correct += a.isCorrect ? 1 : 0;
    run.total += 1;
    if (a.ts > run.latestTs) run.latestTs = a.ts;
    mockRuns.set(a.sessionId, run);
  }
  const latest = [...mockRuns.values()].sort((a, b) => b.latestTs - a.latestTs)[0];
  if (!latest || latest.total < 5) return { value: 0, hasEvidence: false };
  return { value: Math.min(1, (latest.correct / latest.total) / passMark), hasEvidence: true };
}

function consistency(attempts: AttemptEvent[], days: number, now: number): { value: number; hasEvidence: boolean } {
  if (attempts.length === 0) return { value: 0, hasEvidence: false };
  const activeDays = new Set(attempts.map((a) => Math.floor(a.ts / 86_400_000)));
  const windowStart = Math.floor(now / 86_400_000) - (days - 1);
  let activeInWindow = 0;
  for (let d = windowStart; d <= Math.floor(now / 86_400_000); d++) {
    if (activeDays.has(d)) activeInWindow++;
  }
  return { value: activeInWindow / days, hasEvidence: true };
}

function medianOf(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

export function computeReadiness(args: {
  pack: ContentPack;
  attempts: AttemptEvent[];
  config: LearningConfig;
  mockPassMark?: number;
  consistencyWindowDays?: number;
  now?: number;
  initialConfidence?: string | null;
}): ReadinessResult | null {
  const {
    pack,
    attempts,
    config,
    mockPassMark = 0.6,
    consistencyWindowDays = 7,
    now = Date.now(),
    initialConfidence = null,
  } = args;

  if (attempts.length < config.minEvidence * 2) return null;

  const contentTopics = pack.topics.filter((t) => t.kind === "content");
  const answerableByTopic = new Map<string, number>();
  const seenByTopic = new Map<string, Set<string>>();
  const topicOfQid = new Map<string, string>();
  for (const t of contentTopics) answerableByTopic.set(t.id, 0);
  for (const q of pack.questions) {
    if (q.status === "answered" && answerableByTopic.has(q.topicId)) {
      answerableByTopic.set(q.topicId, (answerableByTopic.get(q.topicId) ?? 0) + 1);
    }
    topicOfQid.set(q.qid, q.topicId);
  }
  for (const a of attempts) {
    const tid = topicOfQid.get(a.qid);
    if (tid && answerableByTopic.has(tid)) {
      if (!seenByTopic.has(tid)) seenByTopic.set(tid, new Set());
      seenByTopic.get(tid)!.add(a.qid);
    }
  }

  let coveredTotal = 0;
  let answerableTotal = 0;
  let weightedMastery = 0;
  let weight = 0;
  const topics: ReadinessTopic[] = [];
  for (const t of contentTopics) {
    const answerable = answerableByTopic.get(t.id) ?? 0;
    const seen = seenByTopic.get(t.id)?.size ?? 0;
    const topicAttempts = attempts.filter((a) => seenByTopic.get(t.id)?.has(a.qid));
    const stat = computeStat(topicAttempts, t.id, config);
    coveredTotal += seen;
    answerableTotal += answerable;
    if (stat.evidence > 0) {
      weightedMastery += stat.mastery * stat.evidence;
      weight += stat.evidence;
    }
    topics.push({
      topicId: t.id,
      label: t.label,
      seen,
      answerable,
      coverage: answerable ? seen / answerable : 0,
      mastery: stat.mastery,
      evidence: stat.evidence,
    });
  }

  const masteryMean = weight ? weightedMastery / weight : 0;
  const coverage = answerableTotal ? coveredTotal / answerableTotal : 0;

  const evidenceTopics = topics.filter((t) => t.evidence > 0);
  const strongest = evidenceTopics.reduce<ReadinessTopic | null>((best, t) => (best && best.mastery >= t.mastery ? best : t), null);
  const weakest = evidenceTopics.reduce<ReadinessTopic | null>((worst, t) => (worst && worst.mastery <= t.mastery ? worst : t), null);

  const raw: Record<ReadinessComponentId, { value: number; hasEvidence: boolean }> = {
    "topic-mastery": { value: masteryMean, hasEvidence: weight > 0 },
    "recent-performance": recentAccuracy(attempts, config),
    "mock-performance": mockPerformance(attempts, mockPassMark),
    consistency: consistency(attempts, consistencyWindowDays, now),
    confidence: {
      value: attempts.reduce((acc, a) => acc + CONFIDENCE_WEIGHT[a.confidence], 0) / attempts.length,
      hasEvidence: attempts.length > 0,
    },
    speed: {
      value: speedFromMedian(medianOf(attempts.map((a) => a.durationMs)) ?? 120_000),
      hasEvidence: attempts.length > 0,
    },
  };

  const present = COMPONENT_DEFS.filter((c) => raw[c.id].hasEvidence);
  const totalWeight = present.reduce((sum, c) => sum + c.weight, 0);
  if (totalWeight === 0) return null;

  const components: ReadinessComponent[] = present.map((c) => {
    const value = raw[c.id]!.value;
    return {
      id: c.id,
      label: c.label,
      weight: c.weight,
      value,
      contribution: value * c.weight,
      hasEvidence: true,
    };
  });

  const score = components.reduce((sum, c) => sum + c.contribution, 0) / totalWeight;
  const band = bandOf(score);

  const perceivedConfidence = initialConfidence ? PERCEIVED_CONFIDENCE[initialConfidence] ?? null : null;
  const perceivedDelta = perceivedConfidence === null ? null : score - perceivedConfidence;

  const detail: string[] = [];
  if (strongest && weakest && evidenceTopics.length > 1) {
    detail.push(`You have a strong understanding of ${strongest.label.toLowerCase()}, and your biggest opportunity is ${weakest.label.toLowerCase()}.`);
  }
  detail.push(BAND_MESSAGE[band]);

  return {
    score,
    band,
    components,
    coverage,
    masteryMean,
    evidence: attempts.length,
    topics,
    perceivedConfidence,
    perceivedDelta,
    message: detail.join(" "),
    note: "Based on your demonstrated performance. It guides your path — it is never a pass guarantee.",
  };
}