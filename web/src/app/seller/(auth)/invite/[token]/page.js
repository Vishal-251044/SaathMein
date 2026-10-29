/**
 * /seller/invite/[token] — accept an invitation to a dealer team (F31).
 * The token is read on the client, so the form streams in inside Suspense.
 */
import { Suspense } from 'react';
import AcceptInviteForm from '@/components/features/seller/AcceptInviteForm';

export const metadata = { title: 'Join your team' };

/** @returns {JSX.Element} */
export default function AcceptInvitePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-bg-band" aria-busy="true" />}>
      <AcceptInviteForm />
    </Suspense>
  );
}
