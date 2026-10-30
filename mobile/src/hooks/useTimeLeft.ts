/**
 * useTimeLeft — time remaining until a deadline as translated text ("3d 4h left"),
 * refreshed every 30 seconds.
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { getTimeLeft, type TimeLeft } from '@/utils/genericFunctions';

const TICK_MS = 30_000;

/**
 * @param deadline - ISO date (undefined while loading)
 * @returns Parts of the remaining time and a short label
 */
export function useTimeLeft(deadline: string | undefined): TimeLeft & { label: string } {
  const { t } = useTranslation();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(interval);
  }, []);

  const left = getTimeLeft(deadline ?? new Date(0), now);
  let label: string;
  if (left.isOver) label = t('group.timeOver');
  else if (left.days > 0) label = t('group.leftDays', { days: left.days, hours: left.hours });
  else if (left.hours > 0)
    label = t('group.leftHours', { hours: left.hours, minutes: left.minutes });
  else label = t('group.leftMinutes', { minutes: Math.max(1, left.minutes) });
  return { ...left, label };
}
