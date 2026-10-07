import { useContext, useEffect, useState, type SetStateAction } from 'react';
import { ActorContext, actorScope } from './query';

const prefix = 'sd-draft:';
const memory = new Map<string, unknown>();

export function readDraft<T>(key: string, fallback: T): T {
  if (memory.has(key)) return memory.get(key) as T;
  try {
    const raw = sessionStorage.getItem(prefix + key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {
    // Drafts remain usable when browser storage is unavailable.
  }
  return fallback;
}

export function writeDraft(key: string, value: unknown) {
  memory.set(key, value);
  try {
    sessionStorage.setItem(prefix + key, JSON.stringify(value));
  } catch {
    // Keep the in-memory draft for this session.
  }
}

export function clearDraft(key: string) {
  const matches = (candidate: string) => candidate === key || candidate.startsWith(`${key}:`);
  for (const candidate of memory.keys()) {
    if (matches(candidate)) memory.delete(candidate);
  }
  try {
    for (const candidate of Object.keys(sessionStorage)) {
      if (candidate.startsWith(prefix) && matches(candidate.slice(prefix.length))) {
        sessionStorage.removeItem(candidate);
      }
    }
  } catch {
    // Browser storage may be restricted.
  }
}

export function clearDrafts() {
  memory.clear();
  try {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  } catch {
    // Browser storage may be restricted.
  }
}

export function useDraftKey(name: string | null, allowAnonymous = false) {
  const actor = useContext(ActorContext);
  return name && (actor || allowAnonymous)
    ? `${actor ? actorScope(actor) : 'anonymous'}:${name}`
    : null;
}

export function useDraftState<T>(name: string | null, initial: T | (() => T)) {
  const key = useDraftKey(name);
  const fresh = () => (typeof initial === 'function' ? (initial as () => T)() : initial);
  const [state, setState] = useState(() => ({
    key,
    value: key ? readDraft(key, fresh()) : fresh(),
  }));
  if (state.key !== key) {
    setState({ key, value: key ? readDraft(key, fresh()) : fresh() });
  }
  useEffect(() => {
    if (state.key) writeDraft(state.key, state.value);
  }, [state]);
  const update = (next: SetStateAction<T>) => {
    setState((previous) => ({
      ...previous,
      value: typeof next === 'function' ? (next as (value: T) => T)(previous.value) : next,
    }));
  };
  return [state.value, update] as const;
}
