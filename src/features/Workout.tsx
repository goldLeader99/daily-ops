import type { DashboardData } from '../domain/model';
import type { Commit } from '../data/useDashboard';
import { sessionKey, WORKOUTS } from '../domain/model';
export function Workout({
  data,
  date,
  commit,
}: {
  data: DashboardData;
  date: string;
  commit: Commit;
}) {
  const workout = WORKOUTS[data.workoutDay - 1];
  const key = sessionKey(date, data.workoutDay);
  const completed = data.workoutSessions[key] ?? [];
  return (
    <>
      <p className="helper">
        Choose today’s rotation day. Your exercise checks are saved separately for each day and
        date.
      </p>
      <div className="day-selector" role="group" aria-label="Workout day">
        {WORKOUTS.map((w) => (
          <button
            key={w.day}
            aria-pressed={w.day === data.workoutDay}
            onClick={() => commit((d) => ({ ...d, workoutDay: w.day }))}
          >
            DAY {w.day}
          </button>
        ))}
      </div>
      <div className="detail-section-title">
        <h3>{workout.name}</h3>
        <span>
          {completed.length} / {workout.exercises.length}
        </span>
      </div>
      <progress
        value={completed.length}
        max={workout.exercises.length}
        aria-label="Exercises completed"
      />
      <div className="exercise-list">
        {workout.exercises.map((exercise) => (
          <label
            className={'exercise check-row ' + (completed.includes(exercise.id) ? 'completed' : '')}
            key={exercise.id}
          >
            <input
              type="checkbox"
              checked={completed.includes(exercise.id)}
              onChange={() =>
                commit((d) => {
                  const current = d.workoutSessions[key] ?? [];
                  return {
                    ...d,
                    workoutSessions: {
                      ...d.workoutSessions,
                      [key]: current.includes(exercise.id)
                        ? current.filter((id) => id !== exercise.id)
                        : [...current, exercise.id],
                    },
                  };
                })
              }
            />
            <span>
              {exercise.name}
              <small>{exercise.prescription}</small>
            </span>
          </label>
        ))}
      </div>
      <p className="helper">Sample exercise plan · {date}</p>
    </>
  );
}
