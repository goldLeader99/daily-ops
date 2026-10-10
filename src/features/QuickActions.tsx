import { useState } from 'react';
import type { DashboardData, QuickAction } from '../domain/model';
import type { Commit } from '../data/useDashboard';
import { cleanText, safeActionUrl } from '../domain/model';
import { Icon } from '../components/Icon';
import { isNative } from '../native';
export function QuickActions({
  data,
  commit,
  notify,
}: {
  data: DashboardData;
  commit: Commit;
  notify: (text: string) => void;
}) {
  return (
    <>
      <p className="helper">
        Give each shortcut a name and a full http:// or https:// address. Leave the URL empty to
        keep it unconfigured.{' '}
        {isNative
          ? 'Links open in your browser or a matching Android app. For services on your laptop, use its LAN address: localhost refers to this tablet.'
          : 'Links open in another tab.'}
      </p>
      {data.quickActions.map((action) => (
        <ActionForm
          key={action.id}
          action={action}
          onSave={(name, target) => {
            const saved = commit((d) => ({
              ...d,
              quickActions: d.quickActions.map((a) =>
                a.id === action.id ? { ...a, name: cleanText(name, 30), target } : a,
              ),
            }));
            if (saved) notify('Shortcut saved.');
            return saved;
          }}
        />
      ))}
    </>
  );
}
function ActionForm({
  action,
  onSave,
}: {
  action: QuickAction;
  onSave: (name: string, target: string) => boolean;
}) {
  const [name, setName] = useState(action.name);
  const [target, setTarget] = useState(action.target);
  const [error, setError] = useState('');
  return (
    <form
      className="action-form"
      onSubmit={(e) => {
        e.preventDefault();
        const url = target.trim();
        if (!safeActionUrl(url)) {
          setError('Use an http:// or https:// URL without embedded credentials.');
          return;
        }
        if (onSave(name, url)) setError('');
      }}
    >
      <div className="action-form-heading">
        <Icon name={action.id} />
        <span>{action.name.toUpperCase()}</span>
      </div>
      <label className="field">
        BUTTON NAME
        <input value={name} maxLength={30} required onChange={(e) => setName(e.target.value)} />
      </label>
      <label className="field">
        URL
        <input
          type="url"
          value={target}
          maxLength={2000}
          onChange={(e) => setTarget(e.target.value)}
          placeholder="https://…"
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button type="submit">SAVE SHORTCUT</button>
    </form>
  );
}
