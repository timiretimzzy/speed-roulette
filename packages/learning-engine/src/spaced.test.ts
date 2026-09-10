import { describe, it, expect } from "vitest";
import { defaultConfig } from "./config";
import { applyAnswer, isDue, DAY_MS, type ReviewState } from "./spaced";

const cfg = defaultConfig;
const NOW = 1_000_000_000_000;
const clock = { now: () => NOW };

const baseState: ReviewState = {
  qid: "q1",
  learnerId: "l1",
  stage: 0,
  last: NOW,
  next: NOW,
  lapseCount: 0,
};

describe("applyAnswer", () => {
  it("creates a fresh card on first answer", () => {
    expect(applyAnswer(null, "l1", { isCorrect: true, confidence: "sure" }, cfg, clock).stage).toBe(1);
  });

  it("a mistake resets to stage 0 and counts a lapse", () => {
    const s = applyAnswer(baseState, "l1", { isCorrect: false, confidence: "sure" }, cfg, clock);
    expect(s.stage).toBe(0);
    expect(s.lapseCount).toBe(1);
    expect(s.next).toBe(NOW + cfg.reviewScheduleDays[0]! * DAY_MS);
  });

  it("a sure success advances the schedule", () => {
    const s = applyAnswer(baseState, "l1", { isCorrect: true, confidence: "sure" }, cfg, clock);
    expect(s.stage).toBe(1);
    expect(s.next).toBe(NOW + cfg.reviewScheduleDays[1]! * DAY_MS);
  });

  it("unsure or guess success does not advance the stage", () => {
    const atStage3: ReviewState = { ...baseState, stage: 3 };
    const unsure = applyAnswer(atStage3, "l1", { isCorrect: true, confidence: "unsure" }, cfg, clock);
    const guess = applyAnswer(atStage3, "l1", { isCorrect: true, confidence: "guess" }, cfg, clock);
    expect(unsure.stage).toBe(3);
    expect(guess.stage).toBe(3);
    expect(unsure.next).toBe(NOW + cfg.reviewScheduleDays[3]! * DAY_MS);
  });

  it("clamps the schedule beyond its last entry", () => {
    const last = cfg.reviewScheduleDays.length - 1;
    const deep: ReviewState = { ...baseState, stage: last + 5 };
    const s = applyAnswer(deep, "l1", { isCorrect: true, confidence: "sure" }, cfg, clock);
    expect(s.next).toBe(NOW + cfg.reviewScheduleDays[last]! * DAY_MS);
  });

  it("a corrected mistake after mature card never skips the lapse", () => {
    const mature: ReviewState = { ...baseState, stage: 5, lapseCount: 0 };
    const s = applyAnswer(mature, "l1", { isCorrect: false, confidence: "sure" }, cfg, clock);
    expect(s.stage).toBe(0);
    expect(s.lapseCount).toBe(1);
  });
});

describe("isDue", () => {
  it("is due once next is in the past", () => {
    expect(isDue({ ...baseState, next: NOW - 1 }, NOW)).toBe(true);
    expect(isDue({ ...baseState, next: NOW + 1 }, NOW)).toBe(false);
  });
});