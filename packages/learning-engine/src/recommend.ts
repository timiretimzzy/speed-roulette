import type { LearningConfig } from "./config";
import { computeStat, masteryBy, type AttemptLike } from "./mastery";
import { classifyPattern, detectWeakness } from "./weakness";
import type { ReviewState } from "./spaced";
import { isDue, DAY_MS } from "./spaced";

/** Content catalog accessor so this engine stays free of storage/schema. */
export interface TopicCatalog {
  orderedTopics: { id: string; label: string; kind: string }[];
  questionTopic(qid: string): string | null;
  contentTopics(): { id: string; label: string }[];
  answerableInTopic(topicId: string): string[];
}

export interface LearnerState {
  learnerId: string;
  diagnosticCompleted: boolean;
  attempts: AttemptLike[];
  reviews: ReviewState[];
  /** Goal exam date, when the learner picked one. */
  examDate?: number;
  /** When the learner last attempted a mock (for cadence, §50). */
  lastMockAt?: number;
  /** Current streak in days (engagement, informational). */
  streakDays?: number;
}

export type ActivityPriority =
  | "diagnostic"
  | "due-review"
  | "recurring-weakness"
  | "learning-path"
  | "weak-topic"
  | "general"
  | "exam-approaching"
  | "mock-cadence"
  | "consistency-lapse";

export type SessionType = "diagnostic" | "review" | "recovery" | "smart" | "mock";

export interface NextBestActivity {
  kind: ActivityPriority;
  title: string;
  reason: { kind: string; label: string };
  sessionType: SessionType;
  targetTopicId?: string;
  dueCount?: number;
  qids?: string[];
  /** Optional engine-side estimate so the UI can promise a duration. */
  estimatedMinutes?: number;
}

export const DEFAULT_PRIORITIES: ActivityPriority[] = [
  "diagnostic",
  "due-review",
  "recurring-weakness",
  "learning-path",
  "weak-topic",
  "general",
];

/**
 * Recommended v2 ordering (docs/PRODUCT_VISION.md §50): diagnostic first, then
 * exam pressure + mock cadence ahead of grinding priorities, a gentle
 * consistency nudge before the generic warm-up.
 */
export const DEFAULT_PRIORITIES_V2: ActivityPriority[] = [
  "diagnostic",
  "exam-approaching",
  "mock-cadence",
  "due-review",
  "recurring-weakness",
  "learning-path",
  "weak-topic",
  "consistency-lapse",
  "general",
];

export type NowFn = () => number;
export const systemNow: NowFn = () => Date.now();

export interface RecommendContext {
  catalog: TopicCatalog;
  learner: LearnerState;
  config: LearningConfig;
  priorities?: ActivityPriority[];
  now?: number;
}

/**
 * The Next Best Activity engine. Deterministic given inputs; every decision
 * carries an explainable reason. Priority order is configurable.
 */
export function getNextBestActivity(ctx: RecommendContext): NextBestActivity {
  const cfg = ctx.config;
  const now = ctx.now ?? systemNow();
  const priorities = ctx.priorities ?? DEFAULT_PRIORITIES;

  for (const p of priorities) {
    const hit = dispatchPriority(p, ctx, cfg, now);
    if (hit) return hit;
  }

  return {
    kind: "general",
    title: "Smart Practice",
    reason: { kind: "warmup", label: "A short mixed session keeps your knowledge fresh." },
    sessionType: "smart",
  };
}

