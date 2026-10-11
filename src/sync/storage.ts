import { isIOS } from '../native';

export interface SyncStorage {
  readSession(): string | null;
  writeSession(value: string | null): void;
  preserveBackup(value: string): void;
  readBackup(): string | null;
}
declare global {
  interface Window {
    DailyOpsSyncStorage?: SyncStorage;
  }
}
const SESSION = 'daily-ops:session:v1';
const BACKUP = 'daily-ops:before-sync:v1';
export function syncStorage(): SyncStorage {
  if (isIOS) {
    if (!window.DailyOpsSyncStorage)
      throw new Error('Secure account storage is unavailable. Reopen the updated app.');
    return window.DailyOpsSyncStorage;
  }
  return {
    readSession: () => localStorage.getItem(SESSION),
    writeSession: (value) =>
      value === null ? localStorage.removeItem(SESSION) : localStorage.setItem(SESSION, value),
    preserveBackup: (value) => {
      if (!localStorage.getItem(BACKUP)) localStorage.setItem(BACKUP, value);
    },
    readBackup: () => localStorage.getItem(BACKUP),
  };
}
