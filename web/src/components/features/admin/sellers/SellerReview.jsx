'use client';

/**
 * SellerReview — Admin → Sellers → one dealer (TRU-1): business details, private document
 * previews (links expire after 10 minutes), Razorpay payout account status, approve or
 * send back with a reason, and the activity from the audit log (Owner / Admin).
 */
import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  FileText,
  History,
  Loader2,
  RefreshCw,
  Undo2,
} from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { useAdminAuth } from '@/context/AdminAuthContext';
import {
  useAdminSeller,
  useApproveKyc,
  useAuditLogs,
  useRejectKyc,
  useRetryPayoutSetup,
} from '@/hooks/useAdminSellers';
import {
  BUSINESS_TYPE_OPTIONS,
  KYC_DOC_LABELS,
  KYC_STATUS_META,
  PAYOUT_STATUS_LABELS,
} from '@/utils/constants';
import SellerPenalties from '@/components/features/admin/sellers/SellerPenalties';

const ACTION_LABELS = {
  'seller.kyc.approve': 'Approved KYC',
  'seller.kyc.reject': 'Sent KYC back',
  'seller.razorpay.retry': 'Retried payout setup',
};

/** Label / value row. */
function Field({ label, children, mono = false }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd
        className={
          mono ? 'break-all font-mono font-semibold text-ink' : 'break-words font-semibold text-ink'
        }
      >
        {children || '—'}
      </dd>
    </div>
  );
}

