import { download } from './utils/download';
import { useEffect, useLayoutEffect, useState } from 'react';
import { App as NativeApp } from '@capacitor/app';
import { isNative, isAndroid, DashboardDevice } from './native';
import { defaultTheme, themeVariables } from './domain/theme';
import type { ReactNode } from 'react';
import { useDashboard } from './data/useDashboard';
import { defaultStats, localDate, sessionKey, toggleItem, WORKOUTS } from './domain/model';
import type { ChecklistItem } from './domain/model';
import { Icon } from './components/Icon';
import { Drawer } from './components/Drawer';
import { Details } from './features/Details';
import { CounterSummary } from './features/DayCounter';
import { useWanTraffic } from './network/useWanTraffic';
import { Network, NetworkSummary } from './features/Network';

export type Section =
  | 'today'
  | 'workout'
  | 'status'
  | 'projects'
  | 'flex'
  | 'groceries'
  | 'actions'
  | 'cigarettes'
  | 'alcohol'
  | 'theme'
  | 'clock'
  | 'network'
  | 'settings';
const titles: Record<Section, string> = {
  today: 'Today',
  workout: 'Workout',
  status: 'Daily status',
  projects: 'Projects',
  flex: 'Flex / Driving',
  groceries: 'Groceries',
  actions: 'Quick actions',
  settings: 'System settings',
  cigarettes: 'Days without cigarettes',
  alcohol: 'Days without alcohol',
  theme: 'Customize theme',
  clock: 'Clock',
  network: 'Live network traffic',
};
const format = (value: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 }).format(value);
function Panel({
  number,
  title,
  meta,
  children,
  onOpen,
  className = '',
}: {
  number: string;
  title: string;
  meta?: string;
  children: ReactNode;
  onOpen: () => void;
  className?: string;
}) {
  return (
    <section
      className={'panel ' + className}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest('button, a, input, label')) onOpen();
      }}
    >
      <button className="panel-heading" onClick={onOpen} aria-label={'Open ' + title}>
        <span className="panel-name">
          <span className="panel-number">{number}</span>
          {title}
        </span>
        <span className="panel-heading-end">
          <span className="panel-meta">{meta}</span>
          <Icon name="arrow" size={18} />
        </span>
      </button>
      {children}
    </section>
  );
}
function PreviewList({
  items,
  onToggle,
  onOpen,
  noun,
}: {
  items: ChecklistItem[];
  onToggle: (id: string) => void;
  onOpen: () => void;
  noun: string;
}) {
  return (
    <>
      <div className="preview-list">
        {items.slice(0, 4).map((item) => (
          <label key={item.id} className={'check-row ' + (item.completed ? 'completed' : '')}>
            <input type="checkbox" checked={item.completed} onChange={() => onToggle(item.id)} />
            <span>{item.text}</span>
          </label>
        ))}
        {!items.length && <p className="empty">All clear. Add a {noun} below.</p>}
      </div>
      <button className="panel-bottom" onClick={onOpen}>
        <span>
          <Icon name="plus" size={16} /> ADD {noun.toUpperCase()}
        </span>
        <span>
          {items.length > 4
            ? '+' + (items.length - 4) + ' MORE'
            : items.filter((i) => i.completed).length + ' / ' + items.length + ' DONE'}
        </span>
      </button>
    </>
  );
}
export function App() {
  const store = useDashboard();
  const network = useWanTraffic();
  const [now, setNow] = useState(new Date());
  const [section, setSection] = useState<Section | null>(null);
  const [notice, setNotice] = useState('');
  const [offlineReady, setOfflineReady] = useState(isNative);
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, 1000);
    document.addEventListener('visibilitychange', tick);
    const connection = () => setOnline(navigator.onLine);
    window.addEventListener('online', connection);
    window.addEventListener('offline', connection);
    if (!isNative && import.meta.env.PROD && 'serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then(() => setOfflineReady(true))
        .catch(() =>
          setNotice('Offline installation is unavailable. Open this app over HTTPS to enable it.'),
        );
    }
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
      window.removeEventListener('online', connection);
      window.removeEventListener('offline', connection);
    };
  }, []);
  useLayoutEffect(() => {
    const colors = (store.data?.settings.theme ?? defaultTheme()).colors;
    const variables = themeVariables(colors);
    for (const [key, value] of Object.entries(variables))
      document.documentElement.style.setProperty(key, value);
    document.documentElement.classList.toggle('native-app', isNative);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', colors.background);
  }, [store.data?.settings.theme]);
  useEffect(() => {
    if (!isAndroid) return;
    const listener = NativeApp.addListener('backButton', () => {
      if (section) setSection(null);
      else void NativeApp.minimizeApp();
    });
    return () => {
      void listener.then((handle) => handle.remove());
    };
  }, [section]);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(''), 7000);
    return () => clearTimeout(timeout);
  }, [notice]);
  const fullscreen = async () => {
    try {
      if (isNative) {
        await DashboardDevice.fullscreen();
        return;
      }
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch {
      setNotice('Fullscreen is unavailable here. Open Daily Ops directly in your tablet browser.');
    }
  };
  const data = store.data;
  if (!data)
    return (
      <main className="recovery">
        <span className="eyebrow">DAILY OPS / STORAGE RECOVERY</span>
        <h1>Let’s protect your data.</h1>
        <p role="alert">{store.error}</p>
        <p>
          The saved copy has been left untouched. Export it for safekeeping, then restore a valid
          backup or retry after allowing browser storage.
        </p>
        <button
          onClick={async () => {
            try {
              await download(store.exportRaw(), 'daily-ops-recovery.json');
            } catch (e) {
              store.setError((e as Error).message);
            }
          }}
        >
          EXPORT SAVED COPY
        </button>
        <label className="file-button">
          RESTORE BACKUP
          <input
            type="file"
            accept=".json,application/json"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                if (file.size > 4000000) store.setError('Backup exceeds the 4 MB limit.');
                else store.restore(await file.text());
              }
            }}
          />
        </label>
        <button onClick={() => location.reload()}>RETRY</button>
      </main>
    );
  const today = localDate(now);
  const stats = data.stats[today] ?? defaultStats();
  const workout = WORKOUTS[data.workoutDay - 1];
  const completed = data.workoutSessions[sessionKey(today, data.workoutDay)] ?? [];
  const records = data.mileage
    .filter((r) => r.vehicle === data.selectedVehicle)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const last = records[0];
  const odometer = records.length ? Math.max(...records.map((r) => r.end)) : null;
  const tasksDone = data.tasks.filter((t) => t.completed).length;
  return (
    <div className={'app ' + (data.settings.crt ? 'crt' : '')}>
      <div className="console">
        <header className="topbar">
          <div className="identity">
            <div className="eyebrow">
              <span className="live-dot" /> PERSONAL OPERATIONS{' '}
              <span className="header-version">/ V.01</span>
            </div>
            <h1>
              DAILY OPS
              <span className="cursor" aria-hidden="true">
                _
              </span>
            </h1>
          </div>
          <button
            className="clock-block clock-launcher"
            onClick={() => setSection('clock')}
            aria-label="Open clock"
            title="Open clock"
          >
            <span className="date-block">
              <span>{now.toLocaleDateString('en-CA', { weekday: 'long' }).toUpperCase()}</span>
              <strong>
                {now
                  .toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
                  .toUpperCase()}
              </strong>
            </span>
            <time dateTime={now.toISOString()}>
              {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              <span className="seconds">{String(now.getSeconds()).padStart(2, '0')}</span>
            </time>
          </button>
          <div className="header-controls">
            {isAndroid && (
              <button
                className="theme-button"
                aria-label="Go to Home screen"
                onClick={() =>
                  void DashboardDevice.goHome().catch((e: Error) => setNotice(e.message))
                }
              >
                HOME
              </button>
            )}
            <button
              className="theme-button"
              onClick={() => setSection('theme')}
              aria-label="Customize theme"
            >
              THEME
            </button>
            <button
              className="icon-button"
              onClick={fullscreen}
              aria-label="Toggle fullscreen"
              title="Fullscreen"
            >
              <Icon name="full" />
            </button>
            <button
              className="icon-button"
              onClick={() => setSection('settings')}
              aria-label="Open settings"
              title="Settings"
            >
              <Icon name="settings" />
            </button>
          </div>
        </header>
        <div className="system-strip">
          <button
            className="network-launcher"
            aria-label="Open NETWORK"
            onClick={() => setSection('network')}
          >
            <NetworkSummary monitor={network} />
          </button>
          <span>
            {String(tasksDone).padStart(2, '0')} OF {String(data.tasks.length).padStart(2, '0')}{' '}
            TASKS COMPLETE
          </span>
        </div>
        {store.error && (
          <div className="error-banner" role="alert">
            {store.error}
          </div>
        )}
        <main className="dashboard">
          <Panel
            number="01"
            title="TODAY"
            meta={String(data.tasks.length).padStart(2, '0') + ' ITEMS'}
            onOpen={() => setSection('today')}
            className="today-panel"
          >
            <PreviewList
              items={data.tasks}
              noun="task"
              onOpen={() => setSection('today')}
              onToggle={(id) => store.commit((d) => ({ ...d, tasks: toggleItem(d.tasks, id) }))}
            />
          </Panel>
          <Panel
            number="02"
            title="WORKOUT"
            meta="5-DAY ROTATION"
            onOpen={() => setSection('workout')}
            className="workout-panel"
          >
            <button
              className="workout-summary summary-button"
              onClick={() => setSection('workout')}
              aria-label="View workout exercises"
            >
              <div className="workout-day">
                <span className="eyebrow">DAY</span>
                <strong>{String(data.workoutDay).padStart(2, '0')}</strong>
                <div className="day-ticks" aria-hidden="true">
                  {WORKOUTS.map((w) => (
                    <i key={w.day} className={w.day === data.workoutDay ? 'selected' : ''} />
                  ))}
                </div>
              </div>
              <div className="workout-name">
                <h2>{workout.name.replace(' & ', ' + ')}</h2>
                <span className="eyebrow">{workout.focus}</span>
              </div>
            </button>
            <div className="workout-progress">
              <div className="progress-caption">
                <span>
                  <strong>{completed.length}</strong> / {workout.exercises.length} COMPLETE
                </span>
                <span>{Math.round((completed.length / workout.exercises.length) * 100)}%</span>
              </div>
              <progress
                value={completed.length}
                max={workout.exercises.length}
                aria-label="Workout progress"
              />
            </div>
            <button className="panel-bottom" onClick={() => setSection('workout')}>
              <span>OPEN SESSION</span>
              <Icon name="arrow" size={16} />
            </button>
          </Panel>
          <Panel number="03" title="STATUS" meta="TODAY" onOpen={() => setSection('status')}>
            <button
              className="status-summary summary-button"
              onClick={() => setSection('status')}
              aria-label="Edit daily stats"
            >
              <div className="metric">
                <span>WEIGHT</span>
                <strong>
                  {stats.weight ?? '—'} <small>KG</small>
                </strong>
              </div>
              <div className="metric">
                <span>PROTEIN</span>
                <strong>
                  {stats.protein ?? '—'} <small>/ {stats.proteinGoal} G</small>
                </strong>
              </div>
              <div className="protein-bar">
                <progress
                  value={stats.protein ?? 0}
                  max={stats.proteinGoal}
                  aria-label="Protein goal"
                />
              </div>
              <div className="metric">
                <span>WATER</span>
                <strong>
                  {stats.water ?? '—'} <small>L</small>
                </strong>
              </div>
              <div className="metric">
                <span>ACTIVITY</span>
                <span className={'activity-badge ' + (stats.activity ? 'is-complete' : '')}>
                  {stats.activity ? 'COMPLETE' : 'PENDING'}
                </span>
              </div>
            </button>
            <button className="panel-bottom" onClick={() => setSection('status')}>
              <span>UPDATE DAILY STATS</span>
              <Icon name="edit" size={16} />
            </button>
          </Panel>
          <Panel
            number="07"
            title="NO CIGARETTES"
            onOpen={() => setSection('cigarettes')}
            className="counter-panel cigarettes-panel"
          >
            <CounterSummary
              kind="cigarettes"
              start={data.counters.cigarettes}
              date={today}
              onOpen={() => setSection('cigarettes')}
            />
          </Panel>
          <Panel
            number="04"
            title="PROJECTS"
            meta={String(data.projects.length).padStart(2, '0') + ' PROJECTS'}
            onOpen={() => setSection('projects')}
          >
            <div className="projects-preview">
              {data.projects.slice(0, 3).map((project, i) => (
                <button
                  key={project.id}
                  className="project-preview"
                  onClick={() => setSection('projects')}
                >
                  <span className="project-index">{String(i + 1).padStart(2, '0')}</span>
                  <span className="project-name">
                    {project.name}
                    <small>
                      {project.tasks.filter((t) => t.completed).length} / {project.tasks.length}{' '}
                      TASKS
                    </small>
                  </span>
                  <span className={'project-badge ' + project.status.toLowerCase()}>
                    {project.status.toUpperCase()}
                  </span>
                </button>
              ))}
              {data.projects.length === 0 && (
                <p className="empty">A clear workspace. Start a project.</p>
              )}
            </div>
            <button className="panel-bottom" onClick={() => setSection('projects')}>
              <span>PROJECT WORKSPACE</span>
              <Icon name="arrow" size={16} />
            </button>
          </Panel>
          <Panel number="05" title="FLEX" meta="MILEAGE LOG" onOpen={() => setSection('flex')}>
            <button
              className="flex-summary summary-button"
              onClick={() => setSection('flex')}
              aria-label="Open mileage tracker"
            >
              <div className="vehicle-line">
                <span>{data.selectedVehicle.toUpperCase()}</span>
                <span className="eyebrow">ODOMETER</span>
              </div>
              <div className="odometer">
                {odometer === null ? '— — —' : format(odometer)} <small>KM</small>
              </div>
              <div className="last-shift">
                <span>
                  LAST SHIFT
                  <strong>
                    {last ? format(last.end - last.start) : '—'} <small>KM</small>
                  </strong>
                </span>
                <span className="last-shift-date">
                  {last
                    ? new Date(last.date + 'T12:00:00')
                        .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                        .toUpperCase()
                    : 'NO SHIFTS LOGGED'}
                  {last && <small>{last.difficulty.toUpperCase()}</small>}
                </span>
              </div>
            </button>
            <button className="panel-bottom" onClick={() => setSection('flex')}>
              <span>
                <Icon name="plus" size={16} /> LOG A SHIFT
              </span>
              <span>{records.length} RECORDS</span>
            </button>
          </Panel>
          <Panel
            number="06"
            title="GROCERIES"
            meta={data.groceries.filter((g) => !g.completed).length + ' TO GET'}
            onOpen={() => setSection('groceries')}
          >
            <PreviewList
              items={data.groceries}
              noun="item"
              onOpen={() => setSection('groceries')}
              onToggle={(id) =>
                store.commit((d) => ({ ...d, groceries: toggleItem(d.groceries, id) }))
              }
            />
          </Panel>
          <Panel
            number="08"
            title="NO ALCOHOL"
            onOpen={() => setSection('alcohol')}
            className="counter-panel alcohol-panel"
          >
            <CounterSummary
              kind="alcohol"
              start={data.counters.alcohol}
              date={today}
              onOpen={() => setSection('alcohol')}
            />
          </Panel>
        </main>
        <nav className="quick-actions" aria-label="Quick actions">
          <button
            className="quick-label"
            onClick={() => setSection('actions')}
            aria-label="Configure quick actions"
          >
            <span className="eyebrow">
              QUICK
              <br />
              ACTIONS
            </span>
            <Icon name="settings" size={18} />
          </button>
          {data.quickActions.map((action) =>
            action.target ? (
              <a
                key={action.id}
                href={action.target}
                target="_blank"
                rel="noopener noreferrer"
                className="quick-action"
                onClick={
                  isNative
                    ? (e) => {
                        e.preventDefault();
                        void DashboardDevice.openLink({ url: action.target }).catch(
                          (error: Error) => setNotice(error.message),
                        );
                      }
                    : undefined
                }
              >
                <Icon name={action.id} />
                <span>{action.name.toUpperCase()}</span>
                <Icon name="arrow" size={16} />
              </a>
            ) : (
              <button
                key={action.id}
                className="quick-action unconfigured"
                onClick={() => setSection('actions')}
              >
                <Icon name={action.id} />
                <span>
                  {action.name.toUpperCase()}
                  <small>SET URL</small>
                </span>
                <Icon name="plus" size={16} />
              </button>
            ),
          )}
        </nav>
        <footer className="system-footer">
          <span>
            <span className="live-dot" />{' '}
            {store.error ? 'STORAGE NEEDS ATTENTION' : 'SAVED ON THIS DEVICE'}
          </span>
          <span>
            {!online ? 'OFFLINE' : offlineReady ? 'OFFLINE READY' : 'LOCAL MODE'} <b>/</b> DAILY OPS
            — 01
          </span>
        </footer>
      </div>
      {notice && (
        <div className="toast" role="status">
          {notice}
        </div>
      )}
      {section && (
        <Drawer
          title={titles[section]}
          onClose={() => setSection(null)}
          variant={section === 'clock' ? 'clock' : 'drawer'}
        >
          {section === 'network' ? (
            <Network monitor={network} />
          ) : (
            <Details
              section={section}
              data={data}
              date={today}
              now={now}
              commit={store.commit}
              restore={store.restore}
              exportRaw={store.exportRaw}
              notify={setNotice}
            />
          )}
          {store.error && (
            <p className="form-error" role="alert">
              {store.error}
            </p>
          )}
        </Drawer>
      )}
    </div>
  );
}
