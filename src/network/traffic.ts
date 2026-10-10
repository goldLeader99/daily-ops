/** The source adapter must establish that these counters belong to the gateway's WAN. */
export type WanCounters = {
  sourceId: string;
  interfaceId: string;
  observedAtMs: number;
  receivedBytes: string;
  sentBytes: string;
  uptimeSeconds?: number;
};

export type TrafficReading =
  | {
      state: 'waiting' | 'source-changed' | 'reset' | 'gap';
      observedAtMs: number;
    }
  | {
      state: 'live';
      observedAtMs: number;
      intervalMs: number;
      downloadMbps: number;
      uploadMbps: number;
    };

const MAX_COUNTER = 18446744073709551615n;

function byteCounter(raw: string): bigint {
  if (typeof raw !== 'string' || !/^\d{1,20}$/.test(raw))
    throw new Error('Invalid WAN byte counter.');
  const value = BigInt(raw);
  if (value > MAX_COUNTER) throw new Error('WAN byte counter exceeds 64 bits.');
  return value;
}

function validate(sample: WanCounters) {
  if (
    !sample.sourceId.trim() ||
    !sample.interfaceId.trim() ||
    !Number.isSafeInteger(sample.observedAtMs) ||
    sample.observedAtMs < 0 ||
    (sample.uptimeSeconds !== undefined &&
      (!Number.isFinite(sample.uptimeSeconds) || sample.uptimeSeconds < 0))
  )
    throw new Error('Invalid WAN sample identity or time.');
  return { received: byteCounter(sample.receivedBytes), sent: byteCounter(sample.sentBytes) };
}

/** Rates are averages over the actual interval between two verified counter readings. */
export function measureTraffic(
  previous: WanCounters | null,
  current: WanCounters,
  maxIntervalMs = 10_000,
): TrafficReading {
  if (!Number.isFinite(maxIntervalMs) || maxIntervalMs <= 0)
    throw new Error('Invalid live traffic interval.');
  const next = validate(current);
  const observedAtMs = current.observedAtMs;
  if (!previous) return { state: 'waiting', observedAtMs };
  const before = validate(previous);
  if (previous.sourceId !== current.sourceId || previous.interfaceId !== current.interfaceId)
    return { state: 'source-changed', observedAtMs };
  if (
    next.received < before.received ||
    next.sent < before.sent ||
    (previous.uptimeSeconds !== undefined &&
      current.uptimeSeconds !== undefined &&
      current.uptimeSeconds < previous.uptimeSeconds)
  )
    return { state: 'reset', observedAtMs };
  const intervalMs = current.observedAtMs - previous.observedAtMs;
  if (intervalMs <= 0 || intervalMs > maxIntervalMs) return { state: 'gap', observedAtMs };
  return {
    state: 'live',
    observedAtMs,
    intervalMs,
    downloadMbps: (Number(next.received - before.received) * 8) / intervalMs / 1000,
    uploadMbps: (Number(next.sent - before.sent) * 8) / intervalMs / 1000,
  };
}
