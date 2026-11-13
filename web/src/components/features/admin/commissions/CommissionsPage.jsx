'use client';

/**
 * CommissionsPage — Admin → Commissions (PRD §10.11, F17): commission per completed
 * purchase with totals (GMV, commission, kept from tokens, still to invoice), filters by
 * city, category and date, CSV export (MON-1), and the monthly GST invoices with
 * "Issue invoices" for a finished month. Owner, Admin, Finance.
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Loader2,
  Receipt,
  RefreshCw,
} from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import {
  useAdminCommissionInvoices,
  useAdminCommissions,
  useCommissionFilterOptions,
  useGenerateInvoices,
} from '@/hooks/useAdminCommissions';
import { downloadCommissionsCsv } from '@/services/adminCommissions.service';
import { cn, formatBps, formatDateTime, formatINR } from '@/utils/genericFunctions';

const PAGE_SIZE = 25;
const fieldClass =
  'min-h-11 w-full rounded-button border border-line bg-surface px-3 text-sm text-ink focus:border-primary focus:outline-none';

/** Last finished month as "YYYY-MM" (browser time; the API checks it in IST). */
const lastMonth = () => {
  const date = new Date();
  date.setDate(1);
  date.setMonth(date.getMonth() - 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
};

/** @param {{ label: string, children: React.ReactNode }} props */
function Filter({ label, children }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold text-muted">
      {label}
      {children}
    </label>
  );
}

/** @param {{ label: string, value: string }} props */
function Total({ label, value }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-mono text-xl font-extrabold text-ink">{value}</p>
    </div>
  );
}

