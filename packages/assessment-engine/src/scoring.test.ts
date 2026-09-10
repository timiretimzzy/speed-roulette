import { describe, it, expect } from "vitest";
import { gradeQuestion, isAnswered } from "./scoring";
import { q } from "./test/fixtures";

const question = q({ options: ["A", "B", "C", "D"], correct: [2] });

describe("gradeQuestion", () => {
  it("accepts the single correct pick", () => {
    expect(gradeQuestion(question, [2])).toBe(true);
  });

  it("rejects an empty selection", () => {
    expect(gradeQuestion(question, [])).toBe(false);
  });

  it("rejects a wrong option", () => {
    expect(gradeQuestion(question, [0])).toBe(false);
  });

  it("rejects a correct pick mixed with a wrong extra", () => {
    expect(gradeQuestion(question, [2, 2])).toBe(true); // duplicate of the same correct index is still correct
    expect(gradeQuestion(question, [2, 0])).toBe(false);
  });

  it("accepts either alternate where the key allows multiples", () => {
    const alternates = q({ options: ["X", "Y"], correct: [0, 1] });
    expect(gradeQuestion(alternates, [0])).toBe(true);
    expect(gradeQuestion(alternates, [1])).toBe(true);
  });

  it("guards against questions without a key", () => {
    const noKey = q({ options: ["A", "B"], correct: [] });
    expect(gradeQuestion(noKey, [0])).toBe(false);
  });
});

describe("isAnswered", () => {
  it("true for answered questions with a key", () => {
    expect(isAnswered(question)).toBe(true);
  });

  it("false for skip/unanswered", () => {
    expect(isAnswered(q({ options: ["A"], correct: [0], status: "skip" }))).toBe(false);
  });
});