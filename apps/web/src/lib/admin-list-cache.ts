"use client";

import { apiFetch } from "@/lib/api";

type CacheEntry<T> = { at: number; data: T };

const memory = new Map<string, CacheEntry<unknown>>();
const TTL_MS = 5 * 60_000;

function storageKey(key: string) {
  return `aes_admin_cache:${key}`;
}

export function readAdminCache<T>(key: string): T | null {
  const mem = memory.get(key) as CacheEntry<T> | undefined;
  if (mem && Date.now() - mem.at < TTL_MS) return mem.data;

  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(storageKey(key));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CacheEntry<T>;
    if (!parsed?.at || Date.now() - parsed.at > TTL_MS) return null;
    memory.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeAdminCache<T>(key: string, data: T) {
  const entry: CacheEntry<T> = { at: Date.now(), data };
  memory.set(key, entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(key), JSON.stringify(entry));
  } catch {
    // quota / private mode — memory cache still helps
  }
}

export function clearAdminCache(key?: string) {
  if (key) {
    memory.delete(key);
    if (typeof window !== "undefined") sessionStorage.removeItem(storageKey(key));
    return;
  }
  memory.clear();
  if (typeof window === "undefined") return;
  const keys: string[] = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k?.startsWith("aes_admin_cache:")) keys.push(k);
  }
  for (const k of keys) sessionStorage.removeItem(k);
}

/**
 * Stale-while-revalidate:
 * - returns cached data immediately when present
 * - refreshes from network in background and optionally notifies via onFresh
 */
export async function fetchAdminCached<T>(
  key: string,
  path: string,
  options?: { force?: boolean; onFresh?: (data: T) => void }
): Promise<{ data: T; fromCache: boolean }> {
  const cached = options?.force ? null : readAdminCache<T>(key);
  if (cached) {
    void apiFetch<T>(path)
      .then((fresh) => {
        writeAdminCache(key, fresh);
        options?.onFresh?.(fresh);
      })
      .catch(() => {
        /* keep stale */
      });
    return { data: cached, fromCache: true };
  }
  const fresh = await apiFetch<T>(path);
  writeAdminCache(key, fresh);
  return { data: fresh, fromCache: false };
}

export const ADMIN_CACHE_KEYS = {
  products: "products",
  bundles: "bundles",
  wikiArticles: "wiki-articles",
  customers: "customers",
} as const;
