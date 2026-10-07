import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DraftStore, draftStorageKey, type DraftStorage } from '../src/core/draft-store';

function memoryStorage() {
  const data = new Map<string, string>();
  const storage: DraftStorage = {
    get: async (key) => data.get(key) ?? null,
    set: async (key, value) => {
      data.set(key, value);
    },
    remove: async (key) => {
      data.delete(key);
    },
  };
  return { data, storage };
}

test('access fields and history drafts survive store recreation; passwords are never restored', async () => {
  const { data, storage } = memoryStorage();
  const key = draftStorageKey('api:tenant:courier-one');
  const store = new DraftStore(key, storage);
  await store.ready;
  store.set('tenant', 'demo');
  store.set('email', 'courier@example.test');
  store.set('historyFrom', '2026-10-01');
  store.set('historyTo', '2026-10-07');
  store.set('historyPeriod', 'from=2026-10-01&to=2026-10-07');
  await store.flushed();
  const saved = JSON.parse(data.get(key)!);
  saved.password = 'Should-not-be-restored';
  data.set(key, JSON.stringify(saved));
  const restored = new DraftStore(key, storage);
  await restored.ready;
  assert.deepEqual(restored.snapshot(), store.snapshot());
  assert.equal(Object.hasOwn(restored.snapshot(), 'password'), false);
});

test('slow storage restoration does not overwrite input typed while loading', async () => {
  let resolve!: (value: string | null) => void;
  let persisted = '';
  const store = new DraftStore('draft', {
    get: () =>
      new Promise((done) => {
        resolve = done;
      }),
    set: async (_, value) => {
      persisted = value;
    },
    remove: async () => undefined,
  });
  store.set('email', 'new@example.test');
  resolve(JSON.stringify({ email: 'old@example.test', tenant: 'demo' }));
  await store.ready;
  await store.flushed();
  assert.deepEqual(JSON.parse(persisted), { email: 'new@example.test', tenant: 'demo' });
});

test('device/API/user scopes stay separate and logout removes pending and saved drafts', async () => {
  const { data, storage } = memoryStorage();
  const firstKey = draftStorageKey('https://api.test:tenant:courier-one');
  const secondKey = draftStorageKey('https://api.test:tenant:courier-two');
  assert.match(firstKey, /^[A-Za-z0-9._-]+$/);
  assert.notEqual(firstKey, secondKey);
  const first = new DraftStore(firstKey, storage);
  const second = new DraftStore(secondKey, storage);
  await Promise.all([first.ready, second.ready]);
  first.set('historyFrom', '2026-10-01');
  assert.deepEqual(second.snapshot(), {});
  await first.clear();
  assert.deepEqual(first.snapshot(), {});
  assert.equal(data.has(firstKey), false);
});

test('failed device storage keeps drafts in memory and corrupt data is ignored', async () => {
  const store = new DraftStore('draft', {
    get: async () => '{invalid json',
    set: async () => {
      throw new Error('Storage unavailable');
    },
    remove: async () => undefined,
  });
  await store.ready;
  assert.deepEqual(store.snapshot(), {});
  store.set('tenant', 'demo');
  await store.flushed();
  assert.equal(store.snapshot().tenant, 'demo');
});

test('logout during restore prevents an old draft from reappearing', async () => {
  let resolve!: (value: string | null) => void;
  const store = new DraftStore('draft', {
    get: () =>
      new Promise((done) => {
        resolve = done;
      }),
    set: async () => undefined,
    remove: async () => undefined,
  });
  await store.clear();
  resolve(JSON.stringify({ tenant: 'old-tenant' }));
  await store.ready;
  assert.deepEqual(store.snapshot(), {});
});
