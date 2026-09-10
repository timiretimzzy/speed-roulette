# Zivvvo — Offline Strategy

> Offline-first: the device is the source of truth; the backend is a mirror.

## Why this exists

Learners use Zivvvo in buses, at roadblocks, in exam-centre waiting rooms —
places where mobile networks are flaky or absent. If Zivvvo requires
connectivity for core use, it fails its founding principle. Offline-first is a
product requirement, not an optimisation.

## Principles

1. **Offline is not a degraded mode; it is the mode.** Practice, review,
   attempts, and even readiness signals must all work with zero connectivity.
2. **Local first, sync later.** Every write lands in IndexedDB immediately;
   sync to the backend is a background, idempotent process.
3. **Content is shipped, not streamed.** Question banks and explanations are
   downloaded once and served from the device. New/changed content arrives via
   versioned content packs.
4. **Sync by event**, not by state. Attempts and outcomes are append-only
   events with stable ids; the server merges by id.

## Storage

- **IndexedDB via Dexie.js** — implemented on-device tables (see
  `DATABASE.md`): `attempts` (append-only events, `syncedAt` watermark),
  `reviews` (per-question spaced cards), `sessions`, `learners`, `meta`.
  Mastery/readiness is always recomputed from attempts — never stored.
- **Service Worker / Cache** — implemented. `tools/zivvvo/build-precache.mjs`
  emits `sw.js` after each production build: it precaches the whole `dist/`
  (hashed shell assets, `index.html` as "/", and the ~158 referenced question
  images at `/images/*`), with cache-first static serving and a network-first
  SPA navigation fallback. Cache is versioned and cleaned on activate.
- **Versioned content packs** — the content pack is bundled with the app today
  (`packages/content/src/data/content-v1.json`); images are copied into the
  app's `public/` by `tools/zivvvo/copy-images.mjs`. A manifest-based update
  channel (`packId`, schemaVersion, contentHash) is planned so devices upgrade
  atomically and never mix schema versions.

## Sync Flow

```
[device] attempt event            ┌──────────────┐
   └─▶ IndexedDB (append-only)     │ Supabase     │
        └─▶ syncQueue (FIFO) ─────▶│ (idempotent  │
             ▶ retry w/ backoff    │  upsert)     │
                                   └──────────────┘
```

- Conflicting UI state is impossible by construction: writes only ever append.
- Read-your-writes holds even offline because reads also come from IndexedDB.
- The client sync layer is implemented and live: `apps/web/src/sync.ts` is the
  pure, testable core (`SyncManager`, idempotent push of `syncedAt IS NULL`
  attempts, error/backoff snapshot) and `apps/web/src/sync-supabase.ts` wires
  it to the project's `zivvvo.attempts` table via supabase-js (lazy-loaded so
  the offline shell never pays the bundle cost). When the Supabase env vars are
  absent, the manager reports `configured: false` and the app stays local-only.

## Syncable Entities (Phase 1)

```ts
type SyncEnvelope =
  | { kind: 'attempt'; event: AttemptEvent }
  | { kind: 'content-pack-install'; packId: string; ts: number }
  | { kind: 'profile', body: unknown };
```

## Status

- Strategy: **Implemented** (this agreement).
- Dexie write-through schema: **Implemented** (see `DATABASE.md`).
- Service worker precache + PWA manifest/icons: **Implemented**; verified
  offline via a served `dist/` smoke test (all entry points 200, correct MIME).
- Real backend sync: **Implemented** — live Supabase backend (`schema
  zivvvo.attempts`, idempotent upsert on `attempt_id`, RLS scoped to the
  `x-device-id` header). Sync status card in Progress (pending count,
  last-synced, retry); auto-sync on app load, after sessions, and on
  `online`. supabase-js is a lazy chunk — offline shell unaffected.
- Content-pack distribution endpoint: **Planned** — the pack stays app-bundled
  today; `zivvvo.content_pack` exists for the manifest-based channel.

## Assumptions

- A content pack is small enough for one HTTP fetch on a normal connection
  (first category ≈ 1,249 questions + 223 images; no video in v1).
- Users accept an upfront one-time content download.

## Future

- Delta packs (schema-aware patches) instead of full re-downloads.
- Peer-to-peer pack exchange within local networks (classrooms, exam centres).
- Server-side reconciliation audit for device <-> server drift.