/** Tiny in-process TTL cache for hot admin list endpoints. */
export function createTtlCache<T>(ttlMs: number) {
  let entry: { at: number; value: T } | null = null;
  return {
    get(): T | null {
      if (!entry) return null;
      if (Date.now() - entry.at > ttlMs) {
        entry = null;
        return null;
      }
      return entry.value;
    },
    set(value: T) {
      entry = { at: Date.now(), value };
    },
    clear() {
      entry = null;
    },
  };
}
