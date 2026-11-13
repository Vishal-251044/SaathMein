'use client';

/**
 * /admin/monitor/auctions/[groupId] — one auction with dealer names, the full bid timeline
 * and staff actions (PRD §10.11). The id is read on the client.
 */
import { Suspense } from 'react';
import { useParams } from 'next/navigation';
import AuctionDetail from '@/components/features/admin/monitor/AuctionDetail';

/** Reads the group id (client-only URL data, so it renders inside Suspense). */
function AuctionRoute() {
  const { groupId } = useParams();
  return <AuctionDetail groupId={String(groupId)} />;
}

/**
 * @returns {JSX.Element}
 */
export default function AdminAuctionDetailPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-card bg-bg-band" aria-busy="true" />}
    >
      <AuctionRoute />
    </Suspense>
  );
}
