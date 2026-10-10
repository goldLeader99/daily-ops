import { defaultTheme } from './theme';
import type { Theme } from './theme';
export type ChecklistItem = { id: string; text: string; completed: boolean };
export type Vehicle = 'BMW' | 'Subaru';
export type Difficulty = 'Easy' | 'Moderate' | 'Difficult';
export type MileageRecord = {
  id: string;
  vehicle: Vehicle;
  start: number;
  end: number;
  date: string;
  shift: string;
  difficulty: Difficulty;
  createdAt: string;
};
export type DailyStats = {
  weight: number | null;
  protein: number | null;
  proteinGoal: number;
  water: number | null;
  activity: boolean;
};
export type Project = {
  id: string;
  name: string;
  status: 'Active' | 'Paused' | 'Complete';
  tasks: ChecklistItem[];
};
export type QuickAction = { id: string; name: string; kind: 'url'; target: string };
export type CounterKind = 'cigarettes' | 'alcohol';
export type DayCounters = Record<CounterKind, string | null>;
export type DashboardData = {
  schemaVersion: 1;
  tasks: ChecklistItem[];
  groceries: ChecklistItem[];
  workoutDay: number;
  workoutSessions: Record<string, string[]>;
  mileage: MileageRecord[];
  selectedVehicle: Vehicle;
  stats: Record<string, DailyStats>;
  counters: DayCounters;
  projects: Project[];
  quickActions: QuickAction[];
  settings: { crt: boolean; theme: Theme };
};
export type Exercise = { id: string; name: string; prescription: string };
export type Workout = { day: number; name: string; focus: string; exercises: Exercise[] };
const exercises = (rows: [string, string][]): Exercise[] =>
  rows.map(([name, prescription], i) => ({ id: String(i + 1), name, prescription }));
