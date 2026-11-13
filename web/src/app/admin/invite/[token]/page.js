'use client';

/**
 * /admin/invite/[token] — accept a staff invitation (ADL-1). Public: the token is the
 * credential; 2-step verification is set up at the first sign-in.
 */
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import StaffInviteAccept from '@/components/features/admin/StaffInviteAccept';

/** Reads the token (client-only URL data, so it renders inside Suspense). */
function InviteRoute() {
  const { token } = useParams();
  return <StaffInviteAccept token={String(token)} />;
}

/**
 * @returns {JSX.Element}
 */
export default function StaffInvitePage() {
  return (
    <Suspense fallback={<main className="min-h-dvh bg-bg-band" aria-busy="true" />}>
      <InviteRoute />
    </Suspense>
  );
}
