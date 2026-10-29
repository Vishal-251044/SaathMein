'use client';

/**
 * ProductEditor — loads what the product form needs (product, categories, cities) with
 * loading and error states, then renders ProductForm.
 */
import { RefreshCw } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import ProductForm from '@/components/features/admin/products/ProductForm';
import { useAdminCategories, useAdminProduct } from '@/hooks/useAdminCatalog';
import { useAdminCities } from '@/hooks/useAdminCities';

/**
 * @param {Object} props
 * @param {string|null} props.productId - Product to edit, or null for a new product
 * @returns {JSX.Element}
 */
export default function ProductEditor({ productId }) {
  const productQuery = useAdminProduct(productId);
  const categoriesQuery = useAdminCategories();
  const citiesQuery = useAdminCities();
  const queries = [categoriesQuery, citiesQuery, ...(productId ? [productQuery] : [])];

  const failed = queries.find((query) => query.isError);
  const isLoading = queries.some((query) => query.isPending);
  const product = productId ? productQuery.data : null;
  const title = product ? `${product.brand} ${product.model}` : 'New product';

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-ink">
        {isLoading && productId ? 'Product' : title}
      </h1>

      {failed ? (
        <div className="flex flex-col gap-3">
          <Alert>{failed.error.message}</Alert>
          <Button
            variant="secondary"
            onClick={() => queries.forEach((query) => query.refetch())}
            className="self-start"
          >
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : null}

      {isLoading && !failed ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-64 animate-pulse rounded-card border border-line bg-surface" />
          <div className="h-48 animate-pulse rounded-card border border-line bg-surface" />
        </div>
      ) : null}

      {!isLoading && !failed ? (
        <ProductForm
          key={product?.updatedAt || 'new'}
          product={product}
          categories={categoriesQuery.data}
          cities={citiesQuery.data}
        />
      ) : null}
    </div>
  );
}
