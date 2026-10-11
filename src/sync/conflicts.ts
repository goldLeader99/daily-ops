import type { DashboardContent } from '../domain/model';

const names: Record<string, string> = {
  tasks: 'Tasks',
  groceries: 'Groceries',
  mileage: 'Mileage',
  stats: 'Daily stats',
  projects: 'Projects',
  quickActions: 'Shortcuts',
  workoutSessions: 'Workout sessions',
  settings: 'Display',
  counters: 'Counters',
  workoutDay: 'Workout day',
  selectedVehicle: 'Vehicle',
};
export function describeConflict(path: string, local: DashboardContent, shared: DashboardContent) {
  const parts = path.split(' / ');
  const labels = parts.map((part, i) => (i === 0 ? (names[part] ?? part) : part));
  function find(data: DashboardContent, label = false): unknown {
    let value: unknown = data;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === 'odometer range') return value;
      if (Array.isArray(value)) {
        const row = value.find((r) => r.id === parts[i]);
        if (label && row)
          labels[i] =
            row.text ?? row.name ?? (`${row.vehicle ?? ''} ${row.date ?? ''}`.trim() || parts[i]);
        value = row;
      } else if (value && typeof value === 'object')
        value = (value as Record<string, unknown>)[parts[i]];
      else return undefined;
    }
    return value;
  }
  const device = find(local, true),
    remote = find(shared, true);
  const text = (value: unknown) =>
    value === undefined
      ? 'Removed'
      : value === null
        ? 'Not set'
        : typeof value === 'string'
          ? value
          : JSON.stringify(value).slice(0, 240);
  return `${labels.join(' / ')} — This device: ${text(device)} · Shared: ${text(remote)}`;
}
