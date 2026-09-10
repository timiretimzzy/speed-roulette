/**
 * AI gateway contracts (docs/AI_ARCHITECTURE.md).
 *
 * Phase 2 is local-first and deterministic: objective questions are scored
 * against the canonical key embedded in the content model. Subjective and
 * free-text marking is behind this interface so a provider (mock now, an LLM
 * later with consent) can be swapped without touching app logic.
 */

export interface ScoreRequest {
  questionStem: string;
  canonical: string | null;
  userAnswer: string;
  context?: Record<string, unknown>;
}

export interface ScoreResponse {
  score: 0 | 0.5 | 1;
  scoreCanonical: boolean;
  usedFallback: boolean;
  reason: string;
}

export interface ExplainRequest {
  questionStem: string;
  options: { text: string; isCorrect: boolean }[];
  userAnswer: string | null;
}

export interface ExplainResponse {
  text: string;
  source: "canonical" | "generated";
}

export interface AIService {
  readonly id: string;
  score(req: ScoreRequest): Promise<ScoreResponse>;
  explain(req: ExplainRequest): Promise<ExplainResponse>;
}