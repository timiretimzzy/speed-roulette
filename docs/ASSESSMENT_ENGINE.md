# Zivvvo — Assessment Engine

> How attempts, scoring, confidence, mocks, and readiness signals are produced.

## Why this exists

Every screen a learner sees is driven by an assessment signal — correctness,
confidence, readiness. Without a single assessment authority, scoring rules
would splinter across the UI and mock mode would drift from practice mode.

## Responsibilities

1. **Record attempts** as durable, timestamped events (offline-safe).
2. **Score** each question with an explicit `correct` verdict from the
   canonical answer key (never AI, never guesswork).
3. **Capture confidence** — a lightweight 3-point self-report ("sure / not
   sure / guessing") used by the learning engine.
4. **Run simulations** — mock examination mode with real blueprint rules
   (question counts, duration, passing mark, randomisation) driven by the
   `Exam` configuration.
5. **Emit readiness signals** — how ready is this learner for the real test
   (progress and confidence, versus naive "you answered N questions").

## Attempt Event Model

```ts
interface AttemptEvent {
  id: string;
  learnerId: string;
  qid: string;
  examId: string;
  mode: 'learn' | 'practice' | 'mock' | 'review';
  selectedOptionIndexes: number[];
  isCorrect: boolean;                 // from canonical key
  confidence: 'sure' | 'unsure' | 'guess';
  durationMs: number;
  ts: number;                         // device time (could be offline)
  syncedAt?: number;                  // set when pushed to Supabase
}
```

The same event feeds analytics, the learning engine, and offline sync.

## Sessions (implemented in `packages/assessment-engine`)

Sessions are deterministic question sets built from a seeded sampler
(`mulberry32`), so a given seed yields the same session for the same learner
state — reproducible and testable.

| Builder | What it produces |
|---------|------------------|
| `buildDiagnostic` | A small broad-coverage probe across content topics to establish a baseline. |
| `buildSmartSession(ctx, cfg, topicId?)` | Adaptive practice — weak questions first, then new material; mixed or single-topic. |
| `buildWeaknessSession(ctx, cfg, topicId)` | Recovery session targeting a detected weak topic (`avoidRecent = false`). |
| `buildReviewSession(ctx, cfg, qids, count)` | Due spaced-repetition cards. |
| `buildQuickSession(ctx, cfg, minutes)` | Timed quick round (`minutes`), recent-avoid enabled. |
| `buildMistakeReviewSession(ctx, cfg, mistakenQids, size?, preferHard?)` | Mistakes restated as variants — never the same presentation twice (see Variants below). Mode `review`, so attempts map to the base concept. |
| `buildMockSession(ctx, cfg, mock)` | Blueprint-driven mock exam. `mock.ts` defines `MockConfig` (`questionCount`, `durationMin`, `passMark`, `topicMix`), the `ZVID_MOCK_DEFAULT` blueprint (30q / 30 min / 60% — Experimental), and `mockScore(attempts, mock)` giving total/correct/score/passed. Balanced per-topic sampling with `avoidRecent = false` for full coverage; estimated duration overridden to the blueprint's `durationMin`. |
| `buildDynamicMock(ctx, cfg, mock)` | Dynamic mocks (§21): `standard` (balanced simulation), `personalized` (per-topic weights ordered by low topic accuracy via `topicWeights`), `nightmare` (S2 hard tier first, topped up from standard). All modes avoid recently-seen questions. |
| `mockReview(attempts, pack, passMark)` | Post-mock breakdown (§22): score verdict + per-topic bars (`pct`) + a single `biggestRisk` (missed count, codified `concepts`, "You missed N questions…" message) to drive the Fix-this-weakness CTA. |

`mock` is already a first-class `LearningMode`, so mock attempts flow through the same `AttemptEvent` spine and mastery model.

Sampling rules: the **pool** is answered questions with at least one correct
answer recorded; the **content pool** additionally excludes mixed buckets
(e.g. `confusing-pair`) so teachable sessions only draw from real content
topics. The sampler avoids questions seen recently (window/mood-graded by
`config.recentAvoidHours`) unless the session type overrides that.

`buildSmartSession` takes an optional trailing `difficultyMode`
(`"auto" | "easy" | "standard" | "hard"`, default `"auto"`) that restricts
the pool to a tier; falls back to the full pool when a tier is empty.

## Mistake review variants (PRODUCT_VISION §17 — "never the same question")

Composed at runtime (no content changes needed), deterministic per
`(sessionSeed, qid)`:

- `rotate` — same stem/options, different option order (recomputes
  `correctIndexes`); always guaranteed to differ for multi-option questions.
- `swap` — same stem, up to two distractors replaced with **prefer-hard**
  distractors drawn from sibling questions in the same topic (author
  difficulty ranks hardness until empirical data takes over).
- `original` — last-resort copy for degenerate (e.g. one-option) questions.

Variants carry `variant.of = baseQid`; attempts recorded on a variant must
use `baseQidOf(q)` so mastery lands on the concept, not a phantom id.
`buildMistakeReviewSession` dedupes qids, respects `sizeOverride`, seeds
per-question via `variantSeed`/`hashString`.

## Difficulty system (PRODUCT_VISION §49)

- `questionDifficulty(q)` — author difficulty, `standard` fallback.
- `empiricalDifficulty(attemptsForQid, minEvidence = 4)` — how learners
  *actually* perform: reports `correctRate` immediately, but a tier
  (`easy ≥ 80% / standard ≥ 50% / hard else`) only after enough evidence so
  author difficulty stays the signal until real data earns the upgrade.
- `rampDifficulty(current, correctStreak)` — after 3 consecutive correct at a
  tier, promote one notch (`easy → standard → hard`) with the vision's
  "Let's make it harder." prompt; never demotes, never promotes past `hard`.
- `poolForDifficulty(questions, mode)` — tier filter used by session builders.

## Scoring & Readiness

- `gradeQuestion(...)` — correct iff the selection is non-empty and every
  selected index is in the question's `correctIndexes` (multi-accept
  alternates are handled).
