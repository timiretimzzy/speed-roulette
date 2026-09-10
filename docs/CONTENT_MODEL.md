# Zivvvo — Content Model

> How examination content (questions, topics, explanations) is structured.

## Why this exists

The entire product depends on a content model that (a) represents any exam
without special-casing, and (b) lets the learning engine reason over questions
and their relationships. It determines whether adding a new examination is a
data-loading exercise or a rewrite.

## Core Entities

```
Exam 1 ── has ──► Subject 1 ──► Topic ──► Subtopic ──► Concept ──► Question
  └─ configuration: categories, passing mark, duration, question counts,
     randomisation rules (exam-specific, data-driven, not hardcoded)
```

### Question

```ts
type Question =
  | ImagineQuestion            // what do you see / interpret
  | MultipleChoiceQuestion
  | OneImageOneQuestion        // single question tied to one image
  | MatrixQuestion             // one image, multiple dependent questions
  | ClozeQuestion              // complete-the-blank (driver road signs)
  ;

interface QuestionBase {
  id: string;                  // stable external id (e.g. source qid)
  type: Question['type'];
  category: string;
  stem: string;                // the asked text
  media?: MediaRef[];          // images/audio
  options: Option[];
  correctAnswer?: number[];    // indexes into options (null until verified)
  explanation?: Explanation;
  meta: {
    exam: string;              // e.g. "zvid-provisional"
    subject: string;
    topic: string;
    subtopic?: string;
    source: string;            // provenance of this question
    correctnessStatus: 'answered' | 'unanswered' | 'needs-image' | 'skip';
  };
}

interface Option {
  index: number;
  text: string;                // canonical option text (verified against
                               // course answer explanations)
  isCorrect?: boolean;
}

interface Explanation {
  text: string;
  references: string[];        // RTA, SI 119/2023, SI 2025-010, etc.
  relation?: ExplanationRelation; // the "why my choice is wrong" layer
}
```

## Semantic Layers

The engine also needs a semantic view of *why* a question is asked:

- **Concept** — the underlying fact being tested (e.g. "no-load obedience",
  "unmarked pedestrian crossing", "robot light sequences").
- **Source relationship** — which legal or course source drives the answer.
- **Difficulty** — initially assigned to a coarse band
  (`basic | standard | advanced`) by the source, refined over time by learner
  performance (a model property, not a hardcoded attribute).

## Content Rules

1. **Correct answer is data, not AI.** Answers come from the validated
   answer key, never from AI inference at run time.
2. **Option text is canonical.** The answer value is the option *text*
   (e.g. "A rectangle"), stored verbatim from the course explanation.
3. **Every question has a status.** `answered / unanswered / needs-image /
   skip` so the product never presents an unverified question.
4. **Imagery is first-class, skippable.** Image-dependent questions exist but
   are flagged; the product can render them when media is available.

## Provenance (research foundation)

- Bank source: PrimaEd driving course (scraped, 106 quiz URLs).
- 2,119 question slots → 1,249 unique questions
  (`data/primaed/unique_questions.json`).
- Answer key: 984 answered (`data/primaed/answerkey/answers_master.json`),
  265 consciously skipped for manual review (`user_skip.txt`).
- Resolution rules: `rules.json`; explanations derived from course answer
  texts + legal anchors (RTA, SI 119/2023, SI 2025-010).
- Images: 223 files mapped (`questions_with_images.txt`).

## Status

- Research pipeline & models as data: **Implemented** (in `data/primaed/`).
- Typed `ContentDomain` package (`packages/content`): **Planned** (Phase 1).

## Assumptions

- Question ids must be stable across scrapes (matches on exact normalized
  stem/enumeration).
- A coarse difficulty band initialized by source is acceptable until learner
  performance data refines it.

## Future

- Multi-language stems and explanations as additive fields.
- Sub-question dependencies for matrix questions.
- Metadata-driven experiment A/B semantics for QA pipelines.