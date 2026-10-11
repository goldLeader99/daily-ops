import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { syncStorage } from './storage';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
export const cloudConfigured = !!url && !!key;
let client: SupabaseClient | null = null;
export function cloudClient(): SupabaseClient {
  if (!cloudConfigured) throw new Error('Cloud sync is not configured in this build.');
  if (!client) {
    const storage = syncStorage();
    const sessionValues = (): Record<string, string> => JSON.parse(storage.readSession() ?? '{}');
    client = createClient(url!, key!, {
      global: {
        fetch: async (input, init) => {
          const controller = new AbortController();
          const abort = () => controller.abort();
          init?.signal?.addEventListener('abort', abort, { once: true });
          if (init?.signal?.aborted) abort();
          const timeout = setTimeout(abort, 15_000);
          try {
            return await fetch(input, { ...init, signal: controller.signal });
          } finally {
            clearTimeout(timeout);
            init?.signal?.removeEventListener('abort', abort);
          }
        },
      },
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,
        storageKey: 'daily-ops-auth',
        storage: {
          getItem: (key) => {
            const values = sessionValues();
            return Object.hasOwn(values, key) ? values[key] : null;
          },
          setItem: (key, value) =>
            storage.writeSession(JSON.stringify({ ...sessionValues(), [key]: value })),
          removeItem: (key) => {
            const values = sessionValues();
            delete values[key];
            storage.writeSession(Object.keys(values).length ? JSON.stringify(values) : null);
          },
        },
      },
    });
  }
  return client;
}
