import { useEffect, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { isIOS } from '../native';
import { DEFAULT_GATEWAY_DESCRIPTION, gatewayURL, WanSource } from './upnp';
import { measureTraffic } from './traffic';
import type { TrafficReading, WanCounters } from './traffic';

type LiveReading = Extract<TrafficReading, { state: 'live' }>;
type Preferences = { descriptionURL: string; enabled: boolean };
type Observation = {
  last: LiveReading | null;
  capturedAtMs: number | null;
  history: LiveReading[];
  message: string;
  phase: string;
  linkStatus: string | null;
};
const initial: Observation = {
  last: null,
  capturedAtMs: null,
  history: [],
  message: '',
  phase: 'connecting',
  linkStatus: null,
};
const KEY = 'daily-ops-network-v1';

function preferences(): Preferences {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    if (raw && typeof raw.descriptionURL === 'string' && typeof raw.enabled === 'boolean')
      return { descriptionURL: gatewayURL(raw.descriptionURL).href, enabled: raw.enabled };
  } catch {
    /* Noncritical connection settings can fall back without touching personal records. */
  }
  return { descriptionURL: DEFAULT_GATEWAY_DESCRIPTION, enabled: true };
}

export function useWanTraffic() {
  const [settings, setSettings] = useState(preferences);
  const [observation, setObservation] = useState(initial);
  const [generation, setGeneration] = useState(0);
  const [foreground, setForeground] = useState(!document.hidden);
  useEffect(() => {
    const visibility = () => setForeground(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    const listener = isIOS
      ? NativeApp.addListener('appStateChange', ({ isActive }) => setForeground(isActive))
      : null;
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      if (listener) void listener.then((handle) => handle.remove());
    };
  }, []);
  useEffect(() => {
    if (!isIOS || !settings.enabled || !foreground) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    let previous: WanCounters | null = null;
    const source = new WanSource(settings.descriptionURL);
    setObservation((before) => ({ ...before, message: '', phase: 'connecting' }));
    const poll = async () => {
      const started = performance.now();
      try {
        const sample = await source.sample();
        if (cancelled) return;
        const reading = measureTraffic(previous, sample.counters);
        previous = sample.counters;
        setObservation((before) => ({
          last: reading.state === 'live' ? reading : before.last,
          capturedAtMs: reading.state === 'live' ? sample.capturedAtMs : before.capturedAtMs,
          history:
            reading.state === 'live'
              ? [
                  ...before.history.filter(
                    (point) => point.observedAtMs >= reading.observedAtMs - 60_000,
                  ),
                  reading,
                ].slice(-31)
              : before.history,
          phase: reading.state === 'live' ? 'live' : 'waiting',
          message: reading.state === 'reset' ? 'Counters restarted. Taking a fresh baseline.' : '',
          linkStatus: sample.linkStatus,
        }));
      } catch (error) {
        if (cancelled) return;
        previous = null;
        setObservation((before) => ({
          ...before,
          phase: 'unavailable',
          message: error instanceof Error ? error.message : 'Could not read the gateway.',
        }));
      }
      if (!cancelled)
        timer = setTimeout(() => void poll(), Math.max(0, 2000 - (performance.now() - started)));
    };
    void poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [settings, generation, foreground]);
  const configure = (descriptionURL: string, enabled = true) => {
    const next = { descriptionURL: gatewayURL(descriptionURL.trim()).href, enabled };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* Readings still work this session. */
    }
    if (next.descriptionURL !== settings.descriptionURL) setObservation(initial);
    setSettings(next);
  };
  const status = !isIOS
    ? 'iPad app'
    : !settings.enabled
      ? 'paused'
      : !foreground
        ? 'paused'
        : observation.phase === 'live' &&
            observation.last &&
            performance.now() - observation.last.observedAtMs > 6000
          ? 'stale'
          : observation.phase;
  return {
    ...observation,
    status,
    settings,
    supported: isIOS,
    configure,
    retry: () => setGeneration((value) => value + 1),
    pause: () => configure(settings.descriptionURL, !settings.enabled),
  };
}
export type WanMonitor = ReturnType<typeof useWanTraffic>;
