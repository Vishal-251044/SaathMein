/**
 * /admin/product-requests — missing products asked for by buyers and dealers (CAT-5).
 * Owner, Admin, Deal Manager.
 */
import ProductRequestsList from '@/components/features/admin/sellers/ProductRequestsList';

export const metadata = { title: 'Product requests' };

/**
 * @returns {JSX.Element}
 */
export default function AdminProductRequestsPage() {
  return <ProductRequestsList />;
}