- `summarizeResults(...)` — accuracy, counts, and duration for a run.
- `computeReadiness(...)` — the vision-weighted readiness score
  (PRODUCT_VISION §19): `topic mastery 30% / recent performance 20% /
  mock performance 20% / consistency 10% / response confidence 10% / speed
  10%`, renormalised over components that have evidence (an un-taken mock
  exam does not crush a beginner's score). Returns `score`, a five-band
  verdict (`getting-started / building / almost-ready / strong / exam-ready`),
  per-component breakdown, per-topic detail, a personalised message
  (strongest topic + biggest opportunity), and — when the onboarding
  confidence band is supplied — a **perceived-vs-actual delta**
  (`score − self-assessment`). Null until enough evidence exists.
  Markers: `BAND_LABEL`, `BAND_TONE`, `PERCEIVED_CONFIDENCE`.

## Event Sink

Assessment events flow to a configurable sink. The default is console output;
tests set `(globalThis as any).__ZIVVVO_TEST__` to use a null sink. No
`process.env` dependence keeps the engine pure browser-first.

## Status

- Attempt model, scoring, sessions (incl. blueprint-driven mock + pass/fail),
  readiness v2 (weighted, five-band, perceived-vs-actual), diagnostic, and the
  difficulty system (author + empirical + ramp):
  **Implemented** in `packages/assessment-engine`, covered by Vitest tests.
- Verified values for the mock blueprint (count/pass mark vs the real exam
  spec): **Experimental** — played via `ZVID_MOCK_DEFAULT`, tunable data.

## Assumptions

- Scores are stored as events, not overwritten states — history is the source
  of truth; derived scores can always be recomputed.
- Device clock may be behind/ahead; sync resolves by event id and server
  timestamp.

## Future

- Adaptively terminate a mock early by readiness confidence (only when
  statistically defensible).
- Group/class leaderboards and off-device analytics dashboards from the same
  event stream.