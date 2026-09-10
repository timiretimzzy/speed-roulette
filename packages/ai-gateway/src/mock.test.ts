import { describe, it, expect } from "vitest";
import { MockAIService, norm } from "./mock";

const ai = new MockAIService();

describe("norm", () => {
  it("lowercases, strips punctuation and collapses spaces", () => {
    expect(norm("  You MUST  Stop,  NOW! ")).toBe("you must stop now");
    expect(norm("Give way to traffic")).toBe(norm("Give-way to traffic"));
  });
});

describe("MockAIService.score", () => {
  it("scores empty answers as 0 conservatively", async () => {
    const r = await ai.score({ questionStem: "q", canonical: null, userAnswer: "  " });
    expect(r.score).toBe(0);
    expect(r.usedFallback).toBe(true);
  });

  it("exact canonical match scores 1 with canonical=true", async () => {
    const r = await ai.score({ questionStem: "When must you stop?", canonical: "You must stop", userAnswer: "You must stop" });
    expect(r.score).toBe(1);
    expect(r.scoreCanonical).toBe(true);
    expect(r.usedFallback).toBe(false);
  });

  it("matches an accepted rule phrasing despite wording differences", async () => {
    const r = await ai.score({
      questionStem: "When may you proceed?",
      canonical: null,
      userAnswer: "You must give way to the vehicle to your right",
      context: { rules: ["Give way to the vehicle to your right"] },
    });
    expect(r.score).toBe(1);
    expect(r.usedFallback).toBe(true);
  });

  it("falls back to 0 and flags for review when nothing matches", async () => {
    const r = await ai.score({ questionStem: "q", canonical: "Blue", userAnswer: "Red" });
    expect(r.score).toBe(0);
    expect(r.reason).toContain("review");
  });
});

describe("MockAIService.explain", () => {
  it("explains via the canonical key when options carry it", async () => {
    const r = await ai.explain({ questionStem: "q", options: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }], userAnswer: null });
    expect(r.source).toBe("canonical");
  });

  it("generates a graceful default when no key exists", async () => {
    const r = await ai.explain({ questionStem: "q", options: [{ text: "a", isCorrect: false }], userAnswer: null });
    expect(r.source).toBe("generated");
  });
});