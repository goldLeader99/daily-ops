import { useEffect, useRef, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { isIOS } from '../native';
import { newId } from '../domain/model';
import type { WanMonitor } from '../network/useWanTraffic';
import { cloudClient } from './client';
import { HOME_FRESH_MS, homeTraffic, homeTrafficAge } from './homeTraffic';
import type { HomeTraffic } from './homeTraffic';

const KEY = 'daily-ops-home-source-v1';
type Source = { enabled: boolean; id: string };
function source(): Source {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Source;
    if (value && typeof value.enabled === 'boolean' && /^[a-fA-F0-9-]{32,36}$/.test(value.id))
      return value;
  } catch {
    /* Optional network preferences never replace personal data. */
  }
  return { enabled: false, id: newId() };
}
export function useHomeTraffic(local: WanMonitor, userId: string | null) {
  const [settings, setSettings] = useState(source);
  const [active, setActive] = useState(!document.hidden);
  const [sample, setSample] = useState<{
    row: HomeTraffic;
    receivedAt: number;
    requestMs: number;
  } | null>(null);
  const [history, setHistory] = useState<WanMonitor['history']>([]);
  const [message, setMessage] = useState('');
  const [publishMessage, setPublishMessage] = useState('');
  const [now, setNow] = useState(performance.now());
  const current = useRef(local);
  current.current = local;

  useEffect(() => {
    const change = () => setActive(!document.hidden);
    document.addEventListener('visibilitychange', change);
    const listener = isIOS
      ? NativeApp.addListener('appStateChange', ({ isActive }) => setActive(isActive))
      : null;
    return () => {
      document.removeEventListener('visibilitychange', change);
      void listener?.then((v) => v.remove());
    };
  }, []);
  useEffect(() => {
    setSample(null);
    setHistory([]);
    setMessage('');
    setPublishMessage('');
  }, [userId]);
  useEffect(() => {
    if (!userId || !active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      const started = performance.now();
      try {
        const { data, error } = await cloudClient().rpc('daily_ops_read_traffic');
        if (stopped) return;
        if (error) throw error;
        if (!Array.isArray(data)) throw new Error('Could not read home traffic.');
        if (!data.length) {
          setSample(null);
          setHistory([]);
        } else {
          const row = homeTraffic(data[0]);
          const receivedAt = performance.now(),
            requestMs = receivedAt - started;
          setSample({ row, receivedAt, requestMs });
          const age = homeTrafficAge(row, receivedAt, receivedAt, requestMs);
          if (age <= HOME_FRESH_MS)
            setHistory((before) => {
              const observedAtMs = Math.max(0, receivedAt - age);
              if (
                before.length &&
                Math.abs(before[before.length - 1].observedAtMs - observedAtMs) < 1000
              )
                return before;
              return [
                ...before.filter((p) => p.observedAtMs >= receivedAt - 60_000),
                {
                  state: 'live',
                  observedAtMs,
                  intervalMs: 5000,
                  downloadMbps: row.download_mbps,
                  uploadMbps: row.upload_mbps,
                },
              ].slice(-15) as WanMonitor['history'];
            });
        }
        setMessage('');
      } catch (e) {
        if (!stopped) setMessage((e as Error).message);
      }
      if (!stopped) timer = setTimeout(() => void poll(), 5000);
    };
    void poll();
    const tick = setInterval(() => setNow(performance.now()), 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      clearInterval(tick);
    };
  }, [userId, active]);

  useEffect(() => {
    if (!userId || !settings.enabled || !isIOS || !active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const publish = async () => {
      const reading = current.current;
      if (
        reading.status === 'live' &&
        reading.last &&
        reading.capturedAtMs &&
        performance.now() - reading.last.observedAtMs <= 6000
      ) {
        try {
          const { data, error } = await cloudClient().rpc('daily_ops_publish_traffic', {
            source: settings.id,
            download: reading.last.downloadMbps,
            upload: reading.last.uploadMbps,
            captured: new Date(reading.capturedAtMs).toISOString(),
          });
          if (error) throw error;
          if (!stopped)
            setPublishMessage(
              data
                ? ''
                : 'Another home device is sharing. Pause its sharing and wait 30 seconds before using this device.',
            );
        } catch (e) {
          if (!stopped) setPublishMessage((e as Error).message);
        }
      }
      if (!stopped) timer = setTimeout(() => void publish(), 5000);
    };
    void publish();
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [userId, settings, active]);

  const configure = (enabled: boolean) => {
    const next = { ...settings, enabled };
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      throw new Error('Could not save the home sharing setting.');
    }
    setSettings(next);
    setPublishMessage('');
  };
  const age = sample
    ? homeTrafficAge(sample.row, sample.receivedAt, now, sample.requestMs)
    : Infinity;
  const fresh = active && age <= HOME_FRESH_MS;
  const useShared =
    !!userId && (!isIOS || !settings.enabled) && (sample !== null || local.status !== 'live');
  const monitor: WanMonitor = useShared
    ? {
        ...local,
        status: fresh ? 'home live' : sample ? 'home stale' : 'home unavailable',
        last: sample
          ? {
              state: 'live',
              observedAtMs: Math.max(0, performance.now() - age),
              intervalMs: 5000,
              downloadMbps: sample.row.download_mbps,
              uploadMbps: sample.row.upload_mbps,
            }
          : null,
        capturedAtMs: sample ? Date.parse(sample.row.captured_at) : null,
        history,
        message:
          message ||
          (fresh
            ? ''
            : 'Home readings need the iPad online with Daily Ops open and sharing enabled.'),
      }
    : local;
  return {
    monitor,
    sharing: !!userId && isIOS,
    enabled: settings.enabled,
    configure,
    message: publishMessage || message,
    remote: useShared,
  };
}
export type HomeMonitor = ReturnType<typeof useHomeTraffic>;
