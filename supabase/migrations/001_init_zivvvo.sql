-- Zivvvo backend stage 1: isolated sync schema.
--
-- STRICTLY ADDITIVE. Creates objects only inside the `zivvvo` schema and appends
-- `zivvvo` to the postgREST-exposed schemas. Never touches the existing `public`
-- schema (EduStack product) or any other pre-existing object.
--
-- Idempotent: safe to run more than once.
-- Apply via Supabase Dashboard -> SQL Editor, or `supabase db push` when the DB
-- is linked. No destructive statements anywhere.

-- 1. isolated schema ----------------------------------------------------------
create schema if not exists zivvvo;

-- 2. append-only attempt journal --------------------------------------------
-- Mirrors the client AttemptEvent spine (packages/assessment-engine types).
-- `device_id` is enforced to equal the sync request header (RLS gate) so a row
-- can never claim another device.
create table if not exists zivvvo.attempts (
  attempt_id   text primary key,          -- client attempt id (att_…)
  device_id    text not null,             -- browser device uuid
  learner_id   text not null,             -- local learner key on the device
  qid          text not null,             -- content question id
  session_id   text,                      -- owning local session id (may be null)
  mode         text not null,             -- diagnostic|smart|quick|review|weakness|recovery|mock
  selected     integer[] not null,        -- chosen option indexes
  is_correct   boolean not null,
  confidence   text not null check (confidence in ('sure','unsure','guess')),
  duration_ms  bigint,                    -- time spent on the question
  ts           bigint not null,           -- device epoch ms (event time)
  synced_at    bigint                     -- set when pushed; null = still pending
);
create index if not exists attempts_qid_idx    on zivvvo.attempts (qid);
create index if not exists attempts_device_idx on zivvvo.attempts (device_id);

-- 3. learner anchor rows ------------------------------------------------------
create table if not exists zivvvo.learners (
  device_id                text primary key,
  display_name             text,
  diagnostic_completed_at  bigint,
  goal                     text,          -- future onboarding (untouched, nullable)
  target_date              bigint,        -- future onboarding (untouched, nullable)
  created_at               bigint not null default (floor(extract(epoch from clock_timestamp()) * 1000)),
  updated_at               bigint
);

-- 4. sync watermark (idempotence aid per device) ------------------------------
create table if not exists zivvvo.sync_watermark (
  device_id        text primary key,
  last_push_ms     bigint not null,
  last_attempt_id  text
);

-- 5. content-pack placeholder (server distribution is a later stage) ----------
create table if not exists zivvvo.content_pack (
  pack_id         text primary key,
  schema_version  integer not null default 1,
  content_hash    text not null,
  question_count  integer not null default 0,
  published_at    bigint not null default (floor(extract(epoch from clock_timestamp()) * 1000))
);

-- 6. RLS gate helper ----------------------------------------------------------
-- Reads the device id that the sync client sends as the `x-device-id` request
-- header. SECURITY INVOKER: only the postgREST request context matters.
create or replace function zivvvo.request_device_id()
returns text
language sql
stable
security invoker
as $$
  select nullif(current_setting('request.headers', true)::json ->> 'x-device-id', '');
$$;

-- 7. row level security -------------------------------------------------------
alter table zivvvo.attempts      enable row level security;
alter table zivvvo.learners      enable row level security;
alter table zivvvo.sync_watermark enable row level security;
alter table zivvvo.content_pack  enable row level security;

-- attempts: write/read/update only for the owning device (idempotent upsert).
drop policy if exists attempts_insert on zivvvo.attempts;
create policy attempts_insert on zivvvo.attempts
  for insert to anon, authenticated
  with check (zivvvo.request_device_id() = device_id);

drop policy if exists attempts_select on zivvvo.attempts;
create policy attempts_select on zivvvo.attempts
  for select to anon, authenticated
  using (zivvvo.request_device_id() = device_id);

drop policy if exists attempts_update on zivvvo.attempts;
create policy attempts_update on zivvvo.attempts
  for update to anon, authenticated
  using (zivvvo.request_device_id() = device_id)
  with check (zivvvo.request_device_id() = device_id);

-- learners: upsert + read own row only.
drop policy if exists learners_insert on zivvvo.learners;
create policy learners_insert on zivvvo.learners
  for insert to anon, authenticated
  with check (zivvvo.request_device_id() = device_id);

drop policy if exists learners_select on zivvvo.learners;
create policy learners_select on zivvvo.learners
  for select to anon, authenticated
  using (zivvvo.request_device_id() = device_id);

drop policy if exists learners_update on zivvvo.learners;
create policy learners_update on zivvvo.learners
  for update to anon, authenticated
  using (zivvvo.request_device_id() = device_id)
  with check (zivvvo.request_device_id() = device_id);

-- watermark: own device only.
drop policy if exists watermark_insert on zivvvo.sync_watermark;
create policy watermark_insert on zivvvo.sync_watermark
  for insert to anon, authenticated
  with check (zivvvo.request_device_id() = device_id);

drop policy if exists watermark_select on zivvvo.sync_watermark;
create policy watermark_select on zivvvo.sync_watermark
  for select to anon, authenticated
  using (zivvvo.request_device_id() = device_id);

drop policy if exists watermark_update on zivvvo.sync_watermark;
create policy watermark_update on zivvvo.sync_watermark
  for update to anon, authenticated
  using (zivvvo.request_device_id() = device_id)
  with check (zivvvo.request_device_id() = device_id);

-- content_pack: public read; writes only via service key later.
drop policy if exists content_pack_select on zivvvo.content_pack;
create policy content_pack_select on zivvvo.content_pack
  for select to anon, authenticated
  using (true);

-- 8. grants (zivvvo schema only) ----------------------------------------------
grant usage on schema zivvvo to anon, authenticated, service_role;

grant select, insert, update on zivvvo.attempts       to anon, authenticated;
grant select, insert, update on zivvvo.learners       to anon, authenticated;
grant select, insert, update on zivvvo.sync_watermark to anon, authenticated;
grant select on zivvvo.content_pack                    to anon, authenticated;

grant all on all tables in schema zivvvo to service_role;
grant execute on function zivvvo.request_device_id() to anon, authenticated, service_role;

-- 9. expose the schema to postgREST (additive) --------------------------------
-- Appends zivvvo while keeping public. Supabase Storage API (separate gateway)
-- and your existing `public` API are unaffected.
-- Note: if `public` is not your only exposed schema, prefer adding `zivvvo` via
-- Dashboard -> Project Settings -> API -> Exposed schemas instead, or include
-- every current schema here.
alter role authenticator set pgrst.db_schemas = 'public, zivvvo';
notify pgrst, 'reload schema';