/** Monthly invoices + issue a month. */
function InvoicesSection() {
  const [month, setMonth] = useState(lastMonth());
  const invoices = useAdminCommissionInvoices({ month, limit: 50 });
  const generate = useGenerateInvoices();
  const rows = invoices.data?.invoices || [];

  return (
    <section className="rounded-card border border-line bg-surface shadow-card">
      <div className="flex flex-col gap-3 border-b border-line px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 className="flex items-center gap-2 text-lg font-bold text-ink">
          <Receipt className="size-5" strokeWidth={2} aria-hidden="true" />
          Monthly GST invoices
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <Filter label="Month">
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
              className={fieldClass}
            />
          </Filter>
          <Button
            variant="secondary"
            disabled={!month || generate.isPending}
            onClick={() => generate.mutate(month)}
          >
            {generate.isPending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <FileText className="size-4" strokeWidth={2} aria-hidden="true" />
            )}
            Issue invoices
          </Button>
        </div>
      </div>
      <div className="px-5 pt-3">
        {generate.isError ? <Alert>{generate.error.message}</Alert> : null}
        {generate.isSuccess ? (
          <Alert tone="info">
            {generate.data.issued} invoice(s) issued for {generate.data.period}
            {generate.data.failed ? `, ${generate.data.failed} failed (see logs)` : ''}. Invoices
            are also issued automatically at 3 am on the 1st.
          </Alert>
        ) : null}
      </div>
      {invoices.isPending ? (
        <div className="m-5 h-24 animate-pulse rounded-button bg-bg-band" aria-busy="true" />
      ) : invoices.isError ? (
        <div className="p-5">
          <Alert>{invoices.error.message}</Alert>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-5 py-6 text-muted">No invoices for this month.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-5 py-3">
                  Invoice
                </th>
                <th scope="col" className="px-3 py-3">
                  Dealer
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Total
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Balance due
                </th>
                <th scope="col" className="px-5 py-3">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((invoice) => (
                <tr key={invoice.id}>
                  <td className="px-5 py-3">
                    <Link
                      href={`/admin/commissions/invoices/${invoice.id}`}
                      className="font-mono font-semibold text-primary-text hover:underline"
                    >
                      {invoice.invoiceNo}
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-ink">{invoice.recipient.businessName}</td>
                  <td className="px-3 py-3 text-right font-mono">
                    {formatINR(invoice.totalPaise)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono">
                    {formatINR(invoice.balanceDuePaise)}
                  </td>
                  <td className="px-5 py-3">
                    <Badge tone={invoice.status === 'paid' ? 'brand' : 'muted'}>
                      {invoice.status === 'paid' ? 'Paid' : 'Issued'}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

/** @returns {JSX.Element} */
export default function CommissionsPage() {
  const [filters, setFilters] = useState({ cityId: '', categoryId: '', from: '', to: '' });
  const [page, setPage] = useState(1);
  const [csvError, setCsvError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);
  const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value));
  const query = useAdminCommissions({ ...params, page, limit: PAGE_SIZE });
  const options = useCommissionFilterOptions();
  const categories = (options.data?.categories || []).flatMap((parent) => parent.children || []);
  const meta = query.data?.meta;
  const totals = query.data?.totals;

  const set = (key) => (event) => {
    setFilters((prev) => ({ ...prev, [key]: event.target.value }));
    setPage(1);
  };

  const exportCsv = async () => {
    setCsvError(null);
    setIsExporting(true);
    try {
      await downloadCommissionsCsv(params);
    } catch (err) {
      setCsvError(err.message);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Commissions</h1>
          <p className="mt-1 text-muted">
            Earned on every completed purchase. Part is kept from the buyer&apos;s token; the rest
            is billed on the dealer&apos;s monthly GST invoice.
          </p>
        </div>
        <Button variant="secondary" onClick={exportCsv} disabled={isExporting}>
          {isExporting ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Download className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
          Export CSV
        </Button>
      </div>
      {csvError ? <Alert>{csvError}</Alert> : null}

      <div className="grid grid-cols-1 gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
        <Filter label="City">
          <select value={filters.cityId} onChange={set('cityId')} className={fieldClass}>
            <option value="">All cities</option>
            {(options.data?.cities || []).map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Category">
          <select value={filters.categoryId} onChange={set('categoryId')} className={fieldClass}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Filter>
        <Filter label="Completed from">
          <input type="date" value={filters.from} onChange={set('from')} className={fieldClass} />
        </Filter>
        <Filter label="Completed to">
          <input type="date" value={filters.to} onChange={set('to')} className={fieldClass} />
        </Filter>
      </div>

      {totals ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Total label="Purchases value (GMV)" value={formatINR(totals.gmvPaise)} />
          <Total
            label={`Commission (${totals.count} sales)`}
            value={formatINR(totals.commissionPaise)}
          />
          <Total label="Kept from tokens" value={formatINR(totals.fromTokenPaise)} />
          <Total label="To invoice" value={formatINR(totals.invoicedPaise)} />
        </div>
      ) : null}

      {query.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{query.error.message}</Alert>
          <Button variant="secondary" onClick={() => query.refetch()}>
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : query.isPending ? (
        <div className="h-64 animate-pulse rounded-card bg-surface" aria-busy="true" />
      ) : query.data.commissions.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-dashed border-line bg-surface px-6 py-12 text-center">
          <Receipt className="size-8 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-3 font-semibold text-ink">No commissions match these filters</p>
        </div>
      ) : (
        <div
          className={cn(
            'overflow-x-auto rounded-card border border-line bg-surface shadow-card transition-opacity',
            query.isFetching && 'opacity-70',
          )}
        >
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">
                  Completed
                </th>
                <th scope="col" className="px-3 py-3">
                  Dealer
                </th>
                <th scope="col" className="px-3 py-3">
                  Product
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Price
                </th>
                <th scope="col" className="px-3 py-3">
                  Rule
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  Commission
                </th>
                <th scope="col" className="px-3 py-3 text-right">
                  From token
                </th>
                <th scope="col" className="px-4 py-3 text-right">
                  To invoice
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {query.data.commissions.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-muted">{formatDateTime(row.earnedAt)}</td>
                  <td className="px-3 py-3 text-ink">{row.sellerName || '—'}</td>
                  <td className="px-3 py-3 text-ink">{row.productName || '—'}</td>
                  <td className="px-3 py-3 text-right font-mono">{formatINR(row.pricePaise)}</td>
                  <td className="px-3 py-3 text-muted">
                    {row.rule?.type === 'flat'
                      ? `${formatINR(row.rule.value)} flat`
                      : formatBps(row.rule?.value || 0)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono font-semibold">
                    {formatINR(row.commissionPaise)}
                  </td>
                  <td className="px-3 py-3 text-right font-mono">
                    {formatINR(row.fromTokenPaise)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatINR(row.invoicedPaise)}
                    {row.invoiced ? (
                      <span className="ml-1 text-xs text-muted">(billed)</span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {meta && meta.totalPages > 1 ? (
        <div className="flex items-center justify-between gap-3">
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

      <InvoicesSection />
    </div>
  );
}
