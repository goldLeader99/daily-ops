export type HomeTraffic = {
  source_id: string;
  download_mbps: number;
  upload_mbps: number;
  captured_at: string;
  age_ms: number;
};
export const HOME_FRESH_MS = 15_000;
export function homeTraffic(value: unknown): HomeTraffic {
  const row = value as HomeTraffic;
  if (
    !row ||
    typeof row.source_id !== 'string' ||
    !/^[a-fA-F0-9-]{32,36}$/.test(row.source_id) ||
    ![row.download_mbps, row.upload_mbps].every(
      (n) => Number.isFinite(n) && n >= 0 && n <= 100_000,
    ) ||
    !Number.isFinite(row.age_ms) ||
    row.age_ms < 0 ||
    typeof row.captured_at !== 'string' ||
    !Number.isFinite(Date.parse(row.captured_at))
  )
    throw new Error('The shared traffic reading is invalid.');
  return row;
}
export function homeTrafficAge(
  sample: HomeTraffic,
  receivedAt: number,
  now: number,
  requestMs = 0,
) {
  // Use server-computed age plus round-trip time and monotonic elapsed time.
  // A changed phone clock or delayed response cannot make a stale reading live.
  return sample.age_ms + Math.max(0, requestMs) + Math.max(0, now - receivedAt);
}
