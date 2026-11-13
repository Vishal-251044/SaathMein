/**
 * Offline cache for key screens (Day 13): successful queries for the home feed, my groups,
 * group pages (including deal codes for the showroom), payments, products, dealers,
 * wallet, disputes, categories and cities are saved to a file in the app cache and
 * restored on the next start, so these screens open without a network.
 *
 * Uses TanStack Query's own dehydrate / hydrate with expo-file-system (no extra library).
 * Writes are debounced; the file is ignored after 7 days and deleted on sign-out. Tokens
 * are never part of query data (they live in expo-secure-store).
 */
import { dehydrate, hydrate, type Query, type QueryClient } from '@tanstack/react-query';
import { File, Paths } from 'expo-file-system';

const FILE_NAME = 'saathmein-query-cache-v1.json';
const SAVE_DEBOUNCE_MS = 2_000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

/** Query key roots worth keeping offline. */
const PERSISTED_ROOTS = new Set([
  'feed',
  'groups',
  'group',
  'payments',
  'product',
  'products',
  'dealer',
  'wallet',
  'disputes',
  'categories',
  'cities',
]);

type CacheFile = { savedAt: number; state: ReturnType<typeof dehydrate> };

/** The cache file (null where the file system is unavailable, e.g. tests). */
function cacheFile(): File | null {
  try {
    return new File(Paths.cache, FILE_NAME);
  } catch {
    return null;
  }
}

/** Only finished, successful queries from the allow-list. */
const shouldPersist = (query: Query) =>
  query.state.status === 'success' && PERSISTED_ROOTS.has(String(query.queryKey[0]));

/**
 * Put the saved data back into the cache (call once, before the first screen renders).
 * Restored data counts as stale, so screens refetch it as soon as the API is reachable.
 * @param queryClient - The app's query client
 */
export function restoreQueryCache(queryClient: QueryClient): void {
  const file = cacheFile();
  if (!file?.exists) return;
  try {
    const saved = JSON.parse(file.textSync()) as CacheFile;
    if (!saved?.state || Date.now() - saved.savedAt > MAX_AGE_MS) {
      file.delete();
      return;
    }
    hydrate(queryClient, saved.state);
  } catch {
    // Corrupt or unreadable cache: start fresh
    try {
      file.delete();
    } catch {
      // ignore
    }
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

/** Save the allow-listed queries now. */
async function save(queryClient: QueryClient): Promise<void> {
  const file = cacheFile();
  if (!file) return;
  const state = dehydrate(queryClient, { shouldDehydrateQuery: shouldPersist });
  const payload: CacheFile = { savedAt: Date.now(), state };
  try {
    await file.write(JSON.stringify(payload));
  } catch {
    // Disk full or no access: the app still works online
  }
}

/**
 * Keep the cache file up to date after successful fetches.
 * @param queryClient - The app's query client
 * @returns Unsubscribe
 */
export function startPersistingQueries(queryClient: QueryClient): () => void {
  return queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' || event.action.type !== 'success') return;
    if (!PERSISTED_ROOTS.has(String(event.query.queryKey[0]))) return;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveTimer = null;
      save(queryClient).catch(() => {});
    }, SAVE_DEBOUNCE_MS);
  });
}

/** Delete the saved data (sign-out, account deletion). */
export function clearPersistedQueries(): void {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }
  const file = cacheFile();
  try {
    if (file?.exists) file.delete();
  } catch {
    // ignore
  }
}
