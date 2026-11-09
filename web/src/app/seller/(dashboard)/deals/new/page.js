/**
 * /seller/deals/new — publish a tiered group deal (AUC-9).
 */
import DealForm from '@/components/features/seller/deals/DealForm';

export const metadata = { title: 'New group deal' };

/** @returns {JSX.Element} */
export default function SellerNewDealPage() {
  return <DealForm />;
}
