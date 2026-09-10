import { describe, it, expect } from "vitest";
import { defaultConfig } from "./config";
import { buildPlan, planCursor, PLAN_DAY_MS, type PlanInput, type PlanTopic } from "./planner";

const NOW = 1_500_000_000_000;

function input(over: Partial<PlanInput> = {}): PlanInput {
  const topics: PlanTopic[] = [
    { id: "road-signs", label: "Road Signs", mastery: 0.85, evidence: 6 },
    { id: "junction-rules", label: "Junction Rules", mastery: 0.4, evidence: 6 },
    { id: "regulations", label: "Regulations", mastery: 0.3, evidence: 3 },
  ];
  return {
    examDate: NOW + 14 * PLAN_DAY_MS,
    dailyMinutes: 15,
    today: NOW,
    topics,
    config: defaultConfig,
    ...over,
  };
}

describe("buildPlan", () => {
  it("ends every plan with Mock then Final Mock", () => {
    const plan = buildPlan(input());
    expect(plan.days[plan.days.length - 2]!.kind).toBe("mock");
    expect(plan.days[plan.days.length - 1]!.kind).toBe("final-mock");
  });

  it("spans the days between today and the exam", () => {
    const plan = buildPlan(input({ examDate: NOW + 14 * PLAN_DAY_MS }));
    expect(plan.days.length).toBe(14);
    expect(plan.days[0]!.date).toBe(NOW);
    expect(plan.days[13]!.date).toBe(NOW + 13 * PLAN_DAY_MS);
    expect(plan.dailyVolume).toBeGreaterThanOrEqual(3);
  });

  it("adapts: strong topics are skipped from the intro pass", () => {
    const plan = buildPlan(input());
    const taught = plan.days.filter((d) => d.kind === "topic").map((d) => d.topicId);
    expect(taught).not.toContain("road-signs");
    expect(taught).toContain("junction-rules");
    expect(taught).toContain("regulations");
  });

  it("is deterministic", () => {
    expect(buildPlan(input())).toEqual(buildPlan(input()));
  });

  it("compresses: an exam tomorrow is Mock + Final Mock only", () => {
    const plan = buildPlan(input({ examDate: NOW + PLAN_DAY_MS, topics: [] }));
    expect(plan.days.map((d) => d.kind)).toEqual(["mock", "final-mock"]);
  });

  it("adds a warmup day when there is room, sized by cadence", () => {
    const plan = buildPlan(input());
    expect(plan.days[0]!.kind).toBe("warmup");
    expect(plan.days[0]!.sessionType).toBe("smart");
    expect(plan.days[0]!.minutes).toBe(15);
  });

  it("prefers recovery days for the weakest topic before mixed practice", () => {
    const plan = buildPlan(input({ examDate: NOW + 40 * PLAN_DAY_MS }));
    const recoveries = plan.days.filter((d) => d.kind === "recovery").map((d) => d.topicId);
    expect(recoveries[0]).toBe("regulations");
    expect(recoveries).toContain("junction-rules");
    expect(plan.days.some((d) => d.kind === "review")).toBe(true);
    expect(plan.days.some((d) => d.kind === "mixed")).toBe(true);
  });
});

describe("planCursor", () => {
  const plan = buildPlan(input({ examDate: NOW + 14 * PLAN_DAY_MS }));

  it("returns today's day and the days remaining", () => {
    const c = planCursor(plan, NOW + 3 * PLAN_DAY_MS);
    expect(c.index).toBe(3);
    expect(c.daysRemaining).toBe(10);
    expect(c.day.date).toBe(NOW + 3 * PLAN_DAY_MS);
    expect(c.finished).toBe(false);
  });

  it("clamps past the end to the final day, finished", () => {
    const c = planCursor(plan, NOW + 99 * PLAN_DAY_MS);
    expect(c.index).toBe(plan.days.length - 1);
    expect(c.day.kind).toBe("final-mock");
    expect(c.finished).toBe(true);
  });
});
