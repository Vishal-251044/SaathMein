/**
 * /seller/deals — the dealer's seller-led group deals (AUC-9).
 */
import DealsList from '@/components/features/seller/deals/DealsList';

export const metadata = { title: 'Group deals' };

/** @returns {JSX.Element} */
export default function SellerDealsPage() {
  return <DealsList />;
}
