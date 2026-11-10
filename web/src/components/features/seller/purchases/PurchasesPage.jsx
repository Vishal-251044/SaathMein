'use client';

/**
 * PurchasesPage — dealer Purchases (PRD §10.10, PUR-2/PUR-3): scan the buyer's QR with
 * the camera or type the deal code, check the buyer, price and amount to collect, then
 * confirm the sale (releases the held token to the business). Lists open and finished
 * purchases; buyer invoices can be opened and objected to within 48 h.
 */
import { useCallback, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  FileText,
  Flag,
  Loader2,
  RefreshCw,
  Search,
  ShoppingBag,
} from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import FadeIn from '@/components/animations/FadeIn';
import QrScanner from '@/components/features/seller/purchases/QrScanner';
import {
  useConfirmPurchase,
  useInvoiceUrl,
  useLookupPurchase,
  useObjectToInvoice,
  useSellerPurchases,
} from '@/hooks/useSellerPurchases';
import { cn, formatDateTime, formatINR } from '@/utils/genericFunctions';

const TABS = [
  { key: 'open', label: 'To complete' },
  { key: 'completed', label: 'Completed' },
  { key: '', label: 'All' },
];

const STATUS = {
  pending: { label: 'Code issued', tone: 'muted' },
  invoice_uploaded: { label: 'Invoice uploaded', tone: 'warning' },
  objected: { label: 'You objected', tone: 'danger' },
  completed: { label: 'Completed', tone: 'brand' },
  expired: { label: 'Expired', tone: 'muted' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

/** Buyer, product and money for one code (scan result or list row). */
function PurchaseSummary({ purchase }) {
  return (
    <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
      <div>
        <dt className="text-muted">Buyer</dt>
        <dd className="font-semibold text-ink">{purchase.buyerFirstName || 'Member'}</dd>
      </div>
      <div>
        <dt className="text-muted">Price (all-inclusive)</dt>
        <dd className="font-mono font-semibold text-ink">{formatINR(purchase.pricePaise)}</dd>
      </div>
      <div>
        <dt className="text-muted">Token paid online</dt>
        <dd className="font-mono text-ink">{formatINR(purchase.tokenPaise)}</dd>
      </div>
      <div>
        <dt className="text-muted">Collect at the shop</dt>
        <dd className="font-mono font-bold text-ink">{formatINR(purchase.payAtShopPaise)}</dd>
      </div>
    </dl>
  );
}

/** Scan / type a code → preview → confirm. */
function ConfirmPanel() {
  const [code, setCode] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const lookup = useLookupPurchase();
  const confirm = useConfirmPurchase();
  const found = lookup.data;
  const canConfirm = found && ['pending', 'invoice_uploaded', 'objected'].includes(found.status);

  // mutate / reset are stable, so the camera is not restarted on every render
  const { mutate: lookupCode } = lookup;
  const { reset: resetConfirm } = confirm;
  const find = useCallback(
    (text) => {
      resetConfirm();
      setCode(text);
      lookupCode(text);
    },
    [lookupCode, resetConfirm],
  );
  const onScanned = useCallback(
    (text) => {
      setIsScanning(false);
      find(text);
    },
    [find],
  );

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-bold text-ink">Confirm a sale</h2>
      <p className="mt-0.5 text-sm text-muted">
        Scan the buyer&apos;s QR or type their 10-character deal code.
      </p>
      {isScanning ? (
        <div className="mt-4">
          <QrScanner onCode={onScanned} onClose={() => setIsScanning(false)} />
        </div>
      ) : (
        <form
          className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) find(code.trim());
          }}
        >
          <div className="flex-1">
            <Input
              label="Deal code"
              value={code.startsWith('SM1.') ? 'Scanned QR' : code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="e.g. 7KQ2M9XHPA"
              autoComplete="off"
              className="font-mono tracking-wider"
            />
          </div>
          <Button type="submit" variant="secondary" disabled={!code.trim() || lookup.isPending}>
            {lookup.isPending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Search className="size-4" strokeWidth={2} aria-hidden="true" />
            )}
            Check code
          </Button>
          <Button onClick={() => setIsScanning(true)}>
            <Camera className="size-4" strokeWidth={2} aria-hidden="true" />
            Scan QR
          </Button>
        </form>
      )}

      {lookup.isError ? <Alert className="mt-4">{lookup.error.message}</Alert> : null}
      {found ? (
        <div className="mt-4 flex flex-col gap-4 rounded-button bg-bg-band p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="font-bold text-ink">{found.productName}</p>
              <p className="text-sm text-muted">
                {found.variantName || 'Any variant'} · code{' '}
                <span className="font-mono">{found.dealCode}</span> · valid until{' '}
                {formatDateTime(found.validUntil)}
              </p>
            </div>
            <Badge tone={(STATUS[found.status] || STATUS.pending).tone}>
              {(STATUS[found.status] || STATUS.pending).label}
            </Badge>
          </div>
          <PurchaseSummary purchase={found} />
          {confirm.isSuccess ? (
            <Alert tone="info">
              Sale confirmed. The buyer&apos;s token is released to your account (minus commission).
            </Alert>
          ) : canConfirm ? (
            <Button
              className="self-start"
              disabled={confirm.isPending}
              onClick={() => confirm.mutate(code)}
            >
              {confirm.isPending ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" strokeWidth={2} aria-hidden="true" />
              )}
              Confirm sale of {formatINR(found.pricePaise)}
            </Button>
          ) : null}
          {confirm.isError ? <Alert>{confirm.error.message}</Alert> : null}
        </div>
      ) : null}
    </section>
  );
}

