/**
 * /seller/won — groups this dealer won (members, deal codes).
 */
import AuctionList from '@/components/features/seller/auctions/AuctionList';

export const metadata = { title: 'Won groups' };

/** @returns {JSX.Element} */
export default function SellerWonPage() {
  return <AuctionList tab="won" />;
}
