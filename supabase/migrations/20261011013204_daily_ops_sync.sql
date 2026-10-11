begin;

create table public.daily_ops_dashboards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 1 check (revision between 1 and 9007199254740991),
  document jsonb not null check (
    jsonb_typeof(document) = 'object' and coalesce(document ->> 'schemaVersion' = '1', false)
    and not document ? 'cloudSync' and octet_length(document::text) <= 2000000
  ),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.daily_ops_dashboards enable row level security;
create policy daily_ops_select on public.daily_ops_dashboards for select to authenticated
  using ((select auth.uid()) = user_id);
create policy daily_ops_insert on public.daily_ops_dashboards for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy daily_ops_update on public.daily_ops_dashboards for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

revoke all on public.daily_ops_dashboards from public, anon, authenticated;
grant select on public.daily_ops_dashboards to authenticated;
grant insert (user_id, document) on public.daily_ops_dashboards to authenticated;
grant update (document) on public.daily_ops_dashboards to authenticated;

create function public.daily_ops_touch_dashboard() returns trigger language plpgsql
  security invoker set search_path = '' as $$
begin
  new.revision := old.revision + 1;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
revoke all on function public.daily_ops_touch_dashboard() from public, anon, authenticated;
create trigger daily_ops_revision before update on public.daily_ops_dashboards
  for each row execute function public.daily_ops_touch_dashboard();

-- Compare-and-swap prevents an upload based on an old revision replacing a newer one.
create function public.daily_ops_commit(expected_revision bigint, dashboard jsonb)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare next_revision bigint;
begin
  if auth.uid() is null then raise exception 'Sign in to sync.' using errcode = '42501'; end if;
  if expected_revision = 0 then
    insert into public.daily_ops_dashboards (user_id, document)
      values (auth.uid(), dashboard) on conflict (user_id) do nothing
      returning revision into next_revision;
  else
    update public.daily_ops_dashboards set document = dashboard
      where user_id = auth.uid() and revision = expected_revision
      returning revision into next_revision;
  end if;
  return next_revision;
end;
$$;
revoke all on function public.daily_ops_commit(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.daily_ops_commit(bigint, jsonb) to authenticated;

commit;
