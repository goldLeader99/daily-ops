import { useState } from 'react';
import type { CounterKind, DashboardData } from '../domain/model';
import { counterDays, counterStartDate } from '../domain/model';
import type { Commit } from '../data/useDashboard';

export const COUNTER_LABELS: Record<CounterKind, string> = {
  cigarettes: 'Days without cigarettes',
  alcohol: 'Days without alcohol',
};

export function CounterSummary({
  kind,
  start,
  date,
  onOpen,
}: {
  kind: CounterKind;
  start: string | null;
  date: string;
  onOpen: () => void;
}) {
  const days = counterDays(start, date);
  return (
    <>
      <button
        className="counter-summary summary-button"
        onClick={onOpen}
        aria-label={COUNTER_LABELS[kind]}
      >
        <strong className="counter-number">
          {days === null ? '—' : String(days).padStart(2, '0')}
        </strong>
        <span className="counter-caption">{COUNTER_LABELS[kind].toUpperCase()}</span>
        <span className="counter-since">{start ? 'SINCE ' + start : 'SET COUNTER TO BEGIN'}</span>
      </button>
      <button className="panel-bottom" onClick={onOpen}>
        <span>{start ? 'EDIT COUNTER' : 'SET COUNTER'}</span>
        <span>+ / −</span>
      </button>
    </>
  );
}

export function DayCounter({
  kind,
  data,
  date,
  commit,
  notify,
}: {
  kind: CounterKind;
  data: DashboardData;
  date: string;
  commit: Commit;
  notify: (text: string) => void;
}) {
  const [value, setValue] = useState(String(counterDays(data.counters[kind], date) ?? 0));
  const days = Number(value);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (
          commit((d) => ({
            ...d,
            counters: { ...d.counters, [kind]: counterStartDate(Number(value), date) },
          }))
        ) {
          notify('Counter saved. It will increase automatically each day.');
        }
      }}
    >
      <p className="helper">
        Set how many days it has been. The counter increases at midnight in your device’s time zone.
        Zero means you’re starting today.
      </p>
      <label className="field counter-input-label" htmlFor="counter-days">
        {COUNTER_LABELS[kind].toUpperCase()}
      </label>
      <div className="counter-stepper">
        <button
          type="button"
          aria-label="Subtract one day"
          disabled={days <= 0 || value === ''}
          onClick={() => setValue(String(Math.max(0, days - 1)))}
        >
          −
        </button>
        <input
          id="counter-days"
          className="counter-input"
          type="number"
          inputMode="numeric"
          min="0"
          max="36500"
          step="1"
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="button"
          aria-label="Add one day"
          disabled={days >= 36500}
          onClick={() => setValue(String(days + 1))}
        >
          +
        </button>
      </div>
      <div className="form-actions">
        <button type="button" onClick={() => setValue('0')}>
          RESET TO ZERO
        </button>
        <button type="submit" className="primary">
          SAVE COUNTER
        </button>
      </div>
      <p className="helper counter-help">Changes, including a reset, take effect when you save.</p>
    </form>
  );
}
