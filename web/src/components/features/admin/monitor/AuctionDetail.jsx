'use client';

/**
 * AuctionDetail — one auction for staff (PRD §10.11 Auction monitor): numbers, dealers
 * with names, the full bid timeline (with IP for suspicious-bidding checks), status
 * history, and actions — pause / resume, extend, cancel (everyone refunded), force
 * runner-up. Every action needs a reason and is written to the audit log.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Ban, Clock, Pause, Play, Shuffle } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { useMonitorAction, useMonitorAuction, useSecondsLeft } from '@/hooks/useAdminMonitor';
import { GROUP_STATUS_META } from '@/utils/constants';
import { formatBps, formatCountdown, formatDateTime, formatINR } from '@/utils/genericFunctions';
import {
  NumberField,
  PageHeader,
  Panel,
  QueryState,
  ReasonDialog,
  StatTile,
  TableHead,
  TableWrap,
} from './MonitorParts';

const OPS_ROLES = ['owner', 'admin', 'deal_manager'];

/**
 * @param {Object} props
 * @param {string} props.groupId
 * @returns {JSX.Element}
 */
export default function AuctionDetail({ groupId }) {
  const { staff } = useAdminAuth();
  const query = useMonitorAuction(groupId);
  const action = useMonitorAction();
  const [dialog, setDialog] = useState(null);
  const data = query.data;
  const auction = data?.auction;
  const isLive = data?.status === 'auction_live' && !auction?.closedAt;
  const seconds = useSecondsLeft(isLive && !auction?.paused ? auction?.endsAt : null);
  const canAct = OPS_ROLES.includes(staff.role);
  const lowestBidId = data?.bids.filter((bid) => bid.status !== 'outbid').at(-1)?.id;

  // Same IP used by more than one dealer: flag those bids
  const ipDealers = new Map();
  (data?.bids || []).forEach((bid) => {
    if (!bid.ip) return;
    const set = ipDealers.get(bid.ip) || new Set();
    set.add(bid.sellerId);
    ipDealers.set(bid.ip, set);
  });

  const run =
    (path, extra = {}) =>
    async (values) => {
      await action.mutateAsync({ path, body: { ...extra(values), reason: values.reason } });
    };

  const actions = {
    pause: {
      title: 'Pause this auction',
      description:
        'Dealers cannot bid until you resume. The paused time is added back to the timer.',
      confirmLabel: 'Pause auction',
      path: `auctions/${groupId}/pause`,
    },
    resume: {
      title: 'Resume this auction',
      confirmLabel: 'Resume auction',
      path: `auctions/${groupId}/resume`,
    },
    extend: {
      title: 'Extend this auction',
      confirmLabel: 'Extend',
      path: `auctions/${groupId}/extend`,
      initial: { hours: '2' },
      fields: (values, set) => (
        <NumberField
          label="Extra time"
          value={values.hours}
          onChange={(v) => set('hours', v)}
          min={1}
          max={72}
          suffix="hours"
        />
      ),
      body: (values) => ({ hours: Number.parseInt(values.hours, 10) }),
    },
    cancel: {
      title: 'Cancel this group',
      description:
        'The group is cancelled and every buyer gets a full refund of their token. Held dealer transfers are taken back first. This cannot be undone.',
      confirmLabel: 'Cancel and refund everyone',
      danger: true,
      path: `groups/${groupId}/cancel`,
    },
    runnerUp: {
      title: 'Give the group to the runner-up',
      description:
        'The winner loses the group, their deal codes stop working and held transfers are taken back. Without a runner-up the group is cancelled with full refunds.',
      confirmLabel: 'Move to runner-up',
      danger: true,
      path: `auctions/${groupId}/runner-up`,
      initial: { penalise: false },
      fields: (values, set) => (
        <label className="flex min-h-11 items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="size-5 accent-[var(--sm-primary)]"
            checked={Boolean(values.penalise)}
            onChange={(event) => set('penalise', event.target.checked)}
          />
          Penalise the winner (1-star rating penalty and auction suspension)
        </label>
      ),
      body: (values) => ({ penalise: Boolean(values.penalise) }),
    },
  };

  const open = (key) => {
    const config = actions[key];
    setDialog({ ...config, onConfirm: run(config.path, config.body || (() => ({}))) });
  };

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/monitor/auctions"
        className="inline-flex min-h-11 items-center gap-2 self-start text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
        All auctions
      </Link>

      <QueryState query={query} skeletonClass="h-96">
        {data ? (
          <>
            <PageHeader
              title={data.productName || 'Auction'}
              description={`${data.cityName} · ${data.memberCount} buyers · started ${formatDateTime(auction.startsAt)}`}
              live
              actions={
                canAct ? (
                  <>
                    {isLive && !auction.paused ? (
                      <Button variant="secondary" onClick={() => open('pause')}>
                        <Pause className="size-4" strokeWidth={2} aria-hidden="true" />
                        Pause
                      </Button>
                    ) : null}
                    {isLive && auction.paused ? (
                      <Button variant="secondary" onClick={() => open('resume')}>
                        <Play className="size-4" strokeWidth={2} aria-hidden="true" />
                        Resume
                      </Button>
                    ) : null}
                    {isLive ? (
                      <Button variant="secondary" onClick={() => open('extend')}>
                        <Clock className="size-4" strokeWidth={2} aria-hidden="true" />
                        Extend
                      </Button>
                    ) : null}
                    {data.status === 'won' ? (
                      <Button variant="secondary" onClick={() => open('runnerUp')}>
                        <Shuffle className="size-4" strokeWidth={2} aria-hidden="true" />
                        Force runner-up
                      </Button>
                    ) : null}
                    {['auction_live', 'won', 'runner_up'].includes(data.status) ? (
                      <Button
                        variant="secondary"
                        onClick={() => open('cancel')}
                        className="text-danger-text"
                      >
                        <Ban className="size-4" strokeWidth={2} aria-hidden="true" />
                        Cancel group
                      </Button>
                    ) : null}
                  </>
                ) : null
              }
            />

            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <StatTile
                label="Status"
                value={(GROUP_STATUS_META[data.status] || { label: data.status }).label}
              />
              <StatTile
                label="Ceiling"
                value={auction.ceilingPaise != null ? formatINR(auction.ceilingPaise) : '—'}
              />
              <StatTile
                label="Lowest"
                value={auction.lowestPricePaise != null ? formatINR(auction.lowestPricePaise) : '—'}
              />
              <StatTile
                label="Drop"
                value={auction.dropBps != null ? formatBps(auction.dropBps) : '—'}
                tone="savings"
              />
              <StatTile
                label={isLive ? 'Time left' : 'Closed'}
                value={
                  isLive
                    ? auction.paused
                      ? 'Paused'
                      : formatCountdown(seconds)
                    : formatDateTime(auction.closedAt) || '—'
                }
                tone={auction.paused ? 'warning' : 'default'}
              />
              <StatTile label="Extensions" value={auction.extensions} />
            </div>

            <Panel title={`Dealers (${data.dealers.length})`}>
              <QueryState
                query={query}
                isEmpty={data.dealers.length === 0}
                emptyText="No dealer has joined yet"
              >
                <TableWrap minWidth={560}>
                  <TableHead columns={['Dealer', 'Status', 'Best price', 'Bids', 'Joined']} />
                  <tbody className="divide-y divide-line">
                    {data.dealers.map((dealer) => (
                      <tr key={dealer.sellerId}>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/sellers/${dealer.sellerId}`}
                            className="font-semibold text-ink hover:underline"
                          >
                            {dealer.businessName || 'Dealer'}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={dealer.status === 'backed_out' ? 'danger' : 'muted'}>
                            {dealer.status.replace(/_/g, ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-mono text-ink">
                          {dealer.bestPricePaise != null ? formatINR(dealer.bestPricePaise) : '—'}
                        </td>
                        <td className="px-4 py-3 font-mono text-ink">{dealer.bidCount}</td>
                        <td className="px-4 py-3 text-muted">{formatDateTime(dealer.joinedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </QueryState>
            </Panel>

            <Panel title={`Bid timeline (${data.bids.length})`}>
              <QueryState query={query} isEmpty={data.bids.length === 0} emptyText="No bids yet">
                <ol className="relative flex flex-col gap-0 border-l-2 border-line pl-5">
                  {[...data.bids].reverse().map((bid) => {
                    const sharedIp = bid.ip && (ipDealers.get(bid.ip)?.size || 0) > 1;
                    const isWinner = bid.id === auction.winnerBidId;
                    const isRunnerUp = bid.id === auction.runnerUpBidId;
                    return (
                      <li key={bid.id} className="relative py-2.5">
                        <span
                          className={`absolute -left-[27px] top-4 size-3 rounded-full border-2 border-surface ${bid.id === lowestBidId || isWinner ? 'bg-primary' : 'bg-line'}`}
                          aria-hidden="true"
                        />
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-mono text-base font-bold text-ink">
                            {formatINR(bid.pricePerUnitPaise)}
                          </span>
                          <span className="text-sm font-semibold text-ink">
                            {bid.businessName || 'Dealer'}
                          </span>
                          {isWinner ? <Badge tone="brand">Winner</Badge> : null}
                          {isRunnerUp ? <Badge>Runner-up</Badge> : null}
                          {sharedIp ? <Badge tone="danger">Same IP as another dealer</Badge> : null}
                        </div>
                        <p className="text-xs text-muted">
                          {new Date(bid.createdAt).toLocaleTimeString('en-IN', {
                            hour: 'numeric',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                          {' · '}
                          {formatDateTime(bid.createdAt)}
                          {bid.ip ? ` · IP ${bid.ip}` : ''}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </QueryState>
            </Panel>

            {data.statusHistory.length ? (
              <Panel title="Status history">
                <ul className="flex flex-col gap-2 text-sm">
                  {data.statusHistory.map((entry, index) => (
                    <li key={`${entry.at}-${index}`} className="flex flex-wrap gap-x-2 text-ink">
                      <span className="font-semibold">
                        {(GROUP_STATUS_META[entry.from] || { label: entry.from || 'new' }).label} →{' '}
                        {(GROUP_STATUS_META[entry.to] || { label: entry.to }).label}
                      </span>
                      <span className="text-muted">
                        {entry.reason ? `${entry.reason.replace(/_/g, ' ')} · ` : ''}
                        {entry.byType || 'system'} · {formatDateTime(entry.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Panel>
            ) : null}
          </>
        ) : null}
      </QueryState>

      <ReasonDialog
        action={dialog}
        onConfirm={(values) => dialog.onConfirm(values)}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
