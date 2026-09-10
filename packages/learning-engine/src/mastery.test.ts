import { describe, it, expect } from "vitest";
import { defaultConfig } from "./config";
import { computeStat, masteryBy, type AttemptLike } from "./mastery";

const cfg = defaultConfig;

function attempt(qid: string, isCorrect: boolean, ts: number, confidence = "sure"): AttemptLike {
  return { qid, isCorrect, mode: "smart", confidence, ts };
}

describe("computeStat", () => {
  it("starts limited with zero evidence", () => {
    const s = computeStat([], "road-signs", cfg);
    expect(s.evidence).toBe(0);
    expect(s.status).toBe("limited");
    expect(s.mastery).toBe(0);
  });

  it("labels strong after a consistent run", () => {
    const s = computeStat([0, 1, 2].map((t) => attempt("q1", true, t * 1000)), "road-signs", cfg);
    expect(s.evidence).toBe(3);
    expect(s.mastery).toBeGreaterThanOrEqual(cfg.strongThreshold);
    expect(s.status).toBe("strong");
  });

  it("labels needs-attention after repeated misses", () => {
    const s = computeStat(
      [0, 1, 2, 3, 4].map((t) => attempt("q1", t % 2 === 0, t * 1000)),
      "junction-rules",
      cfg,
    );
    expect(s.mastery).toBeLessThan(cfg.developingThreshold);
    expect(s.status).toBe("needs-attention");
  });

  it("requires minEvidence before directional labels", () => {
    const one = attempt("q1", true, 0);
    const s = computeStat([one], "road-signs", cfg);
    expect(s.evidence).toBeLessThan(cfg.minEvidence);
    expect(s.status).toBe("limited");
  });

  it("nudges mastery toward recent performance", () => {
    const oldGood = [0, 1, 2, 3, 4, 5, 6, 7].map((t) => attempt("q1", true, t * 1000));
    const recentBad = [8, 9, 10, 11, 12, 13].map((t) => attempt("q1", false, t * 1000));
    const s = computeStat([...oldGood, ...recentBad], "road-signs", cfg);
    expect(s.recentAccuracy).toBe(0.4);
    expect(s.mastery).toBeLessThan(s.accuracy);
  });

  it("grows confidence with evidence, bounded below 1", () => {
    const low = computeStat([attempt("q1", true, 0)], "road-signs", cfg);
    const high = computeStat([0, 1, 2, 3, 4, 5, 6, 7].map((t) => attempt("q1", true, t)), "road-signs", cfg);
    expect(high.confidence).toBeGreaterThan(low.confidence);
    expect(high.confidence).toBeLessThan(1);
  });
});

describe("masteryBy", () => {
  it("groups and sorts by key", () => {
    const rows = [
      attempt("a", true, 0),
      attempt("b", true, 1),
      attempt("a", false, 2),
    ];
    const stats = masteryBy(rows, (a) => a.qid, cfg);
    expect(stats.map((s) => s.key)).toEqual(["a", "b"]);
    expect(stats.find((s) => s.key === "a")!.evidence).toBe(2);
  });
});