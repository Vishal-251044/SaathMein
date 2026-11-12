/**
 * SiteFooter — footer for public pages.
 * Links the legal pages (terms, privacy, refund policy, grievance officer) as e-commerce
 * rules require.
 */
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import { LEGAL_PAGES } from '@/utils/legal';
import { APP_TAGLINE } from '@/utils/constants';

/**
 * @returns {JSX.Element}
 */
export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-bg-band pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo size={28} />
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {LEGAL_PAGES.map((page) => (
            <Link key={page.href} href={page.href} className="text-muted hover:text-ink">
              {page.label}
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted">{APP_TAGLINE} · Made in Pune · © SaathMein</p>
      </div>
    </footer>
  );
}
