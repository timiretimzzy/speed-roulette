// Submit-score Edge Function
// The only writer to the shared `scores` table: the public anon key has no
// INSERT policy (RLS), so nobody can inject a row through the REST API.
//
// Security design:
//  - `scores` has no public INSERT policy; this function is the sole writer
//    using the service-role key (never exposed to the browser).
//  - `source` is recorded as 'app' so rows that arrived through the real game
//    can be distinguished from anything else, and `created_at` is the server
//    timestamp.
import { createClient } from "jsr:@supabase/supabase-js@2";

const serviceRoleKey = Deno.env.get("SERVICE_ROLE_KEY")!;
const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceRoleKey, {
  auth: { persistSession: false },
});

const MAX_NAME_LEN = 18;

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

  // ---- validate ms (must be a number) ----
  if (typeof msRaw !== "number" || !Number.isInteger(msRaw)) {
    return json({ error: "ms must be an integer" }, 400);
  }

  // ---- insert score with the service-role key ----
  const { error: insertError } = await supabase
    .from("scores")
    .insert({ name: nameRaw, ms: msRaw, source: "app" });
  if (insertError) {
    console.error("insert failed:", insertError.message);
    return json({ error: "could not save score" }, 500);
  }

  return json({ ok: true });
});