import type { LearningConfig } from "./config";
import { DAY_MS } from "./spaced";

/**
 * ENGAGEMENT ENGINE (docs/PRODUCT_VISION.md §24–26).
 *
 * Lightweight, PURE, and self-contained: XP that rewards doing the hard thing
 * (not sitting in easy mode), streaks that encourage *coming back* without
 * guilt ("One quick session keeps it alive"), streak freezes earned through
 * activity rather than bought, daily-goal presets, and levels.
 *
 * Deliberately separate from mastery/readiness: XP is engagement,
 * readiness is value (§26). The app persists one `EngagementState`; the
 * reducer stays deterministic and testable.
 */

export const DAILY_GOAL_PRESETS: { id: "casual" | "serious" | "locked-in"; minutes: number }[] = [
  { id: "casual", minutes: 5 },
  { id: "serious", minutes: 15 },
  { id: "locked-in", minutes: 30 },
];

export interface EngagementState {
  xp: number;
  streakDays: number;
  bestStreakDays: number;
  freezeAvailable: number;
  dailyGoalMin: number;
  /** Day-of-epoch (UTC) of the most recent activity. */
  lastActiveDay: number | null;
  distinctActiveDays: number;
  perfectSessions: number;
  freezesEarned: number;
  freezesUsed: number;
  dailyGoalCompletedDays: number;
}

export type EngagementEvent =
  | { type: "answer"; correct: boolean; hard: boolean; day: number }
  | { type: "session"; perfect: boolean; questionCount: number; day: number }
  | { type: "daily-goal"; day: number }
  | { type: "use-freeze" }
  | { type: "set-goal"; minutes: number };

export function initialEngagementState(dailyGoalMin = DAILY_GOAL_PRESETS[1]!.minutes): EngagementState {
  return {
    xp: 0,
    streakDays: 0,
    bestStreakDays: 0,
    freezeAvailable: 0,
    dailyGoalMin,
    lastActiveDay: null,
    distinctActiveDays: 0,
    perfectSessions: 0,
    freezesEarned: 0,
    freezesUsed: 0,
    dailyGoalCompletedDays: 0,
  };
}

/** UTC day index (seconds since epoch / day length), good enough for streak math. */
export function dayOfEpoch(ts: number): number {
  return Math.floor(ts / DAY_MS);
}

/**
 * Advance engagement by one event. Streak rules: activity exactly one day
 * after the last → streak continues; activity with one missed day and a
 * freeze available → the freeze is spent and the streak survives (comeback,
 * +XP); any larger gap → streak resets to 1. No event on the same day changes
 * the streak.
 */
export function reduceEngagement(state: EngagementState, event: EngagementEvent, cfg: LearningConfig): EngagementState {
  switch (event.type) {
    case "answer": {
      const gain = event.correct ? cfg.xpCorrect + (event.hard ? cfg.xpHardBonus : 0) : 0;
      return applyDay(state, event.day, gain, 0, cfg);
    }
    case "session": {
      const perfect = event.perfect && event.questionCount >= 3;
      let next = withPerfect(applyDay(state, event.day, 0, perfect ? cfg.xpPerfectSet : 0, cfg), perfect);
      if (perfect && next.freezeAvailable < cfg.maxFreezes) {
        next = { ...next, freezeAvailable: next.freezeAvailable + 1, freezesEarned: next.freezesEarned + 1 };
      }
      return next;
    }
    case "daily-goal":
      return { ...state, xp: state.xp + cfg.xpDailyGoal, dailyGoalCompletedDays: state.dailyGoalCompletedDays + 1 };
    case "use-freeze":
      return state.freezeAvailable > 0
        ? { ...state, freezeAvailable: state.freezeAvailable - 1, freezesUsed: state.freezesUsed + 1 }
        : state;
    case "set-goal":
      return { ...state, dailyGoalMin: event.minutes };
  }
}

/** Streak/day bookkeeping for an event on `day`, then XP award. */
function applyDay(state: EngagementState, day: number, xpGain: number, bonusXp: number, cfg: LearningConfig): EngagementState {
  let { streakDays, bestStreakDays, freezeAvailable, freezesUsed, ...rest } = state;

  if (state.lastActiveDay === null) {
    streakDays = 1;
  } else if (day === state.lastActiveDay) {
    // same day: no streak change
  } else if (day === state.lastActiveDay + 1) {
    streakDays += 1;
  } else if (day === state.lastActiveDay + 2 && freezeAvailable > 0) {
    // exactly one missed day: spend a freeze (comeback)
    streakDays += 1;
    freezeAvailable -= 1;
    freezesUsed += 1;
    xpGain += cfg.xpComeback;
  } else {
    streakDays = 1;
  }

  bestStreakDays = Math.max(bestStreakDays, streakDays);
  const distinctActiveDays = state.distinctActiveDays + (day === state.lastActiveDay ? 0 : 1);
  return { ...rest, lastActiveDay: day, streakDays, bestStreakDays, freezeAvailable, freezesUsed, distinctActiveDays, xp: state.xp + xpGain + bonusXp };
}

function withPerfect(s: EngagementState, perfect: boolean): EngagementState {
  return perfect ? { ...s, perfectSessions: s.perfectSessions + 1 } : s;
}

export interface Level {
  level: number;
  label: string;
  /** Total XP needed to reach this level (cumulative). */
  threshold: number;
  /** Progress within the current level, 0..1. */
  progress: number;
}

export const LEVEL_LABELS = [
  "Learner",
  "Practitioner",
  "Road-Ready",
  "Examiner-Proof",
  "Master",
];

/** Triangular level curve: level k needs k * base cumulative XP. */
export function xpForLevel(level: number, base: number): number {
  return base * (level * (level + 1)) / 2;
}

export function levelInfo(xp: number, cfg: LearningConfig): Level {
  let level = 0;
  while (xpForLevel(level + 1, cfg.xpPerLevelBase) <= xp) level += 1;
  const threshold = xpForLevel(level, cfg.xpPerLevelBase);
  const nextThreshold = xpForLevel(level + 1, cfg.xpPerLevelBase);
  const progress = nextThreshold > threshold ? (xp - threshold) / (nextThreshold - threshold) : 1;
  return {
    level,
    label: LEVEL_LABELS[level] ?? `Level ${level}`,
    threshold,
    progress: Math.min(1, progress),
  };
}