import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createNativeStorage, readNativeData } from '../src/data/nativeStorage.ts';
import { createInitialData } from '../src/domain/model.ts';
import { createRepository, STORAGE_KEY } from '../src/data/repository.ts';

test('native migration preserves old data exactly and thereafter reads the native store', () => {
  const original = JSON.stringify(createInitialData());
  let native: string | null | undefined = undefined;
  const bridge = {
    read: () => native,
    write: (value: string) => {
      native = value;
      return true;
    },
  };
  const legacy = {
    getItem: () => original,
    setItem: () => {
      throw new Error('Legacy data must stay untouched');
    },
  };
  const store = createNativeStorage(bridge, legacy);
  assert.equal(store.getItem(STORAGE_KEY), original);
  assert.equal(native, original);
  const updated = createInitialData();
  updated.tasks = [];
  const repo = createRepository(store);
  repo.save(updated);
  assert.deepEqual(createRepository(createNativeStorage(bridge, legacy)).load(), updated);
});

test('corrupt legacy data and failed migrations are preserved, never replaced with defaults', () => {
  let writes = 0;
  const bridge = {
    read: () => null,
    write: () => {
      writes++;
      return false;
    },
  };
  const corruptLegacy = { getItem: () => '{broken', setItem: () => {} };
  const corrupt = createNativeStorage(bridge, corruptLegacy);
  assert.throws(() => createRepository(corrupt).load());
  assert.equal(writes, 0);
  assert.equal(readNativeData(bridge, corruptLegacy), '{broken');
  const original = JSON.stringify(createInitialData());
  const validLegacy = {
    getItem: () => original,
    setItem: () => {},
  };
  const valid = createNativeStorage(bridge, validLegacy);
  assert.throws(() => createRepository(valid).load(), /Could not migrate/);
  assert.equal(writes, 1);
  assert.equal(readNativeData(bridge, validLegacy), original);
});

test('native save failures surface without acknowledging the new state', () => {
  const original = JSON.stringify(createInitialData());
  const adapter = createNativeStorage(
    { read: () => original, write: () => false },
    {
      getItem: () => {
        throw new Error('Legacy storage must not be read');
      },
      setItem: () => {},
    },
  );
  const repo = createRepository(adapter);
  const next = repo.load();
  next.tasks = [];
  assert.throws(() => repo.save(next), /Could not save/);
  assert.equal(repo.exportRaw(), original);
  assert.throws(() => adapter.getItem('another-key'));
});
