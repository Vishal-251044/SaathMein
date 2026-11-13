'use client';

/**
 * PaymentsMonitor — Razorpay monitor for Finance (PRD §10.11 Payment monitor): captured
 * and failed payments with success rate by method, tokens with SaathMein, refunds pending
 * or failed, Route transfers on hold / released / reversed / failed, webhook failures and
 * the latest reconciliation. Lists to act on: retry a failed refund, manual refund,
 * release or reverse a dealer hold. Every action needs a reason and is audited.
 */
import { useState } from 'react';
import {
  CircleCheck,
  CreditCard,
  RotateCcw,
  Search,
  TriangleAlert,
  Undo2,
  Wallet,
} from 'lucide-react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { useMonitorAction, useMonitorPayments, usePaymentSummary } from '@/hooks/useAdminMonitor';
import { rupeesInputToPaise } from '@/utils/money';
import { cn, formatBps, formatDateTime, formatINR } from '@/utils/genericFunctions';
import {
  NumberField,
  PageHeader,
  Pager,
  Panel,
  QueryState,
  ReasonDialog,
  StatTile,
  TableHead,
  TableWrap,
} from './MonitorParts';

const VIEWS = [
  ['all', 'All'],
  ['refunds_failed', 'Refunds failed'],
  ['refunds_pending', 'Refunds pending'],
  ['held', 'On hold at dealer'],
  ['transfer_failed', 'Transfers failed'],
];
const dateClass =
  'min-h-11 rounded-button border border-line bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none';

/** Money left to refund on a payment (paise). */
const refundable = (payment) =>
  payment.amountPaise -
  payment.refunds
    .filter((refund) => refund.status !== 'failed')
    .reduce((total, refund) => total + refund.amountPaise, 0);

