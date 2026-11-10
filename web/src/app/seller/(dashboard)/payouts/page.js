/**
 * /seller/payouts — held and released transfers, bank settlements, commission invoices.
 */
import PayoutsPage from '@/components/features/seller/payouts/PayoutsPage';

export const metadata = { title: 'Payouts' };

/** @returns {JSX.Element} */
export default function SellerPayoutsPage() {
  return <PayoutsPage />;
}
