'use client';

/**
 * AuctionRoom — one live auction for a dealer (AUC-2 to AUC-8): live lowest price with a
 * "new lowest" animation, timer (anti-sniping extensions show up live), dealers bidding,
 * my rank and my bids; join form, bid form, and after the close the result (won panel
 * with deal codes, runner-up offer, or the outcome). Other dealers stay anonymous.
 */
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Clock, Radio, RefreshCw, UsersRound, WifiOff } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import FadeIn from '@/components/animations/FadeIn';
import JoinCommitmentForm from '@/components/features/seller/auctions/JoinCommitmentForm';
import BidForm from '@/components/features/seller/auctions/BidForm';
import { RunnerUpOffer, WonGroupPanel } from '@/components/features/seller/auctions/WonGroupPanel';
import { useSellerMe } from '@/hooks/useSeller';
import { useAuctionLive, useCountdown, useSellerAuction } from '@/hooks/useSellerAuctions';
import { DURATION, EASE } from '@/utils/animations';
import { ROUTES } from '@/utils/constants';
import {
  cn,
  formatCountdown,
  formatDateTime,
  formatINR,
  formatMemberCount,
} from '@/utils/genericFunctions';

/** Why a dealer cannot bid, in plain words (codes from the API). */
const INELIGIBLE_TEXT = {
  KYC_NOT_APPROVED: 'Finish verification (KYC) to bid in auctions.',
  SELLER_SUSPENDED: 'Your dealer account is suspended. Contact SaathMein support.',
  AUCTIONS_SUSPENDED: 'Your business is suspended from auctions for backing out of a won group.',
  RATING_TOO_LOW: 'Your rating is below 3.5, the minimum to bid.',
  CITY_NOT_COVERED: 'Add this city to your coverage in your business profile to bid.',
  CATEGORY_NOT_COVERED: 'Add this category to your business profile to bid.',
};

/** Result text for a closed auction, by group status and my status. */
const outcomeText = (auction) => {
  if (auction.status === 'no_deal')
    return 'This auction ended without a deal. Buyers were refunded.';
  if (auction.status === 'cancelled') return 'This group was cancelled. Buyers were refunded.';
  if (auction.closedAt && auction.status === 'auction_live') {
    return 'Bidding has stopped. Only one dealer bid, so the group leader is deciding whether to accept that price.';
  }
  if (auction.myStatus === 'runner_up')
    return 'You came second. If the winner backs out, the group is offered to you.';
  return 'Another dealer won this group with a lower price.';
};

/** @param {{ label: string, children: React.ReactNode }} props */
function Stat({ label, children }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-0.5 font-bold text-ink">{children}</dd>
    </div>
  );
}

/**
 * @param {{ groupId: string }} props
 * @returns {JSX.Element}
 */
