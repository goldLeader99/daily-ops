import { useState } from 'react';
import type { CloudSync } from '../sync/useCloudSync';
import { download } from '../utils/download';

export function AccountSync({ cloud }: { cloud: CloudSync }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [create, setCreate] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const { status } = cloud;
  const act = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setMessage('');
    try {
      await operation();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="settings-section account-sync">
      <h3>Account & sync</h3>
      <p className="helper">
        Share your tasks, workouts, daily stats, counters, projects, mileage, shortcuts, and theme
        between your iPhone and iPad. Offline changes stay on this device until they can sync.
      </p>
      <p className="eyebrow" role="status">
        {status.phase.replace('-', ' ').toUpperCase()}
        {status.email && <> · {status.email}</>}
      </p>
      {status.phase === 'unconfigured' ? (
        <p className="helper">
          Cloud sync is not configured in this build. Your records still save on this device.
        </p>
      ) : !cloud.signedIn ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void act(async () => {
              const active = await cloud.signIn(email.trim(), password, create);
              setPassword('');
              if (!active)
                setMessage('Check your confirmation email, open its link, then sign in here.');
            });
          }}
        >
          <p className="helper">
            Use the same Daily Ops account on both devices. Your Supabase dashboard login is
            separate from this app account.
          </p>
          <label className="form-label">
            Email
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="form-label">
            Password
            <input
              type="password"
              autoComplete={create ? 'new-password' : 'current-password'}
              minLength={create ? 8 : undefined}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          <div className="form-actions">
            <button className="primary" disabled={busy}>
              {busy ? 'PLEASE WAIT…' : create ? 'CREATE APP ACCOUNT' : 'SIGN IN'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setCreate(!create);
                setMessage('');
              }}
            >
              {create ? 'ALREADY HAVE AN ACCOUNT' : 'CREATE AN ACCOUNT'}
            </button>
          </div>
        </form>
      ) : (
        <>
          {!cloud.linked && (status.phase === 'setup' || status.phase === 'error') && (
            <>
              <p className="helper">
                {status.hasShared
                  ? 'A shared dashboard exists. Use it on this device; a private copy of the current records is kept here first.'
                  : 'Start sharing from your iPhone first. Its current records will become the shared dashboard. Connect the iPad to that same account afterward.'}
              </p>
              <button
                className="primary"
                disabled={busy}
                onClick={() =>
                  void act(() => cloud.connect(status.hasShared ? 'shared' : 'device'))
                }
              >
                {status.hasShared ? 'USE SHARED DASHBOARD' : 'SHARE THIS DASHBOARD'}
              </button>
            </>
          )}
          {cloud.linked && (
            <div className="form-actions">
              <button disabled={busy} onClick={() => void act(() => cloud.sync())}>
                SYNC NOW
              </button>
            </div>
          )}
          {status.phase === 'conflict' && (
            <div className="confirm-box">
              <h3>Review competing edits</h3>
              <p className="helper">
                Other changes can still be combined. These records need a choice:
              </p>
              <ul>
                {status.conflicts.slice(0, 12).map((path) => (
                  <li key={path}>{path}</li>
                ))}
              </ul>
              {status.conflicts.length > 12 && (
                <p className="helper">
                  And {status.conflicts.length - 12} more competing edits. Export a backup before
                  choosing if you need to review the complete dashboard.
                </p>
              )}
              <div className="form-actions">
                <button disabled={busy} onClick={() => void act(() => cloud.sync('device'))}>
                  KEEP THIS DEVICE'S EDITS
                </button>
                <button disabled={busy} onClick={() => void act(() => cloud.sync('shared'))}>
                  KEEP SHARED EDITS
                </button>
              </div>
            </div>
          )}
          <button
            className="text-button"
            disabled={busy}
            onClick={() => void act(() => cloud.signOut())}
          >
            SIGN OUT ON THIS DEVICE
          </button>
        </>
      )}
      {(message || status.message) && (
        <p className="helper" role="alert">
          {message || status.message}
        </p>
      )}
      {cloud.linked && (
        <button
          className="text-button"
          onClick={() =>
            void act(async () => {
              const backup = cloud.backup();
              if (!backup) throw new Error('No pre-sync copy was found.');
              await download(backup, 'daily-ops-before-sync.json');
            })
          }
        >
          EXPORT PRE-SYNC COPY
        </button>
      )}
    </div>
  );
}
