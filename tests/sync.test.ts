import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialData, defaultStats } from '../src/domain/model.ts';
import type { DashboardData } from '../src/domain/model.ts';
import { createRepository, STORAGE_KEY } from '../src/data/repository.ts';
import { mergeDashboard, sharedContent } from '../src/sync/merge.ts';
import { SyncEngine } from '../src/sync/engine.ts';
import type { RemoteDashboard, SyncTransport } from '../src/sync/transport.ts';

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v));
const owner = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const baseline = () => sharedContent(createInitialData());

test('independent task fields, new records, stats, and workout completions combine', () => {
  const base = baseline(),
    local = clone(base),
    remote = clone(base);
  local.tasks[0].text = 'Leg workout';
  remote.tasks[0].completed = true;
  local.groceries.push({ id: 'new-local', text: 'Beans', completed: false });
  remote.groceries.push({ id: 'new-remote', text: 'Rice', completed: false });
  local.stats['2026-10-10'] = { ...defaultStats(), weight: 80 };
  remote.stats['2026-10-10'] = { ...defaultStats(), protein: 100 };
  local.workoutSessions['2026-10-10/1'] = ['1'];
  remote.workoutSessions['2026-10-10/1'] = ['2'];
  const merged = mergeDashboard(base, local, remote);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.data.tasks[0], {
    ...base.tasks[0],
    text: 'Leg workout',
    completed: true,
  });
  assert.equal(merged.data.groceries.length, base.groceries.length + 2);
  assert.equal(merged.data.stats['2026-10-10'].weight, 80);
  assert.equal(merged.data.stats['2026-10-10'].protein, 100);
  assert.deepEqual(new Set(merged.data.workoutSessions['2026-10-10/1']), new Set(['1', '2']));
});

test('deletes persist; deletion versus edit needs review; unrelated changes survive a choice', () => {
  const base = baseline(),
    local = clone(base),
    remote = clone(base);
  const id = local.tasks[0].id;
  local.tasks.shift();
  remote.tasks[0].text = 'Remote edited';
  remote.groceries[0].completed = true;
  assert.ok(mergeDashboard(base, local, remote).conflicts.some((p) => p.includes(id)));
  const device = mergeDashboard(base, local, remote, 'device');
  assert.equal(
    device.data.tasks.some((v) => v.id === id),
    false,
  );
  assert.equal(device.data.groceries[0].completed, true);
  assert.equal(mergeDashboard(base, local, remote, 'shared').data.tasks[0].text, 'Remote edited');
  assert.equal(
    mergeDashboard(base, local, base).data.tasks.some((v) => v.id === id),
    false,
  );
});

test('coupled odometer edits require a choice without dropping other merged records', () => {
  const base = baseline();
  base.mileage = [
    {
      id: 'shift',
      vehicle: 'BMW',
      start: 100,
      end: 200,
      date: '2026-10-10',
      shift: 'Test',
      difficulty: 'Easy',
      createdAt: '2026-10-10T10:00:00Z',
    },
  ];
  const local = clone(base),
    remote = clone(base);
  local.mileage[0].start = 180;
  remote.mileage[0].end = 150;
  remote.groceries[0].completed = true;
  assert.ok(mergeDashboard(base, local, remote).conflicts.some((p) => p.includes('odometer')));
  const merged = mergeDashboard(base, local, remote, 'device');
  assert.equal(merged.data.mileage[0].start, 180);
  assert.equal(merged.data.mileage[0].end, 200);
  assert.equal(merged.data.groceries[0].completed, true);
});

function setup() {
  let document: RemoteDashboard | null = null;
  let local: DashboardData = baseline();
  let backup: string | null = null;
  let beforeCommit: (() => void) | undefined;
  const transport: SyncTransport = {
    revision: async () => document?.revision ?? null,
    read: async () => clone(document),
    commit: async (expected, data) => {
      beforeCommit?.();
      beforeCommit = undefined;
      if ((document?.revision ?? 0) !== expected) return null;
      document = { revision: expected + 1, data: clone(data) };
      return document.revision;
    },
  };
  const store = {
    load: () => clone(local),
    save: (data: DashboardData) => {
      local = clone(data);
    },
    preserveBackup: (raw: string) => {
      backup ??= raw;
    },
  };
  const engine = new SyncEngine(owner, transport, store);
  return {
    engine,
    transport,
    store,
    get local() {
      return local;
    },
    set local(v) {
      local = v;
    },
    get document() {
      return document;
    },
    set document(v) {
      document = v;
    },
    get backup() {
      return backup;
    },
    race: (callback: () => void) => {
      beforeCommit = callback;
    },
  };
}

