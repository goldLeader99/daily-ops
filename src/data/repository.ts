import {
  calculateMileage,
  createInitialData,
  defaultCounters,
  safeActionUrl,
  validDate,
  WORKOUTS,
} from '../domain/model';
import type { DashboardData } from '../domain/model';
import { defaultTheme, validTheme } from '../domain/theme';

export const STORAGE_KEY = 'daily-ops:data:v1';
export interface StorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 120): v is string =>
  typeof v === 'string' && !!v.trim() && v.length <= max;
const number = (v: unknown, min = 0, max = 10000000): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const optionalNumber = (v: unknown, max: number) => v === null || number(v, 0, max);
const list = (v: unknown, check: (item: unknown) => boolean): v is unknown[] =>
  Array.isArray(v) && v.length <= 10000 && v.every(check);
const unique = (v: unknown[]) =>
  new Set(v.map((item) => (item as { id: string }).id)).size === v.length;
const items = (v: unknown) =>
  list(v, (i) => object(i) && text(i.id) && text(i.text) && typeof i.completed === 'boolean') &&
  unique(v);
const vehicle = (v: unknown) => v === 'BMW' || v === 'Subaru';

/** Validate untrusted persisted/exported data before it can enter the app. */
export function validateData(value: unknown): asserts value is DashboardData {
  const invalid = () => {
    throw new Error(
      'This backup is invalid or uses an unsupported data version. Your saved data has not been changed.',
    );
  };
  if (!object(value) || value.schemaVersion !== 1) return invalid();
  if (
    !object(value.counters) ||
    !['cigarettes', 'alcohol'].every(
      (key) =>
        value.counters &&
        object(value.counters) &&
        (value.counters[key] === null || validDate(value.counters[key])),
    )
  )
    return invalid();
  if (
    !items(value.tasks) ||
    !items(value.groceries) ||
    !number(value.workoutDay, 1, 5) ||
    !Number.isInteger(value.workoutDay)
  )
    return invalid();
  if (
    !object(value.workoutSessions) ||
    !Object.entries(value.workoutSessions).every(([key, ids]) => {
      const [date, day, extra] = key.split('/');
      const workout = WORKOUTS.find((w) => String(w.day) === day);
      return (
        !extra &&
        validDate(date) &&
        !!workout &&
        list(ids, (id) => typeof id === 'string' && workout.exercises.some((e) => e.id === id)) &&
        new Set(ids).size === ids.length
      );
    })
  )
    return invalid();
  if (
    !vehicle(value.selectedVehicle) ||
    !list(value.mileage, (r) => {
      if (
        !object(r) ||
        !text(r.id) ||
        !vehicle(r.vehicle) ||
        !number(r.start) ||
        !number(r.end) ||
        !validDate(r.date) ||
        !text(r.shift, 80) ||
        !['Easy', 'Moderate', 'Difficult'].includes(String(r.difficulty)) ||
        typeof r.createdAt !== 'string' ||
        Number.isNaN(Date.parse(r.createdAt))
      )
        return false;
      try {
        calculateMileage(r.start, r.end);
        return true;
      } catch {
        return false;
      }
    }) ||
    !unique(value.mileage)
  )
    return invalid();
  if (
    !object(value.stats) ||
    !Object.entries(value.stats).every(
      ([date, s]) =>
        validDate(date) &&
        object(s) &&
        optionalNumber(s.weight, 500) &&
        optionalNumber(s.protein, 2000) &&
        number(s.proteinGoal, 1, 2000) &&
        optionalNumber(s.water, 30) &&
        typeof s.activity === 'boolean',
    )
  )
    return invalid();
  if (
    !list(
      value.projects,
      (p) =>
        object(p) &&
        text(p.id) &&
        text(p.name, 80) &&
        ['Active', 'Paused', 'Complete'].includes(String(p.status)) &&
        items(p.tasks),
    ) ||
    !unique(value.projects)
  )
    return invalid();
  if (
    !list(
      value.quickActions,
      (a) =>
        object(a) &&
        text(a.id) &&
        text(a.name, 30) &&
        a.kind === 'url' &&
        typeof a.target === 'string' &&
        a.target.length <= 2000 &&
        safeActionUrl(a.target),
    ) ||
    !unique(value.quickActions)
  )
    return invalid();
  if (
    !object(value.settings) ||
    typeof value.settings.crt !== 'boolean' ||
    !validTheme(value.settings.theme)
  )
    return invalid();
  if (value.cloudSync !== undefined) {
    const sync = value.cloudSync;
    if (
      !object(sync) ||
      typeof sync.userId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sync.userId) ||
      !Number.isSafeInteger(sync.revision) ||
      Number(sync.revision) < 1 ||
      !object(sync.base) ||
      Object.hasOwn(sync.base, 'cloudSync')
    )
      return invalid();
    validateData(sync.base);
  }
}
export function parseData(raw: string): DashboardData {
  if (raw.length > 4000000) throw new Error('Backup exceeds the 4 MB limit.');
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error('Saved data could not be read. Export a copy before attempting recovery.');
  }
  // Additive v1 migration: older installations/backups have no counters yet.
  if (object(value) && value.schemaVersion === 1 && !Object.hasOwn(value, 'counters')) {
    value = { ...value, counters: defaultCounters() };
  }
  if (
    object(value) &&
    value.schemaVersion === 1 &&
    object(value.settings) &&
    !Object.hasOwn(value.settings, 'theme')
  ) {
    value = { ...value, settings: { ...value.settings, theme: defaultTheme() } };
  }
  validateData(value);
  return value;
}
export function createRepository(storage: StorageAdapter) {
  return {
    load(): DashboardData {
      const raw = storage.getItem(STORAGE_KEY);
      if (raw !== null) return parseData(raw);
      const data = createInitialData();
      this.save(data);
      return data;
    },
    save(data: DashboardData): void {
      validateData(data);
      const serialized = JSON.stringify(data);
      if (serialized.length > 4000000)
        throw new Error(
          'Your data exceeds the 4 MB limit. Export a backup and remove old records before saving.',
        );
      try {
        storage.setItem(STORAGE_KEY, serialized);
      } catch {
        throw new Error(
          'Could not save on this device. Storage may be full or blocked. Free space or allow site storage, then try again.',
        );
      }
    },
    exportRaw(): string {
      const raw = storage.getItem(STORAGE_KEY) ?? '';
      try {
        const { cloudSync, ...content } = parseData(raw);
        return cloudSync ? JSON.stringify(content) : raw;
      } catch {
        return raw;
      }
    },
    restore(raw: string): DashboardData {
      const data = parseData(raw);
      this.save(data);
      return data;
    },
  };
}
