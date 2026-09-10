import { contentPack } from "@zivvvo/content";
import type { Topic } from "@zivvvo/content";
import type { TopicCatalog } from "@zivvvo/learning-engine";

export const pack = contentPack;

const topicOfQid = new Map(pack.questions.map((q) => [q.qid, q.topicId]));

/** Adapter turning the content pack into the learning engine's catalog. */
export const catalog: TopicCatalog = {
  orderedTopics: [...pack.topics],
  questionTopic: (qid) => topicOfQid.get(qid) ?? null,
  contentTopics: (): { id: string; label: string }[] =>
    pack.topics.filter((t): t is Topic & { kind: "content" } => t.kind === "content").map((t) => ({ id: t.id, label: t.label })),
  answerableInTopic: (topicId) =>
    pack.questions.filter((q) => q.topicId === topicId && q.status === "answered" && q.options.length >= 2).map((q) => q.qid),
};

export function questionById(qid: string) {
  return pack.questions.find((q) => q.qid === qid) ?? null;
}