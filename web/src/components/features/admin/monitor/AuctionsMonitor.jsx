'use client';

/**
 * AuctionsMonitor — every live auction (or recent results) with dealers joined and
 * bidding, bids, ceiling, lowest price, drop %, time left and extensions (PRD §10.11
 * Auction monitor). Live through the staff socket.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ChevronRight, Pause } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { useMonitorAuctions, useSecondsLeft } from '@/hooks/useAdminMonitor';
import { GROUP_STATUS_META } from '@/utils/constants';
import {
  cn,
  formatBps,
  formatCountdown,
  formatDateTime,
  formatINR,
} from '@/utils/genericFunctions';
import { PageHeader, Pager, QueryState, TableHead, TableWrap } from './MonitorParts';
import ScopeFilters, { canScope } from './ScopeFilters';

/** Ticking time left for one row. */
function TimeLeft({ endsAt, paused }) {
  const seconds = useSecondsLeft(paused ? null : endsAt);
  if (paused) {
    return (
      <Badge tone="warning">
        <Pause className="size-3" strokeWidth={2} aria-hidden="true" />
        Paused
      </Badge>
    );
  }
  return <span className="font-mono">{seconds ? formatCountdown(seconds) : 'Closing'}</span>;
}

/** @returns {JSX.Element} */
export default function AuctionsMonitor() {
  const { staff } = useAdminAuth();
  const [tab, setTab] = useState('live');
  const [scope, setScope] = useState({ cityId: '', categoryId: '' });
  const [page, setPage] = useState(1);
  const query = useMonitorAuctions({ status: tab, ...scope, page, limit: 25 });
  const rows = query.data?.auctions || [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Live auctions"
        description="Dealer names and every bid are visible here only. Buyers and dealers never see them."
        live
        actions={
          canScope(staff.role) ? (
            <ScopeFilters
              value={scope}
              onChange={(next) => {
                setScope(next);
                setPage(1);
              }}
            />
          ) : null
        }
      />

      <div role="tablist" aria-label="Auctions" className="flex gap-2">
        {[
          ['live', 'Live now'],
          ['recent', 'Recent results'],
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              setTab(value);
              setPage(1);
            }}
            className={cn(
              'min-h-11 rounded-full px-4 text-sm font-semibold',
              tab === value
                ? 'bg-primary/10 text-primary'
                : 'border border-line text-ink hover:bg-bg-band',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <QueryState
        query={query}
        isEmpty={rows.length === 0}
        emptyText={tab === 'live' ? 'No auction is live right now' : 'No results yet'}
      >
        <TableWrap minWidth={900} dim={query.isFetching}>
          <TableHead
            columns={[
              'Product',
              'Status',
              'Dealers',
              'Bids',
              'Ceiling',
              'Lowest',
              'Drop',
              tab === 'live' ? 'Time left' : 'Closed',
              '',
            ]}
          />
          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const status = GROUP_STATUS_META[row.status] || { label: row.status, tone: 'muted' };
              return (
                <tr key={row.groupId} className="hover:bg-bg-band/60">
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{row.productName || 'Unknown product'}</p>
                    <p className="text-xs text-muted">
                      {row.cityName} · {row.memberCount} buyers
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {row.dealersBidding} bidding
                    <p className="text-xs text-muted">{row.dealersJoined} joined</p>
                  </td>
                  <td className="px-4 py-3 font-mono text-ink">{row.bidCount}</td>
                  <td className="px-4 py-3 font-mono text-ink">
                    {row.ceilingPaise != null ? formatINR(row.ceilingPaise) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold text-ink">
                    {row.lowestPricePaise != null ? formatINR(row.lowestPricePaise) : '—'}
                  </td>
                  <td className="px-4 py-3 font-mono text-savings">
                    {row.dropBps != null ? formatBps(row.dropBps) : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink">
                    {tab === 'live' ? (
                      <TimeLeft endsAt={row.endsAt} paused={row.paused} />
                    ) : (
                      formatDateTime(row.closedAt)
                    )}
                    {row.extensions ? (
                      <p className="text-xs text-muted">Extended {row.extensions}x</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-3">
                    <Link
                      href={`/admin/monitor/auctions/${row.groupId}`}
                      aria-label={`Open ${row.productName || 'auction'}`}
                      className="grid size-11 place-items-center rounded-button text-muted hover:bg-bg-band hover:text-ink"
                    >
                      <ChevronRight className="size-5" strokeWidth={2} aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </TableWrap>
      </QueryState>
      <Pager meta={query.data?.meta} page={page} onPage={setPage} noun="auctions" />
    </div>
  );
}
