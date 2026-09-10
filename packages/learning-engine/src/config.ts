/**
 * Tunable learning-engine parameters.
 * Single source of truth -- these are NOT scattered as magic numbers across
 * the codebase nor across UI components. See docs/LEARNING_ENGINE.md.
 */
export interface LearningConfig {
  /** Laplace/prior smoothing constant used against evidence. */
  prior: number;
  /** Minimum attempts before a topic is assigned a directional label. */
  minEvidence: number;
  /** Number of most recent attempts used for "recent performance". */
  recentWindow: number;
  /** Max weight recent performance may pull mastery away from base accuracy. */
  recentWeightMax: number;
  /** Per-attempt growth of the recent-performance weight. */
  recentWeightPerAttempt: number;
  /** Denominator of the confidence curve: confidence = evidence/(evidence+k). */
  confidenceDenominator: number;
  /** Mastery >= this (with sufficient evidence) => "strong". */
  strongThreshold: number;
  /** Mastery >= this => "developing"; below => "needs-attention". */
  developingThreshold: number;
  /** recentAccuracy below this marks a candidate weakness. */
  recentWeakThreshold: number;
  /** Look-back window (attempts) for recurring-miss detection. */
  recurringMissWindow: number;
  /** Misanswer count within window that flags "recurring". */
  recurringMissCount: number;
  /** A performance drop at least this large into a recent window suggests deterioration. */
  deteriorationMargin: number;
  /** Weak topic untouched for this many days is "long-unreviewed". */
  weakGapDays: number;
  /** Spaced repetition interval schedule, in days. */
  reviewScheduleDays: number[];
  /** Days without a mock before another mock is recommended (§50 cadence). */
  mockGapDays: number;
  /** Within this many days of the exam, mocks get exam-pressure priority. */
  timePressureDays: number;
  /** Inactivity this long (days) triggers a gentle consistency nudge (§25). */
  consistencyGapDays: number;
  /** Default sizes for generated sessions. */
  sessionSizeSmart: number;
  sessionSizeWeakness: number;
  /** Questions per minute for a Quick Session. */
  sessionSizeQuickPerMinute: number;
  /** Number of questions in the diagnostic. */
  diagnosticSize: number;
  /** Do not re-present questions attempted within this many hours. */
  recentAvoidHours: number;
  /** Engagement (docs/PRODUCT_VISION.md §26). */
  xpCorrect: number;
  /** Extra XP when the answer was on a hard question. */
  xpHardBonus: number;
  /** Perfect (all-correct, >= 3 questions) session bonus. */
  xpPerfectSet: number;
  /** Meeting the daily goal bonus. */
  xpDailyGoal: number;
  /** Comeback bonus (streak restored after a miss). */
  xpComeback: number;
  /** Freezes earned per perfect session, capped here (§25). */
  maxFreezes: number;
  /** XP needed for the first level; levels grow triangularly. */
  xpPerLevelBase: number;
}

export const defaultConfig: LearningConfig = {
  prior: 0.5,
  minEvidence: 3,
  recentWindow: 10,
  recentWeightMax: 0.35,
  recentWeightPerAttempt: 0.06,
  confidenceDenominator: 4,
  strongThreshold: 0.8,
  developingThreshold: 0.6,
  recentWeakThreshold: 0.6,
  recurringMissWindow: 4,
  recurringMissCount: 2,
  deteriorationMargin: 0.15,
  weakGapDays: 14,
  reviewScheduleDays: [0.2, 1, 3, 7, 14, 30],
  mockGapDays: 5,
  timePressureDays: 14,
  consistencyGapDays: 2,
  sessionSizeSmart: 8,
  sessionSizeWeakness: 6,
  sessionSizeQuickPerMinute: 1.3,
  diagnosticSize: 15,
  recentAvoidHours: 4,
  xpCorrect: 10,
  xpHardBonus: 10,
  xpPerfectSet: 30,
  xpDailyGoal: 50,
  xpComeback: 25,
  maxFreezes: 2,
  xpPerLevelBase: 100,
};