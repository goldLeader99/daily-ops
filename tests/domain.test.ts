import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateMileage,
  createInitialData,
  createItem,
  defaultStats,
  deleteItem,
  editItem,
  localDate,
  safeActionUrl,
  sessionKey,
  toggleItem,
  validDate,
} from '../src/domain/model.ts';
import { createRepository, parseData, STORAGE_KEY, validateData } from '../src/data/repository.ts';

test('task creation trims input, creates unique IDs, and rejects empty tasks', () => {
  const task = createItem('  Workout  ');
  assert.equal(task.text, 'Workout');
  assert.equal(task.completed, false);
  assert.notEqual(task.id, createItem('Workout').id);
  assert.throws(() => createItem('  '));
  assert.throws(() => createItem('x'.repeat(121)));
});
test('completion is reversible and does not mutate the source list', () => {
  const task = createItem('Groceries');
  const original = [task];
  const done = toggleItem(original, task.id);
  assert.equal(done[0].completed, true);
  assert.equal(original[0].completed, false);
  assert.equal(toggleItem(done, task.id)[0].completed, false);
});
test('editing preserves task identity and deletion targets only the chosen task', () => {
  const a = createItem('First');
  const b = createItem('Second');
  const edited = editItem([a, b], a.id, 'Updated');
  assert.deepEqual(edited[0], { ...a, text: 'Updated' });
  assert.deepEqual(deleteItem(edited, a.id), [b]);
  assert.equal(deleteItem(edited, 'missing').length, 2);
});
test('mileage calculation handles real odometers, decimals, and zero-distance shifts', () => {
  assert.equal(calculateMileage(163088, 163181), 93);
  assert.equal(calculateMileage(100.1, 100.3), 0.2);
  assert.equal(calculateMileage(100, 100), 0);
});
test('mileage rejects negative, reversed, infinite, and NaN readings', () => {
  for (const [start, end] of [
    [-1, 100],
    [200, 100],
    [NaN, 1],
    [1, Infinity],
    [0, 10000001],
  ])
    assert.throws(() => calculateMileage(start, end));
});
test('a fresh repository persists once and reloads after a simulated restart', () => {
  const values = new Map<string, string>();
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  const repo = createRepository(storage);
  const data = repo.load();
  data.tasks.push(createItem('Persist me'));
  data.tasks = toggleItem(data.tasks, data.tasks.at(-1)!.id);
  repo.save(data);
  assert.deepEqual(createRepository(storage).load(), data);
  const exported = repo.exportRaw();
  data.tasks = [];
  repo.save(data);
  repo.restore(exported);
  assert.equal(repo.load().tasks.at(-1)!.completed, true);
});
test('corrupt data and unsupported versions are preserved rather than silently reset', () => {
  let raw = '{broken';
  const repo = createRepository({
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  });
  assert.throws(() => repo.load());
  assert.equal(raw, '{broken');
  raw = JSON.stringify({ ...createInitialData(), schemaVersion: 99 });
  const before = raw;
  assert.throws(() => repo.load());
  assert.equal(raw, before);
});
test('failed storage writes surface a recoverable error and preserve existing data', () => {
  const original = JSON.stringify(createInitialData());
  const repo = createRepository({
    getItem: () => original,
    setItem: () => {
      throw new Error('QuotaExceededError');
    },
  });
  const data = repo.load();
  data.tasks = [];
  assert.throws(() => repo.save(data), /Could not save/);
  assert.equal(repo.exportRaw(), original);
});
test('invalid restores never overwrite valid saved data', () => {
  let raw = JSON.stringify(createInitialData());
  const repo = createRepository({
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  });
  const invalid = createInitialData();
  invalid.quickActions[0].target = 'javascript:alert(1)';
  const original = raw;
  assert.throws(() => repo.restore(JSON.stringify(invalid)));
  assert.equal(raw, original);
  assert.equal(STORAGE_KEY, 'daily-ops:data:v1');
});
test('validation rejects malformed nested records, duplicate IDs, and invalid dates', () => {
  const data = createInitialData();
  data.tasks.push(data.tasks[0]);
  assert.throws(() => validateData(data));
  const badStats = createInitialData();
  badStats.stats['2026-02-30'] = defaultStats();
  assert.throws(() => validateData(badStats));
  const badWorkout = createInitialData();
  badWorkout.workoutSessions['2026-09-28/1'] = ['100'];
  assert.throws(() => validateData(badWorkout));
  const badMileage = createInitialData();
  badMileage.mileage.push({
    id: 'a',
    vehicle: 'BMW',
    start: 10,
    end: 9,
    date: '2026-09-28',
    shift: 'AM',
    difficulty: 'Easy',
    createdAt: new Date().toISOString(),
  });
  assert.throws(() => validateData(badMileage));
});
test('date keys use local calendar dates and workout sessions do not leak across days', () => {
  assert.equal(localDate(new Date(2026, 8, 28, 23, 59)), '2026-09-28');
  assert.equal(validDate('2024-02-29'), true);
  assert.equal(validDate('2026-02-29'), false);
  assert.notEqual(sessionKey('2026-09-28', 1), sessionKey('2026-09-29', 1));
  assert.notEqual(sessionKey('2026-09-28', 1), sessionKey('2026-09-28', 2));
  assert.equal(defaultStats().weight, null);
});
test('quick actions accept web URLs and reject unsafe schemes or credentials', () => {
  for (const value of ['', 'https://open.spotify.com', 'http://192.168.1.50:8123'])
    assert.equal(safeActionUrl(value), true);
  for (const value of [
    'javascript:alert(1)',
    'data:text/html,a',
    'file:///etc/passwd',
    'https://user:pass@example.com',
    'not a url',
  ])
    assert.equal(safeActionUrl(value), false);
});
test('all default and populated sections survive JSON serialization', () => {
  const data = createInitialData();
  data.stats['2026-09-28'] = {
    weight: 88.6,
    protein: 82,
    proteinGoal: 120,
    water: 2.1,
    activity: true,
  };
  data.workoutSessions['2026-09-28/2'] = ['1', '3'];
  data.projects[0].tasks.push(createItem('Build API'));
  data.mileage.push({
    id: 'trip-1',
    vehicle: 'BMW',
    start: 100,
    end: 193,
    date: '2026-09-28',
    shift: 'Morning',
    difficulty: 'Moderate',
    createdAt: new Date().toISOString(),
  });
  assert.deepEqual(parseData(JSON.stringify(data)), data);
});
