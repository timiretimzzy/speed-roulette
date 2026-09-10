import { describe, it, expect } from "vitest";
import { defaultConfig } from "@zivvvo/learning-engine";
import { simplePack } from "./test/fixtures";
import {
  BAND_LABEL,
  RANK_ORDER,
  computeReadiness,
  PERCEIVED_CONFIDENCE,
} from "./readiness";
import type { AttemptEvent } from "./types";

const cfg = defaultConfig;
const NOW = 1_000_000_000_000;
const DAY = 86_400_000;

function attempt(
  qid: string,
  isCorrect: boolean,
  ts: number,
  over: Partial<AttemptEvent> = {},
): AttemptEvent {
  return {
    id: `a-${qid}-${Math.random()}`,
    learnerId: "l1",
    qid,
    sessionId: null,
    mode: "smart",
    selected: [0],
    isCorrect,
    confidence: "sure",
    durationMs: 1500,
    ts,
    syncedAt: null,
    ...over,
  };
}

function spreadAttempts(attemptSuffixes: string[], topic: string, ts: number): AttemptEvent[] {
  return attemptSuffixes.map((s) => attempt(`${topic}-${s}`, true, ts - attemptSuffixes.indexOf(s) * 1000));
}

describe("computeReadiness — gating and basics", () => {
  it("returns null until enough evidence exists", () => {
    const pack = simplePack();
    const attempts = [
      attempt("road-a", true, NOW - 1000),
      attempt("road-b", true, NOW - 900),
      attempt("ju-a", false, NOW - 800),
      attempt("ju-b", true, NOW - 700),
    ];
    expect(computeReadiness({ pack, attempts, config: cfg, now: NOW })).toBeNull();
  });

  it("returns a real readiness verdict once the evidence gate clears", () => {
    const pack = simplePack();
    const attempts = [
      ...spreadAttempts("abcdef".split(""), "road", NOW - 100 * DAY),
      ...["abcdef".split("").map((s) => attempt(`ju-${s}`, s.charCodeAt(0) % 2 === 0, NOW - 50 * DAY))] .flat(),
    ];
    const r = computeReadiness({ pack, attempts, config: cfg, now: NOW })!;
    expect(r.evidence).toBe(12);
    expect(r.score).toBeGreaterThanOrEqual(0);
    expect(r.score).toBeLessThanOrEqual(1);
    expect(RANK_ORDER).toContain(r.band);
    expect(BAND_LABEL[r.band]).toBeTruthy();
    const road = r.topics.find((t) => t.topicId === "road-signs")!;
    expect(road.answerable).toBe(6);
    expect(road.coverage).toBe(1);
  });
});

