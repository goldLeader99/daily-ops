import { useState } from 'react';
import type { WanMonitor } from '../network/useWanTraffic';
import type { HomeMonitor } from '../sync/useHomeTraffic';

const rate = (value: number | undefined) =>
  value === undefined
    ? '—'
    : value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const labels: Record<string, string> = {
  live: 'LIVE',
  connecting: 'CONNECTING',
  waiting: 'SAMPLING',
  unavailable: 'UNAVAILABLE',
  stale: 'STALE',
  paused: 'PAUSED',
  'iPad app': 'IPAD APP',
  'home live': 'HOME LIVE',
  'home stale': 'HOME STALE',
  'home unavailable': 'HOME UNAVAILABLE',
};
const live = (status: string) => status === 'live' || status === 'home live';

export function NetworkSummary({ monitor }: { monitor: WanMonitor }) {
  return (
    <>
      <span className="network-label">
        NETWORK <small>{labels[monitor.status]}</small>
      </span>
      <span className={live(monitor.status) ? 'network-rates' : 'network-rates muted'}>
        <span>↓ {rate(monitor.last?.downloadMbps)}</span>
        <span>↑ {rate(monitor.last?.uploadMbps)}</span>
        <small>Mbps</small>
      </span>
    </>
  );
}

function TrafficChart({
  monitor,
  direction,
}: {
  monitor: WanMonitor;
  direction: 'downloadMbps' | 'uploadMbps';
}) {
  const points = monitor.history;
  if (points.length < 2) return <p className="empty">Waiting for traffic history.</p>;
  const end = performance.now();
  const visible = points.filter((point) => point.observedAtMs >= end - 60_000);
  if (visible.length < 2) return <p className="empty">Waiting for recent traffic history.</p>;
  const peak = Math.max(...visible.map((point) => point[direction]));
  const maximum = Math.max(0.01, peak);
  const path = visible
    .map((point, index) => {
      const x = ((point.observedAtMs - (end - 60_000)) / 60_000) * 300;
      const y = 78 - (point[direction] / maximum) * 70;
      const gap = index === 0 || point.observedAtMs - visible[index - 1].observedAtMs > 6000;
      return `${gap ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
  return (
    <div className="traffic-chart">
      <div className="eyebrow">
        <span>LAST 60 SECONDS</span>
        <span>{rate(peak)} Mbps PEAK</span>
      </div>
      <svg
        role="img"
        aria-label={`Recent ${direction === 'downloadMbps' ? 'download' : 'upload'} traffic`}
        viewBox="0 0 300 85"
        preserveAspectRatio="none"
      >
        <path className="traffic-baseline" d="M0 78H300" />
        <path d={path} />
      </svg>
    </div>
  );
}

export function Network({ monitor, home }: { monitor: WanMonitor; home?: HomeMonitor }) {
  const [url, setURL] = useState(monitor.settings.descriptionURL);
  const [error, setError] = useState('');
  return (
    <>
      <p className="helper">
        Current internet traffic through your XB10, across the devices in your home. Readings update
        {home?.remote
          ? 'about every five seconds from your home dashboard while it is online and open.'
          : 'about every two seconds.'}
      </p>
      {home?.sharing && (
        <>
          <label className="check-row">
            <input
              type="checkbox"
              checked={home.enabled}
              onChange={(event) => {
                try {
                  home.configure(event.target.checked);
                  setError('');
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            />
            <span>Share this device’s home readings</span>
          </label>
          <p className="helper">
            Enable this on the iPad that stays at home. Leave it off on your iPhone. The iPad must
            stay on your home network with Daily Ops open; iOS cannot wake it remotely for readings.
          </p>
          {home.message && (
            <p className="form-error" role="status">
              {home.message}
            </p>
          )}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </>
      )}
      <div className={`network-detail ${live(monitor.status) ? 'is-live' : ''}`}>
        <div className="network-state">
          <span className="eyebrow">{home?.remote ? 'HOME XB10 / WAN' : 'XB10 / WAN'}</span>
          <strong>{labels[monitor.status]}</strong>
        </div>
        <div className="network-metrics">
          <div>
            <span className="eyebrow">↓ DOWNLOAD</span>
            <strong data-testid="wan-download">
              {rate(monitor.last?.downloadMbps)}
              <small>Mbps</small>
            </strong>
            <TrafficChart monitor={monitor} direction="downloadMbps" />
          </div>
          <div>
            <span className="eyebrow">↑ UPLOAD</span>
            <strong data-testid="wan-upload">
              {rate(monitor.last?.uploadMbps)}
              <small>Mbps</small>
            </strong>
            <TrafficChart monitor={monitor} direction="uploadMbps" />
          </div>
        </div>
        <p className="network-observed">
          {monitor.capturedAtMs
            ? `Last reading ${new Date(monitor.capturedAtMs).toLocaleTimeString()}`
            : 'No traffic reading yet.'}
          {!live(monitor.status) &&
            monitor.last &&
            ' · Last values retained; readings are not live.'}
        </p>
      </div>
      {home?.remote ? (
        <p className="helper" role="status">
          {monitor.message ||
            'These readings come from your home iPad through your signed-in account. An idle connection can show zero traffic; this measures current usage.'}
        </p>
      ) : !monitor.supported ? (
        <p className="helper">
          Open the installed Daily Ops iPad app for direct gateway readings. The gateway service
          does not allow this browser to read its counters.
        </p>
      ) : (
        <>
          {monitor.message && (
            <p className="form-error" role="status">
              {monitor.message}
            </p>
          )}
          {monitor.status === 'unavailable' && (
            <p className="helper">
              Check that the iPad is on your home network, Daily Ops has Local Network access in
              Settings, and gateway UPnP is enabled. If the modem restarted, its service address may
              need updating below.
            </p>
          )}
          <p className="helper">
            An idle connection can show zero traffic. These rates measure current usage, not the
            maximum speed of your internet plan.
          </p>
          <div className="network-controls">
            <button onClick={monitor.retry} disabled={!monitor.settings.enabled}>
              RECONNECT
            </button>
            <button onClick={monitor.pause}>
              {monitor.settings.enabled ? 'PAUSE READINGS' : 'RESUME READINGS'}
            </button>
          </div>
          <details className="network-settings">
            <summary>Connection settings</summary>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                try {
                  monitor.configure(url);
                  setError('');
                } catch (reason) {
                  setError((reason as Error).message);
                }
              }}
            >
              <label className="field">
                GATEWAY SERVICE URL
                <input
                  type="url"
                  required
                  value={url}
                  onChange={(event) => setURL(event.target.value)}
                />
              </label>
              <p className="helper">
                Use the service address advertised by the XB10. This changes only where Daily Ops
                reads; it does not change modem settings.
              </p>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit">SAVE AND RECONNECT</button>
            </form>
          </details>
        </>
      )}
    </>
  );
}