/** Open the private invoice / object to it. */
function InvoiceActions({ purchase }) {
  const invoiceUrl = useInvoiceUrl();
  const object = useObjectToInvoice();
  const [isObjecting, setIsObjecting] = useState(false);
  const [reason, setReason] = useState('');
  const canObject = purchase.status === 'invoice_uploaded';

  const openInvoice = () =>
    invoiceUrl.mutate(purchase.id, {
      onSuccess: (url) => window.open(url, '_blank', 'noopener,noreferrer'),
    });

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={openInvoice} disabled={invoiceUrl.isPending}>
          <FileText className="size-4" strokeWidth={2} aria-hidden="true" />
          View invoice
        </Button>
        {canObject && !isObjecting ? (
          <Button variant="ghost" className="text-danger" onClick={() => setIsObjecting(true)}>
            <Flag className="size-4" strokeWidth={2} aria-hidden="true" />
            Object
          </Button>
        ) : null}
      </div>
      {purchase.autoCompleteAt ? (
        <p className="text-sm text-muted">
          Completes automatically on {formatDateTime(purchase.autoCompleteAt)} unless you object.
        </p>
      ) : null}
      {isObjecting ? (
        <div className="flex flex-col gap-2">
          <Textarea
            label="What is wrong with this invoice?"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={2}
          />
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsObjecting(false)}>
              Cancel
            </Button>
            <Button
              disabled={reason.trim().length < 10 || object.isPending}
              onClick={() => object.mutate({ purchaseId: purchase.id, reason: reason.trim() })}
            >
              Send objection
            </Button>
          </div>
        </div>
      ) : null}
      {invoiceUrl.isError ? <Alert>{invoiceUrl.error.message}</Alert> : null}
      {object.isError ? <Alert>{object.error.message}</Alert> : null}
    </div>
  );
}

/** @returns {JSX.Element} */
export default function PurchasesPage() {
  const [tab, setTab] = useState('open');
  const [page, setPage] = useState(1);
  const query = useSellerPurchases(tab, page);
  const purchases = query.data?.purchases || [];
  const meta = query.data?.meta;

  return (
    <div className="flex flex-col gap-6">
      <FadeIn>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Purchases</h1>
        <p className="mt-1 text-muted">
          Members of groups you won buy at your price with their deal code.
        </p>
      </FadeIn>

      <ConfirmPanel />

      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Purchase lists">
        {TABS.map((item) => (
          <button
            key={item.key || 'all'}
            type="button"
            role="tab"
            aria-selected={item.key === tab}
            onClick={() => {
              setTab(item.key);
              setPage(1);
            }}
            className={cn(
              'inline-flex min-h-11 items-center whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors duration-150',
              item.key === tab
                ? 'bg-primary/10 text-primary'
                : 'bg-bg-band text-muted hover:text-ink',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {query.isPending ? (
        <div className="h-48 animate-pulse rounded-card bg-bg-band" aria-busy="true" />
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{query.error.message}</Alert>
          <Button variant="secondary" onClick={() => query.refetch()}>
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : purchases.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface p-10 text-center">
          <ShoppingBag className="size-8 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="max-w-md text-muted">
            {tab === 'open'
              ? 'No purchases to complete. Members of groups you win appear here.'
              : 'Nothing here yet.'}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {purchases.map((purchase) => {
            const status = STATUS[purchase.status] || STATUS.pending;
            return (
              <li
                key={purchase.id}
                className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4 shadow-card sm:p-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-ink">{purchase.productName}</p>
                    <p className="text-sm text-muted">
                      <span className="font-mono">{purchase.dealCode}</span> ·{' '}
                      {purchase.completedAt
                        ? `completed ${formatDateTime(purchase.completedAt)}`
                        : `valid until ${formatDateTime(purchase.validUntil)}`}
                    </p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </div>
                <PurchaseSummary purchase={purchase} />
                {purchase.hasInvoice ? <InvoiceActions purchase={purchase} /> : null}
                {purchase.objection ? (
                  <p className="text-sm text-muted">Your objection: {purchase.objection.reason}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
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
    </div>
  );
}
