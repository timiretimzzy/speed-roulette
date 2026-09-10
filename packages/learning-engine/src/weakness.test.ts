import { describe, it, expect } from "vitest";
import { defaultConfig } from "./config";
import { computeStat, type AttemptLike } from "./mastery";
import { detectWeakness, classifyPattern } from "./weakness";
import { DAY_MS } from "./spaced";

const cfg = defaultConfig;
const NOW = 2_000_000_000_000;

function attempt(isCorrect: boolean, ts: number): AttemptLike {
  return { qid: "q1", isCorrect, mode: "smart", confidence: "sure", ts };
}

function statFor(correct: boolean[], start: number, step = 1_000): ReturnType<typeof computeStat> {
  const attempts = correct.map((c, i) => attempt(c, start + i * step));
  return computeStat(attempts, "road-signs", cfg);
}

describe("detectWeakness", () => {
  it("reports none while evidence is too thin to judge", () => {
    const s = detectWeakness(statFor([true, false], 0), cfg, NOW);
    expect(s.kind).toBe("none");
    expect(s.reasons.length).toBeGreaterThan(0);
  });

  it("is silent about a mastered topic", () => {
    const s = detectWeakness(statFor([true, true, true, true], 0), cfg, NOW);
    expect(s.kind).toBe("none");
  });

  it("flags weak-but-recently-reviewed as early", () => {
    const start = NOW - 5 * 3_600_000;
    const s = detectWeakness(statFor([true, false, false, false, false], start, 3_600_000), cfg, NOW);
    expect(["early", "recurring", "deteriorating"]).toContain(s.kind);
    expect(s.reasons[0]).toMatch(/Accuracy on this topic/);
  });

  it("flags weak-and-stale topics as long-unreviewed", () => {
    const start = NOW - 30 * DAY_MS;
    const s = detectWeakness(statFor([true, false, false, false], start, 3_600_000), cfg, NOW);
    expect(s.kind).toBe("long-unreviewed");
    expect(s.reasons.some((r) => r.includes("days"))).toBe(true);
  });
});

describe("classifyPattern", () => {
  it("detects a recurring miss pattern within the window", () => {
    const attempts = [
      attempt(true, 0),
      attempt(true, 1),
      attempt(true, 2),
      attempt(false, 3),
      attempt(false, 4),
    ];
    const p = classifyPattern(attempts, cfg);
    expect(p.kind).toBe("recurring");
  });

  it("does not flag a recovering streak", () => {
    const attempts = [
      attempt(true, 0),
      attempt(false, 1),
      attempt(true, 2),
      attempt(true, 3),
      attempt(true, 4),
    ];
    expect(classifyPattern(attempts, cfg).kind).toBe("none");
  });

  it("requires evidence before claiming recurrence", () => {
    const attempts = [attempt(false, 0), attempt(false, 1)];
    expect(classifyPattern(attempts, cfg).kind).toBe("none");
  });

  it("does not treat a single slip in many as a pattern", () => {
    const attempts = Array.from({ length: 10 }, (_, i) => attempt(i === 5 ? false : true, i));
    expect(classifyPattern(attempts, cfg).kind).toBe("none");
  });
});