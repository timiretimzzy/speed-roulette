# Zivvvo — Database

> Backend data model (Supabase/Postgres) and how it relates to the device.

## Why this exists

The device is the source of truth for learner interaction (see
`OFFLINE_STRATEGY.md`); the backend is the account and sync layer plus the
source for content packs and analytics. The database model must (a) mirror the
content model, (b) store attempts as events, and (c) keep secrets and
multi-tenancy safe via RLS.

## Backend Responsibilities

1. Accounts & sessions (Supabase Auth).
2. Content pack download source (versioned, hash-verified).
3. Event sync target (append-only attempts, mastery).
4. Product/performance telemetry and analytics warehouse source.
5. Payments/per-exam entitlements (later phases, `Pay-per-exam delivery`).

## Core Tables (Planned Schema)

```sql
-- Content (read-mostly; published via content packs)
content_exam(id, slug, title, config jsonb)        -- blueprint: counts, pass mark
content_topic(id, exam_id, parent_id, slug, title)
content_question(id, topic_id, type, stem, media jsonb, ...)
content_option(question_id, idx, text, is_correct encrypted? no -- RLS, table-restricted)
content_explanation(question_id, text, references jsonb, relation jsonb)

-- Learner activity (append-only)
attempts(id uuid, learner_id uuid, qid text, mode text,
         selected int[], is_correct bool, confidence text,
         duration_ms int, device_ts bigint, synced_at timestamptz)
mastery_snapshot(learner_id, concept, state text, updated_at)

-- Sync & packs
content_pack(pack_id, schema_version, content_hash, published_at)
sync_watermark(learner_id, last_processed_event_id)
```

## On-Device Schema (implemented, Dexie v1)

The device database is defined in `apps/web/src/db.ts` (`ZivvvoDB`, Dexie):

| Table | Key | Purpose |
|-------|-----|---------|
| `attempts` | `id` (indexed `learnerId, qid, ts, syncedAt`) | Append-only attempt events; `syncedAt` set when pushed to a backend. |
| `reviews` | composite `learnerId:qid` | Per-question spaced-repetition cards (`stage`, `next`, `state`). |
| `sessions` | `id` (indexed `learnerId, type, createdAt`) | Session bookkeeping for history/analytics. |
| `learners` | `id` | Local learners/profiles (demo learners A & B are seeded). |
| `meta` | `key` | Small key/value store (db version, last sync, etc.). |

Derived state (mastery, weaknesses, readiness) is **recomputed from
`attempts` + `reviews`** on load — it is never stored denormalised on the
device.

## Remote Schema (implemented, schema `zivvvo`)

Isolated entirely inside a dedicated `zivvvo` schema of the shared Supabase
project `uvmgmbwnsdebtkwldfaa` (the same database also hosts the EduStack
product in `public`; see `docs/supabase/no-touch-checklist.md`). Migration:
`supabase/migrations/001_init_zivvvo.sql` — strictly additive, forward-only.

| Table | Key | Purpose |
|-------|-----|---------|
| `attempts` | `attempt_id` (text PK) | Append-only attempt events; `device_id` must equal the request `x-device-id` header (RLS). |
| `learners` | `device_id` | Minimal device→profile anchor; `goal` / `target_date` now populated locally by onboarding (client writes them to Dexie; learner-row cloud sync is a later stage). |
| `sync_watermark` | `device_id` | Last-push tracking (idempotence aid). |
| `content_pack` | `pack_id` | Versioned pack registry; distribution is a later stage. |

RLS is enabled on every table. Anonymous-first (ADR-020): `insert` is open and
`select`/`update` require the row's `device_id` to equal the `x-device-id`
request header — **spoofable by design** until email auth swaps the key to
`auth.uid()` without schema changes. `content_pack` is publicly readable.
Grants are confined to the `zivvvo` schema; the client ships only the
publishable API key and never touches `service_role`.

## Security Model

- **RLS on learner-owned tables** (`attempts`, `learners`, `sync_watermark` in
  schema `zivvvo`) — anonymous-first keyed to the `x-device-id` header today
  (ADR-020); the seam for `auth.uid()` when email auth lands.
- **Content tables read-only to all authenticated users**; writes happen only
  through an internal admin channel (see `SECURITY.md`).
- **No service-role keys in the client.** The PWA ships the *publishable* key
  only; the secret/service-role keys live server-side, never in app code.
- **Answer keys and explanations shipped inside signed content packs**, not
  as individually fetchable secrets.
- **Shared-database isolation:** Zivvvo DDL is confined to `zivvvo`; the
  EduStack `public` schema is untouched (verified by the no-touch checklist).

## Status

- On-device schema: **Implemented** (`apps/web/src/db.ts`, tables + mappers).
- Remote schema (`zivvvo`): **Implemented** (migration `001_init_zivvvo.sql`
  applied to `uvmgmbwnsdebtkwldfaa`). postgREST exposure of the schema is
  **gated on the platform "Exposed schemas" setting** — neither the SQL
  `alter role` nor the dashboard Save has reflected in the running API yet
  (see `docs/supabase/no-touch-checklist.md` + ADR-022). The app works in
  offline-only mode meanwhile.
- Client sync: **Implemented** — `apps/web/src/sync.ts` (core, testable) +
  `apps/web/src/sync-supabase.ts` (live backend). FIFO push of `syncedAt IS
  NULL` attempts, idempotent upsert on `attempt_id`, backoff/error surface,
  auto-sync on load and after sessions, sync status card in Progress. No code
  change needed the moment exposure lands — the client already targets
  `zivvvo.attempts`.
- Data portability: **Implemented** — "Download my data (JSON)" in the Progress
  tab serialises attempts, reviews, sessions and the learner record from the
  device, with zero backend dependency.
- Auth / accounts: **Planned** — anonymous-first device headers today; email
  auth keys RLS to `auth.uid()` without schema changes.
- Content-pack distribution endpoint: **Planned** — `content_pack` table is
  reserved for the later pack-delivery stage.

## Assumptions

- Postgres/Supabase remains the backend; if it changes, only the data layer
  changes (architecture rule).
- Attempt volume is modest (millions/year at target scale) — an
  event-append table is fine without exotic sharding initially.

## Future

- Denormalised analytics tables fed from the event stream for the
  product/performance dashboard.
- Entitlement/entitlement-grant tables for pay-per-exam.
- Deletion/right-to-be-forgotten flows (privacy).