test('first connection preserves current records and a pre-sync copy; shared adoption backs up the other device', async () => {
  const env = setup();
  env.local.tasks = [];
  await env.engine.connect('device');
  assert.deepEqual(env.document?.data.tasks, []);
  assert.deepEqual(JSON.parse(env.backup!).tasks, []);
  assert.equal(env.local.cloudSync?.revision, 1);
  const second = setup();
  second.document = env.document;
  const original = clone(second.local);
  await second.engine.connect('shared');
  assert.deepEqual(second.local.tasks, []);
  assert.deepEqual(JSON.parse(second.backup!), original);
});

test('offline edits survive process restart and combine with a changed remote record', async () => {
  const env = setup();
  await env.engine.connect('device');
  env.local.tasks[0].completed = true;
  const updated = clone(env.document!);
  updated.revision++;
  updated.data.groceries[0].completed = true;
  env.document = updated;
  env.engine.stop();
  const restarted = new SyncEngine(owner, env.transport, env.store);
  assert.equal((await restarted.sync()).kind, 'synced');
  assert.equal(env.local.tasks[0].completed, true);
  assert.equal(env.local.groceries[0].completed, true);
  assert.equal(env.document?.data.tasks[0].completed, true);
});

test('a concurrent server write retries without overwriting it, and in-flight local edits stay pending', async () => {
  const env = setup();
  await env.engine.connect('device');
  env.local.tasks[0].completed = true;
  env.race(() => {
    env.document!.revision++;
    env.document!.data.groceries[0].completed = true;
  });
  await env.engine.sync();
  assert.equal(env.document!.data.groceries[0].completed, true);
  env.local.tasks[1].completed = true;
  env.race(() => {
    env.local.tasks[2].completed = true;
  });
  await env.engine.sync();
  assert.equal(env.local.tasks[2].completed, true);
  assert.equal(env.local.cloudSync!.base.tasks[2].completed, false);
  await env.engine.sync();
  assert.equal(env.document!.data.tasks[2].completed, true);
});

test('competing edits do not upload until reviewed; stale reviews require another review', async () => {
  const env = setup();
  await env.engine.connect('device');
  env.local.tasks[0].text = 'Device version';
  env.document!.revision++;
  env.document!.data.tasks[0].text = 'Shared version';
  const review = await env.engine.sync();
  assert.equal(review.kind, 'conflict');
  if (review.kind === 'conflict') {
    assert.match(review.details[0], /This device: Device version/);
    assert.match(review.details[0], /Shared: Shared version/);
  }
  assert.equal(env.document!.data.tasks[0].text, 'Shared version');
  env.document!.revision++;
  env.document!.data.tasks[0].text = 'New shared version';
  assert.equal((await env.engine.sync('device')).kind, 'conflict');
  await env.engine.sync('device');
  assert.equal(env.document!.data.tasks[0].text, 'Device version');
});

test('missing remote, a different account, and cancelled sessions cannot replace local data', async () => {
  const env = setup();
  await env.engine.connect('device');
  const before = clone(env.local);
  const different = new SyncEngine(other, env.transport, env.store);
  await assert.rejects(different.connect('shared'), /another account/);
  env.document = null;
  await assert.rejects(env.engine.sync(), /unavailable/);
  env.engine.stop();
  await assert.rejects(env.engine.sync(), /session changed/);
  assert.deepEqual(env.local, before);
});

test('sync metadata is validated and committed with records; exports do not carry account identity', () => {
  let raw: string | null = null;
  const repo = createRepository({
    getItem: () => raw,
    setItem: (_key, v) => {
      raw = v;
    },
  });
  const data = repo.load();
  const linked: DashboardData = {
    ...data,
    cloudSync: { userId: owner, revision: 1, base: sharedContent(data) },
  };
  repo.save(linked);
  assert.deepEqual(repo.load(), linked);
  assert.equal(Object.hasOwn(JSON.parse(repo.exportRaw()), 'cloudSync'), false);
  assert.throws(() => repo.save({ ...linked, cloudSync: { ...linked.cloudSync!, revision: -1 } }));
  assert.equal(STORAGE_KEY, 'daily-ops:data:v1');
});
