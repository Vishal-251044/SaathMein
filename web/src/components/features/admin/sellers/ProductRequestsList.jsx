'use client';

/**
 * ProductRequestsList — Admin → Product requests: models buyers and dealers asked for
 * (CAT-5). Staff add the product in Products, then mark the request as added or rejected.
 */
import { useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Inbox, RefreshCw, X } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useProductRequests, useUpdateProductRequest } from '@/hooks/useAdminSellers';
import { cn } from '@/utils/genericFunctions';

const TABS = [
  { value: 'open', label: 'Open' },
  { value: 'added', label: 'Added' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'all', label: 'All' },
];
const STATUS_TONES = { open: 'warning', added: 'brand', rejected: 'muted' };

/**
 * @returns {JSX.Element}
 */
export default function ProductRequestsList() {
  const [status, setStatus] = useState('open');
  const [page, setPage] = useState(1);
  const { data, isPending, isError, error, refetch } = useProductRequests({
    status,
    page,
    limit: 25,
  });
  const update = useUpdateProductRequest();
  const meta = data?.meta;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Product requests</h1>
        <p className="mt-1 text-muted">
          Products buyers and dealers could not find in the catalog.
        </p>
      </div>

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div
          role="tablist"
          aria-label="Request status"
          className="flex w-max gap-1 rounded-button bg-surface p-1 shadow-card"
        >
          {TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={status === tab.value}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={cn(
                'min-h-11 rounded-button px-4 text-sm font-semibold',
                status === tab.value ? 'bg-primary/10 text-primary' : 'text-ink hover:bg-bg-band',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {update.isError ? <Alert>{update.error.message}</Alert> : null}

      {isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{error.message}</Alert>
          <Button variant="secondary" onClick={() => refetch()}>
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : isPending ? (
        <div className="h-40 animate-pulse rounded-card bg-surface" aria-busy="true" />
      ) : data.requests.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center">
          <Inbox className="size-8 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-3 font-semibold text-ink">No requests here</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {data.requests.map((request) => (
            <li
              key={request.id}
              className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:flex-row sm:items-center"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-bold text-ink">
                    {request.brand} {request.model}
                  </p>
                  <Badge tone={STATUS_TONES[request.status]}>{request.status}</Badge>
                  <Badge>{request.fromDealer ? 'Dealer' : 'Buyer'}</Badge>
                </div>
                {request.note ? <p className="mt-1 text-sm text-muted">{request.note}</p> : null}
                <p className="mt-1 text-xs text-muted">
                  {new Date(request.createdAt).toLocaleString('en-IN')}
                </p>
              </div>
              {request.status === 'open' ? (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({ requestId: request.id, changes: { status: 'added' } })
                    }
                  >
                    <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                    Added
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={update.isPending}
                    onClick={() =>
                      update.mutate({ requestId: request.id, changes: { status: 'rejected' } })
                    }
                  >
                    <X className="size-4" strokeWidth={2} aria-hidden="true" />
                    Reject
                  </Button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">
            Page {meta.page} of {meta.totalPages}
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
