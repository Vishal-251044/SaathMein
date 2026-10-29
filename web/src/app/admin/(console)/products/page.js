/**
 * /admin/products — product list with search and filters (CAT-2). Owner, Admin, Deal Manager.
 */
import ProductsList from '@/components/features/admin/products/ProductsList';

export const metadata = { title: 'Products' };

/**
 * @returns {JSX.Element}
 */
export default function AdminProductsPage() {
  return <ProductsList />;
}
