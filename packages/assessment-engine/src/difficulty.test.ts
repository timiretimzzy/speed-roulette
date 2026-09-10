import { describe, it, expect } from "vitest";
import { defaultConfig } from "@zivvvo/learning-engine";
import {
  questionDifficulty,
  empiricalDifficulty,
  rampDifficulty,
  poolForDifficulty,
  difficultyOrder,
  DIFFICULTY_LABEL,
} from "./difficulty";
import { buildSmartSession } from "./sessions";
import { simplePack, q } from "./test/fixtures";
import type { AttemptEvent } from "./types";

const cfg = defaultConfig;

function attempt(qid: string, isCorrect: boolean): AttemptEvent {
  return {
    id: "a",
    learnerId: "l1",
    qid,
    sessionId: null,
    mode: "smart",
    selected: [0],
    isCorrect,
    confidence: "sure",
    durationMs: 1500,
    ts: 1_000_000_000_000,
    syncedAt: null,
  };
}

describe("questionDifficulty", () => {
  it("uses the author difficulty when present", () => {
    const h = q({ qid: "h", options: ["A", "B"], correct: [0], difficulty: "hard" });
    expect(questionDifficulty(h)).toBe("hard");
  });

  it("falls back to standard when the author gave no signal", () => {
    const u = q({ qid: "u", options: ["A", "B"], correct: [0], difficulty: null });
    expect(questionDifficulty(u)).toBe("standard");
  });

  it("orders easy < standard < hard", () => {
    expect(difficultyOrder("easy")).toBeLessThan(difficultyOrder("standard"));
    expect(difficultyOrder("standard")).toBeLessThan(difficultyOrder("hard"));
  });

  it("has labels for every tier", () => {
    expect(DIFFICULTY_LABEL.easy).toBe("Easy");
    expect(DIFFICULTY_LABEL.standard).toBe("Standard");
    expect(DIFFICULTY_LABEL.hard).toBe("Hard");
  });
});

describe("empiricalDifficulty", () => {
  it("is neutral with zero evidence", () => {
    expect(empiricalDifficulty([])).toEqual({ attempts: 0, correctRate: null, label: null });
  });

  it("reports rate but no tier until there is enough evidence", () => {
    const r = empiricalDifficulty([attempt("a", true), attempt("a", false)], 4);
    expect(r.attempts).toBe(2);
    expect(r.correctRate).toBe(0.5);
    expect(r.label).toBeNull();
  });

  it("reads 80%+ as easy, ~50% as standard, and poor rates as hard (vision: author vs actual)", () => {
    expect(empiricalDifficulty([attempt("a", true), attempt("a", true), attempt("a", true), attempt("a", true)]).label).toBe("easy");
    expect(empiricalDifficulty([attempt("a", true), attempt("a", true), attempt("a", false), attempt("a", false)]).label).toBe("standard");
    expect(empiricalDifficulty([attempt("a", true), attempt("a", false), attempt("a", false), attempt("a", false)]).label).toBe("hard");
  });
});

describe("rampDifficulty (Let's make it harder)", () => {
  it("promotes easy->standard after 3 consecutive correct", () => {
    expect(rampDifficulty("easy", 3)).toEqual({ next: "standard", promoteMessage: "Let's make it harder." });
  });

  it("promotes standard->hard after 3 consecutive correct", () => {
    expect(rampDifficulty("standard", 4)).toEqual({ next: "hard", promoteMessage: "Let's make it harder." });
  });

  it("stays at hard forever, no promote message at top", () => {
    expect(rampDifficulty("hard", 12)).toEqual({ next: "hard", promoteMessage: null });
  });

  it("does not promote while the streak is too short", () => {
    expect(rampDifficulty("easy", 2)).toEqual({ next: "easy", promoteMessage: null });
  });

  it("defaults an unknown current tier to standard", () => {
    expect(rampDifficulty(null, 1).next).toBe("standard");
  });
});

describe("poolForDifficulty", () => {
  const pack = simplePack();

  it("auto keeps everything", () => {
    expect(poolForDifficulty(pack.questions, "auto")).toHaveLength(pack.questions.length);
  });

  it("hard keeps only questions authored hard (road-b/d/f in the fixture)", () => {
    const onlyHard = poolForDifficulty(pack.questions, "hard").map((x) => x.qid);
    expect(onlyHard).toEqual(["road-b", "road-d", "road-f"]);
  });
});

describe("buildSmartSession honours difficulty", () => {
  const identicalFixture = () => ({ pack: simplePack(), attempts: [] as AttemptEvent[], seed: 42, now: 1_000_000_000_000 });

  it("auto mixes tiers", () => {
    const { session } = buildSmartSession(identicalFixture(), cfg);
    const tiers = new Set(session.questions.map((x) => questionDifficulty(x)));
    expect(tiers.size).toBeGreaterThan(1);
  });

  it("hard mode yields a session of only hard questions", () => {
    const { session } = buildSmartSession(identicalFixture(), cfg, undefined, undefined, "hard");
    expect(session.questions.length).toBeGreaterThan(0);
    for (const question of session.questions) expect(questionDifficulty(question)).toBe("hard");
  });

  it("falls back to the full pool when no questions exist at the requested tier", () => {
    const empty = { pack: simplePack({ questions: [] }), attempts: [] as AttemptEvent[], seed: 42, now: 1_000_000_000_000 };
    const { session } = buildSmartSession(empty, cfg, undefined, undefined, "hard");
    expect(session.questions).toHaveLength(0);
  });
});