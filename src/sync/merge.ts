import type { DashboardContent, DashboardData } from '../domain/model';
import { calculateMileage, defaultStats } from '../domain/model';
import { validateData } from '../data/repository';

export type ConflictChoice = 'device' | 'shared';
export type MergeResult = { data: DashboardContent; conflicts: string[] };
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const own = (v: Record<string, unknown>, key: string) =>
  Object.hasOwn(v, key) ? v[key] : undefined;

export function equal(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b))
    return a.length === b.length && a.every((v, i) => equal(v, b[i]));
  if (object(a) && object(b)) {
    const keys = Object.keys(a);
    return (
      keys.length === Object.keys(b).length && keys.every((key) => equal(own(a, key), own(b, key)))
    );
  }
  return false;
}

/** Only the dashboard content is transmitted; local sync state is never uploaded. */
export function sharedContent(data: DashboardData): DashboardContent {
  const {
    schemaVersion,
    tasks,
    groceries,
    workoutDay,
    workoutSessions,
    mileage,
    selectedVehicle,
    stats,
    counters,
    projects,
    quickActions,
    settings,
  } = data;
  return JSON.parse(
    JSON.stringify({
      schemaVersion,
      tasks,
      groceries,
      workoutDay,
      workoutSessions,
      mileage,
      selectedVehicle,
      stats,
      counters,
      projects,
      quickActions,
      settings,
    }),
  ) as DashboardContent;
}

/** Three-way merge: unchanged fields follow the other device; competing edits require review. */
export function mergeDashboard(
  base: DashboardContent,
  device: DashboardContent,
  shared: DashboardContent,
  choice?: ConflictChoice,
): MergeResult {
  const conflicts: string[] = [];
  function merge(b: unknown, l: unknown, r: unknown, path: string[]): unknown {
    if (b === undefined && path[0] === 'stats' && path.length === 2 && object(l) && object(r))
      b = defaultStats();
    if (equal(l, r) || equal(b, r)) return l;
    if (equal(b, l)) return r;
    if ((object(b) || b === undefined) && object(l) && object(r)) {
      const result: Record<string, unknown> = Object.create(null);
      const keys = new Set([...Object.keys(b ?? {}), ...Object.keys(r), ...Object.keys(l)]);
      for (const key of keys) {
        const value = merge(object(b) ? own(b, key) : undefined, own(l, key), own(r, key), [
          ...path,
          key,
        ]);
        if (value !== undefined) result[key] = value;
      }
      if (path[0] === 'mileage' && path.length === 2) {
        try {
          calculateMileage(Number(result.start), Number(result.end));
        } catch {
          conflicts.push([...path, 'odometer range'].join(' / '));
          return choice === 'shared' ? r : l;
        }
      }
      return result;
    }
    if ((Array.isArray(b) || b === undefined) && Array.isArray(l) && Array.isArray(r)) {
      const baseline = Array.isArray(b) ? b : [];
      if ([...baseline, ...l, ...r].every((v) => object(v) && typeof v.id === 'string')) {
        const map = (rows: Record<string, unknown>[]) =>
          Object.fromEntries(rows.map((v) => [v.id, v]));
        const merged = merge(map(baseline), map(l), map(r), path) as Record<string, unknown>;
        // Keep existing shared ordering and append new local records.
        return Object.values(merged);
      }
      if (
        path[0] === 'workoutSessions' &&
        [...baseline, ...l, ...r].every((v) => typeof v === 'string')
      ) {
        return [...new Set([...r, ...l, ...baseline])].filter(
          (id) =>
            merge(baseline.includes(id), l.includes(id), r.includes(id), [...path, id]) === true,
        );
      }
    }
    conflicts.push(path.join(' / '));
    return choice === 'shared' ? r : l;
  }
  const data = merge(base, device, shared, []) as DashboardContent;
  // Coupled fields (e.g. odometer start/end) can conflict even when different fields changed.
  try {
    validateData(data);
  } catch {
    conflicts.push('Dashboard fields that must stay consistent');
    return { data: choice === 'shared' ? shared : device, conflicts };
  }
  return { data: JSON.parse(JSON.stringify(data)) as DashboardContent, conflicts };
}
