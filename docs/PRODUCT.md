# Zivvvo — Product Specification

## Vision

Zivvvo is a learning platform for examinations. It is not a "quiz app". It is a
platform that takes a learner from "I am not sure" to "I know" and then to
"I am confident" — in that order.

The learning journey is:

1. **Learn** — understand the material.
2. **Practise** — apply it.
3. **Assess** — measure readiness with simulated examinations.

Zivvvo achieves this through **adaptive learning**. No two learners get the
same path. A doctor, a banker, and a school leaver preparing for the same
examination will each see different question sets and different explanations,
because their existing knowledge differs.

> **Mission statement:** Enable people to feel prepared and confident before
> they sit an examination — through preparation designed around each
> individual learner.

## Core Value Proposition

- **Adaptive learning** — the platform learns how the learner learns, and
  adapts the content to their ability and confidence level.
- **Learning before testing** — Zivvvo does not immediately rush a learner
  into questions. It first diagnoses, then teaches, then tests.
- **Preparation, not punishment** — wrong answers are never shamed. `0` or
  `1` labels are avoided. A wrong answer is data that drives the next
  learning step — and eventually leads to the correct answer.
- **Feel ready before you sit the test** — the success metric is a learner
  who walks into the test calm, because a readiness signal has told them they
  are ready.

## Initial Market

- **First category:** Zimbabwe VID provisional licence test.
- **Research foundation:** a scraped and validated question bank (1,249 unique
  questions, 984 answered) and California-legal-influenced sources, used as the
  seed knowledge base. The product architecture is generic so the same engine
  serves any examination category later.

## Core Pillars

1. **Adaptive** — the platform's engine and content adapt to the learner.
2. **For real examinations** — aligned to real test structures and content.
3. **For all exam types** — theory, practical-adjacent, and professional.
4. **Consistent** — every exam type gets the same learner experience.
5. **Pay-per-exam delivery** — the learner pays to access the exam preparation
   they actually want, rather than a broad subscription.

## Non-Goals

- Not a generic "quiz site" with question banks bolted together.
- Not a hardcoded Zimbabwe/provisional-licence-only product.
- Does **not** use AI to determine or verify answers.
- Does **not** require an internet connection for every learner interaction.
- Does not ship dozens of loosely-baked features for launch.

## Update Context (current state)

Today this repository is a research/data engineering codebase with a validated
content bank, plus a clean monorepo that will become the product. The next step
is **Phase 1: Product Foundation** (see `ARCHITECTURE.md` and `ROADMAP.md`) —
a working mobile-first application shell, engineered architecture, design
system, navigation, offline storage, content and attempt models, learning
engine interfaces, AI abstraction, mock data, and a core question experience
prototype.

## Outcome

Users experience a coherent first-time journey:

> Welcome → choose a goal → set an examination timeline → confidence
> assessment → Home → Learning Path → question interaction → feedback →
> progress.

When that journey is wired end-to-end with real content, Zivvvo is live for its
first examination.