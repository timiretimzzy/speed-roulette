import { describe, it, expect } from "vitest";
import { defaultConfig } from "@zivvvo/learning-engine";
import { simplePack } from "./test/fixtures";
import type { AttemptEvent } from "./types";
import {
  buildDiagnostic,
  buildSmartSession,
  buildWeaknessSession,
  buildReviewSession,
  buildQuickSession,
  type SessionGenContext,
} from "./sessions";

const cfg = defaultConfig;
const NOW = 1_500_000_000_000;

function ctx(over: Partial<SessionGenContext> = {}): SessionGenContext {
  return { pack: simplePack(), attempts: [], seed: 42, now: NOW, ...over };
}

function attempt(qid: string, ts: number, isCorrect = true): AttemptEvent {
  return { id: `a-${qid}-${ts}`, learnerId: "l1", qid, sessionId: null, mode: "smart", selected: [0], isCorrect, confidence: "sure", durationMs: 2000, ts, syncedAt: null };
}

describe("buildDiagnostic", () => {
  it("is deterministic for a given seed", () => {
    const a = buildDiagnostic(ctx(), cfg);
    const b = buildDiagnostic(ctx(), cfg);
    expect(a.session.questions.map((q) => q.qid)).toEqual(b.session.questions.map((q) => q.qid));
    expect(a.session.id).not.toBe(b.session.id);
  });

  it("stratifies across content topics", () => {
    const r = buildDiagnostic(ctx(), cfg);
    const topics = new Set(r.session.questions.map((q) => q.topicId));
    expect(topics.has("road-signs")).toBe(true);
    expect(topics.has("junction-rules")).toBe(true);
  });

  it("selected questions are limited to answered, keyed content", () => {
    const pack = simplePack();
    const r = buildDiagnostic(ctx({ pack }), cfg);
    for (const q of r.session.questions) {
      expect(pack.questions.find((x) => x.qid === q.qid)?.status).toBe("answered");
      expect(q.correctIndexes.length).toBeGreaterThan(0);
    }
  });

  it("avoids a question the learner just saw", () => {
    const pack = simplePack();
    const cfg8 = { ...cfg, diagnosticSize: 8 };
    const recently = pack.questions[0]!;
    const r = buildDiagnostic(
      ctx({ pack, attempts: [attempt(recently.qid, NOW - 3_600_000)], now: NOW }),
      cfg8,
    );
    expect(r.session.questions.map((q) => q.qid)).not.toContain(recently.qid);
    expect(r.session.questions.length).toBe(8);
  });
});

describe("buildSmartSession", () => {
  it("targets a topic when requested, never leaking mixed bucket", () => {
    const r = buildSmartSession(ctx(), cfg, "junction-rules");
    expect(r.session.questions.length).toBeGreaterThan(0);
    expect(r.session.questions.filter((q) => q.topicId === "junction-rules").length).toBeGreaterThanOrEqual(6);
    expect(r.session.questions.every((q) => q.topicId !== "confusing-pair")).toBe(true);
  });

  it("picks a unique set within the session", () => {
    const r = buildSmartSession(ctx(), cfg);
    const qids = r.session.questions.map((q) => q.qid);
    expect(new Set(qids).size).toBe(qids.length);
    expect(r.session.questions.length).toBeGreaterThan(0);
    expect(r.session.questions.length).toBeLessThanOrEqual(cfg.sessionSizeSmart);
  });

  it("prefers explanation-rich questions when available", () => {
    const pack = simplePack();
    const r = buildSmartSession(ctx({ pack }), cfg, "road-signs", 4);
    expect(r.session.questions.filter((q) => q.explanation).length).toBeGreaterThanOrEqual(
      r.session.questions.filter((q) => !q.explanation).length,
    );
  });
});

describe("buildWeaknessSession", () => {
  it("re-teaches just-missed questions in the weak topic", () => {
    const pack = simplePack();
    const missed = pack.questions.filter((q) => q.topicId === "junction-rules").slice(0, 2);
    const r = buildWeaknessSession(
      ctx({ pack, attempts: missed.map((q) => attempt(q.qid, NOW - 3_600_000, false)) }),
      cfg,
      "junction-rules",
    );
    expect(r.session.questions.length).toBeGreaterThan(0);
    expect(r.session.questions.every((q) => q.topicId === "junction-rules")).toBe(true);
  });

  it("uses the weakness session size", () => {
    const r = buildWeaknessSession(ctx(), cfg, "road-signs");
    expect(r.session.questions.length).toBeGreaterThan(0);
    expect(r.session.questions.length).toBeLessThanOrEqual(cfg.sessionSizeWeakness);
  });
});

describe("buildReviewSession", () => {
  it("builds from the due question ids and keeps learner context", () => {
    const pack = simplePack();
    const dueQids = pack.questions.slice(0, 3).map((q) => q.qid);
    const r = buildReviewSession(ctx({ pack, learnerId: "learner-7" }), cfg, dueQids);
    expect(r.session.learnerId).toBe("learner-7");
    expect(r.session.questions.map((q) => q.qid).sort()).toEqual([...dueQids].sort());
  });

  it("silently ignores unknown or unanswerable ids", () => {
    const r = buildReviewSession(ctx(), cfg, ["nope", "road-a"]);
    expect(r.session.questions.map((q) => q.qid)).toEqual(["road-a"]);
  });
});

describe("buildQuickSession", () => {
  it("sizes the session to minutes available", () => {
    const r = buildQuickSession(ctx(), cfg, 2);
    expect(r.session.type).toBe("quick");
    expect(r.session.questions.length).toBeGreaterThanOrEqual(3);
  });
});