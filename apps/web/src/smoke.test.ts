import { describe, expect, it } from "vitest";
import { gradeQuestion, computeReadiness } from "@zivvvo/assessment-engine";
import { defaultConfig } from "@zivvvo/learning-engine";
import { DEMO_LEARNERS, demoLearnerRecord, sealedAttemptsFor } from "./seed";
import { learnerState, nextActivity, sessionFor, smartTopicSession, topicMastery, weaknesses, quickSession, mockSession, planDaySession, lastMockAt, ZVID_MOCK_DEFAULT } from "./engine";
import { pack } from "./catalog";

/** Same question selection the store uses when seeding a demo learner. */
function seedQids(learner: (typeof DEMO_LEARNERS)[number]): { topic: string; qid: string }[] {
  const wanted = new Set([learner.strongTopic, learner.weakTopic]);
  const qids: { topic: string; qid: string }[] = [];
  for (const q of pack.questions) {
    if (q.status === "answered" && wanted.has(q.topicId)) qids.push({ topic: q.topicId, qid: q.qid });
  }
  return qids;
}

describe("demo learner flow (as the app runs it)", () => {
  const learnerA = DEMO_LEARNERS[0]!;
  const learnerB = DEMO_LEARNERS[1]!;
  const attemptsA = sealedAttemptsFor(learnerA, seedQids(learnerA));
  const attemptsB = sealedAttemptsFor(learnerB, seedQids(learnerB));

  it("seeds full records (attempts + completed diagnostic patch)", () => {
    expect(attemptsA.length).toBeGreaterThanOrEqual(100);
    expect(attemptsA.every((a) => a.learnerId === learnerA.id)).toBe(true);
    const patch = demoLearnerRecord(learnerA);
    expect(patch.id).toBe(learnerA.id);
    expect(patch.diagnosticCompleted).toBe(true);
  });

  it("leads learner A straight into a junction-rules recovery session", () => {
    // A recent mock keeps v2's mock-cadence quiet so the real signal surfaces.
    const state = learnerState(learnerA.id, attemptsA, [], true, { lastMockAt: Date.now() - 2 * 86_400_000 });
    const activity = nextActivity(state);
    expect(activity.kind).toBe("recurring-weakness");
    expect(activity.sessionType).toBe("recovery");
    expect(activity.targetTopicId).toBe("junction-rules");
    const result = sessionFor(activity, attemptsA, learnerA.id);
    expect(result).not.toBeNull();
    expect(result!.session.type).toBe("recovery");
    expect(result!.session.questions.length).toBeGreaterThan(0);
    expect(result!.session.questions.length).toBeLessThanOrEqual(defaultConfig.sessionSizeWeakness);
    expect(result!.session.questions.every((q) => q.topicId === "junction-rules")).toBe(true);
  });

  it("flags the diagnostic for a fresh learner", () => {
    const state = learnerState("new-learner", [], [], false);
    const activity = nextActivity(state);
    expect(activity.kind).toBe("diagnostic");
    const result = sessionFor(activity, [], "new-learner");
    expect(result).not.toBeNull();
    expect(result!.session.type).toBe("diagnostic");
    expect(result!.session.questions.length).toBeGreaterThan(0);
    expect(result!.session.questions.length).toBeLessThanOrEqual(defaultConfig.diagnosticSize);
  });

  it("builds smart, quick and topic sessions", () => {
    const smart = smartTopicSession("road-signs", attemptsA, learnerA.id);
    expect(smart.session.type).toBe("smart");
    expect(smart.session.questions.length).toBeGreaterThan(0);
    expect(smart.session.questions.length).toBeLessThanOrEqual(defaultConfig.sessionSizeSmart);

    const quick = quickSession(attemptsA, learnerA.id, 2);
    expect(quick.mode).toBe("quick");
    expect(quick.session.type).toBe("quick");
    expect(quick.session.questions.length).toBe(Math.max(3, Math.round(2 * defaultConfig.sessionSizeQuickPerMinute)));
  });

  it("builds the blueprint mock through the app adapter", () => {
    const mock = mockSession(attemptsA, learnerA.id);
    expect(mock.mode).toBe("mock");
    expect(mock.session.type).toBe("mock");
    expect(mock.session.questions.length).toBe(ZVID_MOCK_DEFAULT.questionCount);
    expect(mock.session.estimatedMinutes).toBe(ZVID_MOCK_DEFAULT.durationMin);
    const topics = new Set(mock.session.questions.map((q) => q.topicId));
    expect(topics.size).toBeGreaterThanOrEqual(5);
  });

  it("canonical key grades a question locally", () => {
    const q = quickSession(attemptsA, learnerA.id, 1).session.questions[0]!;
    expect(q.correctIndexes.length).toBeGreaterThan(0);
    expect(gradeQuestion(q, q.correctIndexes)).toBe(true);
    expect(gradeQuestion(q, [q.correctIndexes[0]!])).toBe(true);
    expect(gradeQuestion(q, [999])).toBe(false);
    expect(gradeQuestion(q, [])).toBe(false);
  });

  it("learner A: road-signs strong, junction-rules is the weak spot", () => {
    const rows = topicMastery(attemptsA);
    const roads = rows.find((r) => r.stat.key === "road-signs");
    const junction = rows.find((r) => r.stat.key === "junction-rules");
    expect(roads).toBeDefined();
    expect(junction).toBeDefined();
    expect(roads!.stat.status).toBe("strong");
    expect(junction!.stat.mastery).toBeLessThan(defaultConfig.developingThreshold);
    expect(roads!.stat.mastery).toBeGreaterThan(junction!.stat.mastery);
  });

  it("coach reports exactly learner A's junction-rules weakness", () => {
    const weak = weaknesses(attemptsA);
    expect(weak.length).toBe(1);
    expect(weak[0]!.topic.id).toBe("junction-rules");
    expect(weak[0]!.signal.kind).not.toBe("none");
  });

  it("learner B is the mirror image", () => {
    const rows = topicMastery(attemptsB);
    const find = (k: string) => rows.find((r) => r.stat.key === k)!;
    expect(find("junction-rules").stat.mastery).toBeGreaterThan(find("road-signs").stat.mastery);
    expect(weaknesses(attemptsB).some((w) => w.topic.id === "road-signs")).toBe(true);
  });

  it("returns a readiness verdict from attempts alone", () => {
    const r = computeReadiness({ pack, attempts: attemptsA, config: defaultConfig });
    expect(r).not.toBeNull();
    expect(r!.score).toBeGreaterThanOrEqual(0);
    expect(r!.score).toBeLessThanOrEqual(1);
    expect(["getting-started", "building", "almost-ready", "strong", "exam-ready"]).toContain(r!.band);
    for (const t of r!.topics) {
      if (t.topicId === "junction-rules" || t.topicId === "road-signs") {
        expect(t.coverage).toBeGreaterThan(0);
      }
    }
    expect(r!.note.length).toBeGreaterThan(0);
  });

  it("Home v2: planner day kinds build playable sessions", () => {
    const mockR = planDaySession({ date: Date.now(), kind: "mock", title: "Mock Exam", purpose: "", sessionType: "mock", minutes: 30 }, attemptsA, [], learnerA.id);
    expect(mockR).not.toBeNull();
    expect(mockR!.session.type).toBe("mock");
    expect(mockR!.session.questions.length).toBe(ZVID_MOCK_DEFAULT.questionCount);

    const topicR = planDaySession({ date: Date.now(), kind: "recovery", title: "Weakness Recovery", purpose: "", sessionType: "recovery", topicId: "junction-rules", minutes: 10 }, attemptsA, [], learnerA.id);
    expect(topicR).not.toBeNull();
    expect(topicR!.session.type).toBe("recovery");
    expect(topicR!.session.questions.every((q) => q.topicId === "junction-rules")).toBe(true);

    const smartR = planDaySession({ date: Date.now(), kind: "topic", title: "Road Signs", purpose: "", sessionType: "smart", topicId: "road-signs", minutes: 10 }, attemptsA, [], learnerA.id);
    expect(smartR!.session.type).toBe("smart");
  });

  it("Home v2: v2 priorities surface a mock-cadence nudge when no mock exists", () => {
    const state = learnerState(learnerA.id, attemptsA, [], true, { streakDays: 5 });
    const activity = nextActivity(state);
    expect(["mock-cadence", "exam-approaching"]).toContain(activity.kind);
    expect(activity.sessionType).toBe("mock");
    expect(lastMockAt(attemptsA)).toBeUndefined();
  });
});