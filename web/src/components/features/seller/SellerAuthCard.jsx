/**
 * SellerAuthCard — centred card layout for dealer login, sign-up and invite pages.
 */
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { LogoMark } from '@/components/ui/Logo';
import { ROUTES } from '@/utils/constants';

/**
 * @param {Object} props
 * @param {string} props.title - Heading
 * @param {string} [props.subtitle] - Line under the heading
 * @param {React.ReactNode} props.children - Form
 * @param {React.ReactNode} [props.footer] - Links under the card
 * @returns {JSX.Element}
 */
export default function SellerAuthCard({ title, subtitle, children, footer }) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-bg-band px-4 py-10">
      <div className="w-full max-w-md animate-rise">
        <div className="mb-6 flex flex-col items-center text-center">
          <Link href={ROUTES.HOME} aria-label="SaathMein home" className="rounded-button">
            <LogoMark size={48} />
          </Link>
          <p className="mt-3 text-xs font-bold uppercase tracking-wider text-primary-text">
            SaathMein for dealers
          </p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-muted">{subtitle}</p> : null}
        </div>

        <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-7">
          {children}
        </div>

        {footer ? <div className="mt-5 text-center text-sm text-muted">{footer}</div> : null}

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted">
          <ShieldCheck className="size-4" strokeWidth={2} aria-hidden="true" />
          Only KYC-verified dealers can bid on SaathMein groups.
        </p>
      </div>
    </main>
  );
}
