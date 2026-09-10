import { describe, it, expect } from "vitest";
import { defaultConfig } from "@zivvvo/learning-engine";
import { simplePack } from "./test/fixtures";
import { diagnosticProfile } from "./diagnostic";
import type { AttemptEvent } from "./types";

const cfg = defaultConfig;

function attempt(qid: string, isCorrect: boolean, ts: number): AttemptEvent {
  return {
    id: `a-${qid}-${ts}`,
    learnerId: "l1",
    qid,
    sessionId: null,
    mode: "diagnostic",
    selected: [0],
    isCorrect,
    confidence: "sure",
    durationMs: 1500,
    ts,
    syncedAt: null,
  };
}

function run(attempts: AttemptEvent[]) {
  return diagnosticProfile({ pack: simplePack(), attempts, config: cfg });
}

describe("diagnosticProfile", () => {
  it("labelling requires minEvidence, otherwise limited", () => {
    const r = run([attempt("road-a", true, 0), attempt("road-b", true, 1)]);
    expect(r.strong).toEqual([]);
    expect(r.limited.some((t) => t.topicId === "road-signs")).toBe(true);
  });

  it("splits strong / developing / priority from real answers", () => {
    const attempts: AttemptEvent[] = [];
    // road-signs: 6 consistent corrects => strong
    for (let i = 0; i < 6; i++) attempts.push(attempt(`road-${"abcdef"[i]}`, true, i));
    // junction-rules: 8 attempts, 6 correct => developing (>= 0.6, < 0.8)
    for (let i = 0; i < 8; i++) attempts.push(attempt(`ju-${"abcdef"[i % 6]}`, i >= 2, 100 + i));
    // confusing-pair is mixed-kind: excluded on purpose
    const r = run(attempts);
    expect(r.strong.map((t) => t.topicId)).toContain("road-signs");
    expect(r.developing.map((t) => t.topicId)).toContain("junction-rules");
    expect(r.limited.some((t) => t.topicId === "confusing-pair")).toBe(false);
    expect(r.headline).toMatch(/strength/);
  });

  it("joins counts into a learner-facing headline", () => {
    expect(run([]).headline).toMatch(/Not enough answers yet/);
  });

  it("keeps topics out when they had no attempts", () => {
    const r = run([attempt("road-a", true, 0)]);
    const ids = [...r.strong, ...r.developing, ...r.priority, ...r.limited].map((t) => t.topicId);
    expect(ids).not.toContain("junction-rules");
  });
});