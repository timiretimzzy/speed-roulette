import type { LearningConfig } from "@zivvvo/learning-engine";
import type { AttemptEvent, LearningSession } from "./types";

export interface TopicGist {
  topicId: string;
  label: string;
  correct: number;
  attempted: number;
  mentioned: boolean;
}

export interface SessionSummary {
  sessionId: string;
  type: string;
  accuracy: number;
  correctCount: number;
  totalCount: number;
  /** Compare vs the learner's prior performance on the same topics. */
  improvement: number | null;
  improvementReason: string | null;
  strengthened: TopicGist[];
  stillReviewing: TopicGist[];
  averageAnswerMs: number;
}

function topicLabel(catalogTopicFor: (topicId: string) => string | undefined, t: TopicGist): TopicGist {
  const label = catalogTopicFor(t.topicId) ?? t.topicId;
  return { ...t, label };
}

/**
 * Aggregate feedback after a session. Avoids fabricating improvement: when no
 * previous comparison data exists, improvement is null.
 */
export function buildSessionSummary(args: {
  session: LearningSession;
  attempts: AttemptEvent[];
  previous: AttemptEvent[]; // all prior attempts for the same learner
  config: LearningConfig;
  topicLabelFor: (topicId: string) => string | undefined;
}): SessionSummary {
  const { session, attempts, previous, config, topicLabelFor } = args;
  const totalCount = session.questions.length;
  const correctCount = attempts.filter((a) => a.isCorrect).length;
  const accuracy = totalCount ? correctCount / totalCount : 0;

  /* per-topic performance within this session */
  const map = new Map<string, TopicGist>();
  const questionTopic = new Map<string, string>();
  for (const q of session.questions) {
    questionTopic.set(q.qid, q.topicId);
    if (!map.has(q.topicId)) map.set(q.topicId, { topicId: q.topicId, label: q.topicId, correct: 0, attempted: 0, mentioned: false });
  }
  for (const a of attempts) {
    const t = map.get(questionTopic.get(a.qid) ?? "");
    if (t) {
      t.attempted++;
      if (a.isCorrect) t.correct++;
    }
  }
  const topics = [...map.values()];

  const strengthened = topics
    .filter((t) => t.attempted >= 2 && t.correct / t.attempted >= 0.67)
    .map((t) => topicLabel(topicLabelFor, t));
  const stillReviewing = topics
    .filter((t) => t.attempted >= 2 && t.correct / t.attempted < 0.5)
    .map((t) => topicLabel(topicLabelFor, t));

  /* improvement vs prior: same topics, evidence-gated (never fabricated) */
  const sessionTopicQids = new Set(session.questions.map((q) => q.qid));
  const priorInSameTopics = previous.filter((a) => sessionTopicQids.has(a.qid));
  let improvement: number | null = null;
  let improvementReason: string | null = null;
  if (priorInSameTopics.length >= config.minEvidence) {
    const priorAcc = priorInSameTopics.filter((a) => a.isCorrect).length / priorInSameTopics.length;
    improvement = accuracy - priorAcc;
    improvementReason =
      improvement >= 0
        ? `+${Math.round(improvement * 100)}% compared with your previous attempts on these topics.`
        : `${Math.round(improvement * 100)}% compared with your previous attempts on these topics.`;
  }

  const dur = attempts.length ? attempts.reduce((s, a) => s + a.durationMs, 0) / attempts.length : 0;

  return {
    sessionId: session.id,
    type: session.type,
    accuracy,
    correctCount,
    totalCount,
    improvement,
    improvementReason,
    strengthened,
    stillReviewing,
    averageAnswerMs: dur,
  };
}