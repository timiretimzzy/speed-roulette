import contentV1 from "./data/content-v1.json";
import type { ContentPack, Question, Topic } from "./types";

export type * from "./types";
export { contentV1 };

export const contentPack = contentV1 as unknown as ContentPack;

export function getTopic(pack: ContentPack, topicId: string): Topic | undefined {
  return pack.topics.find((t) => t.id === topicId);
}

export function questionsByTopic(pack: ContentPack, topicId: string): Question[] {
  return pack.questions.filter((q) => q.topicId === topicId);
}

export function questionsByConcept(pack: ContentPack, concept: string): Question[] {
  return pack.questions.filter((q) => q.concept === concept);
}

/** Questions safe to present in a session (verified correct answer exists). */
export function answerable(pack: ContentPack): Question[] {
  return pack.questions.filter((q) => q.status === "answered" && q.correctIndexes.length > 0);
}