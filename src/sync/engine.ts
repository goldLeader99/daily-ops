import type { DashboardData } from '../domain/model';
import type { ConflictChoice } from './merge';
import { equal, mergeDashboard, sharedContent } from './merge';
import type { RemoteDashboard, SyncTransport } from './transport';
import { describeConflict } from './conflicts';

export interface SyncStore {
  load(): DashboardData;
  save(data: DashboardData): void;
  preserveBackup(raw: string): void;
}
export type SyncResult =
  | { kind: 'synced' }
  | { kind: 'conflict'; paths: string[]; details: string[] };

export class SyncEngine {
  private active = true;
  private conflict: { local: ReturnType<typeof sharedContent>; remote: RemoteDashboard } | null =
    null;
  constructor(
    private userId: string,
    private transport: SyncTransport,
    private store: SyncStore,
  ) {}
  stop() {
    this.active = false;
  }
  private check() {
    if (!this.active) throw new Error('Sync session changed.');
  }

  async connect(mode: 'device' | 'shared'): Promise<void> {
    const remote = await this.transport.read();
    this.check();
    const current = this.store.load();
    if (current.cloudSync && current.cloudSync.userId !== this.userId)
      throw new Error(
        'This device is linked to another account. Sign in to that account to keep syncing its records.',
      );
    this.store.preserveBackup(JSON.stringify(sharedContent(current)));
    if (mode === 'shared') {
      if (!remote)
        throw new Error('No shared dashboard exists yet. Start sharing from your iPhone first.');
      this.store.save({
        ...remote.data,
        cloudSync: { userId: this.userId, revision: remote.revision, base: remote.data },
      });
      return;
    }
    if (remote)
      throw new Error(
        'A shared dashboard already exists. Review it before connecting this device.',
      );
    const sent = sharedContent(current);
    const revision = await this.transport.commit(0, sent);
    this.check();
    if (revision === null)
      throw new Error(
        'Another device started sharing. Review the shared dashboard before connecting.',
      );
    const latest = sharedContent(this.store.load());
    const local = mergeDashboard(sent, latest, sent).data;
    this.store.save({ ...local, cloudSync: { userId: this.userId, revision, base: sent } });
  }

  async sync(choice?: ConflictChoice): Promise<SyncResult> {
    for (let attempt = 0; attempt < 4; attempt++) {
      this.check();
      const current = this.store.load();
      const state = current.cloudSync;
      if (!state || state.userId !== this.userId)
        throw new Error('Connect this device to the shared dashboard first.');
      const local = sharedContent(current);
      const revision = await this.transport.revision();
      this.check();
      if (revision === null)
        throw new Error('The shared dashboard is unavailable. Your local records have been kept.');
      if (revision < state.revision)
        throw new Error(
          'The shared dashboard was restored to an older revision. Export your device copy before reconnecting.',
        );
      if (revision === state.revision && equal(local, state.base)) return { kind: 'synced' };
      const remote =
        revision === state.revision ? { revision, data: state.base } : await this.transport.read();
      this.check();
      if (!remote)
        throw new Error('The shared dashboard is unavailable. Your local records have been kept.');
      // A review applies only to exactly the local and remote versions that were shown.
      if (
        choice &&
        (!this.conflict ||
          this.conflict.remote.revision !== remote.revision ||
          !equal(this.conflict.local, local))
      )
        choice = undefined;
      const merged = mergeDashboard(state.base, local, remote.data, choice);
      if (merged.conflicts.length && !choice) {
        this.conflict = { local, remote };
        return {
          kind: 'conflict',
          paths: merged.conflicts,
          details: merged.conflicts.map((path) => describeConflict(path, local, remote.data)),
        };
      }
      const nextRevision = equal(merged.data, remote.data)
        ? remote.revision
        : await this.transport.commit(remote.revision, merged.data);
      this.check();
      if (nextRevision === null) {
        choice = undefined;
        continue;
      }
      const latest = this.store.load();
      if (latest.cloudSync?.userId !== this.userId) throw new Error('Sync session changed.');
      // Local edits made while a request was in flight remain pending for the next upload.
      const pending = mergeDashboard(local, sharedContent(latest), merged.data, 'device').data;
      this.store.save({
        ...pending,
        cloudSync: { userId: this.userId, revision: nextRevision, base: merged.data },
      });
      this.conflict = null;
      return { kind: 'synced' };
    }
    throw new Error('Both devices are updating. Your changes are saved here; sync will retry.');
  }
}
