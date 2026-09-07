-- Records how each leaderboard entry arrived in the DB.
-- The submit-score Edge Function writes every row with source = 'app'.
-- The public REST API has no INSERT policy on scores, so there is no other
-- writer; this column just makes origin auditable.
alter table public.scores add column if not exists source text not null default 'app';