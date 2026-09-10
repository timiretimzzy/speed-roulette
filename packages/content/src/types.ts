/** Content domain models. Mirrors docs/CONTENT_MODEL.md. */

export type QuestionType = "single" | "matrix_sort_answer" | "cloze" | "unknown";

/** Coarse difficulty proxy derived from source quiz (data-driven heuristic). */
export type Difficulty = "easy" | "standard" | "hard";

export type CorrectnessStatus = "answered" | "skip" | "unanswered";

export interface QuestionOption {
  text: string;
  isCorrect: boolean;
}

export interface Question {
  /** Stable source id (question_post_id). */
  qid: string;
  type: QuestionType;
  stem: string;
  options: QuestionOption[];
  /** Canonical topic id (from content taxonomy). Always present. */
  topicId: string;
  /** Codified semantics where the curated rules.json matched the stem. */
  concept: string | null;
  /** Data-driven difficulty proxy; null when no signal. */
  difficulty: Difficulty | null;
  /** Author-written explanation (T0). May be empty. */
  explanation: string;
  /** Media reference, relative filename when local, else null. */
  imageRef: string | null;
  status: CorrectnessStatus;
  /** Indexes into options identified as correct by the validated key. */
  correctIndexes: number[];
}

export interface Topic {
  id: string;
  label: string;
  /** content = exam-relevant learning area; mixed = practice/mock-only bucket. */
  kind: "content" | "mixed";
  count: number;
}

export interface ContentPack {
  version: 1;
  exam: "zvid-provisional";
  topics: Topic[];
  concepts: string[];
  questions: Question[];
  stats: {
    total: number;
    answered: number;
    withExplanation: number;
    withImage: number;
  };
}