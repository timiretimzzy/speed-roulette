# Zivvvo — Decision Log

> Recorded decisions and their rationale. Reverse decisions here — never in
> commit messages.

## ADR-001 — Repurpose the repository into a learning platform monorepo

**Date:** 2026-09-08

**Context:** The path (`reaction-speed-roulette`) began as a different game
side-project. The team is building a serious learning platform (Zivvvo) and
the existing repo carried research data and scripts already.

**Decision:** Convert the repo in place into a Zivvvo monorepo:
`apps/web`, `packages/{content,learning-engine,ai-gateway}`, `docs/`,
`research/`, `tools/primaed/`, `data/primaed/`, `supabase/`. The old
reaction-speed-roulette game assets (`index.html`, `style.css`,
`script.js`, game icons/config) are deleted.

**Consequences:** Git history preserves the old app, but the working tree is a
clean product foundation. Research and scraping tooling is kept (it is the
content pipeline).

## ADR-002 — Documentation-first lifecycle step

**Decision:** The current step in the development lifecycle is writing the
product/engineering markdowns (the full `docs/` set) before application code.

**Consequences:** Everyone builds against an agreed architecture; Phase 1 code
has a specification to conform to. Docs carry honest status labels
(Implemented/Planned/Experimental) — no imaginary finished features.

## ADR-003 — Content correctness is data, not AI

**Decision:** Correct answers come from the validated answer key built during
research; explanations are authored from course material + law (RTA,
SI 119/2023, SI 2025-010). AI is an enhancement layer only (see
`AI_ARCHITECTURE.md`).

**Consequences:** Zivvvo can never hallucinate an answer. Research pipeline
work remains a first-class investment.

## ADR-004 — Offline-first as a product requirement

**Decision:** Device (IndexedDB) is the source of truth; Supabase is a sync and
account mirror (`OFFLINE_STRATEGY.md`). All core flows work with zero
connectivity.

**Consequences:** Sync complexity moved into the data layer; UX never depends
on the network.

## ADR-005 — Engine-over-special-cases

**Decision:** Learning, assessment, and exam-blueprint behaviors are explicit
domains with stable interfaces, driven by data — never by hardcoded
provisional-licence logic in the UI.

**Consequences:** Adding an examination is content-legwork plus config, not an
architecture change.

## ADR-006 — Credentials never in the repository

**Decision:** Research scrapers read `PRIMAED_USER`/`PRIMAED_PASS` from the
environment or from `data/primaed/.creds.txt` (gitignored). Supabase service
keys are server-only. Verified: zero committed credentials.

**Consequences:** A pre-commit credential scan becomes a Phase 1 CI gate.

## ADR-007 — Answer value = canonical option text

**Decision:** In the research answer key, a correct answer is stored as the
option *text* exactly (e.g. `"A rectangle"`), normalized during matching, and
mapped into option objects at content build time.

**Consequences:** The bank is human-reviewable and directly mappable to the
content model's `Option.text`; no re-guessing at import.

## ADR-008 — Conscious skip list for unanswered questions

**Decision:** Questions whose correctness cannot be validated today are marked
`skip` with reasons (259 image-gated, 3 malformed pedestrian 49887/49497/47356,
2 cloze 51863/51870, 1 matrix 52717) and excluded from `answers_master.json` /
`question_bank_filled.csv` answered counts. They remain in the bank flagged for
manual review.

**Consequences:** Product never presents an unverified question as answered.

## ADR-009 — Scraping status: lessons and quiz re-diff are gated

**Date:** 2026-09-08

**Context:** Live lesson notes, topic lesson content, and re-diffing of the 106
quiz URLs requires an enrolled learner session. The test account
(`rakotamadarrel@gmail.com`) currently shows **"Not Enrolled … This course is
currently closed"**; lesson/quiz URLs redirect to the course landing page.

**Decision:** Do not fabricate or re-purpose content for lessons while gated.
Keep `tools/primaed/scrape_course_content.ps1` and `recheck_quizzes.ps1`
hardened (they now detect the gate and skip) and ready to run once the account
is re-enrolled. Public data already captured this session: page snapshots
(home, my-account, course), 327 testimonials, 2 maths-related public PDFs
(kept out of driving scope).

**Consequences:** The driving *question* bank is complete (2,119 slots);
*lesson explanation* scraping is blocked pending re-enrollment. This blocker is
tracked openly rather than papered over.

