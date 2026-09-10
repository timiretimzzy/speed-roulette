/**
 * Analytics abstraction (docs/ANALYTICS.md). UI components never push events
 * directly to a backend; they call track(), which fans out to sinks.
 */
export type AnalyticsEventName =
  | "question_started"
  | "question_answered"
  | "explanation_opened"
  | "session_started"
  | "session_completed"
  | "diagnostic_started"
  | "diagnostic_completed"
  | "recommendation_generated"
  | "weakness_detected"
  | "review_completed";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  ts: number;
  learnerId: string;
  sessionId?: string | null;
  qid?: string;
  props?: Record<string, unknown>;
}

export interface AnalyticsSink {
  push(e: AnalyticsEvent): void;
}

export class ConsoleSink implements AnalyticsSink {
  push(e: AnalyticsEvent): void {
    console.debug("[analytics]", e.name, e.props ?? "");
  }
}

export class CompositeSink implements AnalyticsSink {
  constructor(public readonly sinks: AnalyticsSink[]) {}
  push(e: AnalyticsEvent): void {
    for (const s of this.sinks) {
      try {
        s.push(e);
      } catch {
        /* a sink must never break learning */
      }
    }
  }
}

export class DevNullSink implements AnalyticsSink {
  push(): void {}
}

const defaultSink: AnalyticsSink =
  typeof globalThis !== "undefined" && (globalThis as { __ZIVVVO_TEST__?: boolean }).__ZIVVVO_TEST__
    ? new DevNullSink()
    : new ConsoleSink();
let sink: AnalyticsSink = defaultSink;
export const setSink = (s: AnalyticsSink): void => {
  sink = s;
};
export const track = (e: AnalyticsEvent): void => sink.push(e);