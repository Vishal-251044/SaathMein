'use client';

/**
 * ProductsList — Admin → Products: search, filter by category and status (including
 * "Needs price review"), paginated list, and links to create, edit and import.
 */
import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, FileUp, Package, Plus, RefreshCw, Search } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import FadeIn from '@/components/animations/FadeIn';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { useAdminCategories, useAdminProducts } from '@/hooks/useAdminCatalog';
import { useAdminCities } from '@/hooks/useAdminCities';
import { cn, formatINR } from '@/utils/genericFunctions';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All products' },
  { value: 'review', label: 'Needs price review' },
  { value: 'active', label: 'Live' },
  { value: 'inactive', label: 'Hidden' },
];
const PAGE_SIZE = 25;

/**
 * Lowest price of a product in a city (any variant), for the list.
 * @param {Object} product - Admin product
 * @param {string|undefined} cityId - City id
 * @returns {number|null} Paise
 */
const lowestCityPrice = (product, cityId) => {
  const values = product.prices
    .filter((price) => price.cityId === cityId)
    .map((price) => price.onRoadPaise ?? price.exShowroomPaise ?? price.mrpPaise)
    .filter((value) => value != null);
  return values.length ? Math.min(...values) : null;
};

/** Small status pill. */
function StatusBadge({ product }) {
  if (product.needsPriceReview) {
    return (
      <span className="rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-ink">
        Needs review
      </span>
    );
  }
  return product.active ? (
    <span className="rounded-full bg-savings-soft px-2 py-0.5 text-xs font-semibold text-savings-text">
      Live
    </span>
  ) : (
    <span className="rounded-full bg-bg-band px-2 py-0.5 text-xs font-semibold text-muted">
      Hidden
    </span>
  );
}

/**
 * @returns {JSX.Element}
 */
export default function ProductsList() {
  const [search, setSearch] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), 300);

  const filters = {
    q: q || undefined,
    categoryId: categoryId || undefined,
    status,
    page,
    limit: PAGE_SIZE,
  };
  const { data, isPending, isError, error, refetch, isFetching } = useAdminProducts(filters);
  const { data: categories } = useAdminCategories();
  const { data: cities } = useAdminCities();

  const leafCategories = useMemo(() => {
    const list = categories || [];
    const parentIds = new Set(list.map((category) => category.parentId).filter(Boolean));
    return list.filter((category) => !parentIds.has(category.id));
  }, [categories]);
  const categoryNames = new Map((categories || []).map((category) => [category.id, category.name]));
  const firstCity = cities?.[0];

  const resetPage = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-6">
      <FadeIn className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-ink">
            Products
          </h1>
          <p className="mt-1 text-muted">
            Products, variants and city prices. Imported products stay hidden until their prices are
            checked.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" href="/admin/products/import">
            <FileUp className="size-4" strokeWidth={2} aria-hidden="true" />
            Import CSV
          </Button>
          <Button href="/admin/products/new">
            <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
            New product
          </Button>
        </div>
      </FadeIn>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_220px_200px]">
        <label className="relative">
          <span className="sr-only">Search products</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            aria-hidden="true"
          />
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Search brand or model"
            className="min-h-11 w-full rounded-button border border-line bg-surface pl-9 pr-3 text-sm text-ink focus:border-primary focus:outline-none"
          />
        </label>
        <select
          aria-label="Category"
          value={categoryId}
          onChange={resetPage(setCategoryId)}
          className="min-h-11 rounded-button border border-line bg-surface px-3 text-sm text-ink"
        >
          <option value="">All categories</option>
          {leafCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Status"
          value={status}
          onChange={resetPage(setStatus)}
          className="min-h-11 rounded-button border border-line bg-surface px-3 text-sm text-ink"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isError ? (
        <div className="flex flex-col gap-3">
          <Alert>{error.message}</Alert>
          <Button variant="secondary" onClick={() => refetch()} className="self-start">
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : null}

      {isPending ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              className="h-16 animate-pulse rounded-button border border-line bg-surface"
            />
          ))}
        </div>
      ) : null}

      {data && data.products.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-line bg-surface px-6 py-12 text-center">
          <Package className="size-8 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-4 font-bold text-ink">No products found</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Try another search, or import the starter catalog from Import CSV.
          </p>
        </div>
      ) : null}

      {data?.products.length ? (
        <ul
          className={cn(
            'divide-y divide-line overflow-hidden rounded-card border border-line bg-surface',
            isFetching && 'opacity-70',
          )}
        >
          {data.products.map((product) => {
            const price = lowestCityPrice(product, firstCity?.id);
            return (
              <li key={product.id}>
                <Link
                  href={`/admin/products/${product.id}`}
                  className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-bg-band"
                >
                  <div className="min-w-0 flex-1 basis-56">
                    <p className="truncate font-semibold text-ink">
                      {product.brand} {product.model}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {categoryNames.get(product.categoryId) || 'Unknown category'}
                      {product.variants.length ? ` · ${product.variants.length} variants` : ''}
                    </p>
                  </div>
                  <p className="basis-28 text-sm font-semibold text-ink">
                    {price != null
                      ? `${formatINR(price)}${firstCity ? ` · ${firstCity.name}` : ''}`
                      : 'No price'}
                  </p>
                  <StatusBadge product={product} />
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}

      {data?.meta && data.meta.totalPages > 1 ? (
        <nav aria-label="Pages" className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Page {data.meta.page} of {data.meta.totalPages} · {data.meta.total} products
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage((p) => p + 1)}
              disabled={!data.meta.hasNextPage}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      ) : null}
    </div>
  );
}