## ADR-010 — Technology stack

**Decision:** React + TypeScript (strict) + Vite + Tailwind, TanStack Query +
Zustand, Dexie (IndexedDB), Supabase backend, turborepo-style package layout.

**Consequences:** Minimal, portable, and offline-capable by default; provider
and backend choices stay behind interfaces.

## ADR-011 — First examination = Zimbabwe VID provisional licence

**Decision:** Phase 2 targets ZVID provisional licence content (legal anchors:
RTA, SI 119/2023, Scheme SI 2025-010).

**Consequences:** Research data is validated against this category; the engine
remains category-agnostic.

## ADR-012 — Single-option "coaching" rows are skipped, not answered

**Date:** 2026-09-09

**Context:** 4 questions in the bank (50182, 50185, 50189, 50946) carry only
one option — the correct answer text. With one option there is no meaningful
choice, so they are not answerable as questions, yet the key text is real and
worth keeping.

**Decision:** The content generator emits these rows with `status: "skip"`,
preserving `key` and the single option. Content-pack contract:
answered ⟺ has a key AND ≥2 options; keyed-but-not-answered must be
single-option only. The `skip` status keeps them visible for manual review and
future expansion instead of presenting an unanswerable question.

**Consequences:** The pack now reports 1249 total / 980 answered / 269 skip;
skip includes the 265 legacy ADR-008 rows plus these 4.

## ADR-013 — Mixed buckets are excluded from teachable sessions

**Decision:** Session sampling draws from the **content pool** — answered
questions in topics of kind `content` — and excludes mixed/curated buckets
(e.g. `confusing-pair`). Such buckets never appear in learn/review/recovery
(teachable) sessions; they exist for benchmark-style/off-topic comparisons.

**Consequences:** Teachable sessions stay within real content topics; mixed
buckets could still be shown by an explicit UI action later without engine
changes.

## ADR-014 — Deterministic seeded sampling with recent-avoidance

**Decision:** Session builders sample the pool with a seeded PRNG
(`mulberry32`, seed derived from device time), giving reproducible sessions.
Sessions avoid questions seen recently (`config.recentAvoidHours`) by default,
so learners aren't hammered by one question; review/recovery sessions pass
`avoidRecent = false` and may recall recent items on purpose.

**Consequences:** Same seed + same attempts ⇒ same session (testable and
deterministic per engine rules); the cost is that "give me a fresh set"
needs a new seed, which the app derives per session.

## ADR-015 — Engine event sink is environment-agnostic

**Decision:** Assessment events default to a console sink and switch to a null
sink via a `globalThis.__ZIVVVO_TEST__` flag. No `process.env` reads live in
engine code.

**Consequences:** The engines remain browser-first and portable (Vite, Vitest,
and future edge runtimes read the same code); tests are silent by default.

## ADR-016 — Hand-rolled PWA, zero new dependencies

**Date:** 2026-09-09

**Context:** Offline support needed to ship the product shell. npm installs had
been flaky in this environment, and `vite-plugin-pwa`/Workbox would add a
dependency tree for precaching + manifest handling.

**Decision:** Implement the PWA with hand-written pieces: `manifest.webmanifest`
in `public/`, procedurally generated PNG icons (`make-icons.mjs`, brand ring on
slate), a `build:precache.mjs` that emits `sw.js` after each production build
(cache-first static serving, network-first SPA navigation fallback, versioned
cache eviction), and PROD-only registration in `main.tsx`.

**Consequences:** Zero new packages; the precache list is exact (dist walk +
image manifest); the SW is ~40 lines and easily auditable. We trade away
Workbox's runtime helpers (e.g. auto-update UX) until the backend stage.

## ADR-017 — Mock blueprint defaults are Experimental

**Decision:** `ZVID_MOCK_DEFAULT` (30 questions / 30 min / pass at 60% /
balanced topic mix) ships as tunable data served by `MockConfig`, clearly
flagged Experimental — it has not been verified against the real VID exam spec.

**Consequences:** Mock mode works end-to-end today; the numbers can change in
one constant without code churn, and the UI prints the blueprint it used.

## ADR-018 — Question images ship inside the app bundle

