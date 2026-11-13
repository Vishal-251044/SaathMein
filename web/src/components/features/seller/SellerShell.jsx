'use client';

/**
 * SellerShell — dealer dashboard layout: sidebar on desktop, slide-in drawer on phones,
 * top bar with the business name, verification status and log out.
 */
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LogOut, Menu, X } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { LogoMark } from '@/components/ui/Logo';
import { sellerNavItemsForRole } from '@/components/features/seller/sellerNav';
import { useSellerAuth } from '@/context/SellerAuthContext';
import { DURATION, EASE } from '@/utils/animations';
import { KYC_STATUS_META } from '@/utils/constants';
import { cn } from '@/utils/genericFunctions';

/**
 * Sidebar links.
 * @param {{ role: string, onNavigate?: () => void }} props
 * @returns {JSX.Element}
 */
function SellerSidebar({ role, onNavigate }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dealer dashboard" className="flex h-full flex-col gap-6 px-3 py-5">
      <div className="flex items-center gap-2 px-2">
        <LogoMark size={32} />
        <div className="leading-tight">
          <p className="text-base font-extrabold tracking-tight text-ink">saathmein</p>
          <p className="text-xs font-semibold text-muted">Dealer dashboard</p>
        </div>
      </div>
      <ul className="flex flex-col gap-1">
        {sellerNavItemsForRole(role).map(({ label, href, icon: Icon, availableOn }) => {
          const isActive =
            href && (pathname === href || (href !== '/seller' && pathname.startsWith(`${href}/`)));
          const classes = cn(
            'flex min-h-11 items-center gap-3 rounded-button px-3 text-sm font-semibold transition-colors duration-150',
            isActive ? 'bg-primary/10 text-primary-text' : 'text-ink',
            href ? 'hover:bg-bg-band' : 'cursor-not-allowed opacity-55',
          );
          const content = (
            <>
              <Icon className="size-5 shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className="flex-1 truncate">{label}</span>
              {availableOn ? (
                <span className="rounded-full bg-bg-band px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {availableOn}
                </span>
              ) : null}
            </>
          );
          return (
            <li key={label}>
              {href ? (
                <Link
                  href={href}
                  onClick={onNavigate}
                  className={classes}
                  aria-current={isActive ? 'page' : undefined}
                >
                  {content}
                </Link>
              ) : (
                <span className={classes} aria-disabled="true">
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * @param {Object} props
 * @param {Object} props.seller - Dealer (self view)
 * @param {React.ReactNode} props.children - Page
 * @returns {JSX.Element}
 */
export default function SellerShell({ seller, children }) {
  const { user, logout } = useSellerAuth();
  const reduceMotion = useReducedMotion();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const kyc = KYC_STATUS_META[seller.kyc.status] || KYC_STATUS_META.not_submitted;

  return (
    <div className="min-h-dvh bg-bg-band lg:grid lg:grid-cols-[260px_minmax(0,1fr)] print:block! print:bg-white">
      <aside className="sticky top-0 hidden h-dvh print:hidden border-r border-line bg-surface lg:block">
        <SellerSidebar role={seller.role} />
      </aside>

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
              <SellerSidebar role={seller.role} onNavigate={() => setIsDrawerOpen(false)} />
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
          <div className="min-w-0 leading-tight">
            <p className="truncate text-sm font-bold text-ink">{seller.businessName}</p>
            <Badge tone={kyc.tone} className="mt-0.5">
              {kyc.label}
            </Badge>
          </div>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <p className="hidden truncate text-sm font-semibold text-muted md:block">
              {user?.name || user?.email}
            </p>
            <button
              type="button"
              onClick={() => logout()}
              className="inline-flex min-h-11 items-center gap-2 rounded-button border border-line px-3 text-sm font-semibold text-ink hover:bg-bg-band"
            >
              <LogOut className="size-4" strokeWidth={2} aria-hidden="true" />
              <span className="hidden sm:inline">Log out</span>
            </button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