/** @returns {JSX.Element} */
export default function PaymentsMonitor() {
  const [range, setRange] = useState({ from: '', to: '' });
  const [view, setView] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [dialog, setDialog] = useState(null);
  const q = useDebouncedValue(search.trim(), 300);
  const summary = usePaymentSummary(range);
  const payments = useMonitorPayments({ view, q, page, limit: 25 });
  const action = useMonitorAction();
  const data = summary.data;

  const open = (payment, kind) => {
    const configs = {
      retry: {
        title: 'Retry the failed refund',
        confirmLabel: 'Retry refund',
        path: `payments/${payment.id}/retry-refund`,
      },
      refund: {
        title: 'Manual refund',
        description: `Up to ${formatINR(refundable(payment))} can still be refunded to the buyer's original payment method.`,
        confirmLabel: 'Refund',
        danger: true,
        path: `payments/${payment.id}/refund`,
        initial: { rupees: String(refundable(payment) / 100) },
        fields: (values, set) => (
          <NumberField
            label="Amount"
            value={values.rupees}
            onChange={(v) => set('rupees', v)}
            min={1}
            suffix="rupees"
          />
        ),
        body: (values) => {
          const amountPaise = rupeesInputToPaise(values.rupees);
          if (!amountPaise) throw new Error('Enter the amount in rupees');
          return { amountPaise };
        },
      },
      release: {
        title: 'Release the hold to the dealer',
        description:
          'Use only when the purchase is confirmed outside the app. The dealer receives the money.',
        confirmLabel: 'Release to dealer',
        danger: true,
        path: `payments/${payment.id}/release-hold`,
      },
      reverse: {
        title: 'Take the transfer back',
        description: 'The held money returns to SaathMein so it can be refunded or moved.',
        confirmLabel: 'Reverse transfer',
        path: `payments/${payment.id}/reverse-hold`,
      },
    };
    const config = configs[kind];
    setDialog({
      ...config,
      onConfirm: (values) =>
        action.mutateAsync({
          path: config.path,
          body: { ...(config.body ? config.body(values) : {}), reason: values.reason },
        }),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Payments"
        description="Razorpay payments, refunds and dealer transfers. Today unless you pick dates."
        live
        actions={
          <div className="flex flex-wrap items-end gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              From
              <input
                type="date"
                value={range.from}
                onChange={(event) => setRange({ ...range, from: event.target.value })}
                className={dateClass}
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted">
              To
              <input
                type="date"
                value={range.to}
                onChange={(event) => setRange({ ...range, to: event.target.value })}
                className={dateClass}
              />
            </label>
          </div>
        }
      />

      <QueryState query={summary} skeletonClass="h-64">
        {data ? (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
              <StatTile
                label="Captured"
                value={data.captured}
                hint={formatINR(data.capturedPaise)}
                icon={CreditCard}
              />
              <StatTile
                label="Failed"
                value={data.failed}
                icon={TriangleAlert}
                tone={data.failed ? 'warning' : 'default'}
              />
              <StatTile
                label="Success rate"
                value={data.successRateBps != null ? formatBps(data.successRateBps) : '—'}
                tone={
                  data.successRateBps != null && data.successRateBps < 9000 ? 'danger' : 'default'
                }
              />
              <StatTile
                label="With SaathMein"
                value={formatINR(data.tokensWithSaathMein.paise)}
                hint={`${data.tokensWithSaathMein.count} tokens`}
                icon={Wallet}
              />
              <StatTile
                label="Refunds pending"
                value={data.refunds.pending.count}
                hint={formatINR(data.refunds.pending.paise)}
                icon={RotateCcw}
              />
              <StatTile
                label="Refunds failed"
                value={data.refunds.failed.count}
                hint={formatINR(data.refunds.failed.paise)}
                tone={data.refunds.failed.count ? 'danger' : 'default'}
              />
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Panel title="By payment method">
                {data.byMethod.length ? (
                  <ul className="flex flex-col gap-2 text-sm">
                    {data.byMethod.map((row) => (
                      <li key={row.method} className="flex items-center gap-3">
                        <span className="flex-1 font-semibold uppercase text-ink">
                          {row.method}
                        </span>
                        <span className="font-mono text-muted">
                          {row.captured} / {row.captured + row.failed}
                        </span>
                        <span className="w-16 text-right font-mono text-ink">
                          {row.successRateBps != null ? formatBps(row.successRateBps) : '—'}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted">No payments in this range.</p>
                )}
              </Panel>
              <Panel title="Dealer transfers (Route)">
                <dl className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ['On hold', data.transfers.onHold],
                    ['Released', data.transfers.released],
                    ['Reversed', data.transfers.reversed],
                    ['Failed', data.transfers.failed],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-button bg-bg-band p-3">
                      <dt className="text-xs font-semibold text-muted">{label}</dt>
                      <dd
                        className={cn(
                          'font-mono font-bold text-ink',
                          label === 'Failed' && value.count && 'text-danger',
                        )}
                      >
                        {value.count}
                      </dd>
                      <dd className="font-mono text-xs text-muted">{formatINR(value.paise)}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              <Panel title="Webhooks and reconciliation">
                {data.reconciliation ? (
                  <p className="flex items-start gap-2 text-sm text-ink">
                    {data.reconciliation.unresolved ? (
                      <TriangleAlert
                        className="mt-0.5 size-4 shrink-0 text-danger"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    ) : (
                      <CircleCheck
                        className="mt-0.5 size-4 shrink-0 text-muted"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    )}
                    <span>
                      Last reconciliation {data.reconciliation.day}:{' '}
                      {data.reconciliation.mismatches} mismatches, {data.reconciliation.unresolved}{' '}
                      need a look.
                    </span>
                  </p>
                ) : (
                  <p className="text-sm text-muted">No reconciliation has run yet.</p>
                )}
                <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-muted">
                  Failed webhooks
                </p>
                {data.webhookFailures.length ? (
                  <ul className="mt-1 flex flex-col gap-1 text-xs">
                    {data.webhookFailures.slice(0, 6).map((event) => (
                      <li key={event.eventId} className="truncate text-ink">
                        <span className="font-mono">{event.event || event.eventId}</span>
                        <span className="text-muted"> · {formatDateTime(event.at)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted">None</p>
                )}
              </Panel>
            </div>
          </div>
        ) : null}
      </QueryState>

      <Panel
        title="Payments to act on"
        actions={
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search by Razorpay payment or order id</span>
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
              placeholder="pay_... or order_..."
              className="min-h-11 w-full rounded-button border border-line bg-surface pl-9 pr-3 font-mono text-sm text-ink focus:border-primary focus:outline-none"
            />
          </label>
        }
      >
        <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Payment views">
          {VIEWS.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={view === value}
              onClick={() => {
                setView(value);
                setPage(1);
              }}
              className={cn(
                'min-h-11 rounded-full px-4 text-sm font-semibold',
                view === value
                  ? 'bg-primary/10 text-primary'
                  : 'border border-line text-ink hover:bg-bg-band',
              )}
            >
              {label}
            </button>
          ))}
        </div>
        <QueryState
          query={payments}
          isEmpty={payments.data?.payments.length === 0}
          emptyText="No payments in this view"
        >
          <TableWrap minWidth={920} dim={payments.isFetching}>
            <TableHead
              columns={['Payment', 'Amount', 'Status', 'Refunds', 'Dealer transfer', 'Actions']}
            />
            <tbody className="divide-y divide-line">
              {(payments.data?.payments || []).map((payment) => {
                const failedRefund = payment.refunds.some((refund) => refund.status === 'failed');
                const held = ['pending', 'processed'].includes(payment.transfer?.status);
                const canRefund =
                  ['paid', 'partially_refunded'].includes(payment.status) &&
                  !held &&
                  refundable(payment) > 0;
                return (
                  <tr key={payment.id}>
                    <td className="px-4 py-3">
                      <p className="font-mono text-xs text-ink">
                        {payment.razorpayPaymentId || 'Not captured'}
                      </p>
                      <p className="text-xs text-muted">
                        {(payment.method || '—').toUpperCase()} · {formatDateTime(payment.paidAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3 font-mono text-ink">
                      {formatINR(payment.amountPaise)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={payment.status === 'failed' ? 'danger' : 'muted'}>
                        {payment.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {payment.refunds.length
                        ? payment.refunds.map((refund, index) => (
                            <p
                              key={`${refund.reason}-${index}`}
                              className={refund.status === 'failed' ? 'text-danger' : 'text-ink'}
                            >
                              <span className="font-mono">{formatINR(refund.amountPaise)}</span>{' '}
                              {refund.status} · {refund.reason.replace(/_/g, ' ')}
                            </p>
                          ))
                        : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink">
                      {payment.transfer ? (
                        <>
                          <span className="font-mono">
                            {formatINR(payment.transfer.amountPaise)}
                          </span>{' '}
                          {payment.transfer.status}
                        </>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        {failedRefund ? (
                          <Button variant="secondary" onClick={() => open(payment, 'retry')}>
                            <RotateCcw className="size-4" strokeWidth={2} aria-hidden="true" />
                            Retry
                          </Button>
                        ) : null}
                        {canRefund ? (
                          <Button variant="secondary" onClick={() => open(payment, 'refund')}>
                            <Undo2 className="size-4" strokeWidth={2} aria-hidden="true" />
                            Refund
                          </Button>
                        ) : null}
                        {held ? (
                          <>
                            <Button variant="secondary" onClick={() => open(payment, 'reverse')}>
                              Reverse
                            </Button>
                            <Button variant="secondary" onClick={() => open(payment, 'release')}>
                              Release
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        </QueryState>
        <div className="mt-3">
          <Pager meta={payments.data?.meta} page={page} onPage={setPage} noun="payments" />
        </div>
      </Panel>

      <ReasonDialog
        action={dialog}
        onConfirm={(values) => dialog.onConfirm(values)}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}
