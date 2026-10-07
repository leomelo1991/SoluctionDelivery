import {
  createContext,
  useContext,
  useMemo,
  useSyncExternalStore,
  type PropsWithChildren,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { DraftStore, draftStorageKey, type DraftName } from './draft-store';

const stores = new Map<string, { url: string; store: DraftStore }>();
const Context = createContext<DraftStore | null>(null);

export function MobileDraftProvider({
  url,
  actor,
  children,
}: PropsWithChildren<{ url: string; actor: string }>) {
  const store = useMemo(() => {
    const key = draftStorageKey(JSON.stringify([url, actor]));
    const existing = stores.get(key);
    if (existing) return existing.store;
    const next = new DraftStore(key, {
      get: (name) => SecureStore.getItemAsync(name),
      set: (name, value) =>
        SecureStore.setItemAsync(name, value, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      remove: (name) => SecureStore.deleteItemAsync(name),
    });
    stores.set(key, { url, store: next });
    return next;
  }, [url, actor]);
  return <Context.Provider value={store}>{children}</Context.Provider>;
}

export async function clearMobileDrafts(url: string) {
  await Promise.all(
    [...stores.values()].filter((entry) => entry.url === url).map((entry) => entry.store.clear()),
  );
}

export function useMobileDraft(name: DraftName, initial: string | (() => string) = '') {
  const store = useContext(Context);
  if (!store) throw new Error('Rascunhos indisponíveis.');
  const values = useSyncExternalStore(store.subscribe, store.snapshot);
  const fallback = useMemo(
    () => (typeof initial === 'function' ? initial() : initial),
    [store, name],
  );
  return [values[name] ?? fallback, (value: string) => store.set(name, value)] as const;
}
