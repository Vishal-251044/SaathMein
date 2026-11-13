'use client';

/**
 * DealsList — the dealer's seller-led group deals (AUC-9): buyers joined, tier reached,
 * price now, "X more to unlock" and the result.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Tags, UsersRound } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import FadeIn from '@/components/animations/FadeIn';
import { useSellerDeals } from '@/hooks/useSellerAuctions';
import { fadeUp, staggerContainer } from '@/utils/animations';
import { ROUTES } from '@/utils/constants';
import { formatBps, formatDateTime, formatINR, formatMemberCount } from '@/utils/genericFunctions';

const STATUS_LABEL = {
  open: { label: 'Open', tone: 'brand' },
  full: { label: 'Full', tone: 'brand' },
  won: { label: 'Sold', tone: 'brand' },
  purchasing: { label: 'Purchasing', tone: 'brand' },
  completed: { label: 'Completed', tone: 'muted' },
  expired: { label: 'Expired, refunded', tone: 'muted' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

/** @param {{ deal: Object }} props */
function DealCard({ deal }) {
  const status = STATUS_LABEL[deal.status] || { label: deal.status, tone: 'muted' };
  return (
    <motion.li
      variants={fadeUp}
      className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-bold text-ink">{deal.product?.name || 'Product'}</p>
          <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted">
            <UsersRound className="size-4" strokeWidth={2} aria-hidden="true" />
            {formatMemberCount(deal.memberCount, deal.targetSize)} buyers · ends{' '}
            {formatDateTime(deal.deadline)}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <ol className="mt-4 flex flex-wrap gap-2">
        {deal.tiers.map((tier) => {
          const reached = deal.memberCount >= tier.size;
          return (
            <li
              key={tier.size}
              className={
                reached
                  ? 'rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary-text'
                  : 'rounded-full bg-bg-band px-3 py-1 text-xs font-semibold text-muted'
              }
            >
              {tier.size} buyers · {formatBps(tier.discountBps)} off
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-sm text-muted">
        Price now{' '}
        <span className="font-mono font-semibold text-ink">
          {formatINR(deal.winningPricePaise ?? deal.pricePaise)}
        </span>
        {deal.status === 'open' && deal.membersToNext
          ? ` · ${deal.membersToNext} more to unlock the next tier`
          : ''}
      </p>
    </motion.li>
  );
}

/** @returns {JSX.Element} */
export default function DealsList() {
  const [page, setPage] = useState(1);
  const query = useSellerDeals(page);
  const deals = query.data?.deals || [];
  const meta = query.data?.meta;

  return (
    <div className="flex flex-col gap-6">
      <FadeIn className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Group deals</h1>
          <p className="mt-1 text-muted">
            Your own tiered offers. The price drops for everyone as buyers join.
          </p>
        </div>
        <Button href={ROUTES.SELLER_DEAL_NEW}>
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          New deal
        </Button>
      </FadeIn>

      {query.isPending ? (
        <ul className="grid gap-4 lg:grid-cols-2" aria-busy="true">
          {['a', 'b'].map((key) => (
            <li key={key} className="h-36 animate-pulse rounded-card bg-bg-band" />
          ))}
        </ul>
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{query.error.message}</Alert>
          <Button variant="secondary" onClick={() => query.refetch()}>
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : deals.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface p-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-bg-band text-muted">
            <Tags className="size-7" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="max-w-md text-muted">
            No deals yet. Publish one to bring groups of buyers to your showroom.
          </p>
        </div>
      ) : (
        <motion.ul
          key={page}
          className="grid gap-4 lg:grid-cols-2"
          variants={staggerContainer()}
          initial="hidden"
          animate="visible"
        >
          {deals.map((deal) => (
            <DealCard key={deal.groupId} deal={deal} />
          ))}
        </motion.ul>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
          <Button
            variant="secondary"
            disabled={page <= 1}
            onClick={() => setPage((value) => value - 1)}
          >
            <ChevronLeft className="size-4" strokeWidth={2} aria-hidden="true" />
            Previous
          </Button>
          <span className="text-sm text-muted">
            Page {page} of {meta.totalPages}
          </span>
          <Button
            variant="secondary"
            disabled={page >= meta.totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
            <ChevronRight className="size-4" strokeWidth={2} aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
