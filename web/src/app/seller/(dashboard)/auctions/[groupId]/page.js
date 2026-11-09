/**
 * /seller/auctions/[groupId] — the live bid screen, result and deal codes (AUC-2 to AUC-8).
 */
import { Suspense } from 'react';
import { AuctionRoomRoute } from '@/components/features/seller/auctions/AuctionRoutes';

export const metadata = { title: 'Auction' };

/** @returns {JSX.Element} */
export default function SellerAuctionPage() {
  return (
    <Suspense
      fallback={<div className="h-96 animate-pulse rounded-card bg-bg-band" aria-busy="true" />}
    >
      <AuctionRoomRoute />
    </Suspense>
  );
}
