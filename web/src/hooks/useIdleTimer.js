'use client';

/**
 * useIdleTimer — calls `onIdle` after `timeoutMs` without user activity
 * (mouse, keyboard, touch, scroll). Used for the 30-minute admin idle logout (ADL-4).
 */
import { useEffect, useRef } from 'react';

const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'wheel'];

/**
 * @param {Object} options
 * @param {number} options.timeoutMs - Idle time before onIdle fires
 * @param {() => void} options.onIdle - Called once when the user has been idle
 * @param {boolean} [options.enabled=true] - Turn the timer on/off
 */
export default function useIdleTimer({ timeoutMs, onIdle, enabled = true }) {
  // Keep the latest callback without restarting the timer on every render
  const onIdleRef = useRef(onIdle);
  useEffect(() => {
    onIdleRef.current = onIdle;
  }, [onIdle]);

  useEffect(() => {
    if (!enabled) return undefined;

    let timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => onIdleRef.current(), timeoutMs);
    };

    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, reset));
    };
  }, [enabled, timeoutMs]);
}
