'use client';

/**
 * BuyersMonitor — buyer activity (PRD §10.11 Buyer monitor): sign-ups, weekly active,
 * groups joined, exits after a win, referred users; searchable list with suspend /
 * reactivate (sessions end at once). Admin and Support.
 */
import { useState } from 'react';
import { Search, UserCheck, UserX } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { useMonitorAction, useMonitorBuyers } from '@/hooks/useAdminMonitor';
import { formatDateTime, formatINR } from '@/utils/genericFunctions';
import {
  PageHeader,
  Pager,
  QueryState,
  ReasonDialog,
  StatTile,
  TableHead,
  TableWrap,
} from './MonitorParts';

/** @returns {JSX.Element} */
export default function BuyersMonitor() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const q = useDebouncedValue(search.trim(), 300);
  const query = useMonitorBuyers({ q, page, limit: 25 });
  const action = useMonitorAction();
  const stats = query.data?.stats;
  const rows = query.data?.buyers || [];

  const open = (buyer) => {
    const suspend = buyer.status === 'active';
    setDialog({
      title: suspend
        ? `Suspend ${buyer.firstName || 'this buyer'}`
        : `Reactivate ${buyer.firstName || 'this buyer'}`,
      description: suspend
        ? 'They are signed out everywhere and cannot sign in or join groups. Their tokens and refunds are not touched.'
        : 'They can sign in and use SaathMein again.',
      confirmLabel: suspend ? 'Suspend account' : 'Reactivate account',
      danger: suspend,
      onConfirm: (values) =>
        action.mutateAsync({
          path: `buyers/${buyer.id}/status`,
          body: { active: !suspend, reason: values.reason },
        }),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Buyers" description="Buyer sign-ups and activity." />

      <QueryState query={query} skeletonClass="h-24">
        {stats ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <StatTile label="Sign-ups today" value={stats.signupsToday} />
            <StatTile label="Sign-ups 7 days" value={stats.signupsWeek} />
            <StatTile label="Active 7 days" value={stats.activeWeek} />
            <StatTile label="Joins 7 days" value={stats.joinsWeek} />
            <StatTile
              label="Exits after a win"
              value={stats.exitsAfterWinWeek}
              hint="Last 7 days"
            />
            <StatTile label="Referred users" value={stats.referredUsers} />
          </div>
        ) : null}
      </QueryState>

      <label className="relative">
        <span className="sr-only">Search buyers</span>
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
          placeholder="Name or last digits of the phone number"
          className="min-h-11 w-full rounded-button border border-line bg-surface pl-9 pr-3 text-ink focus:border-primary focus:outline-none"
        />
      </label>

      <QueryState query={query} isEmpty={rows.length === 0} emptyText="No buyers match">
        <TableWrap minWidth={860} dim={query.isFetching}>
          <TableHead
            columns={[
              'Buyer',
              'Phone',
              'Groups',
              'Left',
              'Wallet',
              'Joined',
              'Last seen',
              'Status',
              '',
            ]}
          />
          <tbody className="divide-y divide-line">
            {rows.map((buyer) => (
              <tr key={buyer.id}>
                <td className="px-4 py-3 font-semibold text-ink">
                  {buyer.firstName || 'No name yet'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-ink">{buyer.phone}</td>
                <td className="px-4 py-3 font-mono text-ink">{buyer.groupsJoined}</td>
                <td className="px-4 py-3 font-mono text-ink">{buyer.groupsLeft}</td>
                <td className="px-4 py-3 font-mono text-ink">
                  {formatINR(buyer.walletBalancePaise)}
                </td>
                <td className="px-4 py-3 text-muted">{formatDateTime(buyer.createdAt)}</td>
                <td className="px-4 py-3 text-muted">{formatDateTime(buyer.lastLoginAt) || '—'}</td>
                <td className="px-4 py-3">
                  <Badge tone={buyer.status === 'active' ? 'muted' : 'danger'}>
                    {buyer.status}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <Button
                    variant="secondary"
                    onClick={() => open(buyer)}
                    aria-label={
                      buyer.status === 'active'
                        ? `Suspend ${buyer.firstName || 'buyer'}`
                        : `Reactivate ${buyer.firstName || 'buyer'}`
                    }
                  >
                    {buyer.status === 'active' ? (
                      <UserX className="size-4 text-danger" strokeWidth={2} aria-hidden="true" />
                    ) : (
                      <UserCheck className="size-4" strokeWidth={2} aria-hidden="true" />
                    )}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </QueryState>
      <Pager meta={query.data?.meta} page={page} onPage={setPage} noun="buyers" />
      <ReasonDialog
        action={dialog}
        onConfirm={(values) => dialog.onConfirm(values)}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
