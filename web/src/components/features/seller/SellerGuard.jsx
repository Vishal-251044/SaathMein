'use client';

/**
 * SellerGuard — shows dashboard pages only to signed-in dealer team members; everyone
 * else goes to /seller/login. UI only: the API checks every request itself.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import SellerShell from '@/components/features/seller/SellerShell';
import { useSellerAuth } from '@/context/SellerAuthContext';
import { useSellerMe } from '@/hooks/useSeller';
import { ROUTES } from '@/utils/constants';

/** Full-page skeleton while the session and dealer load. */
function DashboardSkeleton() {
  return (
    <div className="min-h-dvh bg-bg-band p-6" aria-busy="true">
      <div className="mx-auto max-w-5xl">
        <div className="h-8 w-48 animate-pulse rounded-button bg-surface" />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="h-36 animate-pulse rounded-card bg-surface" />
          <div className="h-36 animate-pulse rounded-card bg-surface" />
        </div>
      </div>
      <span className="sr-only">Loading your dashboard</span>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Dashboard page
 * @returns {JSX.Element}
 */
export default function SellerGuard({ children }) {
  const router = useRouter();
  const { status, logout } = useSellerAuth();
  const me = useSellerMe({ enabled: status === 'signedIn' });

  useEffect(() => {
    if (status === 'signedOut') router.replace(ROUTES.SELLER_LOGIN);
  }, [status, router]);

  if (status !== 'signedIn' || me.isPending) return <DashboardSkeleton />;

  if (me.isError) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-bg-band px-4">
        <div className="flex w-full max-w-md flex-col gap-4">
          <Alert>{me.error.message}</Alert>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => me.refetch()}>
              <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
              Try again
            </Button>
            <Button variant="ghost" onClick={() => logout()}>
              Log out
            </Button>
          </div>
        </div>
      </main>
    );
  }

  return <SellerShell seller={me.data}>{children}</SellerShell>;
}
