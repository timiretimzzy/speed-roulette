-- Rate limiter for score submissions (one row per name, sliding window counters)
create table if not exists public.rate_limits (
  name text primary key,
  window_start timestamptz not null default now(),
  count int not null default 0
);

alter table public.rate_limits enable row level security;

-- No policies: the table is only touched by the Edge Function (service-role
-- key, which bypasses RLS) via this RPC. The public anon key cannot read or
-- write it.

-- Atomic check-and-increment. Returns true if a new submission is allowed,
-- false if the racer has exceeded the window limit.
create or replace function public.rate_limit_allow(
  p_name text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $FUNC$
declare
  v_reset boolean;
  v_count int;
begin
  insert into public.rate_limits (name, window_start, count)
  values (p_name, now(), 0)
  on conflict (name) do nothing;

  select (r.window_start < now() - make_interval(secs => p_window_seconds)), r.count
  into v_reset, v_count
  from public.rate_limits r
  where r.name = p_name
  for update;

  if v_reset then
    v_count := 1;
    update public.rate_limits set window_start = now(), count = 1 where name = p_name;
  else
    v_count := v_count + 1;
    update public.rate_limits set count = v_count where name = p_name;
  end if;

  return v_count <= p_max;
end;
$FUNC$;