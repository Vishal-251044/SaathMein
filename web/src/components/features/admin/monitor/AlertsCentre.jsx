'use client';

/**
 * AlertsCentre — every alert (MON-4): payment success rate, failed webhooks or transfers,
 * stuck refunds, auctions with no bids or one dealer, suspicious bidding, reconciliation
 * mismatches, queue backlog and API error spikes. Repeats count up on one alert. Staff
 * acknowledge (someone is on it) and close; live through the staff socket.
 */
import { useState } from 'react';
import Link from 'next/link';
import { BellOff, Check, CheckCheck } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import { useAlerts, useUpdateAlert } from '@/hooks/useAdminMonitor';
import { ALERT_SEVERITY_META, ALERT_TYPE_LABELS } from '@/utils/constants';
import { cn, formatDateTime } from '@/utils/genericFunctions';
import { PageHeader, Pager, QueryState } from './MonitorParts';

const STATUS_TABS = [
  ['active', 'Open and acknowledged'],
  ['open', 'Open'],
  ['ack', 'Acknowledged'],
  ['closed', 'Closed'],
];
const selectClass =
  'min-h-11 rounded-button border border-line bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none';

/** @returns {JSX.Element} */
export default function AlertsCentre() {
  const [status, setStatus] = useState('active');
  const [type, setType] = useState('');
  const [page, setPage] = useState(1);
  const query = useAlerts({ status, type, page, limit: 25 });
  const update = useUpdateAlert();
  const rows = query.data?.alerts || [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Alerts"
        description="Warnings and critical alerts are also emailed, and pushed to the Owner's linked phone."
        live
        actions={
          <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
            Type
            <select
              value={type}
              onChange={(event) => {
                setType(event.target.value);
                setPage(1);
              }}
              className={selectClass}
            >
              <option value="">All types</option>
              {Object.entries(ALERT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        }
      />
      <div role="tablist" aria-label="Alert status" className="flex flex-wrap gap-2">
        {STATUS_TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={status === value}
            onClick={() => {
              setStatus(value);
              setPage(1);
            }}
            className={cn(
              'min-h-11 rounded-full px-4 text-sm font-semibold',
              status === value
                ? 'bg-primary/10 text-primary-text'
                : 'border border-line text-ink hover:bg-bg-band',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {update.isError ? <Alert>{update.error.message}</Alert> : null}

      <QueryState query={query} isEmpty={rows.length === 0} emptyText="No alerts here">
        <ul className="flex flex-col gap-3">
          {rows.map((alert) => {
            const severity = ALERT_SEVERITY_META[alert.severity] || ALERT_SEVERITY_META.info;
            return (
              <li
                key={alert.id}
                className={cn(
                  'flex flex-col gap-3 rounded-card border bg-surface p-4 shadow-card sm:flex-row sm:items-start',
                  alert.severity === 'critical' && alert.status === 'open'
                    ? 'border-danger/40'
                    : 'border-line',
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={severity.tone}>{severity.label}</Badge>
                    <Badge>{ALERT_TYPE_LABELS[alert.type] || alert.type}</Badge>
                    {alert.status !== 'open' ? (
                      <Badge>{alert.status === 'ack' ? 'Acknowledged' : 'Closed'}</Badge>
                    ) : null}
                    {alert.count > 1 ? (
                      <span className="text-xs font-semibold text-muted">
                        Seen {alert.count} times
                      </span>
                    ) : null}
                  </div>
                  <Link
                    href={alert.link}
                    className="mt-2 block font-semibold text-ink hover:underline"
                  >
                    {alert.title}
                  </Link>
                  {alert.message ? (
                    <p className="mt-1 text-sm text-muted">{alert.message}</p>
                  ) : null}
                  <p className="mt-1 text-xs text-muted">
                    First {formatDateTime(alert.createdAt)} · last{' '}
                    {formatDateTime(alert.lastSeenAt)}
                  </p>
                </div>
                <div className="flex gap-2">
                  {alert.status === 'open' ? (
                    <Button
                      variant="secondary"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ alertId: alert.id, action: 'ack' })}
                    >
                      <Check className="size-4" strokeWidth={2} aria-hidden="true" />
                      Acknowledge
                    </Button>
                  ) : null}
                  {alert.status !== 'closed' ? (
                    <Button
                      variant="secondary"
                      disabled={update.isPending}
                      onClick={() => update.mutate({ alertId: alert.id, action: 'close' })}
                    >
                      <CheckCheck className="size-4" strokeWidth={2} aria-hidden="true" />
                      Close
                    </Button>
                  ) : (
                    <BellOff className="size-5 text-muted" strokeWidth={2} aria-label="Closed" />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </QueryState>
      <Pager meta={query.data?.meta} page={page} onPage={setPage} noun="alerts" />
    </div>
  );
}
