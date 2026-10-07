export const draftNames = ['tenant', 'email', 'historyFrom', 'historyTo', 'historyPeriod'] as const;
export type DraftName = (typeof draftNames)[number];
export type DraftValues = Partial<Record<DraftName, string>>;
export interface DraftStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export function draftStorageKey(scope: string) {
  // SecureStore permits only letters, digits, dots, hyphens and underscores.
  return `solution.drafts.v1.${Array.from(scope, (char) => char.codePointAt(0)!.toString(16).padStart(6, '0')).join('')}`;
}

export class DraftStore {
  private values: DraftValues = {};
  private dirty = new Set<DraftName>();
  private listeners = new Set<() => void>();
  private queue = Promise.resolve();
  private epoch = 0;
  readonly ready: Promise<void>;

  constructor(
    private key: string,
    private storage: DraftStorage,
  ) {
    this.ready = this.restore();
  }

  snapshot = () => this.values;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private notify() {
    for (const listener of this.listeners) listener();
  }
  private async restore() {
    const epoch = this.epoch;
    try {
      const raw = await this.storage.get(this.key);
      if (epoch !== this.epoch || !raw) return;
      const saved: unknown = JSON.parse(raw);
      if (!saved || typeof saved !== 'object' || Array.isArray(saved)) return;
      const next = { ...this.values };
      for (const name of draftNames) {
        const value = (saved as DraftValues)[name];
        if (!this.dirty.has(name) && typeof value === 'string' && value.length <= 1000) {
          next[name] = value;
        }
      }
      this.values = next;
      this.notify();
    } catch {
      // Keep usable in-memory drafts if device storage fails.
    }
  }
  set(name: DraftName, value: string) {
    this.dirty.add(name);
    this.values = { ...this.values, [name]: value };
    this.notify();
    const epoch = this.epoch;
    this.queue = this.queue
      .then(async () => {
        await this.ready;
        if (epoch === this.epoch) await this.storage.set(this.key, JSON.stringify(this.values));
      })
      .catch(() => undefined);
  }
  async clear() {
    this.epoch++;
    this.values = {};
    this.dirty.clear();
    this.notify();
    const removal = this.queue.then(() => this.storage.remove(this.key));
    this.queue = removal.catch(() => undefined);
    await removal;
  }
  async flushed() {
    await this.queue;
  }
}
