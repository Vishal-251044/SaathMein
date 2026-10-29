/**
 * /admin/products/import — bulk CSV import with a failed-row report (CAT-3).
 */
import ProductImport from '@/components/features/admin/products/ProductImport';

export const metadata = { title: 'Import products' };

/**
 * @returns {JSX.Element}
 */
export default function ImportProductsPage() {
  return <ProductImport />;
}
