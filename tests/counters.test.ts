import { test } from 'node:test';
import assert from 'node:assert/strict';
import { counterDays, counterStartDate, createInitialData } from '../src/domain/model.ts';
import { createRepository, parseData, validateData } from '../src/data/repository.ts';

test('counters count local calendar boundaries, including DST and leap days', () => {
  assert.equal(counterDays(null, '2026-09-28'), null);
  assert.equal(counterDays('2026-09-28', '2026-09-28'), 0);
  assert.equal(counterDays('2026-09-13', '2026-09-28'), 15);
  assert.equal(counterDays('2026-03-07', '2026-03-09'), 2);
  assert.equal(counterDays('2026-10-31', '2026-11-02'), 2);
  assert.equal(counterDays('2024-02-28', '2024-03-01'), 2);
  assert.equal(counterDays('2026-09-29', '2026-09-28'), 0);
  assert.throws(() => counterDays('2026-02-30', '2026-09-28'));
});

test('setting or resetting a counter converts whole day counts to start dates', () => {
  assert.equal(counterStartDate(0, '2026-09-28'), '2026-09-28');
  assert.equal(counterStartDate(15, '2026-09-28'), '2026-09-13');
  assert.equal(counterStartDate(1, '2026-01-01'), '2025-12-31');
  for (const days of [-1, 1.5, NaN, Infinity, 36501]) {
    assert.throws(() => counterStartDate(days, '2026-09-28'));
  }
});

test('old v1 data gains unset counters without losing records or rewriting the saved copy', () => {
  const { counters: _counters, ...legacy } = createInitialData();
  legacy.tasks[0].completed = true;
  let raw = JSON.stringify(legacy);
  const original = raw;
  const repository = createRepository({
    getItem: () => raw,
    setItem: (_, value) => {
      raw = value;
    },
  });
  const migrated = repository.load();
  assert.deepEqual(migrated.counters, { cigarettes: null, alcohol: null });
  assert.deepEqual(migrated.tasks, legacy.tasks);
  assert.equal(raw, original);
  const updated = { ...migrated, counters: { cigarettes: '2026-09-13', alcohol: '2026-08-19' } };
  repository.save(updated);
  assert.deepEqual(repository.load().counters, updated.counters);
  assert.deepEqual(parseData(repository.exportRaw()).counters, updated.counters);
});

test('malformed counter data is rejected instead of resetting it', () => {
  for (const counters of [
    null,
    {},
    { cigarettes: '2026-02-30', alcohol: null },
    { cigarettes: 5, alcohol: null },
  ]) {
    const data = { ...createInitialData(), counters };
    assert.throws(() => validateData(data));
    assert.throws(() => parseData(JSON.stringify(data)));
  }
});