/** Card section. */
function Card({ title, children, action }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-ink">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Activity from the audit log (only Owner and Admin may read it). */
function Activity({ sellerId }) {
  const { data, isPending, isError, error } = useAuditLogs({
    targetType: 'seller',
    targetId: sellerId,
    limit: 20,
  });
  if (isPending) return <div className="h-16 animate-pulse rounded-button bg-bg-band" />;
  if (isError) return <Alert>{error.message}</Alert>;
  if (!data.entries.length) return <p className="text-sm text-muted">No staff actions yet.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {data.entries.map((entry) => (
        <li key={entry.id} className="flex gap-3 text-sm">
          <History
            className="mt-0.5 size-4 shrink-0 text-muted"
            strokeWidth={2}
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="font-semibold text-ink">
              {ACTION_LABELS[entry.action] || entry.action}
              <span className="font-normal text-muted"> by {entry.actor?.name || 'Unknown'}</span>
            </p>
            {entry.reason ? <p className="text-muted">{entry.reason}</p> : null}
            <p className="text-xs text-muted">
              {new Date(entry.createdAt).toLocaleString('en-IN')}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * @param {Object} props
 * @param {string} props.sellerId - Seller id
 * @returns {JSX.Element}
 */
export default function SellerReview({ sellerId }) {
  const { staff } = useAdminAuth();
  const { data: seller, isPending, isError, error, refetch } = useAdminSeller(sellerId);
  const approve = useApproveKyc();
  const reject = useRejectKyc();
  const retry = useRetryPayoutSetup();
  const [mode, setMode] = useState(null); // 'approve' | 'reject' | null
  const [note, setNote] = useState('');
  const canSeeAudit = ['owner', 'admin'].includes(staff.role);

  if (isPending) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true">
        <div className="h-8 w-64 animate-pulse rounded-button bg-surface" />
        <div className="h-48 animate-pulse rounded-card bg-surface" />
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert>{error.message}</Alert>
        <Button variant="secondary" onClick={() => refetch()}>
          <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
          Try again
        </Button>
      </div>
    );
  }

  const kyc = KYC_STATUS_META[seller.kyc.status] || KYC_STATUS_META.not_submitted;
  const isPendingReview = seller.kyc.status === 'pending';
  const payoutReady =
    seller.razorpay.accountId &&
    !['not_started', 'failed'].includes(seller.razorpay.status) &&
    seller.razorpay.settlementsConfigured;
  const businessType = BUSINESS_TYPE_OPTIONS.find(
    (option) => option.value === seller.businessType,
  )?.label;
  const actionError = approve.error || reject.error;

  /** Approve or send back. */
  const handleDecision = (event) => {
    event.preventDefault();
    const done = { onSuccess: () => setMode(null) };
    if (mode === 'approve') approve.mutate({ sellerId, note: note.trim() || undefined }, done);
    if (mode === 'reject') reject.mutate({ sellerId, reason: note.trim() }, done);
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/sellers"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
          Sellers
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{seller.businessName}</h1>
          <Badge tone={kyc.tone}>{kyc.label}</Badge>
        </div>
        {seller.kyc.submittedAt ? (
          <p className="mt-1 text-sm text-muted">
            Submitted {new Date(seller.kyc.submittedAt).toLocaleString('en-IN')}
          </p>
        ) : null}
      </div>

      {seller.kyc.status === 'rejected' && seller.kyc.rejectionReason ? (
        <Alert tone="warning">Sent back: {seller.kyc.rejectionReason}</Alert>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <Card title="Business">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Legal name">{seller.businessName}</Field>
              <Field label="Business type">{businessType}</Field>
              <Field label="GSTIN" mono>
                {seller.gstin}
              </Field>
              <Field label="PAN" mono>
                {seller.pan}
              </Field>
              <Field label="Contact person">{seller.contactName}</Field>
              <Field label="Business mobile">{seller.contactPhone}</Field>
              <Field label="Owner login">
                {seller.owner?.email}
                {seller.owner && !seller.owner.emailVerified ? ' (not verified)' : ''}
              </Field>
              <Field label="Shop address">
                {seller.address
                  ? [
                      seller.address.line1,
                      seller.address.line2,
                      seller.address.area,
                      seller.address.state,
                      seller.address.pincode,
                    ]
                      .filter(Boolean)
                      .join(', ')
                  : null}
              </Field>
            </dl>
          </Card>

          <Card title="Documents">
            {seller.kyc.documents.length ? (
              <ul className="flex flex-col gap-2">
                {seller.kyc.documents.map((doc) => (
                  <li key={doc.id}>
                    <a
                      href={doc.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex min-h-11 items-center gap-3 rounded-button border border-line px-4 py-2 hover:bg-bg-band"
                    >
                      <FileText
                        className="size-5 shrink-0 text-muted"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                        {KYC_DOC_LABELS[doc.type] || doc.type}
                      </span>
                      <span className="text-xs uppercase text-muted">{doc.format}</span>
                      <ExternalLink
                        className="size-4 shrink-0 text-muted"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No documents uploaded yet.</p>
            )}
            <p className="mt-3 text-xs text-muted">
              Links work for 10 minutes. Reload the page for new ones.
            </p>
          </Card>

          {seller.kyc.status === 'approved' || seller.penalties?.length ? (
            <Card title="Penalties">
              <SellerPenalties sellerId={sellerId} penalties={seller.penalties} />
            </Card>
          ) : null}

          {canSeeAudit ? (
            <Card title="Activity">
              <Activity sellerId={sellerId} />
            </Card>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card
            title="Payouts (Razorpay Route)"
            action={
              seller.kyc.status !== 'not_submitted' ? (
                <Button
                  variant="ghost"
                  onClick={() => retry.mutate({ sellerId })}
                  disabled={retry.isPending}
                  aria-label="Retry payout setup"
                >
                  {retry.isPending ? (
                    <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
                  ) : (
                    <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
                  )}
                  <span className="hidden sm:inline">Retry</span>
                </Button>
              ) : null
            }
          >
            <dl className="flex flex-col gap-3">
              <Field label="Status">
                {PAYOUT_STATUS_LABELS[seller.razorpay.status] || seller.razorpay.status}
              </Field>
              <Field label="Linked account" mono>
                {seller.razorpay.accountId}
              </Field>
              <Field label="Bank">
                {seller.bank
                  ? `${seller.bank.beneficiaryName} · ${seller.bank.ifsc} · ending ${seller.bank.accountLast4}`
                  : null}
              </Field>
            </dl>
            {seller.razorpay.lastError ? (
              <Alert className="mt-3">{seller.razorpay.lastError}</Alert>
            ) : null}
            {retry.isError ? <Alert className="mt-3">{retry.error.message}</Alert> : null}
          </Card>

          {isPendingReview ? (
            <Card title="Decision">
              {mode ? (
                <form onSubmit={handleDecision} className="flex flex-col gap-3">
                  <Textarea
                    label={mode === 'approve' ? 'Note (optional)' : 'What must the dealer fix?'}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    maxLength={1000}
                    hint={
                      mode === 'reject'
                        ? 'The dealer sees this message. At least 10 characters.'
                        : 'Saved in the audit log.'
                    }
                  />
                  {actionError ? <Alert>{actionError.message}</Alert> : null}
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="submit"
                      disabled={
                        approve.isPending ||
                        reject.isPending ||
                        (mode === 'reject' && note.trim().length < 10)
                      }
                    >
                      {approve.isPending || reject.isPending ? (
                        <Loader2
                          className="size-4 animate-spin"
                          strokeWidth={2}
                          aria-hidden="true"
                        />
                      ) : null}
                      {mode === 'approve' ? 'Confirm approval' : 'Send back to dealer'}
                    </Button>
                    <Button variant="ghost" onClick={() => setMode(null)}>
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="flex flex-col gap-3">
                  {!payoutReady ? (
                    <Alert tone="warning">
                      Approval needs a working Razorpay payout account with a bank. Retry the setup
                      or send the KYC back.
                    </Alert>
                  ) : null}
                  <Button
                    onClick={() => {
                      setNote('');
                      setMode('approve');
                    }}
                    disabled={!payoutReady}
                  >
                    <BadgeCheck className="size-4" strokeWidth={2} aria-hidden="true" />
                    Approve dealer
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setNote('');
                      setMode('reject');
                    }}
                  >
                    <Undo2 className="size-4" strokeWidth={2} aria-hidden="true" />
                    Send back with reason
                  </Button>
                </div>
              )}
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
