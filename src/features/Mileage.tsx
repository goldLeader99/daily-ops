import { useState } from 'react';
import type { DashboardData, Difficulty, MileageRecord, Vehicle } from '../domain/model';
import { calculateMileage, cleanText, newId, validDate } from '../domain/model';
import type { Commit } from '../data/useDashboard';
import { Icon } from '../components/Icon';
export function Mileage({
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
  const [editing, setEditing] = useState<MileageRecord | null>(null);
  const [formKey, setFormKey] = useState(0);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const vehicle = data.selectedVehicle;
  const records = data.mileage
    .filter((r) => r.vehicle === vehicle)
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  const odometer = records.length ? Math.max(...records.map((r) => r.end)) : '';
  return (
    <>
      <label className="field">
        VEHICLE
        <select
          value={vehicle}
          onChange={(e) => {
            if (commit((d) => ({ ...d, selectedVehicle: e.target.value as Vehicle })))
              setEditing(null);
          }}
        >
          <option>BMW</option>
          <option>Subaru</option>
        </select>
      </label>
      <div className="detail-section-title">
        <h3>{editing ? 'Edit shift' : 'Log a shift'}</h3>
        <span>KM</span>
      </div>
      <MileageForm
        key={vehicle + (editing?.id ?? 'new') + formKey}
        initial={editing}
        startDefault={odometer}
        date={date}
        onCancel={() => setEditing(null)}
        onSave={(fields) => {
          if (
            commit((d) => {
              const record: MileageRecord = {
                ...fields,
                vehicle,
                id: editing?.id ?? newId(),
                createdAt: editing?.createdAt ?? new Date().toISOString(),
              };
              return {
                ...d,
                mileage: editing
                  ? d.mileage.map((r) => (r.id === editing.id ? record : r))
                  : [...d.mileage, record],
              };
            })
          ) {
            setEditing(null);
            setFormKey((k) => k + 1);
            notify('Shift saved.');
          }
        }}
      />
      <div className="detail-section-title history-title">
        <h3>Shift history</h3>
        <span>{records.length} RECORDS</span>
      </div>
      {!records.length && (
        <p className="empty">No shifts for {vehicle} yet. Log your first trip above.</p>
      )}
      <div className="shift-history">
        {records.map((record) => (
          <article key={record.id} className="shift-record">
            <div className="shift-record-top">
              <div>
                <strong>{record.date}</strong>
                <p>{record.shift}</p>
              </div>
              <strong className="distance">
                {calculateMileage(record.start, record.end).toLocaleString()} <small>KM</small>
              </strong>
            </div>
            <div className="shift-record-meta">
              <span>
                {record.start.toLocaleString()} → {record.end.toLocaleString()} KM
              </span>
              <span>{record.difficulty}</span>
            </div>
            {deleteId === record.id ? (
              <div className="confirm-row">
                <span>Delete this shift?</span>
                <button
                  className="danger"
                  onClick={() => {
                    if (
                      commit((d) => ({
                        ...d,
                        mileage: d.mileage.filter((r) => r.id !== record.id),
                      }))
                    ) {
                      setDeleteId(null);
                      if (editing?.id === record.id) setEditing(null);
                    }
                  }}
                >
                  DELETE SHIFT
                </button>
                <button onClick={() => setDeleteId(null)}>KEEP</button>
              </div>
            ) : (
              <div className="record-actions">
                <button
                  onClick={() => {
                    setEditing(record);
                    setDeleteId(null);
                  }}
                  aria-label={'Edit shift ' + record.date}
                >
                  <Icon name="edit" size={16} /> EDIT
                </button>
                <button
                  className="danger"
                  onClick={() => setDeleteId(record.id)}
                  aria-label={'Delete shift ' + record.date}
                >
                  <Icon name="trash" size={16} /> DELETE
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </>
  );
}
type Fields = Pick<MileageRecord, 'start' | 'end' | 'date' | 'shift' | 'difficulty'>;
function MileageForm({
  initial,
  startDefault,
  date,
  onSave,
  onCancel,
}: {
  initial: MileageRecord | null;
  startDefault: number | '';
  date: string;
  onSave: (value: Fields) => void;
  onCancel: () => void;
}) {
  const [start, setStart] = useState(String(initial?.start ?? startDefault));
  const [end, setEnd] = useState(initial ? String(initial.end) : '');
  const [shiftDate, setDate] = useState(initial?.date ?? date);
  const [shift, setShift] = useState(initial?.shift ?? '');
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? 'Moderate');
  const [error, setError] = useState('');
  let distance: number | null = null;
  try {
    if (start !== '' && end !== '') distance = calculateMileage(Number(start), Number(end));
  } catch {
    /* Validation appears on submit and below. */
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        try {
          if (!validDate(shiftDate) || start === '' || end === '')
            throw new Error('Enter a valid date and both odometer readings.');
          calculateMileage(Number(start), Number(end));
          const name = cleanText(shift, 80);
          setError('');
          onSave({
            start: Number(start),
            end: Number(end),
            date: shiftDate,
            shift: name,
            difficulty,
          });
        } catch (e) {
          setError((e as Error).message);
        }
      }}
    >
      <div className="form-grid">
        <label className="field">
          STARTING ODOMETER
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="10000000"
            step="0.1"
            required
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
        </label>
        <label className="field">
          ENDING ODOMETER
          <input
            type="number"
            inputMode="decimal"
            min="0"
            max="10000000"
            step="0.1"
            required
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </label>
        <label className="field">
          DATE
          <input type="date" required value={shiftDate} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          ROUTE DIFFICULTY
          <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            <option>Easy</option>
            <option>Moderate</option>
            <option>Difficult</option>
          </select>
        </label>
      </div>
      <label className="field">
        SHIFT
        <input
          value={shift}
          maxLength={80}
          required
          placeholder="e.g. Afternoon · 13:00–17:00"
          onChange={(e) => setShift(e.target.value)}
        />
      </label>
      <div className="distance-preview" role="status">
        <span>DISTANCE DRIVEN</span>
        <strong>
          {distance ?? '—'} <small>KM</small>
        </strong>
      </div>
      {start !== '' && end !== '' && distance === null && (
        <p className="form-error">Ending odometer must be at least the starting odometer.</p>
      )}
      {error && (
        <p role="alert" className="form-error">
          {error}
        </p>
      )}
      <div className="form-actions">
        <button className="primary" type="submit">
          {initial ? 'SAVE CHANGES' : 'SAVE SHIFT'}
        </button>
        {initial && (
          <button type="button" onClick={onCancel}>
            CANCEL EDIT
          </button>
        )}
      </div>
    </form>
  );
}
