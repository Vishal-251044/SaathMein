/**
 * LegalLayout — shared frame for the legal pages: header, title, "draft" notice until a
 * lawyer has reviewed the text, readable prose, links between the pages, footer.
 */
import Link from 'next/link';
import { TriangleAlert } from 'lucide-react';
import SiteHeader from '@/components/layout/SiteHeader';
import SiteFooter from '@/components/layout/SiteFooter';
import { LEGAL, LEGAL_PAGES } from '@/utils/legal';

/**
 * @param {{ title: string, path: string, children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
export default function LegalLayout({ title, path, children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-10 sm:px-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-ink">{title}</h1>
        <p className="mt-1 text-sm text-muted">Last updated {LEGAL.lastUpdated}</p>
        {LEGAL.isDraft ? (
          <p className="mt-4 flex items-start gap-2 rounded-button border border-warning/30 bg-warning/10 p-3 text-sm text-ink">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Draft — pending legal review. This text explains how SaathMein works today and may
            change before launch.
          </p>
        ) : null}
        <article className="legal-prose mt-8 flex flex-col gap-4 text-base leading-relaxed text-ink [&_h2]:mt-6 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
          {children}
        </article>
        <nav
          aria-label="Legal pages"
          className="mt-12 flex flex-wrap gap-x-5 gap-y-2 border-t border-line pt-6 text-sm"
        >
          {LEGAL_PAGES.map((page) => (
            <Link
              key={page.href}
              href={page.href}
              aria-current={page.href === path ? 'page' : undefined}
              className={
                page.href === path ? 'font-semibold text-ink' : 'text-muted hover:text-ink'
              }
            >
              {page.label}
            </Link>
          ))}
        </nav>
      </main>
      <SiteFooter />
    </div>
  );
}
