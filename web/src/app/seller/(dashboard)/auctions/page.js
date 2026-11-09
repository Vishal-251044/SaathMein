/**
 * /seller/auctions — live auctions and upcoming groups in the dealer's coverage (AUC-1).
 */
import { Suspense } from 'react';
import { AuctionListRoute } from '@/components/features/seller/auctions/AuctionRoutes';

export const metadata = { title: 'Live auctions' };

/** @returns {JSX.Element} */
export default function SellerAuctionsPage() {
  return (
    <Suspense
      fallback={<div className="h-64 animate-pulse rounded-card bg-bg-band" aria-busy="true" />}
    >
      <AuctionListRoute />
    </Suspense>
  );
}
