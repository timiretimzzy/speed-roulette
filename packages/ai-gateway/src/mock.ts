import type { AIService, ScoreRequest, ScoreResponse, ExplainRequest, ExplainResponse } from "./types";

/** Normalises for forgiving comparison: lowercase, collapse punctuation/spacing. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Phase 2 mock provider -- deterministic, offline, no network. Implements the
 * fallback chain from docs/AI_ARCHITECTURE.md:
 *   1. canonical key exact match
 *   2. normalised substring / rule match
 *   3. rules.json (via context) match, else conservative 0
 */
export class MockAIService implements AIService {
  readonly id = "mock-ai-v0";

  async score(req: ScoreRequest): Promise<ScoreResponse> {
    const answer = norm(req.userAnswer);
    if (!answer) {
      return { score: 0, scoreCanonical: false, usedFallback: true, reason: "No answer given." };
    }

    const canonical = norm(req.canonical ?? "");
    if (canonical !== "" && answer === canonical) {
      return { score: 1, scoreCanonical: true, usedFallback: false, reason: "Matches the canonical answer." };
    }

    const rules = req.context?.rules as string[] | undefined;
    if (rules?.length) {
      const matched = rules.find((r) => {
        const n = norm(r);
        return n !== "" && (answer === n || answer.includes(n) || n.includes(answer));
      });
      if (matched) {
        return { score: 1, scoreCanonical: false, usedFallback: true, reason: "Matched an accepted rule phrasing." };
      }
    }

    if (canonical !== "" && answer.includes(canonical)) {
      return { score: 1, scoreCanonical: false, usedFallback: false, reason: "Closely matches the canonical answer." };
    }

    return { score: 0, scoreCanonical: false, usedFallback: true, reason: "No rule or canonical match found. This will be reviewed." };
  }

  async explain(req: ExplainRequest): Promise<ExplainResponse> {
    if (req.options.some((o) => o.isCorrect) && req.options.some((o) => !o.isCorrect)) {
      return { text: "Correct option(s) are marked against the official answer key.", source: "canonical" };
    }
    return { text: "Explanation will be added when the content pack covers this question.", source: "generated" };
  }
}

export const mockAI: AIService = new MockAIService();