export default function AuctionRoom({ groupId }) {
  const reduceMotion = useReducedMotion();
  const me = useSellerMe();
  // Polls only while the live room is not connected (read through a ref by the query)
  const liveRef = useRef(false);
  const query = useSellerAuction(groupId, liveRef);
  const auction = query.data;
  const joined = Boolean(auction?.joined);
  const { isLive, flash } = useAuctionLive(groupId, joined);
  useEffect(() => {
    liveRef.current = isLive;
  }, [isLive]);
  const isOpen = auction?.status === 'auction_live' && !auction.closedAt;
  const seconds = useCountdown(isOpen ? auction?.endsAt : null);

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-10 w-2/3 animate-pulse rounded-button bg-bg-band" />
        <div className="h-48 animate-pulse rounded-card bg-bg-band" />
        <div className="h-72 animate-pulse rounded-card bg-bg-band" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert>{query.error.message}</Alert>
        <Button variant="secondary" onClick={() => query.refetch()}>
          <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
          Try again
        </Button>
      </div>
    );
  }

  const soon = seconds != null && seconds <= 300;
  const shownPrice = auction.lowestPricePaise ?? auction.ceilingPaise;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={auction.isWinner ? ROUTES.SELLER_WON : ROUTES.SELLER_AUCTIONS}
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
        Back
      </Link>

      <FadeIn className="flex items-start gap-4">
        <div className="size-20 shrink-0 overflow-hidden rounded-card bg-bg-band">
          {auction.product?.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={auction.product.imageUrl} alt="" className="size-full object-cover" />
          ) : null}
        </div>
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {auction.product?.name}
          </h1>
          <p className="text-muted">
            {auction.variantName || 'Any variant'} · {auction.cityName}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {isOpen ? (
              <Badge tone="brand">
                <Radio className="size-3.5" strokeWidth={2} aria-hidden="true" />
                Live
              </Badge>
            ) : (
              <Badge>Closed</Badge>
            )}
            {joined && !isLive && isOpen ? (
              <Badge tone="warning">
                <WifiOff className="size-3.5" strokeWidth={2} aria-hidden="true" />
                Reconnecting, refreshing every 10 s
              </Badge>
            ) : null}
          </div>
        </div>
      </FadeIn>

      <section
        className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
        aria-live="polite"
      >
        <p className="text-sm text-muted">
          {auction.lowestPricePaise
            ? 'Current lowest price (per unit)'
            : 'Market price — first bid must be lower'}
        </p>
        <div className="relative h-12 overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.p
              key={`${shownPrice}-${flash}`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24 }}
              transition={{ duration: DURATION.base, ease: EASE.out }}
              className="font-mono text-4xl font-extrabold text-ink"
            >
              {formatINR(shownPrice) || '—'}
            </motion.p>
          </AnimatePresence>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-4 sm:grid-cols-4">
          <Stat label="Time left">
            {isOpen ? (
              <span
                className={cn('inline-flex items-center gap-1 font-mono', soon && 'text-danger')}
              >
                <Clock className="size-4" strokeWidth={2} aria-hidden="true" />
                {seconds > 0 ? formatCountdown(seconds) : 'Closing'}
              </span>
            ) : (
              'Ended'
            )}
          </Stat>
          <Stat label="Buyers">
            <span className="inline-flex items-center gap-1">
              <UsersRound className="size-4" strokeWidth={2} aria-hidden="true" />
              {formatMemberCount(auction.memberCount, auction.memberCount)}
            </span>
          </Stat>
          <Stat label="Dealers bidding">{auction.dealerCount}</Stat>
          <Stat label="Your rank">
            {auction.myRank ? `#${auction.myRank}` : joined ? 'No bid yet' : '—'}
          </Stat>
        </dl>
        {auction.extensions > 0 && isOpen ? (
          <p className="mt-3 text-sm text-muted">
            Extended {auction.extensions} time{auction.extensions > 1 ? 's' : ''} by last-minute
            bids.
          </p>
        ) : null}
      </section>

      {auction.isWinner ? (
        <WonGroupPanel auction={auction} isOwner={me.data?.role === 'owner'} />
      ) : auction.runnerUpOffer ? (
        <RunnerUpOffer auction={auction} />
      ) : isOpen ? (
        !joined ? (
          auction.eligible ? (
            <JoinCommitmentForm groupId={groupId} />
          ) : (
            <Alert tone="warning">
              {INELIGIBLE_TEXT[auction.ineligibleReason] ||
                'Your business cannot bid in this auction.'}
            </Alert>
          )
        ) : (
          <>
            {auction.commitment ? (
              <p className="text-sm text-muted">
                Your commitment: delivery by {formatDateTime(auction.commitment.deliveryBy)}, price
                valid {auction.commitment.priceValidityDays} days.
              </p>
            ) : null}
            {auction.eligible ? (
              <BidForm auction={auction} />
            ) : (
              <Alert tone="warning">
                {INELIGIBLE_TEXT[auction.ineligibleReason] || 'Your business cannot bid right now.'}
              </Alert>
            )}
          </>
        )
      ) : (
        <Alert tone="info">{outcomeText(auction)}</Alert>
      )}

      {auction.myBids.length ? (
        <section className="rounded-card border border-line bg-surface shadow-card">
          <h2 className="border-b border-line px-5 py-4 text-lg font-bold text-ink sm:px-6">
            Your bids
          </h2>
          <ul className="divide-y divide-line">
            {auction.myBids.map((bid) => (
              <li
                key={bid.id}
                className="flex items-center justify-between gap-3 px-5 py-3 text-sm sm:px-6"
              >
                <span className="text-muted">{formatDateTime(bid.createdAt)}</span>
                <span className="font-mono font-semibold text-ink">
                  {formatINR(bid.pricePerUnitPaise)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
