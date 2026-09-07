// Submit-score Edge Function
// Validates reaction time server-side, rate-limits per racer, and writes to
// `scores` using the service-role key (never exposed to the browser).
//
// Security design:
//  - The public anon key has SELECT-only access on `scores` (INSERT policy
//    removed), so it cannot write or tamper with the leaderboard.
//  - `ms` is bounded 100-5000 by the `scores_ms_human` CHECK constraint in
//    the DB as well as validated here; negative / non-integer / out-of-range
//    values are rejected with 400.
//  - Each racer name is limited to `MAX_PER_WINDOW` submissions per
//    `WINDOW_SECONDS` using the `rate_limits` table.
import { createClient } from "jsr:@supabase/supabase-js@2";

const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey, {
  auth: { persistSession: false },
});

const MIN_MS = 100;
const MAX_MS = 5000;
const MAX_NAME_LEN = 18;
const MAX_PER_WINDOW = 5;
const WINDOW_SECONDS = 60;

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
    return json({ error: "invalid json body" }, 400);
  }

  const nameRaw = typeof body.name === "string" ? body.name.trim() : "";
  const msRaw = body.ms;

  // ---- validate name ----
  if (!nameRaw || nameRaw.length > MAX_NAME_LEN) {
    return json({ error: "invalid name" }, 400);
  }
  if (/[^\p{L}\p{N} _-]/u.test(nameRaw)) {
    return json({ error: "name contains invalid characters" }, 400);
  }

  // ---- validate ms (reject negatives / non-integer / out-of-range) ----
  if (typeof msRaw !== "number" || !Number.isInteger(msRaw)) {
    return json({ error: "ms must be an integer" }, 400);
  }
  if (msRaw < MIN_MS || msRaw > MAX_MS) {
    return json({ error: "ms must be between 100 and 5000" }, 400);
  }

  // ---- rate limit (per racer name, sliding window) ----
  try {
    const rl = await supabase.rpc("rate_limit_allow", {
      p_name: nameRaw,
      p_max: MAX_PER_WINDOW,
      p_window_seconds: WINDOW_SECONDS,
    });
    if (rl.error) throw rl.error;
    if (rl.data === false) {
      return json({ error: "too many submissions, slow down" }, 429);
    }
  } catch (e) {
    console.error("rate_limit failed:", e.message);
    return json({ error: "server error" }, 500);
  }

  // ---- insert score with the service-role key ----
  const { error: insertError } = await supabase
    .from("scores")
    .insert({ name: nameRaw, ms: msRaw });
  if (insertError) {
    console.error("insert failed:", insertError.message);
    return json({ error: "could not save score" }, 500);
  }

  return json({ ok: true });
});
