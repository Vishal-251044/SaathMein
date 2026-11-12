'use client';

/**
 * CommissionInvoiceView — a monthly GST commission invoice (F17), shared by the dealer
 * Payouts page and Admin → Commissions. Print-ready: "Print or save as PDF" uses the
 * browser's print dialog (decided 9 Nov 2026: no PDF library); the dashboard chrome is
 * hidden when printing.
 */
import Link from 'next/link';
import { ArrowLeft, Printer, RefreshCw } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatBps, formatDateTime, formatINR } from '@/utils/genericFunctions';

/** @param {{ label: string, value: string, strong?: boolean }} props */
function TotalRow({ label, value, strong }) {
  return (
    <div className="flex justify-between gap-6 py-1.5">
      <dt className={strong ? 'font-bold text-ink' : 'text-muted'}>{label}</dt>
      <dd className={strong ? 'font-mono font-bold text-ink' : 'font-mono text-ink'}>{value}</dd>
    </div>
  );
}

/** Month label, e.g. "October 2026". */
const monthLabel = (key) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, 15)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
};

/**
 * @param {{ query: import('@tanstack/react-query').UseQueryResult, backHref: string }} props
 * @returns {JSX.Element}
 */
export default function CommissionInvoiceView({ query, backHref }) {
  if (query.isPending) {
    return <div className="h-[32rem] animate-pulse rounded-card bg-bg-band" aria-busy="true" />;
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
  const invoice = query.data;
  const { gst } = invoice;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={backHref}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
          Back
        </Link>
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer className="size-4" strokeWidth={2} aria-hidden="true" />
          Print or save as PDF
        </Button>
      </div>

      <article className="rounded-card border border-line bg-surface p-5 text-sm shadow-card sm:p-8 print:border-0 print:p-0 print:shadow-none">
        <header className="flex flex-col gap-4 border-b border-line pb-5 sm:flex-row sm:justify-between">
          <div>
            <p className="text-xl font-extrabold tracking-tight text-ink">Tax invoice</p>
            <p className="mt-1 font-mono text-ink">{invoice.invoiceNo}</p>
            <p className="text-muted">Issued {formatDateTime(invoice.issuedAt)}</p>
            <p className="text-muted">Commission for {monthLabel(invoice.period.key)}</p>
          </div>
          <div className="sm:text-right">
            <Badge tone={invoice.status === 'paid' ? 'brand' : 'muted'}>
              {invoice.status === 'paid' ? 'Paid' : 'Issued'}
            </Badge>
          </div>
        </header>

        <section className="grid gap-5 border-b border-line py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">From</p>
            <p className="mt-1 font-bold text-ink">{invoice.supplier.legalName}</p>
            {invoice.supplier.address ? (
              <p className="text-muted">{invoice.supplier.address}</p>
            ) : null}
            <p className="text-muted">GSTIN {invoice.supplier.gstin || 'not set'}</p>
            {invoice.supplier.sacCode ? (
              <p className="text-muted">SAC {invoice.supplier.sacCode}</p>
            ) : null}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">To</p>
            <p className="mt-1 font-bold text-ink">{invoice.recipient.businessName}</p>
            {invoice.recipient.address ? (
              <p className="text-muted">{invoice.recipient.address}</p>
            ) : null}
            {invoice.recipient.gstin ? (
              <p className="text-muted">GSTIN {invoice.recipient.gstin}</p>
            ) : null}
          </div>
        </section>

        <div className="overflow-x-auto py-5">
          <table className="w-full min-w-[560px] text-left">
            <thead className="text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="py-2 pr-3">
                  Purchase
                </th>
                <th scope="col" className="py-2 pr-3">
                  Date
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Price
                </th>
                <th scope="col" className="py-2 pr-3 text-right">
                  Commission
                </th>
                <th scope="col" className="py-2 text-right">
                  Kept from token
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {invoice.lines.map((line, index) => (
                <tr key={`${line.completedAt}-${index}`}>
                  <td className="py-2 pr-3 text-ink">{line.productName}</td>
                  <td className="py-2 pr-3 text-muted">{formatDateTime(line.completedAt)}</td>
                  <td className="py-2 pr-3 text-right font-mono">{formatINR(line.pricePaise)}</td>
                  <td className="py-2 pr-3 text-right font-mono">
                    {formatINR(line.commissionPaise)}
                  </td>
                  <td className="py-2 text-right font-mono">{formatINR(line.fromTokenPaise)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <dl className="ml-auto max-w-sm border-t border-line pt-4">
          <TotalRow label="Commission (taxable value)" value={formatINR(invoice.taxablePaise)} />
          {gst.intraState ? (
            <>
              <TotalRow
                label={`CGST ${formatBps(gst.rateBps / 2)}`}
                value={formatINR(gst.cgstPaise)}
              />
              <TotalRow
                label={`SGST ${formatBps(gst.rateBps / 2)}`}
                value={formatINR(gst.sgstPaise)}
              />
            </>
          ) : (
            <TotalRow label={`IGST ${formatBps(gst.rateBps)}`} value={formatINR(gst.igstPaise)} />
          )}
          <TotalRow label="Invoice total" value={formatINR(invoice.totalPaise)} strong />
          <TotalRow
            label="Already kept from buyers' tokens"
            value={`− ${formatINR(invoice.fromTokensPaise)}`}
          />
          {invoice.recoveries?.length
            ? invoice.recoveries.map((item, index) => (
                <TotalRow
                  key={`${item.createdAt}-${index}`}
                  label={`${item.reason} (no GST)`}
                  value={`+ ${formatINR(item.amountPaise)}`}
                />
              ))
            : null}
          <TotalRow label="Balance due" value={formatINR(invoice.balanceDuePaise)} strong />
        </dl>
      </article>
    </div>
  );
}
