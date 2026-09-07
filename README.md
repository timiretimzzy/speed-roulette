# Reaction Speed Roulette

A one-tap reaction speed game with a leaderboard shared by everyone who plays.

## Play

Open `index.html` in a browser, or deploy it (see below).

## Why this needs a backend

GitHub Pages only serves static files — it can't run code to write a score
into a `.db` file when someone plays. To get one leaderboard that every
visitor sees, some service has to accept writes from the public. This
project uses **Supabase** (free-tier hosted Postgres with a public API) —
you still don't run or maintain a server; you just get an API URL and a key.

Until you set that up — or whenever the backend can't be reached from a
player's browser — the game plays in local mode: names aren't checked against
the shared `players` table, and scores go to a per-device leaderboard stored
in the browser instead of the shared one, so it's still fully playable.

## Set up the shared leaderboard (5 minutes)

1. Go to [supabase.com](https://supabase.com), sign up, and create a new project (free tier).
2. In the project, open the **SQL Editor** and run:

   ```sql
   create table scores (
     id uuid primary key default gen_random_uuid(),
     name text not null,
     ms integer not null,
     source text not null default 'app',
     created_at timestamptz default now()
   );

   alter table scores enable row level security;

   create policy "Anyone can read scores"
     on scores for select
     using (true);
   ```

   The public key is **SELECT-only** on `scores`: there is deliberately no
   INSERT policy, so nobody can inject a leaderboard row through the REST
   API — not even with the browser key, which has to be exposed in your
   site's JS for a static site. All score writes go through the `submit-score`
   Edge Function, which uses the service-role key server-side and stamps each
   row with `source = 'app'` (so entries that came through the real game can
   be distinguished from anything else).

   `ms` is not range-restricted — a player can legitimately land very fast
   times (or even single-digit ones) by timing the green transition, and
   that's their reward for practicing. (It must still be a positive integer;
   the function rejects `ms <= 0`.)

   The game also needs a `players` table that reserves each racer name to the
   first device that claims it (matched case-insensitively via `name_lower`):

   ```sql
   create table players (
     name_lower text primary key,
     name text not null,
     device_id uuid
   );

   alter table players enable row level security;

   create policy "Anyone can read player names"
     on players for select
     using (true);

   create policy "Anyone can register a name"
     on players for insert
     with check (true);

   create policy "Only unclaimed names can be claimed"
     on players for update
     using (device_id is null)
     with check (true);
   ```

   Name claiming is a first-come-first-served string, not a security boundary —
   scores are, and they're write-protected as shown above.

   The live feed (`postgres_changes` on `scores`) needs that table in the
   realtime publication. In the dashboard it's **Database → Replication**, or:

   ```sql
   alter publication supabase_realtime add table public.scores, public.players;
   ```

3. Deploy the `submit-score` Edge Function (the only writer of scores; it uses
   the service-role key and records `source = 'app'`):

   ```bash
   npx supabase functions deploy submit-score --project-ref <your-ref> --use-api
   npx supabase secrets set SERVICE_ROLE_KEY=<your-service-secret-key> --project-ref <your-ref>
   ```

   `SERVICE_ROLE_KEY` is a service-role-scoped secret (Settings → API →
   **secret** key in modern projects, or the legacy `service_role` JWT). The
   function reads it at runtime and uses it only on the server — never sent to
   the browser.

5. In the project, go to **Settings → API**. Copy the **Project URL** and the
    **publishable** public key.
6. Open `config.js` in this project and paste them in:

   ```js
   window.RSR_CONFIG = {
     SUPABASE_URL: "https://xxxxx.supabase.co",
     SUPABASE_ANON_KEY: "sb_publishable_..."
   };
   ```

7. Commit and push. That's it — every visitor reads the same `scores` table,
    and every row carries `source = 'app'` from the function.

## Key rotation / security notes

- The **publishable** (browser) key can SELECT `scores` and INSERT/UPDATE
  `players` (name claiming) only — RLS blocks everything else. It has no
  INSERT on `scores`.
- The **service-role secret** is only ever used by the Edge Function. Never
  put it in `config.js` — that file is public.
- If a browser-used key is ever leaked you can rotate it in **Settings →
  API** without touching the function.

## Deploy to GitHub Pages

1. Push these files to a GitHub repo (`index.html`, `style.css`, `script.js`, `config.js`).
2. **Settings → Pages** → Source: `Deploy from a branch` → branch `main`, folder `/ (root)` → Save.
3. Live in about a minute at `https://<your-username>.github.io/<repo-name>/`.

## Files

- `index.html` — structure (name gate, game stage, leaderboard panel)
- `style.css` — fullscreen layout and theme
- `script.js` — game logic + leaderboard (Supabase, with local fallback)
- `config.js` — your Supabase project URL and publishable key
- `supabase/functions/submit-score/` — Edge Function (the only writer of scores) that inserts `source = 'app'` rows
- `supabase/config.toml` — Supabase CLI project + function config