describe("computeReadiness — weighted components", () => {
  function build(rx: number, recentTs: number, over: Partial<AttemptEvent> = {}) {
    const pack = simplePack();
    const attempts: AttemptEvent[] = [];
    // 6 road + 6 junction = 12 distinct questions; rx = correct ratio
    let i = 0;
    for (const topic of ["road", "ju"]) {
      for (const s of ["a", "b", "c", "d", "e", "f"]) {
        const isCorrect = i >= Math.round(12 * (1 - rx));
        attempts.push(attempt(`${topic}-${s}`, isCorrect, recentTs - i * 60_000, over));
        i++;
      }
    }
    return { pack, attempts };
  }

  it("lists one component per evidence source with renormalised weights", () => {
    const { pack, attempts } = build(0.8, NOW - 3 * DAY);
    const r = computeReadiness({ pack, attempts, config: cfg, now: NOW })!;
    const ids = r.components.map((c) => c.id).sort();
    // no mock evidence yet -> mock-performance excluded
    expect(ids).toEqual(["confidence", "consistency", "recent-performance", "speed", "topic-mastery"].sort());
    const total = r.components.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBeCloseTo(0.8, 5); // 1.0 - 0.2 (mock) renormalised over present weights
  });

  it("includes mock performance after a completed mock run", () => {
    const { pack, attempts } = build(0.8, NOW - DAY);
    const mock = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map((s) =>
      attempt(`road-${s}`, true, NOW - 6_000, { mode: "mock", sessionId: "mock-1" }),
    );
    const r = computeReadiness({ pack, attempts: [...attempts, ...mock], config: cfg, now: NOW })!;
    const mockC = r.components.find((c) => c.id === "mock-performance")!;
    expect(mockC.hasEvidence).toBe(true);
    // full marks on a 0.6 pass mark -> 1.0
    expect(mockC.value).toBe(1);
    const total = r.components.reduce((sum, c) => sum + c.weight, 0);
    expect(total).toBeCloseTo(1, 5);
  });

  it("renormalises so a score without any mock evidence is honest but not crushed", () => {
    const { pack, attempts } = build(1, NOW - 2 * DAY);
    const r = computeReadiness({ pack, attempts, config: cfg, now: NOW })!;
    const withoutMock = r.components.filter((c) => c.id !== "mock-performance");
    expect(withoutMock.every((c) => c.hasEvidence)).toBe(true);
    expect(r.score).toBeGreaterThan(0.3);
  });

  it("feeds confidence and speed into the breakdown", () => {
    const { pack, attempts } = build(1, NOW - 2 * DAY, { durationMs: 90_000 });
    const r = computeReadiness({ pack, attempts, config: cfg, now: NOW })!;
    expect(r.components.find((c) => c.id === "confidence")!.value).toBe(1); // all "sure"
    expect(r.components.find((c) => c.id === "speed")!.value).toBe(0.3);   // median 90s
  });

  it("consistency reflects study-day coverage over the trailing window", () => {
    const pack = simplePack();
    const attempts = [
      ...spreadAttempts("abcdef".split(""), "road", NOW - 6 * DAY),
      // only ONE study day in the last 7-day window (7 days ago is outside window edge)
      ...spreadAttempts("abcdef".split(""), "ju", NOW - 3 * DAY),
    ];
    const r = computeReadiness({ pack, attempts, config: cfg, now: NOW })!;
    const cons = r.components.find((c) => c.id === "consistency")!;
    // two distinct active days within the 7-day window
    expect(cons.value).toBeCloseTo(2 / 7, 5);
  });
});

describe("computeReadiness — bands and perceived confidence", () => {
  it("ranks a high-evidence strong learner into strong or exam-ready", () => {
    const pack = simplePack();
    const attempts: AttemptEvent[] = [];
    let i = 0;
    for (const topic of ["road", "ju"]) {
      for (const s of ["a", "b", "c", "d", "e", "f"]) {
        for (let round = 0; round < 4; round++) {
          attempts.push(attempt(`${topic}-${s}`, true, NOW - i * 60_000));
          i++;
        }
      }
    }
    const r = computeReadiness({ pack, attempts, config: cfg, now: NOW })!;
    expect(r.score).toBeGreaterThan(0.7);
    expect(["strong", "exam-ready"]).toContain(r.band);
    expect(r.message).toMatch(/strong understanding/);
  });

  it("reports perceived-vs-actual delta from the onboarding confidence band", () => {
    const pack = simplePack();
    const attempts: AttemptEvent[] = [];
    for (let i = 0; i < 12; i++) attempts.push(attempt(`road-${"abcdef"[i % 6]}`, true, NOW - i * 1000));
    const r = computeReadiness({ pack, attempts, config: cfg, now: NOW, initialConfidence: "confident" })!;
    expect(r.perceivedConfidence).toBe(PERCEIVED_CONFIDENCE["confident"]);
    expect(r.perceivedDelta).toBeCloseTo(r.score - PERCEIVED_CONFIDENCE["confident"]!, 5);
  });

  it("omits the perceived delta when no onboarding band is provided", () => {
    const pack = simplePack();
    const attempts: AttemptEvent[] = [];
    for (let i = 0; i < 12; i++) attempts.push(attempt(`road-${"abcdef"[i % 6]}`, true, NOW - i * 1000));
    const r = computeReadiness({ pack, attempts, config: cfg, now: NOW })!;
    expect(r.perceivedConfidence).toBeNull();
    expect(r.perceivedDelta).toBeNull();
  });
});