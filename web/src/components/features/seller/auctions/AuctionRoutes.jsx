'use client';

/**
 * Client entry points for the auction pages: they read the URL (tab, group id) on the
 * client, so the pages stream inside Suspense.
 */
import { useParams, useSearchParams } from 'next/navigation';
import AuctionList from '@/components/features/seller/auctions/AuctionList';
import AuctionRoom from '@/components/features/seller/auctions/AuctionRoom';

/** /seller/auctions?tab=live|upcoming @returns {JSX.Element} */
export function AuctionListRoute() {
  const tab = useSearchParams().get('tab') === 'upcoming' ? 'upcoming' : 'live';
  return <AuctionList key={tab} tab={tab} />;
}

/** /seller/auctions/[groupId] @returns {JSX.Element} */
export function AuctionRoomRoute() {
  const { groupId } = useParams();
  return <AuctionRoom groupId={String(groupId)} />;
}
