// Submit-score Edge Function
// The only writer to the shared `scores` table: the public key has no INSERT
// policy (RLS), so nobody can inject a row through the REST API.
//
// Security design:
//  - `scores` has no public INSERT policy; this function is the sole writer
//    using the service-role key (never exposed to the browser).
//  - `source` is recorded as 'app' and `created_at` is the server timestamp.
//  - A round is 5 games; the function stores the raw `games` and the computed
//    average as `ms`. Rejections are generic so the acceptance logic is never
//    discoverable from client responses.
import { createClient } from "jsr:@supabase/supabase-js@2";

const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey, {
  auth: { persistSession: false },
});

const MAX_NAME_LEN = 18;
const ROUND_SIZE = 5;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

// Accept/reject is intentionally opaque: failures use the same generic shape
// as genuine validation errors so the rule is not learnable from responses.
function reject() {
  return json({ error: "invalid submission" }, 400);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json({ error: "method not allowed" }, 405);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return reject();
  }

  const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
  const gamesRaw = body.games;
  const framesRaw = body.frames;

  // ---- validate name ----
  if (!nameRaw || nameRaw.length > MAX_NAME_LEN) {
    return reject();
  }
  if (/[^\p{L}\p{N} _-]/u.test(nameRaw)) {
    return reject();
  }

  // ---- validate round: exactly ROUND_SIZE positive integer games ----
  if (!Array.isArray(gamesRaw) || gamesRaw.length !== ROUND_SIZE) {
    return reject();
  }
  const games = gamesRaw.map(Number);
  if (games.some((g) => !Number.isInteger(g) || g < 0)) {
    return reject();
  }

  // ---- validate frames proof (soft signal, never surfaced) ----
  if (
    !Array.isArray(framesRaw) || framesRaw.length !== ROUND_SIZE ||
    framesRaw.some((f) => !Number.isInteger(f) || f < 0)
  ) {
    return reject();
  }

  // ---- opaque eligibility: never surfaced to the client ----
  for (const f of framesRaw) {
    if (f < 1) return reject();
  }
  // Reaction times that no human can produce; a few are plausible (tight
  // prediction), but a cluster is treated as invalid.
  if (games.filter((g) => g <= 5).length >= 3) return reject();

  const avg = Math.round(games.reduce((a, b) => a + b, 0) / ROUND_SIZE);
  if (avg <= 0) return reject();

  // ---- insert score with the service-role key ----
  const { error: insertError } = await supabase
    .from("scores")
    .insert({ name: nameRaw, ms: avg, games, source: "app" });
  if (insertError) {
    console.error("insert failed:", insertError.message);
    return json({ error: "server error" }, 500);
  }

  return json({ ok: true });
});