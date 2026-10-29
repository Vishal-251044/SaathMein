/**
 * /admin/products/new — create a product.
 */
import ProductEditor from '@/components/features/admin/products/ProductEditor';

export const metadata = { title: 'New product' };

/**
 * @returns {JSX.Element}
 */
export default function NewProductPage() {
  return <ProductEditor productId={null} />;
}
