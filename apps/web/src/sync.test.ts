import { beforeEach, describe, expect, it } from "vitest";
import type { AttemptEvent } from "@zivvvo/assessment-engine";
import { DEFAULT_SNAPSHOT, SyncManager, attemptToRow, getDeviceId, useSync, type SyncBackend, type SyncHost } from "./sync";

const att = (id: string, overrides: Partial<AttemptEvent> = {}): AttemptEvent => ({
  id,
  learnerId: "L1",
  qid: "q1",
  sessionId: null,
  mode: "smart",
  selected: [0],
  isCorrect: true,
  confidence: "sure",
  durationMs: 1200,
  ts: 100,
  syncedAt: null,
  ...overrides,
});

const fakeHost = (pending: AttemptEvent[]): SyncHost & { marked: string[] } => {
  const marked: string[] = [];
  return {
    marked,
    async readPending() {
      return pending;
    },
    async markSynced(ids) {
      marked.push(...ids);
    },
  };
};

const fakeBackend = (configured = true): SyncBackend & { pushed: string[] } => {
  const pushed: string[] = [];
  return {
    pushed,
    async configured() {
      return configured;
    },
    async push(r: { attempt_id: string }[]) {
      pushed.push(...r.map((x) => x.attempt_id));
    },
  };
};

beforeEach(() => {
  useSync.setState({ ...DEFAULT_SNAPSHOT });
});

describe("attemptToRow", () => {
  it("maps the attempt spine onto snake_case server columns", () => {
    const row = attemptToRow(att("att_1", { mode: "mock", selected: [2], durationMs: 900 }), "dev-1");
    expect(row).toEqual({
      attempt_id: "att_1",
      device_id: "dev-1",
      learner_id: "L1",
      qid: "q1",
      session_id: null,
      mode: "mock",
      selected: [2],
      is_correct: true,
      confidence: "sure",
      duration_ms: 900,
      ts: 100,
      synced_at: null,
    });
  });
});

describe("getDeviceId", () => {
  it("is stable across calls and non-empty", () => {
    const a = getDeviceId();
    const b = getDeviceId();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });
});

describe("SyncManager.sync", () => {
  it("pushes pending rows via the backend, then marks them synced", async () => {
    const host = fakeHost([att("att_1"), att("att_2")]);
    const backend = fakeBackend();
    const manager = new SyncManager(host, backend);

    const snap = await manager.sync("dev-1");

    expect(backend.pushed).toEqual(["att_1", "att_2"]);
    expect(host.marked).toEqual(["att_1", "att_2"]);
    expect(snap).toMatchObject({ configured: true, state: "idle", pending: 0 });
    expect(snap.lastRun).toBeTypeOf("number");
  });

  it("pushes nothing and stays idle when there are no pending attempts", async () => {
    const host = fakeHost([]);
    const backend = fakeBackend();
    const manager = new SyncManager(host, backend);

    const snap = await manager.sync("dev-1");

    expect(backend.pushed).toEqual([]);
    expect(host.marked).toEqual([]);
    expect(snap.state).toBe("idle");
    expect(snap.pending).toBe(0);
  });

  it("surfaces backend errors and does not mark anything synced", async () => {
    const host = fakeHost([att("att_1")]);
    const backend: SyncBackend = {
      async configured() {
        return true;
      },
      async push() {
        throw new Error("network down");
      },
    };
    const manager = new SyncManager(host, backend);

    const snap = await manager.sync("dev-1");

    expect(host.marked).toEqual([]);
    expect(snap.state).toBe("error");
    expect(snap.lastError).toBe("network down");
    expect(snap.pending).toBe(1);
  });

  it("reports configured:false when no backend is wired and never pushes", async () => {
    const host = fakeHost([att("att_1")]);
    const backend = fakeBackend(false);
    const manager = new SyncManager(host, backend);

    const snap = await manager.sync("dev-1");

    expect(snap.configured).toBe(false);
    expect(backend.pushed).toEqual([]);
    expect(host.marked).toEqual([]);
  });

  it("exposes the pending snapshot through the zustand store", async () => {
    const host = fakeHost([att("att_1")]);
    const manager = new SyncManager(host, fakeBackend());

    await manager.refreshPending();

    const s = useSync.getState();
    expect(s.pending).toBe(1);
    expect(s.configured).toBe(true);
  });
});