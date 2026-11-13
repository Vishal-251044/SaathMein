'use client';

/**
 * AdminSidebar — console navigation. Built modules are links; upcoming ones are shown
 * disabled with the roadmap day they arrive on.
 */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LogoMark } from '@/components/ui/Logo';
import { navItemsForRole } from '@/components/features/admin/adminNav';
import { cn } from '@/utils/genericFunctions';

/**
 * @param {Object} props
 * @param {string} props.role - Staff role (filters the items)
 * @param {() => void} [props.onNavigate] - Called after a link is clicked (closes the mobile drawer)
 * @returns {JSX.Element}
 */
export default function AdminSidebar({ role, onNavigate }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Admin console"
      className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5"
    >
      <div className="flex items-center gap-2 px-2">
        <LogoMark size={32} />
        <div className="leading-tight">
          <p className="text-base font-extrabold tracking-tight text-ink">saathmein</p>
          <p className="text-xs font-semibold text-muted">Admin console</p>
        </div>
      </div>

      <ul className="flex flex-col gap-1">
        {navItemsForRole(role).map(({ label, href, icon: Icon, availableOn }) => {
          // Sub-pages (e.g. /admin/products/123) keep their section highlighted
          const isActive =
            href && (pathname === href || (href !== '/admin' && pathname.startsWith(`${href}/`)));
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
          const classes = cn(
            'flex min-h-11 items-center gap-3 rounded-button px-3 text-sm font-semibold transition-colors duration-150',
            isActive ? 'bg-primary/10 text-primary-text' : 'text-ink',
            href ? 'hover:bg-bg-band' : 'cursor-not-allowed opacity-55',
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
