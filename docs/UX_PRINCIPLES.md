# Zivvvo — UX Principles

> Product experience principles: how the learner *feels* using Zivvvo.

## Why this exists

Examination prep is stressful. Zivvvo's UX exists to replace anxiety with
momentum. Every screen either reduces doubt, increases clarity, or builds
confidence — or it does not ship.

## Principles

1. **Mobile-first.** Zivvvo is used on a phone in one hand — on a bus, in a
   queue. Every layout starts at 320px and is designed for thumb reach.
2. **Offline is invisible.** No spinners because of network. Content is local,
   sync is silent. If a learner thinks about connectivity, we failed.
3. **Calm questions.** One clear question, no chrome, no countdown anxiety in
   Learn mode. Typography and spacing do the work; urgency is reserved for
   real Mock mode.
4. **Preparation, not punishment.** Wrong answers get constructive energy —
   `0`/`1` labels, lives, and streak-shaming are banned. A wrong answer is
   celebrated as data that teaches your next step.
5. **Feel ready before you sit the test.** Readiness is a real signal the
   learner can see ("You're ready when…"), not a vague Encouragement Cloud.
6. **Learning before testing.** New material enters via Learn, then Practice,
   then Mock. The app never dumps questions on cold content.
7. **Confidence is asked, not assumed.** A 3-tap self-report ("sure / not
   sure / guessing") powers the learning engine and makes feedback honest.
8. **Energy on rewards, never on punishment.** Praise flows generously;
   punishment never exists.

## Core Navigation (5 bottom tabs)

`Home · Learn · Practice · Progress · Coach`

- **Home** — today's path: what to do next, why, and how it moves readiness.
- **Learn** — the curriculum, structured by topics; explanations before
  questions.
- **Practice** — adaptive drill by weakness, with feedback and explanation.
- **Progress** — mastery per topic and readiness toward the exam date.
- **Coach** — the narrative layer: AI-assisted guidance from `AI_ARCHITECTURE.md`
  T2 (experimental; Phase 1 shell only).

## First-time journey

Welcome → goal selection (exam + date) → examination timeline →
confidence assessment → Home. The confidence assessment feeds the engine so
the very first "next best activity" is personalised (constraint: onboarding
must complete in under 2 minutes).

## Feedback Language

- Correct → confirm + short positive signal, then deepen (explanation).
- Wrong → neutral, honest, constructive: show the correct answer with an
  explanation that addresses *why the chosen option was not it*
  (relation layer in the content model), then a recovery path.
- Never globalises ("you're bad at this"); always instructs ("this topic is
  now your next focus").

## Status

- Principles: **Implemented** (this document).
- Design system, screens flow, motion language: **Planned** (Phase 1).
- First-time journey (Welcome → goal → timeline → confidence → Home):
  **Implemented** — collapsed goal list (only the ZVID provisional category
  exists today; others marked "coming soon"), exam-date input, timeline ⇄ daily
  minutes, four confidence bands persisted on the learner record and used by the
  first Home recommendation (docs/ROADMAP.md Phase 1). Dev/demo learner seeding
  remains available under the onboarding screen's "Developer" disclosure.

## Assumptions

- The five-tab model survives testing; if a tab proves dead-weight it is
  removed, not kept for symmetry.
- Short sessions (3–10 minutes) dominate; the app optimises for
  "one useful thing per session".

## Future

- Accessibility-first review (WCAG AA) as a release gate.
- Localised copy and right-to-left support as categories expand.