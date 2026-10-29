'use client';

/**
 * useDebouncedValue — the value, updated only after it stops changing for `delayMs`.
 * Used for search boxes so the API is not called on every key press.
 */
import { useEffect, useState } from 'react';

/**
 * @param {*} value - Fast-changing value
 * @param {number} [delayMs=300] - Quiet time before updating
 * @returns {*} Debounced value
 */
export default function useDebouncedValue(value, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
