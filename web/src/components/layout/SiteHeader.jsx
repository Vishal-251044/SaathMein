/**
 * SiteHeader — sticky top bar for public pages with the logo and section links.
 * The admin console is intentionally never linked from here (ADL-1).
 */
import Link from 'next/link';
import Logo from '@/components/ui/Logo';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/utils/constants';

/**
 * @returns {JSX.Element}
 */
export default function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-bg/80 pt-[env(safe-area-inset-top)] backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href={ROUTES.HOME} aria-label="SaathMein home" className="rounded-button">
          <Logo size={32} />
        </Link>

        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Button href="#how-it-works" variant="ghost" className="hidden sm:inline-flex">
            How it works
          </Button>
          <Button href="#dealers" variant="secondary">
            For dealers
          </Button>
        </nav>
      </div>
    </header>
  );
}
