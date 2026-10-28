/**
 * 404 page for unknown routes.
 */
import { SearchX } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/utils/constants';

/**
 * @returns {JSX.Element}
 */
export default function NotFound() {
  return (
    <main className="grid flex-1 place-items-center px-4 py-20 text-center">
      <div className="flex max-w-sm flex-col items-center">
        <span className="grid size-14 place-items-center rounded-card bg-bg-band text-muted">
          <SearchX className="size-7" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <h1 className="mt-5 text-2xl font-extrabold text-ink">Page not found</h1>
        <p className="mt-2 text-muted">This page does not exist or has moved.</p>
        <Button href={ROUTES.HOME} className="mt-6">
          Back to home
        </Button>
      </div>
    </main>
  );
}
