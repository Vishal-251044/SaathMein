/**
 * useRecentSearches — the last 8 searches, saved on this phone (secure storage, small list).
 */
import { useCallback, useEffect, useState } from 'react';

import { getItem, removeItem, setItem, STORAGE_KEYS } from '@/lib/secureStorage';

const MAX_RECENT = 8;

/**
 * Read the saved list safely (bad data → empty list).
 * @returns Saved searches, newest first
 */
async function readRecent(): Promise<string[]> {
  try {
    const raw = await getItem(STORAGE_KEYS.RECENT_SEARCHES);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * @returns Recent searches plus add / remove / clear actions
 */
export function useRecentSearches() {
  const [recent, setRecent] = useState<string[]>([]);

  useEffect(() => {
    readRecent().then(setRecent);
  }, []);

  const persist = useCallback((next: string[]) => {
    setRecent(next);
    setItem(STORAGE_KEYS.RECENT_SEARCHES, JSON.stringify(next)).catch(() => {});
  }, []);

  /** Add a search to the top (case-insensitive de-duplication). */
  const add = useCallback(
    (term: string) => {
      const clean = term.trim();
      if (clean.length < 2) return;
      persist(
        [clean, ...recent.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(
          0,
          MAX_RECENT,
        ),
      );
    },
    [recent, persist],
  );

  const remove = useCallback(
    (term: string) => persist(recent.filter((item) => item !== term)),
    [recent, persist],
  );

  const clear = useCallback(() => {
    setRecent([]);
    removeItem(STORAGE_KEYS.RECENT_SEARCHES).catch(() => {});
  }, []);

  return { recent, add, remove, clear };
}
