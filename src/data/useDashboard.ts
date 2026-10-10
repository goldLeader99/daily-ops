import { useCallback, useEffect, useState } from 'react';
import type { DashboardData } from '../domain/model';
import { createRepository, STORAGE_KEY } from './repository';
import { createNativeStorage, readNativeData } from './nativeStorage';
import { isNative } from '../native';

export type Commit = (change: (current: DashboardData) => DashboardData) => boolean;
export function useDashboard() {
  const [repository] = useState(() =>
    createRepository({
      getItem: (key) => {
        if (!isNative) return window.localStorage.getItem(key);
        if (!window.DailyOpsStorage)
          throw new Error(
            'App storage is unavailable. Reopen the app; your saved data has not been changed.',
          );
        return createNativeStorage(window.DailyOpsStorage, window.localStorage).getItem(key);
      },
      setItem: (key, value) => {
        if (!isNative) return window.localStorage.setItem(key, value);
        if (!window.DailyOpsStorage) throw new Error('App storage is unavailable.');
        createNativeStorage(window.DailyOpsStorage, window.localStorage).setItem(key, value);
      },
    }),
  );
  const [initial] = useState(() => {
    try {
      return { data: repository.load(), error: '' };
    } catch (error) {
      return { data: null, error: (error as Error).message };
    }
  });
  const [data, setData] = useState<DashboardData | null>(initial.data);
  const [error, setError] = useState(initial.error);
  const commit: Commit = useCallback(
    (change) => {
      try {
        const next = change(repository.load());
        repository.save(next);
        setData(next);
        setError('');
        return true;
      } catch (error) {
        setError((error as Error).message);
        return false;
      }
    },
    [repository],
  );
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      try {
        setData(repository.load());
        setError('');
      } catch (error) {
        setError((error as Error).message);
      }
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, [repository]);
  const restore = (raw: string) => {
    try {
      setData(repository.restore(raw));
      setError('');
      return true;
    } catch (error) {
      setError((error as Error).message);
      return false;
    }
  };
  const exportRaw = () =>
    isNative && window.DailyOpsStorage
      ? (readNativeData(window.DailyOpsStorage, window.localStorage) ?? '')
      : repository.exportRaw();
  return { data, error, commit, restore, exportRaw, setError };
}
