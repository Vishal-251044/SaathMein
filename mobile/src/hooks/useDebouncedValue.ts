/**
 * useDebouncedValue — the value, updated only after it stops changing for `delayMs`
 * (search: 300 ms, per the roadmap), so the API is not called on every key press.
 */
import { useEffect, useState } from 'react';

/**
 * @param value - Fast-changing value
 * @param delayMs - Quiet time before updating (default 300 ms)
 * @returns Debounced value
 */
export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
