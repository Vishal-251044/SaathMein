/**
 * useSecondsLeft — seconds until a time, ticking every second (live auction timer).
 * Stops ticking once the time has passed.
 */
import { useEffect, useState } from 'react';

/**
 * @param endsAt - ISO time (null/undefined = no timer)
 * @returns Seconds left (0 when passed), or null without a time
 */
export function useSecondsLeft(endsAt: string | null | undefined): number | null {
  const [now, setNow] = useState(() => Date.now());
  const end = endsAt ? new Date(endsAt).getTime() : null;

  useEffect(() => {
    if (end == null) return undefined;
    const interval = setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= end) clearInterval(interval);
    }, 1000);
    return () => clearInterval(interval);
  }, [end]);

  if (end == null) return null;
  return Math.max(0, Math.floor((end - now) / 1000));
}

/**
 * Timer text: "2d 4h" over a day, "3:05:09" over an hour, else "04:59".
 * @param seconds - Seconds left
 * @returns Text with Latin digits (shown in the mono font)
 */
export function formatTimer(seconds: number): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${pad(minutes)}:${pad(secs)}`;
}
