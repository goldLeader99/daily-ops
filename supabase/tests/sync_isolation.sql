-- Administrator verification. No usable credentials are created; fixtures roll back.
begin;
select set_config('daily_ops.test_a', gen_random_uuid()::text, true);
select set_config('daily_ops.test_b', gen_random_uuid()::text, true);
insert into auth.users (id, aud, role, email, created_at, updated_at)
select current_setting('daily_ops.test_a')::uuid, 'authenticated', 'authenticated',
  current_setting('daily_ops.test_a') || '@fixture.invalid', now(), now()
union all
select current_setting('daily_ops.test_b')::uuid, 'authenticated', 'authenticated',
  current_setting('daily_ops.test_b') || '@fixture.invalid', now(), now();

set local role authenticated;
select set_config('request.jwt.claim.sub', current_setting('daily_ops.test_a'), true);
do $$ begin
  assert public.daily_ops_commit(0, '{"schemaVersion":1,"fixture":1}') = 1;
  assert public.daily_ops_commit(1, '{"schemaVersion":1,"fixture":2}') = 2;
  assert public.daily_ops_commit(1, '{"schemaVersion":1,"fixture":"stale"}') is null;
  assert (select document ->> 'fixture' from public.daily_ops_dashboards) = '2';
  begin
    perform public.daily_ops_commit(2, '{}');
    raise exception 'Missing schema version accepted';
  exception when check_violation then null; end;
  begin
    update public.daily_ops_dashboards set revision = 999;
    raise exception 'Client changed server revision';
  exception when insufficient_privilege then null; end;
  assert public.daily_ops_publish_traffic('11111111-1111-4111-8111-111111111111', 8, 1, clock_timestamp());
  assert (select count(*) from public.daily_ops_read_traffic()) = 1;
  assert not public.daily_ops_publish_traffic('22222222-2222-4222-8222-222222222222', 10, 2, clock_timestamp());
  begin
    perform public.daily_ops_publish_traffic('11111111-1111-4111-8111-111111111111', 8, 1, clock_timestamp() + interval '1 hour');
    raise exception 'Future reading accepted';
  exception when invalid_parameter_value then null; end;
end $$;

select set_config('request.jwt.claim.sub', current_setting('daily_ops.test_b'), true);
do $$ declare changed integer; begin
  assert (select count(*) from public.daily_ops_dashboards) = 0;
  assert (select count(*) from public.daily_ops_home_traffic) = 0;
  assert (select count(*) from public.daily_ops_read_traffic()) = 0;
  update public.daily_ops_dashboards set document = '{"schemaVersion":1}'
    where user_id = current_setting('daily_ops.test_a')::uuid;
  get diagnostics changed = row_count;
  assert changed = 0;
  begin
    insert into public.daily_ops_dashboards (user_id, document)
      values (current_setting('daily_ops.test_a')::uuid, '{"schemaVersion":1}');
    raise exception 'Other owner writable';
  exception when insufficient_privilege then null; end;
end $$;

set local role anon;
do $$ begin
  begin
    perform * from public.daily_ops_dashboards;
    raise exception 'Anonymous records readable';
  exception when insufficient_privilege then null; end;
  begin
    perform public.daily_ops_commit(0, '{"schemaVersion":1}');
    raise exception 'Anonymous RPC executable';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
select 'PASS: owners isolated, stale writes rejected, traffic guarded, fixtures rolled back' as verification;
