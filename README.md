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
     created_at timestamptz default now(),
     constraint scores_ms_human check (ms >= 100 and ms <= 5000)
   );

   alter table scores enable row level security;

   create policy "Anyone can submit a score"
     on scores for insert
     with check (true);

   create policy "Anyone can read scores"
     on scores for select
     using (true);
   ```

   `ms` is bounded to 100–5000ms so clearly non-human submissions can't top
   the leaderboard. If you already created the `scores` table before this
   check existed, add it with:

   ```sql
   alter table scores add constraint scores_ms_human check (ms >= 100 and ms <= 5000);
   ```

   The game also needs a `players` table that reserves each racer name to the
   first device that claims it (matched case-insensitively via `name_lower`):

   ```sql
   create table players (
     name_lower text primary key,
     name text not null,
     device_id text
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

   This intentionally only allows INSERT and SELECT for the public key — no
   one can edit or delete another player's score, even with the key exposed
   in your site's JS (which it has to be, for a static site like this).

3. In the project, go to **Settings → API**. Copy the **Project URL** and the
   **anon public** key.
4. Open `config.js` in this project and paste them in:

   ```js
   window.RSR_CONFIG = {
     SUPABASE_URL: "https://xxxxx.supabase.co",
     SUPABASE_ANON_KEY: "eyJhbG..."
   };
   ```

5. Commit and push. That's it — every visitor now reads and writes the same
   `scores` table.

## Deploy to GitHub Pages

1. Push these files to a GitHub repo (`index.html`, `style.css`, `script.js`, `config.js`).
2. **Settings → Pages** → Source: `Deploy from a branch` → branch `main`, folder `/ (root)` → Save.
3. Live in about a minute at `https://<your-username>.github.io/<repo-name>/`.

## Files

- `index.html` — structure (name gate, game stage, leaderboard panel)
- `style.css` — fullscreen layout and theme
- `script.js` — game logic + leaderboard (Supabase, with local fallback)
- `config.js` — your Supabase project URL and public key
