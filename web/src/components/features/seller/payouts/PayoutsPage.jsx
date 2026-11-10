'use client';

/**
 * PayoutsPage — dealer Payouts (PRD §10.10): money from buyers' tokens on hold until each
 * purchase is confirmed, released, or taken back; bank settlements from Razorpay; monthly
 * commission invoices (GST). Read-only.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, FileText, Landmark, RefreshCw, Wallet } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import FadeIn from '@/components/animations/FadeIn';
import { useSellerPayouts } from '@/hooks/useSellerPurchases';
import { ROUTES } from '@/utils/constants';
import { formatDateTime, formatINR } from '@/utils/genericFunctions';

const STATE = {
  on_hold: { label: 'On hold', tone: 'warning' },
  released: { label: 'Released', tone: 'brand' },
  reversed: { label: 'Taken back', tone: 'muted' },
  failed: { label: 'Failed', tone: 'danger' },
};

/** @param {{ label: string, value: number, hint: string }} props */
function Stat({ label, value, hint }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-mono text-2xl font-extrabold text-ink">{formatINR(value)}</p>
      <p className="mt-1 text-xs text-muted">{hint}</p>
    </div>
  );
}

/** @returns {JSX.Element} */
export default function PayoutsPage() {
  const [page, setPage] = useState(1);
  const query = useSellerPayouts(page);

  if (query.isPending) {
    return <div className="h-96 animate-pulse rounded-card bg-bg-band" aria-busy="true" />;
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
  const { totals, transfers, settlements, invoices, meta } = query.data;

  return (
    <div className="flex flex-col gap-6">
      <FadeIn>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Payouts</h1>
        <p className="mt-1 text-muted">
          Each buyer&apos;s token (minus commission) is held for you when you win, and released when
          you confirm that buyer&apos;s purchase.
        </p>
      </FadeIn>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          label="On hold"
          value={totals.onHoldPaise}
          hint="Released when you confirm each sale"
        />
        <Stat
          label="Released"
          value={totals.releasedPaise}
          hint="Paid out to your bank by Razorpay"
        />
        <Stat label="Commission kept" value={totals.commissionPaise} hint="Deducted from tokens" />
      </div>

      <section className="rounded-card border border-line bg-surface shadow-card">
        <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 text-lg font-bold text-ink sm:px-6">
          <Wallet className="size-5" strokeWidth={2} aria-hidden="true" />
          Transfers
        </h2>
        {transfers.length === 0 ? (
          <p className="px-5 py-6 text-muted sm:px-6">
            No transfers yet. Win a group to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted">
                <tr>
                  <th scope="col" className="px-5 py-3">
                    Product
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Token
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    Commission
                  </th>
                  <th scope="col" className="px-3 py-3 text-right">
                    To you
                  </th>
                  <th scope="col" className="px-3 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {transfers.map((transfer) => {
                  const state = STATE[transfer.state] || STATE.on_hold;
                  return (
                    <tr key={transfer.id}>
                      <td className="px-5 py-3 text-ink">{transfer.productName || '—'}</td>
                      <td className="px-3 py-3 text-right font-mono">
                        {formatINR(transfer.tokenPaise)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono">
                        {formatINR(transfer.commissionPaise)}
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-semibold">
                        {formatINR(transfer.amountPaise)}
                      </td>
                      <td className="px-3 py-3">
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </td>
                      <td className="px-5 py-3 text-muted">
                        {formatDateTime(transfer.releasedAt || transfer.updatedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {meta && meta.totalPages > 1 ? (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 sm:px-6">
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
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-card border border-line bg-surface shadow-card">
          <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 text-lg font-bold text-ink">
            <FileText className="size-5" strokeWidth={2} aria-hidden="true" />
            Commission invoices
          </h2>
          {invoices.length === 0 ? (
            <p className="px-5 py-6 text-muted">Invoices are issued on the 1st of each month.</p>
          ) : (
            <ul className="divide-y divide-line">
              {invoices.map((invoice) => (
                <li key={invoice.id}>
                  <Link
                    href={`${ROUTES.SELLER_INVOICES}/${invoice.id}`}
                    className="flex min-h-11 items-center justify-between gap-3 px-5 py-3 hover:bg-bg-band"
                  >
                    <span>
                      <span className="block font-mono text-sm font-semibold text-ink">
                        {invoice.invoiceNo}
                      </span>
                      <span className="text-xs text-muted">{invoice.period.key}</span>
                    </span>
                    <span className="text-right">
                      <span className="block font-mono text-sm text-ink">
                        {formatINR(invoice.totalPaise)}
                      </span>
                      <span className="text-xs text-muted">
                        Due {formatINR(invoice.balanceDuePaise)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-card border border-line bg-surface shadow-card">
          <h2 className="flex items-center gap-2 border-b border-line px-5 py-4 text-lg font-bold text-ink">
            <Landmark className="size-5" strokeWidth={2} aria-hidden="true" />
            Bank settlements
          </h2>
          {settlements.length === 0 ? (
            <p className="px-5 py-6 text-muted">Razorpay settlements to your bank appear here.</p>
          ) : (
            <ul className="divide-y divide-line">
              {settlements.map((settlement) => (
                <li
                  key={settlement.id}
                  className="flex items-center justify-between gap-3 px-5 py-3 text-sm"
                >
                  <span>
                    <span className="block text-ink">{formatDateTime(settlement.settledAt)}</span>
                    <span className="font-mono text-xs text-muted">{settlement.utr || '—'}</span>
                  </span>
                  <span className="font-mono font-semibold text-ink">
                    {formatINR(settlement.amountPaise)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
