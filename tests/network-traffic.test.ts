import { test } from 'node:test';
import assert from 'node:assert/strict';
import { measureTraffic } from '../src/network/traffic.ts';
import type { WanCounters } from '../src/network/traffic.ts';

const sample = (changes: Partial<WanCounters> = {}): WanCounters => ({
  sourceId: 'test-gateway-wan',
  interfaceId: 'wan-interface',
  observedAtMs: 1000,
  receivedBytes: '1000000',
  sentBytes: '500000',
  uptimeSeconds: 60,
  ...changes,
});

test('WAN rates use actual elapsed time and keep download/upload direction separate', () => {
  assert.deepEqual(
    measureTraffic(
      sample(),
      sample({ observedAtMs: 3500, receivedBytes: '7250000', sentBytes: '1750000' }),
    ),
    { state: 'live', observedAtMs: 3500, intervalMs: 2500, downloadMbps: 20, uploadMbps: 4 },
  );
});

test('first WAN reading waits for a second measurement instead of inventing zero traffic', () => {
  assert.deepEqual(measureTraffic(null, sample()), { state: 'waiting', observedAtMs: 1000 });
});

test('unchanged valid counters report genuine idle traffic', () => {
  assert.deepEqual(measureTraffic(sample(), sample({ observedAtMs: 3000 })), {
    state: 'live',
    observedAtMs: 3000,
    intervalMs: 2000,
    downloadMbps: 0,
    uploadMbps: 0,
  });
});

test('64-bit cumulative totals preserve small deltas beyond JavaScript integer precision', () => {
  const base = 18446744073700000000n;
  const before = sample({ receivedBytes: String(base), sentBytes: String(base) });
  const current = sample({
    observedAtMs: 3000,
    receivedBytes: String(base + 250001n),
    sentBytes: String(base + 125001n),
  });
  const reading = measureTraffic(before, current);
  assert.equal(reading.state, 'live');
  if (reading.state !== 'live') throw new Error('Expected measured traffic');
  assert.ok(Math.abs(reading.downloadMbps - 1.000004) < 1e-12);
  assert.ok(Math.abs(reading.uploadMbps - 0.500004) < 1e-12);
});

test('decreased counters and router reboots require a fresh baseline', () => {
  for (const changes of [
    { receivedBytes: '0' },
    { sentBytes: '0' },
    { uptimeSeconds: 1, receivedBytes: '2000000', sentBytes: '1000000' },
  ])
    assert.deepEqual(measureTraffic(sample(), sample({ observedAtMs: 3000, ...changes })), {
      state: 'reset',
      observedAtMs: 3000,
    });
  const reset = sample({ observedAtMs: 3000, receivedBytes: '0', sentBytes: '0', uptimeSeconds: 1 });
  const next = sample({ observedAtMs: 5000, uptimeSeconds: 3 });
  const reading = measureTraffic(reset, next);
  assert.equal(reading.state, 'live');
});

test('changing gateway or WAN interface does not compare unrelated counters', () => {
  for (const change of [{ sourceId: 'another-gateway' }, { interfaceId: 'another-wan' }])
    assert.deepEqual(measureTraffic(sample(), sample({ ...change, observedAtMs: 3000 })), {
      state: 'source-changed',
      observedAtMs: 3000,
    });
});

test('paused sampling and backwards or duplicate clocks do not appear as live rates', () => {
  for (const observedAtMs of [999, 1000, 11001])
    assert.deepEqual(measureTraffic(sample(), sample({ observedAtMs })), {
      state: 'gap',
      observedAtMs,
    });
});

test('invalid counter values fail rather than becoming a plausible traffic reading', () => {
  for (const receivedBytes of ['', '-1', '1.5', 'NaN', '1e6', '18446744073709551616']) {
    assert.throws(() => measureTraffic(null, sample({ receivedBytes })), /counter/);
    assert.throws(() => measureTraffic(sample({ receivedBytes }), sample()), /counter/);
  }
  for (const changes of [
    { observedAtMs: NaN },
    { observedAtMs: -1 },
    { uptimeSeconds: Infinity },
    { sourceId: '' },
    { interfaceId: '' },
  ])
    assert.throws(() => measureTraffic(null, sample(changes)), /sample/);
});
