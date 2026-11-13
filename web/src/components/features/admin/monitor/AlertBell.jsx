'use client';

/**
 * AlertBell — top-bar bell with the open-alert count (MON-4). It also connects the staff
 * socket for the whole console and shows a short toast when a warning or critical alert
 * arrives, linking to the alert's subject.
 */
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Bell, X } from 'lucide-react';
import { useAlerts, useStaffLive } from '@/hooks/useAdminMonitor';
import { DURATION, EASE } from '@/utils/animations';

const TOAST_MS = 8000;

/** @returns {JSX.Element} */
export default function AlertBell() {
  const reduceMotion = useReducedMotion();
  const [toast, setToast] = useState(null);
  const onAlert = useCallback((alert) => {
    if (['warning', 'critical'].includes(alert?.severity)) setToast(alert);
  }, []);
  useStaffLive({ onAlert });
  const { data } = useAlerts({ status: 'open', limit: 1 });
  const count = data?.openCount || 0;

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  return (
    <>
      <Link
        href="/admin/alerts"
        aria-label={count ? `Alerts, ${count} open` : 'Alerts'}
        className="relative grid size-11 place-items-center rounded-button text-ink hover:bg-bg-band"
      >
        <Bell className="size-5" strokeWidth={2} aria-hidden="true" />
        {count ? (
          <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-danger px-1 text-[11px] font-bold leading-5 text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </Link>

      <AnimatePresence>
        {toast ? (
          <motion.div
            role="status"
            className="fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-32px))] items-start gap-3 rounded-card border border-danger/30 bg-surface p-4 shadow-pop"
            initial={reduceMotion ? { opacity: 0 } : { y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: DURATION.base, ease: EASE.out }}
          >
            <Bell
              className="mt-0.5 size-5 shrink-0 text-danger"
              strokeWidth={2}
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-ink">{toast.title}</p>
              {toast.message ? (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">{toast.message}</p>
              ) : null}
              <Link
                href={toast.link}
                onClick={() => setToast(null)}
                className="mt-1 inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline"
              >
                Open
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setToast(null)}
              aria-label="Dismiss alert"
              className="-m-2 grid size-11 place-items-center rounded-button text-muted hover:bg-bg-band"
            >
              <X className="size-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
