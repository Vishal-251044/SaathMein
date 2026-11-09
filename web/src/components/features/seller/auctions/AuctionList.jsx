'use client';

/**
 * AuctionList — dealer lists (AUC-1): live auctions to bid in, upcoming groups still
 * filling in the dealer's cities and categories, and groups this dealer won.
 * Dealers only see the anonymous lowest price, never other dealers (AUC-6).
 */
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Gavel,
  MapPin,
  RefreshCw,
  Trophy,
  UsersRound,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import FadeIn from '@/components/animations/FadeIn';
import { useAuctionList, useCountdown } from '@/hooks/useSellerAuctions';
import { fadeUp, staggerContainer } from '@/utils/animations';
import { ROUTES } from '@/utils/constants';
import { cn, formatCountdown, formatINR, formatMemberCount } from '@/utils/genericFunctions';

const TABS = [
  { key: 'live', label: 'Live auctions', href: ROUTES.SELLER_AUCTIONS },
  { key: 'upcoming', label: 'Upcoming groups', href: `${ROUTES.SELLER_AUCTIONS}?tab=upcoming` },
];

const EMPTY = {
  live: 'No live auctions in your cities and categories right now. We will notify you when a group fills up.',
  upcoming: 'No groups are filling in your coverage yet.',
  won: 'You have not won a group yet. Win live auctions with the best all-inclusive price.',
};

/** @param {{ endsAt: string|null }} props */
function TimeLeft({ endsAt }) {
  const seconds = useCountdown(endsAt);
  if (seconds == null) return null;
  const soon = seconds > 0 && seconds <= 300;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-sm font-semibold',
        soon ? 'text-danger' : 'text-ink',
      )}
    >
      <Clock className="size-4" strokeWidth={2} aria-hidden="true" />
      {seconds > 0 ? formatCountdown(seconds) : 'Closing'}
    </span>
  );
}

/** @param {{ group: Object, tab: string }} props */
function AuctionCard({ group, tab }) {
  const clickable = tab !== 'upcoming';
  const body = (
    <>
      <div className="flex items-start gap-3">
        <div className="size-16 shrink-0 overflow-hidden rounded-button bg-bg-band">
          {group.product?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={group.product.imageUrl}
              alt=""
              className="size-full object-cover"
              loading="lazy"
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-ink">{group.product?.name || 'Product'}</p>
          <p className="truncate text-sm text-muted">{group.variantName || 'Any variant'}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" strokeWidth={2} aria-hidden="true" />
              {group.cityName || '—'}
            </span>
            <span className="inline-flex items-center gap-1">
              <UsersRound className="size-4" strokeWidth={2} aria-hidden="true" />
              {formatMemberCount(group.memberCount, group.targetSize)} buyers
            </span>
          </p>
        </div>
        {tab === 'won' ? (
          <Badge tone="brand">
            <Trophy className="size-3.5" strokeWidth={2} aria-hidden="true" />
            {group.status === 'won'
              ? 'Won'
              : group.status === 'purchasing'
                ? 'Purchasing'
                : 'Completed'}
          </Badge>
        ) : group.joined ? (
          <Badge tone="brand">Joined</Badge>
        ) : null}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-line pt-3 text-sm sm:grid-cols-3">
        {tab === 'won' ? (
          <div>
            <dt className="text-muted">Your price</dt>
            <dd className="font-mono font-bold text-ink">{formatINR(group.winningPricePaise)}</dd>
          </div>
        ) : (
          <div>
            <dt className="text-muted">{tab === 'upcoming' ? 'Market price' : 'Lowest price'}</dt>
            <dd className="font-mono font-bold text-ink">
              {formatINR(
                tab === 'upcoming'
                  ? group.product?.fromPricePaise
                  : (group.lowestPricePaise ?? group.ceilingPaise),
              ) || '—'}
            </dd>
          </div>
        )}
        {tab === 'live' ? (
          <>
            <div>
              <dt className="text-muted">Dealers bidding</dt>
              <dd className="font-bold text-ink">{group.dealerCount}</dd>
            </div>
            <div>
              <dt className="text-muted">Time left</dt>
              <dd>
                {group.status === 'runner_up' ? (
                  <span className="font-semibold">Runner-up offer</span>
                ) : (
                  <TimeLeft endsAt={group.closedAt ? null : group.endsAt} />
                )}
              </dd>
            </div>
          </>
        ) : null}
        {tab === 'live' && group.myBestPricePaise ? (
          <div>
            <dt className="text-muted">Your best</dt>
            <dd className="font-mono font-bold text-ink">{formatINR(group.myBestPricePaise)}</dd>
          </div>
        ) : null}
      </dl>
    </>
  );
  const classes = 'block rounded-card border border-line bg-surface p-4 shadow-card sm:p-5';
  return (
    <motion.li variants={fadeUp}>
      {clickable ? (
        <Link
          href={`${ROUTES.SELLER_AUCTIONS}/${group.groupId}`}
          className={cn(
            classes,
            'transition-shadow duration-150 hover:shadow-pop focus-visible:ring-4 focus-visible:ring-primary/20',
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={classes}>{body}</div>
      )}
    </motion.li>
  );
}

/**
 * @param {{ tab: 'live'|'upcoming'|'won' }} props
 * @returns {JSX.Element}
 */
export default function AuctionList({ tab }) {
  const [page, setPage] = useState(1);
  const query = useAuctionList(tab, page);
  const groups = query.data?.groups || [];
  const meta = query.data?.meta;

  return (
    <div className="flex flex-col gap-6">
      <FadeIn>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">
          {tab === 'won' ? 'Won groups' : 'Live auctions'}
        </h1>
        <p className="mt-1 text-muted">
          {tab === 'won'
            ? 'Groups that chose your price. Members bring their deal code to your showroom.'
            : 'Full groups of buyers in your cities. The lowest all-inclusive price wins the whole group.'}
        </p>
      </FadeIn>

      {tab !== 'won' ? (
        <nav aria-label="Auction lists" className="flex gap-2 overflow-x-auto">
          {TABS.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setPage(1)}
              aria-current={item.key === tab ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors duration-150',
                item.key === tab
                  ? 'bg-primary/10 text-primary'
                  : 'bg-bg-band text-muted hover:text-ink',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      ) : null}

      {query.isPending ? (
        <ul className="grid gap-4 lg:grid-cols-2" aria-busy="true">
          {['a', 'b', 'c', 'd'].map((key) => (
            <li key={key} className="h-40 animate-pulse rounded-card bg-bg-band" />
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
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface p-10 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-bg-band text-muted">
            <Gavel className="size-7" strokeWidth={2} aria-hidden="true" />
          </span>
          <p className="max-w-md text-muted">{EMPTY[tab]}</p>
        </div>
      ) : (
        <motion.ul
          key={`${tab}-${page}`}
          className="grid gap-4 lg:grid-cols-2"
          variants={staggerContainer()}
          initial="hidden"
          animate="visible"
        >
          {groups.map((group) => (
            <AuctionCard key={group.groupId} group={group} tab={tab} />
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
