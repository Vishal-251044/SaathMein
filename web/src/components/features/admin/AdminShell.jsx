'use client';

/**
 * AdminShell — console layout: fixed sidebar on desktop, slide-in drawer on phones,
 * and a top bar with the alert bell (live staff socket), the staff member, role and sign out.
 */
import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LogOut, Menu, X } from 'lucide-react';
import AdminSidebar from '@/components/features/admin/AdminSidebar';
import AlertBell from '@/components/features/admin/monitor/AlertBell';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { DURATION, EASE } from '@/utils/animations';
import { STAFF_ROLE_LABELS } from '@/utils/constants';

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Console page
 * @returns {JSX.Element}
 */
export default function AdminShell({ children }) {
  const { staff, logout } = useAdminAuth();
  const reduceMotion = useReducedMotion();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const roleLabel = STAFF_ROLE_LABELS[staff.role] || staff.role;

  return (
    <div className="min-h-dvh bg-bg-band lg:grid lg:grid-cols-[260px_minmax(0,1fr)] print:block! print:bg-white">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-dvh print:hidden border-r border-line bg-surface lg:block">
        <AdminSidebar role={staff.role} />
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {isDrawerOpen ? (
          <div
            className="fixed inset-0 z-50 lg:hidden"
            role="dialog"
            aria-modal="true"
            aria-label="Menu"
          >
            <motion.button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-ink/40"
              onClick={() => setIsDrawerOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: DURATION.fast }}
            />
            <motion.aside
              className="absolute inset-y-0 left-0 w-[min(300px,85vw)] bg-surface shadow-card"
              initial={reduceMotion ? false : { x: '-100%' }}
              animate={{ x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { x: '-100%' }}
              transition={{ duration: DURATION.base, ease: EASE.out }}
            >
              <button
                type="button"
                onClick={() => setIsDrawerOpen(false)}
                aria-label="Close menu"
                className="absolute right-2 top-3 grid size-11 place-items-center rounded-button text-muted hover:bg-bg-band"
              >
                <X className="size-5" strokeWidth={2} aria-hidden="true" />
              </button>
              <AdminSidebar role={staff.role} onNavigate={() => setIsDrawerOpen(false)} />
            </motion.aside>
          </div>
        ) : null}
      </AnimatePresence>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 print:hidden items-center gap-3 border-b border-line bg-surface/90 px-4 backdrop-blur-md sm:px-6">
          <button
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open menu"
            className="grid size-11 place-items-center rounded-button text-ink hover:bg-bg-band lg:hidden"
          >
            <Menu className="size-5" strokeWidth={2} aria-hidden="true" />
          </button>

          <div className="ml-auto flex min-w-0 items-center gap-3">
            <AlertBell />
            <div className="min-w-0 text-right leading-tight">
              <p className="truncate text-sm font-bold text-ink">{staff.name || staff.email}</p>
              <p className="text-xs font-semibold text-muted">{roleLabel}</p>
            </div>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex min-h-11 items-center gap-2 rounded-button border border-line px-3 text-sm font-semibold text-ink hover:bg-bg-band"
            >
              <LogOut className="size-4" strokeWidth={2} aria-hidden="true" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