export const WORKOUTS: Workout[] = [
  {
    day: 1,
    name: 'Chest & Legs',
    focus: 'PUSH / LOWER BODY',
    exercises: exercises([
      ['Barbell bench press', '3 × 8–10'],
      ['Goblet squat', '3 × 10–12'],
      ['Incline dumbbell press', '3 × 10'],
      ['Romanian deadlift', '3 × 10'],
      ['Cable fly', '3 × 12–15'],
      ['Standing calf raise', '3 × 15'],
    ]),
  },
  {
    day: 2,
    name: 'Lat & Biceps',
    focus: 'PULL / UPPER BODY',
    exercises: exercises([
      ['Lat pulldown', '3 × 10–12'],
      ['Seated cable row', '3 × 10'],
      ['Single-arm dumbbell row', '3 × 10 / side'],
      ['Straight-arm pulldown', '3 × 12'],
      ['EZ-bar curl', '3 × 10'],
      ['Hammer curl', '3 × 12'],
      ['Incline dumbbell curl', '2 × 12'],
    ]),
  },
  {
    day: 3,
    name: 'Shoulders & Legs',
    focus: 'PRESS / LOWER BODY',
    exercises: exercises([
      ['Dumbbell shoulder press', '3 × 10'],
      ['Leg press', '3 × 12'],
      ['Lateral raise', '3 × 15'],
      ['Reverse lunge', '3 × 10 / side'],
      ['Rear delt fly', '3 × 15'],
      ['Seated leg curl', '3 × 12'],
    ]),
  },
  {
    day: 4,
    name: 'Abs & Strengthman',
    focus: 'CORE / CARRY',
    exercises: exercises([
      ['Farmer carry', '4 × 30 m'],
      ['Plank', '3 × 45 sec'],
      ['Sled push', '4 × 20 m'],
      ['Hanging knee raise', '3 × 12'],
      ['Sandbag carry', '3 × 30 m'],
      ['Pallof press', '3 × 10 / side'],
    ]),
  },
  {
    day: 5,
    name: 'Full Body',
    focus: 'COMPOUND / FULL BODY',
    exercises: exercises([
      ['Trap-bar deadlift', '3 × 6'],
      ['Dumbbell bench press', '3 × 10'],
      ['Assisted pull-up', '3 × 8'],
      ['Walking lunge', '3 × 12 / side'],
      ['Dumbbell push press', '3 × 8'],
      ['Dead bug', '3 × 10 / side'],
    ]),
  },
];
export function localDate(date = new Date()): string {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}
export function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00');
  return !Number.isNaN(date.getTime()) && localDate(date) === value;
}
export function defaultCounters(): DayCounters {
  return { cigarettes: null, alcohol: null };
}
/** Compare calendar dates, so daylight-saving changes do not shorten a day. */
export function counterDays(start: string | null, today = localDate()): number | null {
  if (start === null) return null;
  if (!validDate(start) || !validDate(today)) throw new Error('Enter a valid calendar date.');
  return Math.max(
    0,
    Math.round((Date.parse(today + 'T00:00:00Z') - Date.parse(start + 'T00:00:00Z')) / 86400000),
  );
}
export function counterStartDate(days: number, today = localDate()): string {
  if (!Number.isInteger(days) || days < 0 || days > 36500 || !validDate(today)) {
    throw new Error('Enter a whole number of days between 0 and 36,500.');
  }
  return new Date(Date.parse(today + 'T00:00:00Z') - days * 86400000).toISOString().slice(0, 10);
}
export function cleanText(text: string, max = 120): string {
  const value = text.trim();
  if (!value || value.length > max) throw new Error(`Enter between 1 and ${max} characters.`);
  return value;
}
export function createItem(text: string): ChecklistItem {
  return { id: newId(), text: cleanText(text), completed: false };
}
export function toggleItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.map((item) => (item.id === id ? { ...item, completed: !item.completed } : item));
}
export function deleteItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.filter((item) => item.id !== id);
}
export function editItem(items: ChecklistItem[], id: string, text: string): ChecklistItem[] {
  const value = cleanText(text);
  return items.map((item) => (item.id === id ? { ...item, text: value } : item));
}
export function calculateMileage(start: number, end: number): number {
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    end < start ||
    end > 10000000
  ) {
    throw new Error(
      'Ending odometer must be at least the starting odometer. Use values from 0 to 10,000,000 km.',
    );
  }
  return Math.round((end - start) * 10) / 10;
}
export function defaultStats(): DailyStats {
  return { weight: null, protein: null, proteinGoal: 120, water: null, activity: false };
}
export function sessionKey(date: string, day: number): string {
  return `${date}/${day}`;
}
export function safeActionUrl(value: string): boolean {
  if (value === '') return true;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}
export function createInitialData(): DashboardData {
  return {
    schemaVersion: 1,
    tasks: ['Workout', 'Groceries', 'Flex shift', 'DevOps project'].map(createItem),
    groceries: ['Eggs', 'Chicken', 'Milk', 'Fruit'].map(createItem),
    workoutDay: 1,
    workoutSessions: {},
    mileage: [],
    selectedVehicle: 'BMW',
    stats: {},
    counters: defaultCounters(),
    projects: ['Local AI Assistant', 'DevOps Lab', 'Personal Dashboard'].map((name) => ({
      id: newId(),
      name,
      status: 'Active',
      tasks: [],
    })),
    quickActions: [
      { id: 'spotify', name: 'Spotify', kind: 'url', target: 'https://open.spotify.com' },
      { id: 'cameras', name: 'Cameras', kind: 'url', target: '' },
      { id: 'local-ai', name: 'Local AI', kind: 'url', target: '' },
      { id: 'maps', name: 'Maps', kind: 'url', target: 'https://maps.google.com' },
    ],
    settings: { crt: true, theme: defaultTheme() },
  };
}

/** getRandomValues also works on a tablet using a plain HTTP LAN address. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) =>
    byte.toString(16).padStart(2, '0'),
  ).join('');
}
