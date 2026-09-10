import { describe, expect, it } from "vitest";
import {
  CONFIDENCE_BANDS,
  EXAM_GOALS,
  TIMELINES,
  confidenceBandLabel,
  daysUntilExam,
  firstActivityNudge,
  goalLabel,
} from "./onboarding";

describe("onboarding configuration", () => {
  it("exposes exactly one enabled goal for now", () => {
    expect(EXAM_GOALS.filter((g) => g.enabled)).toHaveLength(1);
    expect(EXAM_GOALS[0]!.enabled).toBe(true);
  });

  it("provides three escalading timeline intensities", () => {
    const minutes = TIMELINES.map((t) => t.minutesPerDay);
    expect(minutes).toEqual([10, 20, 30]);
    expect(new Set(TIMELINES.map((t) => t.id))).toEqual(new Set(["relaxed", "focused", "intense"]));
  });

  it("provides four distinct confidence bands", () => {
    expect(new Set(CONFIDENCE_BANDS.map((b) => b.id))).toEqual(
      new Set(["none", "some", "fairly", "confident"]),
    );
  });
});

describe("daysUntilExam", () => {
  it("counts whole days to the exam date", () => {
    const now = Date.UTC(2026, 8, 10);
    expect(daysUntilExam(Date.UTC(2026, 8, 20), now)).toBe(10);
  });

  it("rounds partial days up", () => {
    const now = Date.UTC(2026, 8, 10, 12);
    expect(daysUntilExam(Date.UTC(2026, 8, 12, 6), now)).toBe(2);
  });

  it("never returns a negative count after the exam date", () => {
    expect(daysUntilExam(Date.UTC(2026, 8, 1), Date.UTC(2026, 8, 10))).toBe(0);
  });
});

describe("labels", () => {
  it("maps known goal ids and falls back to the raw value", () => {
    expect(goalLabel("zvid-provisional")).toContain("Provisional");
    expect(goalLabel("other")).toBe("other");
    expect(goalLabel(undefined)).toBe("Not set");
  });

  it("maps confidence band ids to labels", () => {
    expect(confidenceBandLabel("confident")).toBe("Confident");
    expect(confidenceBandLabel(null)).toBe("Not set");
  });
});

describe("firstActivityNudge", () => {
  it("is silent once evidence exists", () => {
    expect(firstActivityNudge("some", 3)).toBeNull();
  });

  it("is silent without a band", () => {
    expect(firstActivityNudge(null, 0)).toBeNull();
  });

  it("frames the baseline as a check for confident arrivals", () => {
    expect(firstActivityNudge("confident", 0)).toMatch(/confirm/);
  });

  it("frames the baseline as a starting point for novices", () => {
    expect(firstActivityNudge("none", 0)).toMatch(/starting point/);
  });
});