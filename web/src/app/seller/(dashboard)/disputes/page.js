/**
 * /seller/disputes — buyers' disputes to answer within 48 h (TRU-4).
 */
import { SellerDisputesList } from '@/components/features/seller/disputes/SellerDisputesPage';

export const metadata = { title: 'Disputes' };

/** @returns {JSX.Element} */
export default function SellerDisputesPage() {
  return <SellerDisputesList />;
}
