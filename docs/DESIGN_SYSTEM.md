# Zivvvo — Design System

> The visual language and component library of the product.

## Why this exists

One consistent system across exams, screens, and future teams. The design
system encodes calm-and-confident: readable type, honest colour, controlled
motion. Components must work offline and feel native on a phone browser.

## Foundations (Phase 1 crib)

> Provisional values — finalised together with the working prototype.

- **Type:** system-first stack (e.g. system UI fonts with optional variable
  font later); large, readable question stems; tabular numerics for scores.
- **Spacing:** 4px base scale; generous card padding for thumb reach.
- **Radius:** comfortably rounded cards (e.g. 16px) so screens feel soft, not
  clinical.
- **Colour:** a focused token set — calm neutrals for chrome, one confident
  primary for actions, and a *message* palette reserved strictly for
  correctness feedback (green/neutral-amber) and motivation. Red is not a
  punishment colour; it is avoided for wrongness to protect principle 4.
- **Motion:** 150–250ms ease-out micro-motion only; no decorative animation.

## Component Inventory

```
Badge, Button (primary/ghost/outline), Card, Chip/Tag,
EmptyState, MetricTile, Modal/Sheet, ProgressRing, QuestionCard,
TabBar (5-tab), Toast, TopBar
```

**QuestionCard** is the heart component: stem, media, options (icon + text),
selection → submit → feedback with explanation panel. It must render identically
offline and online (see `OFFLINE_STRATEGY.md`).

## Accessibility Baseline (Phase 1)

- Contrast ≥ WCAG AA.
- Full keyboard/tab navigation and `aria` wiring on all interactive components.
- Focus states visible; touch targets ≥ 44×44px.

## Status

- Foundations doc: **Planned** (values above open for critique).
- Token set + implemented components: **Planned** (Phase 1 scaffolding,
  Tailwind-config tokens matching this doc).

## Assumptions

- Tailwind CSS tokens are the single source for design tokens; components are
  built from tokens, not `style=""`.
- Motion prefers `prefers-reduced-motion`.

## Future

- Figma-compatible token export.
- Themes per examination category (light/dark and brand-affinity) without
  component rewrites.