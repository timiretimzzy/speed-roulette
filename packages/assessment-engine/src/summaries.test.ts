import { describe, it, expect } from "vitest";
import { defaultConfig } from "@zivvvo/learning-engine";
import { simplePack } from "./test/fixtures";
import { buildSmartSession } from "./sessions";
import { buildSessionSummary } from "./summaries";
import type { AttemptEvent, LearningSession } from "./types";

const cfg = defaultConfig;

function attemptsFor(session: LearningSession, correct: boolean[]): AttemptEvent[] {
  return session.questions.map((q, i) => ({
    id: `a-${q.qid}`,
    learnerId: "l1",
    qid: q.qid,
    sessionId: session.id,
    mode: "smart" as const,
    selected: [0],
    isCorrect: correct[i] ?? false,
    confidence: "sure" as const,
    durationMs: 1500,
    ts: 1_000 + i,
    syncedAt: null,
  }));
}

const labelFor = (topicId: string) => {
  const t = simplePack().topics.find((x) => x.id === topicId);
  return t?.label;
};

describe("buildSessionSummary", () => {
  it("computes accuracy and minutes-of-attention from the session", () => {
    const session = buildSmartSession({ pack: simplePack(), attempts: [], seed: 1 }, cfg).session;
    const attempts = attemptsFor(session, [true, true, false, true]);
    const s = buildSessionSummary({ session, attempts, previous: attempts, config: cfg, topicLabelFor: labelFor });
    expect(s.totalCount).toBe(session.questions.length);
    expect(s.correctCount).toBe(attempts.filter((a) => a.isCorrect).length);
    expect(s.accuracy).toBeCloseTo(s.correctCount / s.totalCount);
  });

  it("does not fabricate improvement without prior evidence", () => {
    const session = buildSmartSession({ pack: simplePack(), attempts: [], seed: 1 }, cfg).session;
    const attempts = attemptsFor(session, [true, true, true, true]);
    const s = buildSessionSummary({ session, attempts, previous: [], config: cfg, topicLabelFor: labelFor });
    expect(s.improvement).toBeNull();
    expect(s.improvementReason).toBeNull();
  });

  it("reports improvement only against prior attempts on the same questions", () => {
    const pack = simplePack();
    const session = buildSmartSession({ pack, attempts: [], seed: 2 }, cfg).session;
    const attempts = attemptsFor(session, [true, true, true, true, true, true]);
    const allWrong = attempts.map((a) => ({ ...a, isCorrect: false }));
    const s = buildSessionSummary({ session, attempts, previous: allWrong, config: cfg, topicLabelFor: labelFor });
    expect(s.improvement).not.toBeNull();
    expect(s.improvementReason).toContain("+");
  });

  it("flags strengthened and still-reviewing topics", () => {
    const pack = simplePack();
    const session = buildSmartSession(
      { pack, attempts: [], seed: 3, learnerId: "l1" },
      { ...cfg, sessionSizeSmart: 6 },
    ).session;
    const attempts = [
      ...attemptsFor(session, [true, true, true, true, true, true]),
    ];
    const s = buildSessionSummary({ session, attempts, previous: [], config: cfg, topicLabelFor: labelFor });
    const mentioned = session.questions.filter((q) => q.topicId === "road-signs").length;
    if (mentioned >= 2) {
      expect(s.strengthened.some((t) => t.topicId === "road-signs")).toBe(true);
    }
    expect(s.stillReviewing.some((t) => t.topicId === "road-signs")).toBe(false);
  });

  it("keeps average answer time sensible", () => {
    const session = buildSmartSession({ pack: simplePack(), attempts: [], seed: 4 }, cfg).session;
    const attempts = attemptsFor(session, [true, true, true, true]);
    const s = buildSessionSummary({ session, attempts, previous: [], config: cfg, topicLabelFor: labelFor });
    expect(s.averageAnswerMs).toBe(1500);
  });
});