**Decision:** The 158 unique images referenced by `imageRef` are copied from
`data/primaed/images` into `apps/web/public/images/` by `copy-images.mjs` and
precached by the service worker; `Practice.tsx` renders `/images/<imageRef>`
when present. Served first-party (offline, same-origin, cache-first).

**Consequences:** Images are immediately offline-capable and need no separate
fetch/streaming infra; updates come with the app release until a manifest-based
pack channel exists (Phase 2). Missing refs fail soft (image simply not
rendered) and are reported by the copy script.

## ADR-019 — Zivvvo lives in its own `zivvvo` Postgres schema

**Date:** 2026-09-09

**Context:** The shared Supabase project (`uvmgmbwnsdebtkwldfaa`) hosts an
existing school-management product ("EduStack") in `public` (41 exposed
objects incl. RBAC and payments). Zivvvo needs backend tables without touching
them.

**Decision:** All Zivvvo objects (tables `attempts`, `learners`,
`sync_watermark`, `content_pack`, function `request_device_id`, plus RLS
policies and grants) live inside a dedicated `zivvvo` schema. Migration
`001_init_zivvvo.sql` is strictly additive and forward-only; `public` is never
modified, and grants never leak outside the schema. The only shared-object
change is appending `zivvvo` to postgREST's exposed schemas (additive).
A no-touch checklist (`docs/supabase/no-touch-checklist.md`) fingerprints the
existing surface and is diffed after every backend change.

**Consequences:** EduStack risk is effectively zero (schema-level isolation);
Zivvvo shares the project's auth/RLS infrastructure without name collisions.
Requires manual "Exposed schemas" addition in the dashboard (or a fully
listed `pgrst.db_schemas` value) because the platform manages that setting.

## ADR-020 — Anonymous-first sync, device id as the identity seam

**Decision:** v1 sync is anonymous and device-scoped. RLS on `zivvvo` tables
gates `select`/`update` on `device_id = x-device-id` request header, and the
client sends a stable per-browser UUID (localStorage-persisted). This is
**spoofable by design** — it protects accidental cross-device access and
collisions, not adversarial reads. The schema keeps a `device_id` foreign-key
linear path to `auth.uid()` migration: when Supabase email/anon-auth UX lands,
policies swap the header check for `auth.uid() = learner_id` with no table
changes.

**Consequences:** Zero-account usable today; a later account stage is additive.
Analytics/sync correctness rests on `attempt_id` idempotence rather than on
who the user is.

## ADR-021 — Secrets: publishable key in the bundle, everything else server-side

**Decision:** The PWA ships only `VITE_SUPABASE_URL` + the **publishable** API
key (public by design). The secret/service-role keys and the management PAT are
never committed, never bundled, and live only in the operator's env. supabase-js
is loaded via a lazy dynamic import so a missing config costs the offline shell
zero bytes. A real Supabase `SupabaseClient` is created only when both env vars
are present.

**Consequences:** Client cannot read/write outside RLS; any privileged path must
ride a server channel. The PAT used during setup should be rotated once the
publishable/secret keys are in daily use.

## ADR-022 — Remote sync acceptance is gated by the platform, tracked openly

**Date:** 2026-09-09

**Context:** The `zivvvo` schema and tables were applied and verified
(`count(*) → 0`), and the sync client is live, tested, and wired. But the REST
API still answers `PGRST125` for `zivvvo/*` even after the Dashboard's
"Exposed schemas" Save *and* `ALTER ROLE authenticator SET pgrst.db_schemas` +
`pg_reload_conf()` + `NOTIFY pgrst, 'reload schema'`. Evidence: the OpenAPI
inventory refreshes (41 → 50 paths — nine new *EduStack* tables from external
activity) yet never includes `zivvvo`, so this project's running postgREST is
configured platform-side, not per-role.

**Decision:** Treat this like ADR-009's "Not Enrolled" gate: no fabricated
config, no touching `public` – the product ships offline-first regardless, the
sync client stays armed for `zivvvo.attempts`, and the blocker is documented in
`docs/supabase/no-touch-checklist.md` and DATABASE status. Resolution requires
the platform (support ticket: "add `zivvvo` to the project's PostgREST exposed
schemas"), after which the app syncs with zero code changes.

**Consequences:** Core flows remain fully usable (device is the source of
truth). Once unblocked, end-to-end verification = one idempotent sync +
re-run of the no-touch checklist diff.