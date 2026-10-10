import { useState } from 'react';
import type { DashboardData } from '../domain/model';
import type { Commit } from '../data/useDashboard';
import { parseData } from '../data/repository';
import { localDate } from '../domain/model';
import { download } from '../utils/download';
import { DashboardDevice, isNative, isAndroid, isIOS } from '../native';
export function Settings({
  data,
  commit,
  restore,
  exportRaw,
  notify,
}: {
  data: DashboardData;
  commit: Commit;
  restore: (raw: string) => boolean;
  exportRaw: () => string;
  notify: (text: string) => void;
}) {
  const [pending, setPending] = useState<{ raw: string; data: DashboardData; name: string } | null>(
    null,
  );
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [storageStatus, setStorageStatus] = useState('');
  return (
    <>
      <div className="settings-section">
        <h3>Display</h3>
        <label className="check-row">
          <input
            type="checkbox"
            checked={data.settings.crt}
            onChange={(e) =>
              commit((d) => ({ ...d, settings: { ...d.settings, crt: e.target.checked } }))
            }
          />
          <span>Subtle CRT scanlines</span>
        </label>
        <p className="helper">
          {isIOS
            ? 'The screen stays awake while Daily Ops is active. Use the iPad Home button or app switcher to leave; normal sleep settings apply outside the app.'
            : isNative
              ? 'The screen stays awake while Daily Ops is active. Use Home or Recents to leave; normal sleep settings apply outside the app. Fullscreen is optional: tap its button again to exit, or swipe from an edge for Android navigation. Reopening the app restores visible navigation.'
              : 'Touch controls stay active in fullscreen. Press the fullscreen button again, or use your browser’s exit control, to leave.'}
        </p>
      </div>
      <div className="settings-section">
        <h3>Local data & backups</h3>
        <p className="helper">
          {isNative
            ? 'Your data is stored privately in this app. Uninstalling or clearing app data removes it. Export a backup regularly. To transfer your browser dashboard, import its exported JSON backup here.'
            : 'Your data is stored in this browser on this device. Clearing site data removes it. Export a backup regularly and before changing browser, device, address, or port.'}
        </p>
        <div className="form-actions">
          <button
            onClick={async () => {
              try {
                await download(exportRaw(), 'daily-ops-' + localDate() + '.json');
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            EXPORT BACKUP
          </button>
          <label className="file-button">
            CHOOSE BACKUP
            <input
              aria-label="Choose backup"
              type="file"
              accept=".json,application/json"
              onChange={async (e) => {
                const input = e.currentTarget;
                const file = input.files?.[0];
                setPending(null);
                setConfirmed(false);
                setError('');
                try {
                  if (!file) return;
                  if (file.size > 4000000) throw new Error('Backup exceeds the 4 MB limit.');
                  const raw = await file.text();
                  setPending({ raw, data: parseData(raw), name: file.name });
                } catch (error) {
                  setError((error as Error).message);
                } finally {
                  input.value = '';
                }
              }}
            />
          </label>
        </div>
        {pending && (
          <div className="confirm-box">
            <h3>Restore backup</h3>
            <p className="helper">
              {pending.name}
              <br />
              {pending.data.tasks.length} tasks · {pending.data.mileage.length} shifts ·{' '}
              {pending.data.projects.length} projects
            </p>
            <label className="check-row">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              <span>Replace all current data with this backup.</span>
            </label>
            <div className="form-actions">
              <button
                className="primary"
                disabled={!confirmed}
                onClick={() => {
                  if (restore(pending.raw)) {
                    setPending(null);
                    notify('Backup restored.');
                  }
                }}
              >
                RESTORE BACKUP
              </button>
              <button onClick={() => setPending(null)}>CANCEL</button>
            </div>
          </div>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
      {!isNative && (
        <div className="settings-section">
          <h3>Storage protection</h3>
          <p className="helper">
            Ask the browser to keep this site’s storage when device space runs low. Browser support
            and approval vary; backups are still useful.
          </p>
          <button
            onClick={async () => {
              try {
                if (!navigator.storage?.persist) {
                  setStorageStatus('Storage protection requires HTTPS and a supported browser.');
                  return;
                }
                const granted = await navigator.storage.persist();
                setStorageStatus(
                  granted
                    ? 'Persistent storage granted by this browser.'
                    : 'The browser did not grant persistent storage. Your data still saves normally.',
                );
              } catch {
                setStorageStatus('Storage protection is unavailable in this browser.');
              }
            }}
          >
            REQUEST STORAGE PROTECTION
          </button>
          {storageStatus && (
            <p className="helper" role="status">
              {storageStatus}
            </p>
          )}
        </div>
      )}
      <div className="settings-section">
        <h3>Tablet setup</h3>
        <p className="helper">
          {isIOS
            ? 'Open Daily Ops from its app icon. Use the iPad Home button to leave the dashboard. Export backups to Files regularly; the installed dashboard works without a Mac server.'
            : isNative
              ? 'Open Daily Ops from its app icon whenever you want the always-on dashboard. It does not replace your Home screen or launch itself after you leave. The header HOME button returns to your normal launcher. If the tablet stays awake while charging in other apps, check Android Developer options → Stay awake.'
              : 'Use landscape orientation. For an installed fullscreen app and offline loading, open the production build over HTTPS and choose “Add to Home screen” or “Install app” in your browser. The README includes setup steps.'}
        </p>
        {isAndroid && (
          <div className="form-actions">
            <button
              onClick={() =>
                void DashboardDevice.systemSettings().catch((e: Error) => setError(e.message))
              }
            >
              ANDROID SETTINGS
            </button>
          </div>
        )}
        <span className="eyebrow">DAILY OPS / VERSION 1.1.2 / DATA FORMAT 1</span>
      </div>
    </>
  );
}
