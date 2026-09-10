import { describe, it, expect } from "vitest";
import { defaultConfig } from "./config";
import {
  initialEngagementState,
  reduceEngagement,
  levelInfo,
  xpForLevel,
  dayOfEpoch,
  DAILY_GOAL_PRESETS,
  type EngagementState,
} from "./engagement";

const cfg = defaultConfig;
const now = 1_500_000_000_000;

it("answering a standard question correctly awards the base XP", () => {
  const s = reduceEngagement(initialEngagementState(), { type: "answer", correct: true, hard: false, day: dayOfEpoch(now) }, cfg);
  expect(s.xp).toBe(cfg.xpCorrect);
});

it("rewards the hard-question bonus on top", () => {
  const s = reduceEngagement(initialEngagementState(), { type: "answer", correct: true, hard: true, day: dayOfEpoch(now) }, cfg);
  expect(s.xp).toBe(cfg.xpCorrect + cfg.xpHardBonus);
});

it("gives nothing for a miss but still counts the day", () => {
  const day = dayOfEpoch(now);
  const s = reduceEngagement(initialEngagementState(), { type: "answer", correct: false, hard: false, day }, cfg);
  expect(s.xp).toBe(0);
  expect(s.distinctActiveDays).toBe(1);
  expect(s.streakDays).toBe(1);
});

describe("streaks", () => {
  it("extends the streak on a consecutive day", () => {
    const d0 = dayOfEpoch(now);
    let s: EngagementState = initialEngagementState();
    s = reduceEngagement(s, { type: "answer", correct: true, hard: false, day: d0 }, cfg);
    s = reduceEngagement(s, { type: "answer", correct: true, hard: false, day: d0 + 1 }, cfg);
    expect(s.streakDays).toBe(2);
  });

  it("spends a freeze on a single missed day and awards comeback XP", () => {
    const d0 = dayOfEpoch(now);
    let s: EngagementState = initialEngagementState();
    s = reduceEngagement(s, { type: "answer", correct: true, hard: false, day: d0 }, cfg);
    s = { ...s, freezeAvailable: 1 };
    const xpBefore = s.xp;
    s = reduceEngagement(s, { type: "answer", correct: true, hard: false, day: d0 + 2 }, cfg);
    expect(s.streakDays).toBe(2);
    expect(s.freezeAvailable).toBe(0);
    expect(s.freezesUsed).toBe(1);
    expect(s.xp).toBe(xpBefore + cfg.xpCorrect + cfg.xpComeback);
  });

  it("resets the streak after a two-day gap (no freeze magic either)", () => {
    const d0 = dayOfEpoch(now);
    let s: EngagementState = initialEngagementState();
    s = reduceEngagement(s, { type: "answer", correct: true, hard: false, day: d0 }, cfg);
    s = reduceEngagement(s, { type: "answer", correct: true, hard: false, day: d0 + 3 }, cfg);
    expect(s.streakDays).toBe(1);
  });

  it("keeps the best streak remembered after a reset", () => {
    const d0 = dayOfEpoch(now);
    let s: EngagementState = initialEngagementState();
    for (const d of [d0, d0 + 1, d0 + 2, d0 + 5]) {
      s = reduceEngagement(s, { type: "answer", correct: true, hard: false, day: d }, cfg);
    }
    expect(s.streakDays).toBe(1);
    expect(s.bestStreakDays).toBe(3);
  });
});

describe("perfect sessions & freezes", () => {
  it("a perfect session earns the bonus plus a freeze, capped at maxFreezes", () => {
    const day = dayOfEpoch(now);
    let s: EngagementState = initialEngagementState();
    for (let i = 0; i < 3; i++) {
      s = reduceEngagement(s, { type: "session", perfect: true, questionCount: 5, day }, cfg);
    }
    expect(s.xp).toBe(3 * cfg.xpPerfectSet);
    expect(s.freezeAvailable).toBe(cfg.maxFreezes);
    expect(s.perfectSessions).toBe(3);
  });

  it("imperfect or tiny sessions earn nothing and no freeze", () => {
    const day = dayOfEpoch(now);
    const s = reduceEngagement(initialEngagementState(), { type: "session", perfect: false, questionCount: 5, day }, cfg);
    expect(s.xp).toBe(0);
  });
});

describe("daily goals", () => {
  it("award the goal bonus and count the day", () => {
    let s: EngagementState = initialEngagementState(15);
    s = reduceEngagement(s, { type: "daily-goal", day: dayOfEpoch(now) }, cfg);
    expect(s.xp).toBe(cfg.xpDailyGoal);
    expect(s.dailyGoalCompletedDays).toBe(1);
  });

  it("set-goal changes the chosen cadence", () => {
    const s = reduceEngagement(initialEngagementState(), { type: "set-goal", minutes: 5 }, cfg);
    expect(s.dailyGoalMin).toBe(5);
  });

  it("exposes the three vision presets", () => {
    expect(DAILY_GOAL_PRESETS.map((p) => p.id)).toEqual(["casual", "serious", "locked-in"]);
  });
});

describe("levels", () => {
  it("starts at level 0 (Learner) with no xp", () => {
    const lvl = levelInfo(0, cfg);
    expect(lvl.level).toBe(0);
    expect(lvl.label).toBe("Learner");
    expect(lvl.progress).toBe(0);
  });

  it("grows triangularly and reports threshold + progress", () => {
    const atLevel1 = xpForLevel(1, cfg.xpPerLevelBase);
    expect(atLevel1).toBe(100);
    const lvl = levelInfo(atLevel1, cfg);
    expect(lvl.level).toBe(1);
    expect(lvl.threshold).toBe(atLevel1);
    expect(lvl.progress).toBe(0);
    const half = levelInfo(atLevel1 + 100, cfg);
    expect(half.level).toBe(1);
    expect(half.progress).toBeCloseTo(0.5);
  });
});