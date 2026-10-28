'use client';

/**
 * AdminGuard — shows console pages only to signed-in staff; everyone else is sent to
 * /admin/login. This only controls the UI: the API checks every request itself.
 */
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/context/AdminAuthContext';
import AdminShell from '@/components/features/admin/AdminShell';
import { ROUTES } from '@/utils/constants';

/** Full-page skeleton while the session is being restored. */
function ConsoleSkeleton() {
  return (
    <div
      className="min-h-dvh bg-bg-band lg:grid lg:grid-cols-[260px_minmax(0,1fr)]"
      aria-busy="true"
    >
      <div className="hidden border-r border-line bg-surface p-5 lg:block">
        <div className="h-8 w-36 animate-pulse rounded-button bg-bg-band" />
        <div className="mt-8 flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="h-9 animate-pulse rounded-button bg-bg-band" />
          ))}
        </div>
      </div>
      <div className="p-6">
        <div className="h-8 w-56 animate-pulse rounded-button bg-surface" />
        <div className="mt-6 h-40 animate-pulse rounded-card bg-surface" />
      </div>
      <span className="sr-only">Loading the admin console</span>
    </div>
  );
}

/**
 * @param {Object} props
 * @param {React.ReactNode} props.children - Console page
 * @returns {JSX.Element}
 */
export default function AdminGuard({ children }) {
  const router = useRouter();
  const { status } = useAdminAuth();

  useEffect(() => {
    if (status === 'signedOut') router.replace(ROUTES.ADMIN_LOGIN);
  }, [status, router]);

  if (status !== 'signedIn') return <ConsoleSkeleton />;
  return <AdminShell>{children}</AdminShell>;
}
