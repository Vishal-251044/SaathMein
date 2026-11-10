/**
 * /seller/purchases — scan or type deal codes and confirm sales (PUR-2, PUR-3).
 */
import PurchasesPage from '@/components/features/seller/purchases/PurchasesPage';

export const metadata = { title: 'Purchases' };

/** @returns {JSX.Element} */
export default function SellerPurchasesPage() {
  return <PurchasesPage />;
}
