begin;

-- One current reading per owner; no router credentials, addresses, or device list.
create table public.daily_ops_home_traffic (
  user_id uuid primary key references auth.users(id) on delete cascade,
  source_id text not null check (source_id ~ '^[a-fA-F0-9-]{32,36}$'),
  download_mbps double precision not null check (download_mbps between 0 and 100000),
  upload_mbps double precision not null check (upload_mbps between 0 and 100000),
  captured_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp()
);
alter table public.daily_ops_home_traffic enable row level security;
create policy daily_ops_traffic_select on public.daily_ops_home_traffic for select to authenticated
  using ((select auth.uid()) = user_id);
create policy daily_ops_traffic_insert on public.daily_ops_home_traffic for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy daily_ops_traffic_update on public.daily_ops_home_traffic for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
revoke all on public.daily_ops_home_traffic from public, anon, authenticated;
grant select on public.daily_ops_home_traffic to authenticated;
grant insert (user_id, source_id, download_mbps, upload_mbps, captured_at)
  on public.daily_ops_home_traffic to authenticated;
grant update (source_id, download_mbps, upload_mbps, captured_at)
  on public.daily_ops_home_traffic to authenticated;

create function public.daily_ops_touch_traffic() returns trigger language plpgsql
  security invoker set search_path = '' as $$
begin
  -- An incorrect device clock must never make a future sample stay live.
  if new.captured_at > clock_timestamp() + interval '5 seconds'
    or new.captured_at < clock_timestamp() - interval '20 seconds' then
    raise exception 'Reading is old or device clock is incorrect.' using errcode = '22023';
  end if;
  new.captured_at := least(new.captured_at, clock_timestamp());
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.daily_ops_touch_traffic() from public, anon, authenticated;
create trigger daily_ops_traffic_time before insert or update on public.daily_ops_home_traffic
  for each row execute function public.daily_ops_touch_traffic();

create function public.daily_ops_publish_traffic(
  source text, download double precision, upload double precision, captured timestamptz
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare accepted boolean;
begin
  if auth.uid() is null then raise exception 'Sign in to share traffic.' using errcode = '42501'; end if;
  insert into public.daily_ops_home_traffic
    (user_id, source_id, download_mbps, upload_mbps, captured_at)
    values (auth.uid(), source, download, upload, captured)
    on conflict (user_id) do update set source_id = excluded.source_id,
      download_mbps = excluded.download_mbps, upload_mbps = excluded.upload_mbps,
      captured_at = excluded.captured_at
      where daily_ops_home_traffic.source_id = excluded.source_id
        or daily_ops_home_traffic.updated_at < clock_timestamp() - interval '30 seconds'
    returning true into accepted;
  return coalesce(accepted, false);
end;
$$;
create function public.daily_ops_read_traffic()
returns table (source_id text, download_mbps double precision, upload_mbps double precision,
  captured_at timestamptz, age_ms double precision)
language sql stable security invoker set search_path = '' as $$
  select t.source_id, t.download_mbps, t.upload_mbps, t.captured_at,
    greatest(0, extract(epoch from (statement_timestamp() - t.captured_at)) * 1000)::double precision
  from public.daily_ops_home_traffic t where t.user_id = (select auth.uid());
$$;
revoke all on function public.daily_ops_publish_traffic(text, double precision, double precision, timestamptz)
  from public, anon, authenticated;
revoke all on function public.daily_ops_read_traffic() from public, anon, authenticated;
grant execute on function public.daily_ops_publish_traffic(text, double precision, double precision, timestamptz)
  to authenticated;
grant execute on function public.daily_ops_read_traffic() to authenticated;

commit;
