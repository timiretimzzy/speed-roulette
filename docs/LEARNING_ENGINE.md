# Zivvvo — Learning Engine

> The adaptive core: what the learner should do next.

## Why this exists

Zivvvo's differentiator is that it adapts — content, order, and messaging. The
Learning Engine is the deterministic, testable core that decides what a
learner should do next based on their model of mastery. It is the subject to
get right before anything else.

## Responsibilities

1. Hold a learner **Mastery Model** (per concept per learner).
2. Score each answer and fold it into mastery (with the Assessment engine).
3. Recommend the **next best activity** — a question, a concept to reread, or a
   readiness verdict.
4. Detect **recovery needs** when a learner answers confidently Wrong (an
   "A-Ha, actually it's B" moment).
5. Compute **readiness** for the real examination.

## Core Interface (implemented)

`packages/learning-engine` exposes:

- `getNextBestActivity(ctx)` — the Next Best Activity engine. Deterministic
  given inputs; every decision carries an explainable reason. Returns
  `{ kind, title, reason, sessionType, targetTopicId?, dueCount?, qids? }`.
- `masteryBy(attempts, keyFor, config)` — per-topic/per-concept mastery stats.
- `computeStat(attempts, key, config)` — the raw evidence/accuracy/mastery
  statistic behind the above.
- `spaced`: `initialReview`, `nextReview`, `applyAnswer` (fold an attempt into
  a schedule), `isDue(r, now)`, `dueCount`.
- `weakness`: `classifyPattern` (recurring / improving / cold /
  long-unreviewed / deteriorating) and `detectWeakness(stat, config, now)`.

The engine is a **reducer** over attempt events — it has no storage or
schema knowledge; the caller supplies a `TopicCatalog` and `LearnerState`.

## Mastery Model

- Per `(learner, key)` — topics today (`contentTopics()`), concepts later — a
  numeric belief plus evidence, updated on every attempt.
- **Statistic:** `accuracy = correct / attempts`, `mastery = prior + recent`
  where `prior = 0.5`, `recent` a recency-weighted component capped at 0.35
  (0.06 per attempt over a window of 10), `evidence = attempts`, and
  `confidence = n / (n + 4)`.
- **Bands:** `strong ≥ 0.8`, `developing ≥ 0.6`, below that `starting`;
  `minEvidence = 3` before a topic is called weak.
- **Mistakes are valuable data.** A confident-but-wrong answer is the most
  valuable signal in the system — it drives recovery, not shame.
- **Spaced repetition schedule (days):** `[0.2, 1, 3, 7, 14, 30]`. Recording a
  wrong answer resets to stage 0 (and counts a lapse); a sure-correct answer
  advances; correct-but-unsure/guessing holds at `max(1, stage)`.
- If a learner answers "sure" and still gets it wrong, that is a recoverable
  misconception — surfaced through `detectWeakness` and recovery sessions.

## Recommendation Priority

`DEFAULT_PRIORITIES` (configurable per call, deterministic order):

1. `diagnostic` — no baseline yet → diagnostic session.
2. `due-review` — spaced-repetition cards due now (weak topics pulled first).
3. `recurring-weakness` — evidence-backed weakness pattern → recovery session.
4. `learning-path` — unseen material in the next content topics.
5. `weak-topic` — lowest-accuracy topic below the developing threshold.
6. `general` — warm-up smart session fallback.

Every activity carries a learner-facing `reason.label`, so the UI always says
*why* this session is next.

### v2 signals (DEFAULT_PRIORITIES_V2, docs/PRODUCT_VISION.md §50)

`getNextBestActivity` now also speaks time-pressure, mock cadence, and
consistency — the engine that powers the Home "next" + mock scheduling:

- `exam-approaching` — goal exam date within `timePressureDays` (14) →
  a timed mock: *"N days to your exam — a timed mock keeps exam pressure
  honest."*
- `mock-cadence` — evidence exists and no mock in `mockGapDays` (5) →
  a mock, with countdown reasoning.
- `consistency-lapse` — no attempts for `consistencyGapDays` (2) and nothing
  stronger pending → a gentle, no-guilt comeback session (§25).
- Every activity now carries `estimatedMinutes` so the UI can promise a
  duration; `SessionType` gained `mock` (the app builds it through
  `buildMockSession`/`buildDynamicMock`).

Ordering: diagnostic → exam-approaching → mock-cadence → due-review →
recurring-weakness → learning-path → weak-topic → consistency-lapse → general.

## Engagement engine (PRODUCT_VISION §24–26)

Pure reducers in `packages/learning-engine/src/engagement.ts` — XP is
engagement, readiness is value:

- `reduceEngagement(state, event, cfg)` — deterministic. Events: `answer`
  (correct +10, hard +10 bonus), `session` (perfect, ≥3 questions: +30 and one
  streak freeze earned up to `maxFreezes`), `daily-goal` (+50), `use-freeze`,
  `set-goal`.
- **Streaks** (§25): activity exactly one day later extends the streak; one
  missed day can be covered by a spent freeze (with a +25 comeback bonus); any
  bigger gap resets to 1. Same-day repeats never change the streak. Best
  streak is remembered.
- **Daily-goal presets** (§24): `DAILY_GOAL_PRESETS` → casual 5 / serious 15 /
  locked-in 30 minutes.
- **Levels** (§26): `levelInfo(xp)` with a triangular curve
  (`xpForLevel(k) = base·k(k+1)/2`, base 100) and level labels
  (Learner → Practitioner → Road-Ready → Examiner-Proof → Master).

One `EngagementState` per learner is persisted app-side; the reducer has no
I/O, so every rule above is unit-tested.

## Study Planner (PRODUCT_VISION §51)

`buildPlan(...)` turns the learner's goal date + cadence into a day-by-day
plan: Warm Up → per-topic introductions → Weakness Recovery (weakest first) →
Review/Mixed fillers → Mock → Final Mock. It **adapts**: topics already strong
(≥ `strongThreshold`, with evidence) are skipped from the intro pass and the
freed slots become recovery, review, or mixed practice. Pure and
deterministic per input. `planCursor(plan, now)` reports where the learner is
today (`index`, `daysRemaining`, `finished`); `PlanDay.minutes` carries the
cadence from onboarding and `sessionType` tells Home which builder to call.

## Status

- Core mastery, spaced repetition, weakness detection, and recommendations:
  **Implemented** in `packages/learning-engine`, covered by Vitest tests.
- Study planner (adaptive, goal-date-backed): **Implemented**
  (`buildPlan`/`planCursor`); Home integration lands with S8.
- Per-concept (rather than per-topic) mastery and data-learned schedule
  parameters: **Experimental** (later).

## Assumptions

- A single adaptive path per learner is enough early on.
- Mastery can be derived from answer attempts + confidence; no implicit
  reading-time signals required for the first version.

## Future

- Forgetting curves and scheduling parameters learned from aggregate usage.
- Cross-exam transfer of provable concepts (e.g. road rules shared between
  licence categories).
- Coach-style narrative messages driven by the same engine output.