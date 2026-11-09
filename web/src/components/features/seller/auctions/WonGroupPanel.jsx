'use client';

/**
 * WonGroupPanel — after winning (AUC-8): the members (first names) and their deal codes,
 * the exit window, and the owner-only "back out" with its penalty warning. Also the
 * runner-up offer when the winner backed out.
 */
import { useState } from 'react';
import { Loader2, Ticket, TriangleAlert, Trophy } from 'lucide-react';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import Alert from '@/components/ui/Alert';
import { useBackOut, useRespondRunnerUp } from '@/hooks/useSellerAuctions';
import { formatDateTime, formatINR } from '@/utils/genericFunctions';

/**
 * @param {{ auction: Object, isOwner: boolean }} props
 * @returns {JSX.Element}
 */
export function WonGroupPanel({ auction, isOwner }) {
  const backOut = useBackOut();
  const [isBackingOut, setIsBackingOut] = useState(false);
  const [reason, setReason] = useState('');

  return (
    <section className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4 sm:px-6">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sunrise text-white">
          <Trophy className="size-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-lg font-bold text-ink">You won this group</h2>
          <p className="text-sm text-muted">
            {auction.memberCount} buyers at{' '}
            <span className="font-mono font-semibold text-ink">
              {formatINR(auction.lowestPricePaise)}
            </span>{' '}
            each.
            {auction.exitWindowEndsAt
              ? ` Members may still leave until ${formatDateTime(auction.exitWindowEndsAt)}.`
              : ''}
          </p>
        </div>
      </div>
      <ul className="divide-y divide-line">
        {auction.members.map((member, index) => (
          <li
            key={member.dealCode || index}
            className="flex items-center justify-between gap-3 px-5 py-3 sm:px-6"
          >
            <span className="font-semibold text-ink">{member.firstName || 'Member'}</span>
            <span className="inline-flex items-center gap-2 rounded-button border border-dashed border-line px-3 py-1 font-mono text-sm font-bold tracking-wider text-ink">
              <Ticket className="size-4 text-muted" strokeWidth={2} aria-hidden="true" />
              {member.dealCode || 'Pending'}
            </span>
          </li>
        ))}
      </ul>
      <p className="px-5 py-3 text-sm text-muted sm:px-6">
        Members show this code at your showroom. Scanning and confirming purchases opens on Day 10.
      </p>

      {isOwner && auction.status === 'won' ? (
        <div className="border-t border-line px-5 py-4 sm:px-6">
          {isBackingOut ? (
            <div className="flex flex-col gap-3">
              <Alert tone="warning">
                Backing out lowers your rating and suspends your business from auctions for 30 days.
                The group goes to the next best dealer or is cancelled with full refunds.
              </Alert>
              <Textarea
                label="Why are you backing out?"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                maxLength={500}
              />
              {backOut.isError ? <Alert>{backOut.error.message}</Alert> : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setIsBackingOut(false)}>
                  Keep the group
                </Button>
                <Button
                  variant="secondary"
                  className="border-danger text-danger"
                  disabled={reason.trim().length < 10 || backOut.isPending}
                  onClick={() =>
                    backOut.mutate({ groupId: auction.groupId, reason: reason.trim() })
                  }
                >
                  {backOut.isPending ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                  ) : null}
                  Back out with penalty
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="ghost" className="text-danger" onClick={() => setIsBackingOut(true)}>
              <TriangleAlert className="size-4" strokeWidth={2} aria-hidden="true" />
              Cannot honour this price?
            </Button>
          )}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The winner backed out and this dealer was next best (PRD §10.5).
 * @param {{ auction: Object }} props
 * @returns {JSX.Element}
 */
export function RunnerUpOffer({ auction }) {
  const respond = useRespondRunnerUp();
  const { runnerUpOffer } = auction;
  return (
    <section className="rounded-card border border-primary/30 bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-bold text-ink">This group is offered to you</h2>
      <p className="mt-1 text-sm text-muted">
        The winning dealer backed out. Take all {auction.memberCount} buyers at your best price{' '}
        <span className="font-mono font-semibold text-ink">
          {formatINR(runnerUpOffer.pricePaise)}
        </span>
        . Answer by {formatDateTime(runnerUpOffer.dueAt)}.
      </p>
      {respond.isError ? <Alert className="mt-3">{respond.error.message}</Alert> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          disabled={respond.isPending}
          onClick={() => respond.mutate({ groupId: auction.groupId, accept: true })}
        >
          Take the group
        </Button>
        <Button
          variant="secondary"
          disabled={respond.isPending}
          onClick={() => respond.mutate({ groupId: auction.groupId, accept: false })}
        >
          Decline
        </Button>
      </div>
    </section>
  );
}
