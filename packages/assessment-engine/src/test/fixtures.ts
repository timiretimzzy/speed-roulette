import type { ContentPack, Question, Topic } from "@zivvvo/content";

let counter = 0;
export function q(over: Omit<Partial<Question>, "options" | "correctIndexes"> & { options: string[]; correct: number[] }): Question {
  counter += 1;
  const { options, correct, ...rest } = over;
  const parsed = options.map((text, i) => ({ text, isCorrect: correct.includes(i) }));
  return {
    qid: over.qid ?? `q${counter}`,
    type: "single",
    stem: over.stem ?? `Stem ${counter}`,
    options: parsed,
    topicId: over.topicId ?? "road-signs",
    concept: over.concept ?? null,
    difficulty: over.difficulty ?? "standard",
    explanation: over.explanation ?? "",
    imageRef: over.imageRef ?? null,
    status: over.status ?? "answered",
    correctIndexes: correct,
    ...rest,
  };
}

export function simplePack(over: Partial<ContentPack> = {}): ContentPack {
  const topics: Topic[] = over.topics ?? [
    { id: "road-signs", label: "Road Signs", kind: "content", count: 6 },
    { id: "junction-rules", label: "Junction & Rules", kind: "content", count: 6 },
    { id: "confusing-pair", label: "Confusing Pair", kind: "mixed", count: 2 },
  ];
  const questions: Question[] =
    over.questions ??
    [
      ...["road-a", "road-b", "road-c", "road-d", "road-e", "road-f"].map((id, i) =>
        q({ qid: id, topicId: "road-signs", options: ["A", "B", "C"], correct: [0], explanation: `expl ${i}`, difficulty: i % 2 ? "hard" : "standard" }),
      ),
      ...["ju-a", "ju-b", "ju-c", "ju-d", "ju-e", "ju-f"].map((id, i) =>
        q({ qid: id, topicId: "junction-rules", options: ["A", "B", "C"], correct: [1], explanation: `expl ${i}` }),
      ),
      ...["cp-a", "cp-b"].map((id) => q({ qid: id, topicId: "confusing-pair", options: ["A", "B"], correct: [0] })),
    ];
  return {
    version: 1,
    exam: "zvid-provisional",
    topics,
    concepts: ["give-way", "lights"],
    questions,
    stats: {
      total: questions.length,
      answered: questions.filter((x) => x.status === "answered").length,
      withExplanation: questions.filter((x) => x.explanation).length,
      withImage: questions.filter((x) => x.imageRef).length,
    },
    ...over,
  };
}