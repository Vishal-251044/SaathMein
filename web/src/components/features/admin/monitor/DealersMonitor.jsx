'use client';

/**
 * DealersMonitor — dealer performance (PRD §10.11 Dealer monitor): auctions joined, wins,
 * win rate, average discount from the ceiling, back-outs, warnings, rating and any
 * suspension. Actions (Admin / Deal Manager): warn, suspend from auctions. Penalties are
 * lifted from the dealer's page (Sellers), where each penalty is listed.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Ban, Star, TriangleAlert } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { useMonitorAction, useMonitorDealers } from '@/hooks/useAdminMonitor';
import { formatBps, formatDateTime } from '@/utils/genericFunctions';
import {
  NumberField,
  PageHeader,
  Pager,
  QueryState,
  ReasonDialog,
  TableHead,
  TableWrap,
} from './MonitorParts';
import ScopeFilters, { canScope } from './ScopeFilters';

const OPS_ROLES = ['owner', 'admin', 'deal_manager'];

/** @returns {JSX.Element} */
export default function DealersMonitor() {
  const { staff } = useAdminAuth();
  const [scope, setScope] = useState({ cityId: '', categoryId: '' });
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const query = useMonitorDealers({ ...scope, page, limit: 25 });
  const action = useMonitorAction();
  const canAct = OPS_ROLES.includes(staff.role);
  const rows = query.data?.dealers || [];

  const open = (dealer, type) => {
    const isSuspension = type === 'auction_suspension';
    setDialog({
      title: isSuspension
        ? `Suspend ${dealer.businessName} from auctions`
        : `Warn ${dealer.businessName}`,
      description: isSuspension
        ? 'The dealer cannot join or bid in auctions until the suspension ends.'
        : 'The warning is recorded on the dealer profile and the dealer is told why.',
      confirmLabel: isSuspension ? 'Suspend' : 'Send warning',
      danger: isSuspension,
      initial: isSuspension ? { days: '7' } : {},
      fields: isSuspension
        ? (values, set) => (
            <NumberField
              label="Suspend for"
              value={values.days}
              onChange={(v) => set('days', v)}
              min={1}
              max={365}
              suffix="days"
            />
          )
        : null,
      onConfirm: (values) =>
        action.mutateAsync({
          path: `dealers/${dealer.id}/penalties`,
          body: {
            type,
            reason: values.reason,
            ...(isSuspension ? { days: Number.parseInt(values.days, 10) } : {}),
          },
        }),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Dealer monitor"
        description="How each dealer performs in auctions."
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
      <QueryState query={query} isEmpty={rows.length === 0} emptyText="No dealers yet">
        <TableWrap minWidth={1000} dim={query.isFetching}>
          <TableHead
            columns={[
              'Dealer',
              'Rating',
              'Auctions',
              'Wins',
              'Win rate',
              'Avg discount',
              'Back-outs',
              'Warnings',
              'Status',
              canAct ? 'Actions' : '',
            ]}
          />
          <tbody className="divide-y divide-line">
            {rows.map((dealer) => (
              <tr key={dealer.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/sellers/${dealer.id}`}
                    className="font-semibold text-ink hover:underline"
                  >
                    {dealer.businessName}
                  </Link>
                  <p className="text-xs text-muted">KYC {dealer.kycStatus || '—'}</p>
                </td>
                <td className="px-4 py-3 text-ink">
                  {dealer.rating != null ? (
                    <span className="inline-flex items-center gap-1 font-mono">
                      <Star
                        className="size-3.5 text-warning-text"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      {dealer.rating.toFixed(1)}
                    </span>
                  ) : (
                    <span className="text-muted">New</span>
                  )}
                  <p className="text-xs text-muted">{dealer.reviewCount} reviews</p>
                </td>
                <td className="px-4 py-3 font-mono text-ink">{dealer.auctionsJoined}</td>
                <td className="px-4 py-3 font-mono text-ink">{dealer.wins}</td>
                <td className="px-4 py-3 font-mono text-ink">
                  {dealer.winRateBps != null ? formatBps(dealer.winRateBps) : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-ink">
                  {dealer.avgDiscountBps != null ? formatBps(dealer.avgDiscountBps) : '—'}
                </td>
                <td className="px-4 py-3 font-mono text-ink">{dealer.backOuts}</td>
                <td className="px-4 py-3 font-mono text-ink">{dealer.warnings}</td>
                <td className="px-4 py-3">
                  {dealer.suspendedUntil ? (
                    <Badge tone="danger">
                      Suspended to {formatDateTime(dealer.suspendedUntil)}
                    </Badge>
                  ) : (
                    <Badge>{dealer.status}</Badge>
                  )}
                </td>
                <td className="px-4 py-3">
                  {canAct ? (
                    <div className="flex gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => open(dealer, 'warning')}
                        aria-label={`Warn ${dealer.businessName}`}
                      >
                        <TriangleAlert className="size-4" strokeWidth={2} aria-hidden="true" />
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => open(dealer, 'auction_suspension')}
                        aria-label={`Suspend ${dealer.businessName}`}
                      >
                        <Ban
                          className="size-4 text-danger-text"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      </Button>
                    </div>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </QueryState>
      <Pager meta={query.data?.meta} page={page} onPage={setPage} noun="dealers" />
      <ReasonDialog
        action={dialog}
        onConfirm={(values) => dialog.onConfirm(values)}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
