import type { ContentPack } from "@zivvvo/content";
import { computeStat, type LearningConfig, type MasteryStatus } from "@zivvvo/learning-engine";
import type { AttemptEvent } from "./types";

export interface DiagnosticTopic {
  topicId: string;
  label: string;
  status: MasteryStatus;
  mastery: number;
  accuracy: number;
  evidence: number;
}

export interface DiagnosticProfile {
  strong: DiagnosticTopic[];
  developing: DiagnosticTopic[];
  /** Below the developing threshold => needs the most work. */
  priority: DiagnosticTopic[];
  /** Evidence too thin to label yet. */
  limited: DiagnosticTopic[];
  headline: string;
}

/**
 * STEP 4 -- Diagnostic knowledge profile, shown right after assessment.
 * Only labels topics once there is enough evidence (minEvidence); anything
 * thinner is surfaced as "limited" rather than guessed at.
 */
export function diagnosticProfile(args: {
  pack: ContentPack;
  attempts: AttemptEvent[];
  config: LearningConfig;
}): DiagnosticProfile {
  const { pack, attempts, config } = args;
  const topicOfQid = new Map(pack.questions.map((q) => [q.qid, q.topicId]));
  const stats = pack.topics
    .filter((t) => t.kind === "content")
    .map((t) => {
      const topicAttempts = attempts.filter((a) => topicOfQid.get(a.qid) === t.id);
      const stat = computeStat(topicAttempts, t.id, config);
      return { topic: t, stat };
    })
    .filter(({ stat }) => stat.evidence > 0);

  const strong: DiagnosticTopic[] = [];
  const developing: DiagnosticTopic[] = [];
  const priority: DiagnosticTopic[] = [];
  const limited: DiagnosticTopic[] = [];
  for (const { topic, stat } of stats) {
    const d: DiagnosticTopic = {
      topicId: topic.id,
      label: topic.label,
      status: stat.status,
      mastery: stat.mastery,
      accuracy: stat.accuracy,
      evidence: stat.evidence,
    };
    if (stat.status === "strong") strong.push(d);
    else if (stat.status === "developing") developing.push(d);
    else if (stat.status === "needs-attention") priority.push(d);
    else limited.push(d);
  }

  const order = (arr: DiagnosticTopic[]) =>
    arr.sort((a, b) => b.mastery - a.mastery);
  order(strong);
  order(developing);
  order(priority);
  order(limited);

  const parts: string[] = [];
  if (strong.length) parts.push(`${strong.length} strength${strong.length > 1 ? "s" : ""}`);
  if (developing.length) parts.push(`${developing.length} developing`);
  if (priority.length) parts.push(`${priority.length} area${priority.length > 1 ? "s" : ""} to work on`);
  const headline = parts.length
    ? `Based on your first assessment: ${parts.join(", ")}.`
    : "Not enough answers yet for a profile. Keep going.";

  return { strong, developing, priority, limited, headline };
}