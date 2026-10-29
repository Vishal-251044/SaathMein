'use client';

/**
 * /admin/products/[productId] — edit a product. The id is read on the client (the console
 * is client-rendered behind the staff session), so no server-side data fetching happens here.
 */
import { useParams } from 'next/navigation';
import ProductEditor from '@/components/features/admin/products/ProductEditor';

/**
 * @returns {JSX.Element}
 */
export default function EditProductPage() {
  const { productId } = useParams();
  return <ProductEditor productId={productId} />;
}
