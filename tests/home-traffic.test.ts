import test from 'node:test';
import assert from 'node:assert/strict';
import { HOME_FRESH_MS, homeTraffic, homeTrafficAge } from '../src/sync/homeTraffic';

test('home traffic freshness uses server age, request delay, and monotonic elapsed time', () => {
  const sample = homeTraffic({
    source_id: '11111111-1111-4111-8111-111111111111',
    download_mbps: 0,
    upload_mbps: 2.5,
    captured_at: '2026-10-10T21:00:00Z',
    age_ms: 5000,
  });
  assert.equal(homeTrafficAge(sample, 1000, 4000, 2000), 10000);
  assert.ok(homeTrafficAge(sample, 1000, 12000, 2000) > HOME_FRESH_MS);
  assert.equal(homeTrafficAge(sample, 1000, 0), 5000);
  for (const invalid of [
    null,
    { ...sample, upload_mbps: NaN },
    { ...sample, download_mbps: -1 },
    { ...sample, age_ms: -1 },
    { ...sample, captured_at: 'invalid' },
    { ...sample, source_id: 'router-private-address' },
  ])
    assert.throws(() => homeTraffic(invalid));
});
