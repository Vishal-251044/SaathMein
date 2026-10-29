/**
 * /admin/sellers — KYC review queue and dealer list (TRU-1). Owner, Admin, Deal Manager.
 */
import SellersList from '@/components/features/admin/sellers/SellersList';

export const metadata = { title: 'Sellers' };

/**
 * @returns {JSX.Element}
 */
export default function AdminSellersPage() {
  return <SellersList />;
}
