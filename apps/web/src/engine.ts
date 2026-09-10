import type { AttemptEvent, SessionResult, MockConfig } from "@zivvvo/assessment-engine";
import {
  buildDiagnostic,
  buildMockSession,
  buildQuickSession,
  buildReviewSession,
  buildSmartSession,
  buildWeaknessSession,
  ZVID_MOCK_DEFAULT,
} from "@zivvvo/assessment-engine";
import {
  DEFAULT_PRIORITIES_V2,
  defaultConfig,
  detectWeakness,
  isDue,
  masteryBy,
  getNextBestActivity,
  type LearnerState,
  type NextBestActivity,
  type PlanDay,
  type ReviewState,
} from "@zivvvo/learning-engine";
import { catalog, pack } from "./catalog";

export type { NextBestActivity };

export function learnerState(
  learnerId: string,
  attempts: AttemptEvent[],
  reviews: ReviewState[],
  diagnosticCompleted: boolean,
  extras: Partial<Pick<LearnerState, "examDate" | "lastMockAt" | "streakDays">> = {},
): LearnerState {
  return { learnerId, diagnosticCompleted, attempts, reviews, ...extras };
}

export function nextActivity(state: LearnerState): NextBestActivity {
  return getNextBestActivity({ catalog, learner: state, config: defaultConfig, priorities: DEFAULT_PRIORITIES_V2 });
}

export function sessionFor(activity: NextBestActivity, attempts: AttemptEvent[], learnerId: string): SessionResult | null {
  const ctx = {
    pack,
    attempts,
    seed: Date.now() % 2147483647,
    learnerId,
  };
  switch (activity.sessionType) {
    case "diagnostic":
      return buildDiagnostic(ctx, defaultConfig);
    case "review":
      return buildReviewSession(ctx, defaultConfig, activity.qids ?? [], (activity.dueCount ?? activity.qids?.length ?? 0));
    case "recovery":
      if (!activity.targetTopicId) return null;
      return buildWeaknessSession(ctx, defaultConfig, activity.targetTopicId);
    case "smart":
      return activity.targetTopicId
        ? buildSmartSession(ctx, defaultConfig, activity.targetTopicId)
        : buildSmartSession(ctx, defaultConfig);
    case "mock":
      return buildMockSession(ctx, defaultConfig, ZVID_MOCK_DEFAULT);
  }
}

export function topicMastery(attempts: AttemptEvent[]) {
  return masteryBy(attempts, (a) => catalog.questionTopic(a.qid) ?? "general", defaultConfig)
    .map((stat) => ({
      stat,
      topic: pack.topics.find((t) => t.id === stat.key) ?? { id: stat.key, label: stat.key, kind: "content" as const, count: 0 },
    }))
    .filter((x) => x.topic.kind === "content");
}

export function weaknesses(attempts: AttemptEvent[]): { signal: ReturnType<typeof detectWeakness>; topic: { id: string; label: string } }[] {
  const out: { signal: ReturnType<typeof detectWeakness>; topic: { id: string; label: string } }[] = [];
  for (const t of pack.topics.filter((x) => x.kind === "content")) {
    const topicAttempts = attempts.filter((a) => catalog.questionTopic(a.qid) === t.id);
    const stat = masteryBy(topicAttempts, () => t.id, defaultConfig)[0];
    if (!stat) continue;
    const signal = detectWeakness(stat, defaultConfig, Date.now());
    if (signal.kind !== "none") out.push({ signal, topic: { id: t.id, label: t.label } });
  }
  return out;
}

export function quickSession(attempts: AttemptEvent[], learnerId: string, minutes: number): SessionResult {
  return buildQuickSession({ pack, attempts, seed: Date.now() % 2147483647, learnerId }, defaultConfig, minutes);
}

export function smartTopicSession(topicId: string, attempts: AttemptEvent[], learnerId: string): SessionResult {
  return buildSmartSession(
    { pack, attempts, seed: Date.now() % 2147483647, learnerId },
    defaultConfig,
    topicId,
  );
}

export { ZVID_MOCK_DEFAULT, type MockConfig };

export function mockSession(attempts: AttemptEvent[], learnerId: string, mock: MockConfig = ZVID_MOCK_DEFAULT): SessionResult {
  return buildMockSession(
    { pack, attempts, seed: Date.now() % 2147483647, learnerId },
    defaultConfig,
    mock,
  );
}

/**
 * Builds the session the study planner has scheduled for today (planner.ts).
 * Review days reuse the actual due cards; other days build their own kind so
 * the dashboard can offer "Start today's task" with one tap.
 */
export function planDaySession(day: PlanDay, attempts: AttemptEvent[], reviews: ReviewState[], learnerId: string): SessionResult | null {
  const ctx = { pack, attempts, seed: Date.now() % 2147483647, learnerId };
  switch (day.sessionType) {
    case "mock":
      return buildMockSession(ctx, defaultConfig, ZVID_MOCK_DEFAULT);
    case "recovery":
      return day.topicId ? buildWeaknessSession(ctx, defaultConfig, day.topicId) : buildSmartSession(ctx, defaultConfig);
    case "review": {
      const due = reviews.filter((r) => isDue(r, Date.now())).map((r) => r.qid);
      if (due.length === 0) return buildSmartSession(ctx, defaultConfig, day.topicId);
      return buildReviewSession(ctx, defaultConfig, due, due.length);
    }
    case "smart":
      return buildSmartSession(ctx, defaultConfig, day.topicId);
  }
}

/** Derived signal for the recommender: when the learner last ran a mock. */
export function lastMockAt(attempts: AttemptEvent[]): number | undefined {
  const mocks = attempts.filter((a) => a.mode === "mock");
  return mocks.length ? Math.max(...mocks.map((a) => a.ts)) : undefined;
}