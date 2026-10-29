'use client';

/**
 * SellersList — Admin → Sellers: KYC review queue (oldest first) and every dealer, with
 * search by business name, GSTIN or email.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  ChevronRight as Open,
  RefreshCw,
  Search,
  Store,
} from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { useAdminSellers } from '@/hooks/useAdminSellers';
import { KYC_STATUS_META, PAYOUT_STATUS_LABELS } from '@/utils/constants';
import { cn } from '@/utils/genericFunctions';

const TABS = [
  { value: 'pending', label: 'Waiting for review' },
  { value: 'rejected', label: 'Sent back' },
  { value: 'approved', label: 'Verified' },
  { value: 'not_submitted', label: 'Not submitted' },
  { value: '', label: 'All' },
];
const PAGE_SIZE = 25;

/**
 * @returns {JSX.Element}
 */
export default function SellersList() {
  const [kycStatus, setKycStatus] = useState('pending');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebouncedValue(search.trim(), 300);
  const filters = { kycStatus: kycStatus || undefined, q: q || undefined, page, limit: PAGE_SIZE };
  const { data, isPending, isError, error, refetch, isFetching } = useAdminSellers(filters);
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Sellers</h1>
        <p className="mt-1 text-muted">
          Review dealer KYC. Only verified dealers can join auctions.
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:px-0">
          <div
            role="tablist"
            aria-label="KYC status"
            className="flex w-max gap-1 rounded-button bg-surface p-1 shadow-card"
          >
            {TABS.map((tab) => (
              <button
                key={tab.label}
                type="button"
                role="tab"
                aria-selected={kycStatus === tab.value}
                onClick={() => {
                  setKycStatus(tab.value);
                  setPage(1);
                }}
                className={cn(
                  'min-h-11 whitespace-nowrap rounded-button px-4 text-sm font-semibold transition-colors duration-150',
                  kycStatus === tab.value
                    ? 'bg-primary/10 text-primary'
                    : 'text-ink hover:bg-bg-band',
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
        <label className="relative lg:ml-auto lg:w-72">
          <span className="sr-only">Search sellers</span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
            strokeWidth={2}
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            placeholder="Business, GSTIN or email"
            className="min-h-11 w-full rounded-button border border-line bg-surface pl-9 pr-3 text-ink focus:border-primary focus:outline-none"
          />
        </label>
      </div>

      {isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{error.message}</Alert>
          <Button variant="secondary" onClick={() => refetch()}>
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : isPending ? (
        <div className="flex flex-col gap-3" aria-busy="true">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-20 animate-pulse rounded-card bg-surface" />
          ))}
        </div>
      ) : data.sellers.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center">
          <Store className="size-8 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-3 font-semibold text-ink">
            {kycStatus === 'pending' ? 'No KYC waiting for review' : 'No sellers here'}
          </p>
          <p className="mt-1 text-sm text-muted">
            New dealer submissions appear here, oldest first.
          </p>
        </div>
      ) : (
        <ul className={cn('flex flex-col gap-3 transition-opacity', isFetching && 'opacity-70')}>
          {data.sellers.map((seller) => {
            const kyc = KYC_STATUS_META[seller.kyc.status] || KYC_STATUS_META.not_submitted;
            return (
              <li key={seller.id}>
                <Link
                  href={`/admin/sellers/${seller.id}`}
                  className="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card transition-transform duration-150 hover:-translate-y-0.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-bold text-ink">{seller.businessName}</p>
                      <Badge tone={kyc.tone}>{kyc.label}</Badge>
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">
                      {[seller.gstin, seller.contactEmail].filter(Boolean).join(' · ') ||
                        'No details yet'}
                    </p>
                    <p className="mt-0.5 text-xs text-muted">
                      Payouts:{' '}
                      {PAYOUT_STATUS_LABELS[seller.razorpay.status] || seller.razorpay.status}
                      {seller.kyc.submittedAt
                        ? ` · submitted ${new Date(seller.kyc.submittedAt).toLocaleDateString('en-IN')}`
                        : ''}
                    </p>
                  </div>
                  <Open className="size-5 shrink-0 text-muted" strokeWidth={2} aria-hidden="true" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Page {meta.page} of {meta.totalPages} · {meta.total} sellers
          </p>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => setPage(page - 1)}
              disabled={page <= 1}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
            </Button>
            <Button
              variant="secondary"
              onClick={() => setPage(page + 1)}
              disabled={page >= meta.totalPages}
              aria-label="Next page"
            >
              <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