function dispatchPriority(
  p: ActivityPriority,
  ctx: RecommendContext,
  cfg: LearningConfig,
  now: number,
): NextBestActivity | null {
  switch (p) {
    case "diagnostic": {
      if (!ctx.learner.diagnosticCompleted) {
        return {
          kind: "diagnostic",
          title: "Take your diagnostic",
          reason: { kind: "no-baseline", label: "We do not know your starting point yet. A quick check will shape everything else." },
          sessionType: "diagnostic",
          estimatedMinutes: smartMinutes(ctx, cfg),
        };
      }
      return null;
    }
    case "exam-approaching": {
      if (ctx.learner.examDate && hasEvidence(ctx.learner)) {
        const daysToExam = (ctx.learner.examDate - now) / DAY_MS;
        if (daysToExam > 0 && daysToExam <= cfg.timePressureDays) {
          return {
            kind: "exam-approaching",
            title: "Practice Like It's the Real Exam",
            reason: {
              kind: "time-pressure",
              label: `${Math.ceil(daysToExam)} day${Math.ceil(daysToExam) === 1 ? "" : "s"} to your exam — a timed mock keeps exam pressure honest.`,
            },
            sessionType: "mock",
            estimatedMinutes: 30,
          };
        }
      }
      return null;
    }
    case "mock-cadence": {
      if (hasEvidence(ctx.learner)) {
        const gap = ctx.learner.lastMockAt ? (now - ctx.learner.lastMockAt) / DAY_MS : cfg.mockGapDays;
        if (gap >= cfg.mockGapDays) {
          return {
            kind: "mock-cadence",
            title: "Take a Mock Exam",
            reason: {
              kind: "mock-due",
              label: ctx.learner.lastMockAt
                ? `Your last mock was ${Math.max(1, Math.round(gap))} days ago. A timed mock keeps your score honest.`
                : "You've never taken a mock. It calibrates your readiness better than anything else.",
            },
            sessionType: "mock",
            estimatedMinutes: 30,
          };
        }
      }
      return null;
    }
    case "due-review": {
      const due = ctx.learner.reviews.filter((r) => isDue(r, now));
      if (due.length > 0) {
        const weak = weaknessTopics(ctx, cfg, now);
        const target = due.find((r) => weak.has(ctx.catalog.questionTopic(r.qid) ?? ""));
        const topicId = ctx.catalog.questionTopic((target?.qid ?? due[due.length - 1]!.qid) ?? due[0]!.qid) ?? undefined;
        return {
          kind: "due-review",
          title: "Review what's due",
          reason: {
            kind: "spaced-review",
            label: `${due.length} question${due.length > 1 ? "s" : ""} are due for review${target ? " in a weak topic" : ""}.`,
          },
          sessionType: "review",
          targetTopicId: topicId,
          dueCount: due.length,
          qids: due.map((r) => r.qid),
          estimatedMinutes: smartMinutes(ctx, cfg),
        };
      }
      return null;
    }
    case "recurring-weakness": {
      for (const t of ctx.catalog.contentTopics()) {
        const topicAttempts = ctx.learner.attempts.filter((a) => ctx.catalog.questionTopic(a.qid) === t.id);
        const stat = mastery(topicAttempts, t.id, cfg);
        const pattern = classifyPattern(topicAttempts, cfg);
        const signal = detectWeakness(stat, cfg, now);
        if (stat.evidence >= cfg.minEvidence && (pattern.kind === "recurring" || signal.kind !== "none" && stat.mastery < cfg.developingThreshold)) {
          return {
            kind: "recurring-weakness",
            title: `Strengthen ${t.label.replace(/ & /g, " ")}`,
            reason: {
              kind: pattern.kind,
              label: `You've missed several questions in ${t.label} recently. Let's fix this concept.`,
            },
            sessionType: "recovery",
            targetTopicId: t.id,
            estimatedMinutes: smartMinutes(ctx, cfg),
          };
        }
      }
      return null;
    }
    case "learning-path": {
      for (const t of ctx.catalog.contentTopics()) {
        const seen = new Set(ctx.learner.attempts.filter((a) => ctx.catalog.questionTopic(a.qid) === t.id).map((a) => a.qid));
        const pool = ctx.catalog.answerableInTopic(t.id).filter((qid) => !seen.has(qid));
        if (pool.length > 0) {
          return {
            kind: "learning-path",
            title: `Continue ${t.label.replace(/ & /g, " ")}`,
            reason: { kind: "new-material", label: `There is new material in ${t.label} you have not practised yet.` },
            sessionType: "smart",
            targetTopicId: t.id,
            estimatedMinutes: smartMinutes(ctx, cfg),
          };
        }
      }
      return null;
    }
    case "weak-topic": {
      const stats = topicStats(ctx, cfg).filter((s) => s.evidence >= cfg.minEvidence).sort((a, b) => a.mastery - b.mastery);
      const weak = stats[0];
      if (weak && weak.mastery < cfg.developingThreshold) {
        const t = ctx.catalog.contentTopics().find((x) => x.id === weak.key);
        return {
          kind: "weak-topic",
          title: `Practise ${(t?.label ?? weak.key).replace(/ & /g, " ")}`,
          reason: { kind: "low-accuracy", label: `This topic needs attention${t ? ` (${(t.label).replace(/ & /g, " ")} at ${Math.round(weak.accuracy * 100)}%)` : ""}.` },
          sessionType: "smart",
          targetTopicId: weak.key,
          estimatedMinutes: smartMinutes(ctx, cfg),
        };
      }
      return null;
    }
    case "consistency-lapse": {
      if (hasEvidence(ctx.learner)) {
        const lastStudyAt = Math.max(...ctx.learner.attempts.map((a) => a.ts), 0);
        const away = (now - lastStudyAt) / DAY_MS;
        if (away >= cfg.consistencyGapDays) {
          return {
            kind: "consistency-lapse",
            title: "Welcome Back",
            reason: {
              kind: "comeback",
              label: `You've been away ${Math.max(1, Math.round(away))} day${Math.max(1, Math.round(away)) === 1 ? "" : "s"}. One quick session keeps your rhythm alive — no guilt.`,
            },
            sessionType: "smart",
            estimatedMinutes: smartMinutes(ctx, cfg),
          };
        }
      }
      return null;
    }
    case "general":
      return {
        kind: "general",
        title: "Smart Practice",
        reason: { kind: "warmup", label: "A short mixed session keeps your knowledge fresh." },
        sessionType: "smart",
        estimatedMinutes: smartMinutes(ctx, cfg),
      };
  }
}

/** Rough minutes for a smart-size session at the engine's per-minute rate. */
function smartMinutes(_ctx: RecommendContext, cfg: LearningConfig): number {
  return Math.max(3, Math.round(cfg.sessionSizeSmart / cfg.sessionSizeQuickPerMinute));
}

function hasEvidence(learner: LearnerState): boolean {
  return learner.attempts.length > 0;
}

function topicStats(ctx: RecommendContext, cfg: LearningConfig) {
  return masteryBy(ctx.learner.attempts, (a) => ctx.catalog.questionTopic(a.qid) ?? "general", cfg);
}

function mastery(attempts: AttemptLike[], key: string, cfg: LearningConfig) {
  return computeStat(attempts, key, cfg);
}

function weaknessTopics(ctx: RecommendContext, cfg: LearningConfig, now: number): Set<string> {
  const set = new Set<string>();
  for (const t of ctx.catalog.contentTopics()) {
    const topicAttempts = ctx.learner.attempts.filter((a) => ctx.catalog.questionTopic(a.qid) === t.id);
    const stat = mastery(topicAttempts, t.id, cfg);
    if (stat.evidence >= cfg.minEvidence && stat.mastery < cfg.developingThreshold) set.add(t.id);
    else if (detectWeakness(stat, cfg, now).kind !== "none") set.add(t.id);
  }
  return set;
}