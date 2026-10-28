/**
 * SiteFooter — footer for public pages.
 * Legal pages (terms, privacy, refund policy, grievance officer) are linked here on Day 12.
 */
import Logo from '@/components/ui/Logo';
import { APP_TAGLINE } from '@/utils/constants';

/**
 * @returns {JSX.Element}
 */
export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-bg-band pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <Logo size={28} />
        <p className="text-sm text-muted">{APP_TAGLINE} · Made in Pune · © SaathMein</p>
      </div>
    </footer>
  );
}
