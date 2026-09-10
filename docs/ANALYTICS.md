# Zivvvo — Analytics

> What we measure, why, and how — events, not vanity dashboards.

## Why this exists

Every decision in the product (readiness, mastery, content quality) must be
driven by evidence. Analytics in Zivvvo is a first-class data layer: a single
event stream that powers product dashboards AND is the same stream the device
already syncs (see `OFFLINE_STRATEGY.md`, `ASSESSMENT_ENGINE.md`).

## Core Event Taxonomy

| Event | When | Payload highlights |
|-------|------|--------------------|
| `question_answered` | submit | mode, qid, correct, confidence, durationMs |
| `explanation_viewed` | feedback shown | qid, relationViewed |
| `onboarding.completed` | journey done | goal, examTimeline, initialConfidenceBands |
| `activity_recommended` | engine choice | activityType, reason.kind |
| `mock.completed` | mock session | score, passingMark, duration |
| `content.pack_installed` | offline pack | packId, schemaVersion |
| `sync.lagged` | sync delayed | pendingCount, ageMs |
| `ai.t1.generated` | enhancement | provider, latencyMs, cacheHit |
| `ai.t1.failed` | enhancement | provider, fallbackToT0 |

All events are device-first (IndexedDB), then synced; server analytics are
derived views over the same append-only stream.

## North-Star & Guardrail Metrics

- **North star:** learners who reach a positive **readiness signal** for their
  exam date.
- Supporting: sessions/week, question attempts/week, recovery completions,
  mock readiness at exam date.
- Guardrail: no metric is ever "votes"/engagement that pushes more questions;
  healthy metrics are *readiness velocity* and *recovery*, preserving the
  "learning before testing" promise.

## Product/Performance Dashboard (planned)

Daily drill-downs: attempts by mode, confidence calibration
(confident-correct vs confident-wrong), content quality (item discrimination),
sync health.

## Status

- Event taxonomy: **Planned** (frozen with Phase 1 models — events shared with
  `AttemptEvent`).
- Instrumentation/dashboard: **Experimental** (post-launch).

## Assumptions

- Data minimisation: identifier `learnerId` used by necessity; no third-party
  tracking pixels.
- Aggregates pre-computed from the event stream rather than real-time AD HOC
  SQL.

## Future

- Item Response Theory analytics on the answered bank to replace coarse
  difficulty bands.
- Experiment framework (A/B) on content presentation.