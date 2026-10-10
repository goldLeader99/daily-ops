import { parseData, STORAGE_KEY } from './repository';
import type { StorageAdapter } from './repository';

export interface NativeStorageBridge {
  read(): string | null | undefined;
  write(value: string): boolean;
}
declare global {
  interface Window {
    DailyOpsStorage?: NativeStorageBridge;
  }
}

/** Recovery exports must remain possible even when validation or migration fails. */
export function readNativeData(bridge: NativeStorageBridge, legacy: StorageAdapter): string | null {
  return bridge.read() ?? legacy.getItem(STORAGE_KEY);
}

/** Keep the repository synchronous: native writes return only after durable commit. */
export function createNativeStorage(
  bridge: NativeStorageBridge,
  legacy: StorageAdapter,
): StorageAdapter {
  const checkKey = (key: string) => {
    if (key !== STORAGE_KEY) throw new Error('Unsupported dashboard storage key.');
  };
  return {
    getItem(key) {
      checkKey(key);
      // Android WebView can marshal a Java null return as JavaScript undefined.
      const current = bridge.read() ?? null;
      if (current !== null) return current;
      // Migrate once; retain the old WebView copy until a later explicit app-data clear.
      const previous = legacy.getItem(key);
      if (previous !== null) {
        parseData(previous); // Never migrate a corrupt copy or seed over it.
        if (!bridge.write(previous))
          throw new Error(
            'Could not migrate saved data. Free device space and retry; your original copy is unchanged.',
          );
      }
      return previous;
    },
    setItem(key, value) {
      checkKey(key);
      if (!bridge.write(value))
        throw new Error('The app could not finish saving to device storage.');
    },
  };
}
