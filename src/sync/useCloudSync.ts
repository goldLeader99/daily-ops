import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { App as NativeApp } from '@capacitor/app';
import type { DashboardData } from '../domain/model';
import { isNative } from '../native';
import { cloudClient, cloudConfigured } from './client';
import { SyncEngine } from './engine';
import { supabaseTransport } from './transport';
import { syncStorage } from './storage';
import type { ConflictChoice } from './merge';

type Phase =
  | 'unconfigured'
  | 'signed-out'
  | 'loading'
  | 'setup'
  | 'syncing'
  | 'synced'
  | 'offline'
  | 'conflict'
  | 'error';
export type CloudStatus = {
  phase: Phase;
  email: string;
  message: string;
  conflicts: string[];
  hasShared: boolean;
  lastSynced: number | null;
};
export function useCloudSync(
  data: DashboardData | null,
  read: () => DashboardData,
  save: (data: DashboardData) => void,
) {
  const [status, setStatus] = useState<CloudStatus>({
    phase: cloudConfigured ? 'loading' : 'unconfigured',
    email: '',
    message: '',
    conflicts: [],
    hasShared: false,
    lastSynced: null,
  });
  const [user, setUser] = useState<User | null>(null);
  const [active, setActive] = useState(!document.hidden);
  const engine = useRef<SyncEngine | null>(null);
  const busy = useRef(false);
  const epoch = useRef(0);

  useEffect(() => {
    if (!cloudConfigured) return;
    try {
      const client = cloudClient();
      // The auth callback only schedules React state; it never awaits another auth method.
      const { data: listener } = client.auth.onAuthStateChange((_event, session) =>
        setUser(session?.user ?? null),
      );
      void client.auth.getSession().then(({ data, error }) => {
        if (error) setStatus((s) => ({ ...s, phase: 'error', message: error.message }));
        else setUser(data.session?.user ?? null);
      });
      return () => listener.subscription.unsubscribe();
    } catch (error) {
      setStatus((s) => ({ ...s, phase: 'error', message: (error as Error).message }));
    }
  }, []);

  useEffect(() => {
    if (!isNative || !cloudConfigured) return;
    const handleURL = async (url: string) => {
      try {
        const parsed = new URL(url);
        if (
          parsed.protocol !== 'com.dailyops.dashboard:' ||
          parsed.host !== 'auth' ||
          parsed.pathname !== '/callback'
        )
          return;
        const code = parsed.searchParams.get('code');
        if (!code) return;
        const { error } = await cloudClient().auth.exchangeCodeForSession(code);
        if (error) throw error;
      } catch (e) {
        setStatus((s) => ({ ...s, phase: 'error', message: (e as Error).message }));
      }
    };
    const listener = NativeApp.addListener('appUrlOpen', ({ url }) => {
      void handleURL(url);
    });
    void NativeApp.getLaunchUrl().then((launch) => {
      if (launch) void handleURL(launch.url);
    });
    return () => {
      void listener.then((v) => v.remove());
    };
  }, []);

  useEffect(() => {
    const change = () => setActive(!document.hidden);
    document.addEventListener('visibilitychange', change);
    const listener = isNative
      ? NativeApp.addListener('appStateChange', ({ isActive }) => setActive(isActive))
      : null;
    return () => {
      document.removeEventListener('visibilitychange', change);
      void listener?.then((v) => v.remove());
    };
  }, []);

  useEffect(() => {
    const version = ++epoch.current;
    busy.current = false;
    engine.current?.stop();
    engine.current = null;
    if (!cloudConfigured) return;
    if (!user) {
      setStatus((s) => ({ ...s, phase: 'signed-out', email: '', message: '', conflicts: [] }));
      return;
    }
    try {
      const storage = syncStorage();
      const transport = supabaseTransport(cloudClient(), user.id);
      engine.current = new SyncEngine(user.id, transport, {
        load: read,
        save,
        preserveBackup: storage.preserveBackup,
      });
      if (read().cloudSync?.userId === user.id) {
        setStatus((s) => ({
          ...s,
          phase: 'syncing',
          email: user.email ?? '',
          message: '',
          conflicts: [],
        }));
      } else {
        setStatus((s) => ({
          ...s,
          phase: 'loading',
          email: user.email ?? '',
          message: '',
          conflicts: [],
        }));
        void transport
          .revision()
          .then((revision) => {
            if (epoch.current === version)
              setStatus((s) => ({ ...s, phase: 'setup', hasShared: revision !== null }));
          })
          .catch((error: Error) => {
            if (epoch.current === version)
              setStatus((s) => ({ ...s, phase: 'error', message: error.message }));
          });
      }
    } catch (error) {
      setStatus((s) => ({ ...s, phase: 'error', message: (error as Error).message }));
    }
    return () => {
      engine.current?.stop();
      epoch.current++;
    };
  }, [user?.id, read, save]);

  const sync = useCallback(
    async (choice?: ConflictChoice) => {
      if (!engine.current || !user || !read().cloudSync || busy.current || !active) return;
      if (!navigator.onLine) {
        setStatus((s) => ({
          ...s,
          phase: 'offline',
          message: 'Changes are saved here and will sync when connected.',
        }));
        return;
      }
      const version = epoch.current;
      busy.current = true;
      setStatus((s) => ({ ...s, phase: 'syncing', message: '' }));
      try {
        const result = await engine.current.sync(choice);
        if (epoch.current !== version) return;
        setStatus((s) =>
          result.kind === 'conflict'
            ? {
                ...s,
                phase: 'conflict',
                conflicts: result.details,
                message: 'Both devices changed the same records. Choose which version to keep.',
              }
            : { ...s, phase: 'synced', conflicts: [], message: '', lastSynced: Date.now() },
        );
      } catch (error) {
        if (epoch.current === version)
          setStatus((s) => ({
            ...s,
            phase: navigator.onLine ? 'error' : 'offline',
            message: (error as Error).message,
          }));
      } finally {
        if (epoch.current === version) busy.current = false;
      }
    },
    [user?.id, active, read],
  );

  useEffect(() => {
    if (!cloudConfigured) return;
    try {
      if (active) cloudClient().auth.startAutoRefresh();
      else cloudClient().auth.stopAutoRefresh();
    } catch {
      return;
    }
    if (!active || !user || data?.cloudSync?.userId !== user.id) return;
    const immediate = setTimeout(() => void sync(), 300);
    const interval = setInterval(() => {
      if (status.phase !== 'conflict') void sync();
    }, 5000);
    const reconnect = () => void sync();
    window.addEventListener('online', reconnect);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
      window.removeEventListener('online', reconnect);
    };
  }, [data, active, user?.id, sync, status.phase === 'conflict']);

  const connect = async (mode: 'device' | 'shared') => {
    if (!engine.current || busy.current) return;
    const version = epoch.current;
    busy.current = true;
    setStatus((s) => ({ ...s, phase: 'syncing', message: '' }));
    try {
      await engine.current.connect(mode);
      if (epoch.current === version)
        setStatus((s) => ({ ...s, phase: 'synced', message: '', lastSynced: Date.now() }));
    } catch (error) {
      if (epoch.current === version) {
        const message = (error as Error).message;
        try {
          const revision = await supabaseTransport(cloudClient(), user!.id).revision();
          if (epoch.current === version)
            setStatus((s) => ({ ...s, phase: 'error', message, hasShared: revision !== null }));
        } catch {
          if (epoch.current === version) setStatus((s) => ({ ...s, phase: 'error', message }));
        }
      }
    } finally {
      if (epoch.current === version) busy.current = false;
    }
  };
  const signIn = async (email: string, password: string, create = false) => {
    const client = cloudClient();
    const result = create
      ? await client.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: isNative
              ? 'com.dailyops.dashboard://auth/callback'
              : window.location.origin,
          },
        })
      : await client.auth.signInWithPassword({ email, password });
    if (result.error) throw result.error;
    return !!result.data.session;
  };
  const signOut = async () => {
    const { error } = await cloudClient().auth.signOut({ scope: 'local' });
    if (error) throw error;
  };
  return {
    status,
    signedIn: !!user,
    userId: user?.id ?? null,
    linked: !!user && data?.cloudSync?.userId === user.id,
    signIn,
    signOut,
    connect,
    sync,
    backup: () => syncStorage().readBackup(),
  };
}
export type CloudSync = ReturnType<typeof useCloudSync>;
