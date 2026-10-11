import type { SupabaseClient } from '@supabase/supabase-js';
import type { DashboardContent } from '../domain/model';
import { validateData } from '../data/repository';
import { sharedContent } from './merge';

export type RemoteDashboard = { revision: number; data: DashboardContent };
export interface SyncTransport {
  revision(): Promise<number | null>;
  read(): Promise<RemoteDashboard | null>;
  commit(expected: number, data: DashboardContent): Promise<number | null>;
}
export function supabaseTransport(client: SupabaseClient, userId: string): SyncTransport {
  return {
    async revision() {
      const { data, error } = await client
        .from('daily_ops_dashboards')
        .select('revision')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      return data ? Number(data.revision) : null;
    },
    async read() {
      const { data, error } = await client
        .from('daily_ops_dashboards')
        .select('revision,document')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      validateData(data.document);
      if (!Number.isSafeInteger(data.revision) || data.revision < 1)
        throw new Error(
          'Shared dashboard has an unsupported revision. Your device copy is unchanged.',
        );
      return { revision: data.revision, data: sharedContent(data.document) };
    },
    async commit(expected, data) {
      validateData(data);
      if (new TextEncoder().encode(JSON.stringify(data)).byteLength > 2_000_000)
        throw new Error(
          'Shared dashboard is too large. Export a backup and remove old records before syncing.',
        );
      const { data: revision, error } = await client.rpc('daily_ops_commit', {
        expected_revision: expected,
        dashboard: data,
      });
      if (error) throw error;
      if (revision !== null && (!Number.isSafeInteger(revision) || revision < 1))
        throw new Error('Sync returned an unsupported revision. Your device copy is unchanged.');
      return revision as number | null;
    },
  };
}
