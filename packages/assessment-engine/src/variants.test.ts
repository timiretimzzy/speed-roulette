import { describe, it, expect } from "vitest";
import { defaultConfig } from "@zivvvo/learning-engine";
import { composeVariant, baseQidOf, variantSeed, hashString } from "./variants";
import { buildMistakeReviewSession } from "./sessions";
import { simplePack, q } from "./test/fixtures";
import type { AttemptEvent } from "./types";

const cfg = defaultConfig;

const base = q({
  qid: "base",
  topicId: "road-signs",
  options: ["Speed limit 60", "Speed limit 30", "Permit required", "No parking"],
  correct: [2],
  explanation: "Permits are required on this stretch.",
});

const siblingPool = [
  q({ qid: "sib-e", topicId: "road-signs", options: ["Two-way traffic", "Give way", "One-way street"], correct: [1], difficulty: "easy" }),
  q({ qid: "sib-s", topicId: "road-signs", options: ["End of speed limit", "No overtaking", "Dual carriageway"], correct: [2], difficulty: "standard" }),
  q({ qid: "sib-h", topicId: "road-signs", options: ["Weight restriction", "Axle load limit", "Advisory speed"], correct: [0], difficulty: "hard" }),
  q({ qid: "sib2", topicId: "road-signs", options: ["Tram crossing", "Pedestrian crossing", "School zone"], correct: [1], difficulty: "standard" }),
];

describe("composeVariant", () => {
  it("rotate keeps the canonical answer, changes the order (never the same presentation)", () => {
    for (const seed of [1, 2, 3, 42, 777]) {
      const rotated = composeVariant(base, [], seed);
      expect(rotated.variant?.mutation).toBe("rotate");
      expect(rotated.options.map((o) => o.text)).not.toEqual(base.options.map((o) => o.text));
      const answersAfter = rotated.options.filter((o) => o.isCorrect).map((o) => o.text);
      const answersBefore = base.options.filter((o) => o.isCorrect).map((o) => o.text);
      expect(answersAfter).toEqual(answersBefore);
      expect(rotated.correctIndexes).toEqual(rotated.options.map((o, i) => (o.isCorrect ? i : -1)).filter((i) => i >= 0));
    }
  });

  it("swap replaces distractors with harder sibling distractors, exact same correct answer", () => {
    const swapped = composeVariant(base, siblingPool, 7, true);
    expect(swapped.variant?.mutation).toBe("swap");
    expect(swapped.options.map((o) => o.text)).toEqual(expect.arrayContaining(["Weight restriction"]));
    expect(swapped.options[base.correctIndexes[0]!]?.text).toBe("Permit required");
    const correctText = base.options[base.correctIndexes[0]!]!.text;
    expect(swapped.options.filter((o) => o.isCorrect).map((o) => o.text)).toEqual([correctText]);
  });

  it("prefers hard distractors in hard mode and easy ones otherwise", () => {
    const hard = composeVariant(base, siblingPool, 11, true);
    const easy = composeVariant(base, siblingPool, 12, false);
    const hardTexts = hard.options.filter((o) => !o.isCorrect).map((o) => o.text);
    const easyTexts = easy.options.filter((o) => !o.isCorrect).map((o) => o.text);
    expect(hardTexts).toContain("Weight restriction");
    expect(hardTexts).toContain("Axle load limit");
    expect(easyTexts).toContain("Two-way traffic");
    expect(easyTexts).toContain("Give way");
  });

  it("swaps in fresh distractor texts, never duplicating a base one", () => {
    const swapped = composeVariant(base, siblingPool, 99, true);
    const baseDistractors = base.options.filter((o) => !o.isCorrect).map((o) => o.text);
    const fresh = swapped.options.filter((o) => !o.isCorrect).map((o) => o.text).filter((t) => !baseDistractors.includes(t));
    expect(fresh.length).toBe(2);
  });

  it("is deterministic under the same seed", () => {
    const a = composeVariant(base, siblingPool, 5);
    const b = composeVariant(base, siblingPool, 5);
    expect(a.options).toEqual(b.options);
    expect(a.variant?.mutation).toBe(b.variant?.mutation);
  });

  it("falls back to original for single-option questions", () => {
    const one = q({ qid: "one", topicId: "road-signs", options: ["Only answer"], correct: [0] });
    const v = composeVariant(one, siblingPool, 3);
    expect(v.variant?.mutation).toBe("original");
    expect(v.options.map((o) => o.text)).toEqual(["Only answer"]);
  });
});

describe("baseQidOf", () => {
  it("maps variant attempts to the base concept", () => {
    const rotated = composeVariant(base, [], 1);
    expect(baseQidOf(rotated)).toBe("base");
    expect(baseQidOf(base)).toBe("base");
  });
});

describe("variantSeed / hashString", () => {
  it("is deterministic and qid-dependent", () => {
    expect(hashString("base")).toBe(hashString("base"));
    expect(hashString("base")).not.toBe(hashString("other"));
    expect(variantSeed(42, "a")).toBe(variantSeed(42, "a"));
  });
});

describe("buildMistakeReviewSession", () => {
  const ctx = (mistakes: string[]) => ({ pack: simplePack(), attempts: [] as AttemptEvent[], seed: 42, now: 1_000_000_000_000, mistakes });

  it("produces a mistake-review session with every mistake restated (never identical)", () => {
    const { session } = buildMistakeReviewSession({ pack: simplePack(), attempts: [], seed: 42, now: 1_000_000_000_000 }, cfg, ["road-a", "road-b", "ju-a"]);
    expect(session.type).toBe("mistake-review");
    expect(session.title).toBe("Mistake Review");
    const byQid = new Map(simplePack().questions.map((qu) => [qu.qid, qu]));
    for (const question of session.questions) {
      const variant = question as VariantPick;
      const baseQuestion = byQid.get(variant.variant?.of ?? question.qid);
      expect(baseQuestion).toBeDefined();
      expect(question.options.map((o) => o.text)).not.toEqual(baseQuestion!.options.map((o) => o.text));
    }
  });

  it("respects sizeOverride and dedupes qids", () => {
    const { session } = buildMistakeReviewSession(ctx([]), cfg, ["road-a", "road-a", "road-b", "road-c"], 2);
    expect(session.questions.length).toBeLessThanOrEqual(2);
    const qids = session.questions.map((question) => (question as VariantPick).variant?.of);
    expect(new Set(qids).size).toBe(qids.length);
  });

  it("is deterministic under the same seed", () => {
    const a = buildMistakeReviewSession(ctx([]), cfg, ["road-a", "ju-a"], 10);
    const b = buildMistakeReviewSession(ctx([]), cfg, ["road-a", "ju-a"], 10);
    expect(a.session.questions[0]!.options).toEqual(b.session.questions[0]!.options);
  });
});

type VariantPick = { variant?: { of: string } };