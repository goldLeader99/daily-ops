import { useState } from 'react';
import type { DashboardData, DailyStats } from '../domain/model';
import { defaultStats, validDate } from '../domain/model';
import type { Commit } from '../data/useDashboard';
export function Stats({
  data,
  date,
  commit,
  notify,
}: {
  data: DashboardData;
  date: string;
  commit: Commit;
  notify: (text: string) => void;
}) {
  const [selectedDate, setDate] = useState(date);
  return (
    <>
      <p className="helper">A fresh log for each date. Empty values mean “not recorded”.</p>
      <label className="field">
        DATE
        <input
          type="date"
          value={selectedDate}
          required
          onChange={(e) => {
            if (validDate(e.target.value)) setDate(e.target.value);
          }}
        />
      </label>
      <StatsForm
        key={selectedDate}
        initial={data.stats[selectedDate] ?? defaultStats()}
        onSave={(stats) => {
          if (commit((d) => ({ ...d, stats: { ...d.stats, [selectedDate]: stats } })))
            notify('Daily stats saved.');
        }}
      />
    </>
  );
}
function StatsForm({
  initial,
  onSave,
}: {
  initial: DailyStats;
  onSave: (stats: DailyStats) => void;
}) {
  const [weight, setWeight] = useState(initial.weight?.toString() ?? '');
  const [protein, setProtein] = useState(initial.protein?.toString() ?? '');
  const [goal, setGoal] = useState(String(initial.proteinGoal));
  const [water, setWater] = useState(initial.water?.toString() ?? '');
  const [activity, setActivity] = useState(initial.activity);
  const numberOrNull = (value: string) => (value === '' ? null : Number(value));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          weight: numberOrNull(weight),
          protein: numberOrNull(protein),
          proteinGoal: Number(goal),
          water: numberOrNull(water),
          activity,
        });
      }}
    >
      <div className="form-grid">
        <label className="field">
          WEIGHT (KG)
          <input
            inputMode="decimal"
            type="number"
            min="0"
            max="500"
            step="0.1"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="Not recorded"
          />
        </label>
        <label className="field">
          WATER (L)
          <input
            inputMode="decimal"
            type="number"
            min="0"
            max="30"
            step="0.1"
            value={water}
            onChange={(e) => setWater(e.target.value)}
            placeholder="Not recorded"
          />
        </label>
        <label className="field">
          PROTEIN CONSUMED (G)
          <input
            inputMode="decimal"
            type="number"
            min="0"
            max="2000"
            step="0.1"
            value={protein}
            onChange={(e) => setProtein(e.target.value)}
            placeholder="Not recorded"
          />
        </label>
        <label className="field">
          PROTEIN GOAL (G)
          <input
            inputMode="decimal"
            type="number"
            required
            min="1"
            max="2000"
            step="0.1"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </label>
      </div>
      <label className="check-row activity-control">
        <input type="checkbox" checked={activity} onChange={(e) => setActivity(e.target.checked)} />
        <span>Walking / activity complete</span>
      </label>
      <button className="primary full-width" type="submit">
        SAVE DAILY STATS
      </button>
    </form>
  );
}
