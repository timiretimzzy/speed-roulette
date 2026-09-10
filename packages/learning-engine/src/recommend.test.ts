import { describe, it, expect } from "vitest";
import { defaultConfig } from "./config";
import { getNextBestActivity, DEFAULT_PRIORITIES_V2, type TopicCatalog, type LearnerState } from "./recommend";
import type { ReviewState } from "./spaced";
import type { AttemptLike } from "./mastery";

const cfg = defaultConfig;
const NOW = 1_000_000_000_000;
const DAY = 86_400_000;

const QID_TOPIC: Record<string, string> = {
  "road-1": "road-signs",
  "road-2": "road-signs",
  "road-3": "road-signs",
  "ju-1": "junction-rules",
  "ju-2": "junction-rules",
  "ju-3": "junction-rules",
};

const catalog: TopicCatalog = {
  orderedTopics: [
    { id: "road-signs", label: "Road Signs", kind: "content" },
    { id: "junction-rules", label: "Junction & Rules", kind: "content" },
  ],
  questionTopic: (qid: string) => QID_TOPIC[qid] ?? null,
  contentTopics: () => catalog.orderedTopics.filter((t) => t.kind === "content"),
  answerableInTopic: (topicId: string) =>
    topicId === "road-signs" ? ["road-1", "road-2", "road-3"] : ["ju-1", "ju-2", "ju-3"],
};

function learner(over: Partial<LearnerState> = {}): LearnerState {
  return {
    learnerId: "l1",
    diagnosticCompleted: false,
    attempts: [],
    reviews: [],
    ...over,
  };
}

function attempt(qid: string, isCorrect: boolean, ts: number): AttemptLike {
  return { qid, isCorrect, mode: "smart", confidence: "sure", ts };
}

function dueReview(qid: string): ReviewState {
  return { qid, learnerId: "l1", stage: 1, last: NOW - DAY, next: NOW - 1, lapseCount: 0 };
}

describe("getNextBestActivity", () => {
  it("forces the diagnostic before anything else", () => {
    const r = getNextBestActivity({ catalog, learner: learner(), config: cfg, now: NOW });
    expect(r.kind).toBe("diagnostic");
    expect(r.sessionType).toBe("diagnostic");
  });

  it("schedules incomplete topics on the learning path next", () => {
    const r = getNextBestActivity({
      catalog,
      learner: learner({ diagnosticCompleted: true }),
      config: cfg,
      now: NOW,
    });
    expect(r.kind).toBe("learning-path");
    expect(r.targetTopicId).toBeTruthy();
  });

  it("prioritises due reviews over fresh practice", () => {
    const r = getNextBestActivity({
      catalog,
      learner: learner({
        diagnosticCompleted: true,
        reviews: [dueReview("road-1")],
        attempts: [attempt("road-1", false, NOW - DAY)],
      }),
      config: cfg,
      now: NOW,
    });
    expect(r.kind).toBe("due-review");
    expect(r.sessionType).toBe("review");
    expect(r.dueCount).toBe(1);
    expect(r.qids).toEqual(["road-1"]);
  });

  it("ignores reviews that are not yet due", () => {
    const future: ReviewState = { ...dueReview("road-1"), next: NOW + DAY };
    const r = getNextBestActivity({
      catalog,
      learner: learner({ diagnosticCompleted: true, reviews: [future] }),
      config: cfg,
      now: NOW,
    });
    expect(r.kind).toBe("learning-path");
  });

  it("escalates a recurring weak topic to a recovery session", () => {
    const attempts: AttemptLike[] = [];
    for (let i = 0; i < 10; i++) {
      attempts.push(attempt("ju-" + ((i % 3) + 1), i >= 6, NOW - (10 - i) * 3_600_000));
    }
    const r = getNextBestActivity({
      catalog,
      learner: learner({ diagnosticCompleted: true, attempts }),
      config: cfg,
      now: NOW,
    });
    expect(r.kind).toBe("recurring-weakness");
    expect(r.sessionType).toBe("recovery");
  });

  it("falls back to general practice when everything is strong", () => {
    const attempts: AttemptLike[] = [];
    for (let i = 0; i < 8; i++) {
      attempts.push(attempt("road-" + ((i % 3) + 1), true, NOW - (20 - i) * 3_600_000));
      attempts.push(attempt("ju-" + ((i % 3) + 1), true, NOW - (20 - i) * 3_600_000));
    }
    const r = getNextBestActivity({
      catalog,
      learner: learner({ diagnosticCompleted: true, attempts }),
      config: cfg,
      now: NOW,
    });
    expect(r.kind).toBe("general");
    expect(r.sessionType).toBe("smart");
  });
});

describe("getNextBestActivity v2 (DEFAULT_PRIORITIES_V2)", () => {
  const v2 = { catalog, config: cfg, now: NOW, priorities: DEFAULT_PRIORITIES_V2 };
  const coversAllTopics = () => [
    attempt("road-1", true, NOW - DAY),
    attempt("road-2", true, NOW - DAY),
    attempt("road-3", true, NOW - DAY),
    attempt("ju-1", true, NOW - DAY),
    attempt("ju-2", true, NOW - DAY),
    attempt("ju-3", true, NOW - DAY),
  ];

  it("still forces the diagnostic first", () => {
    const r = getNextBestActivity({ ...v2, learner: learner() });
    expect(r.kind).toBe("diagnostic");
  });

  it("surfaces exam pressure when the exam is near", () => {
    const r = getNextBestActivity({
      ...v2,
      learner: learner({ diagnosticCompleted: true, examDate: NOW + 7 * DAY, attempts: coversAllTopics() }),
    });
    expect(r.kind).toBe("exam-approaching");
    expect(r.sessionType).toBe("mock");
    expect(r.reason.kind).toBe("time-pressure");
  });

  it("does not fire exam pressure when no goal date is set", () => {
    const r = getNextBestActivity({
      ...v2,
      learner: learner({ diagnosticCompleted: true, attempts: coversAllTopics(), lastMockAt: NOW - DAY }),
    });
    expect(r.kind).not.toBe("exam-approaching");
  });

  it("recommends a mock by cadence when the last one is stale (never taken)", () => {
    const r = getNextBestActivity({
      ...v2,
      learner: learner({ diagnosticCompleted: true, attempts: coversAllTopics() }),
    });
    expect(r.kind).toBe("mock-cadence");
    expect(r.reason.kind).toBe("mock-due");
    expect(r.estimatedMinutes).toBeGreaterThan(0);
  });

  it("holds off on a cadence mock right after one was taken", () => {
    const r = getNextBestActivity({
      ...v2,
      learner: learner({ diagnosticCompleted: true, attempts: coversAllTopics(), lastMockAt: NOW - DAY }),
    });
    expect(r.kind).not.toBe("mock-cadence");
    expect(r.sessionType).not.toBe("mock");
  });

  it("greets a lapsed learner with a gentle comeback session", () => {
    const r = getNextBestActivity({
      ...v2,
      learner: learner({
        diagnosticCompleted: true,
        lastMockAt: NOW - DAY,
        attempts: coversAllTopics().map((a) => ({ ...a, ts: NOW - 4 * DAY })),
      }),
    });
    expect(r.kind).toBe("consistency-lapse");
    expect(r.reason.kind).toBe("comeback");
    expect(r.reason.label).toMatch(/no guilt/);
  });

  it("keeps active, covered learners on the general warm-up", () => {
    const r = getNextBestActivity({
      ...v2,
      learner: learner({ diagnosticCompleted: true, lastMockAt: NOW - DAY, attempts: coversAllTopics() }),
    });
    expect(r.kind).toBe("general");
  });
});