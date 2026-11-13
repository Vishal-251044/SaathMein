'use client';

/**
 * SellerDisputesPage — dealer Disputes (TRU-4): buyers' complaints about purchases at the
 * winning price. Answer within 48 hours with an explanation and files (bill, photos);
 * otherwise Support decides without your side. Penalties can follow if the price was not
 * honoured.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Paperclip, RefreshCw, Scale, Send, Loader2 } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import FadeIn from '@/components/animations/FadeIn';
import {
  DISPUTE_TYPE_LABEL,
  DisputeStatusBadge,
  DisputeTimeline,
  EvidenceList,
} from '@/components/features/trust/DisputeParts';
import { useRespondToDispute, useSellerDispute, useSellerDisputes } from '@/hooks/useTrust';
import { uploadSellerEvidence } from '@/services/trust.service';
import { cn, formatDateTime, formatINR } from '@/utils/genericFunctions';

const MAX_FILES = 6;

/** @returns {JSX.Element} Dealer's dispute list */
export function SellerDisputesList() {
  const [status, setStatus] = useState('open');
  const query = useSellerDisputes({ status, limit: 50 });
  return (
    <div className="flex flex-col gap-6">
      <FadeIn>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Disputes</h1>
        <p className="mt-1 text-muted">
          Answer within 48 hours. SaathMein Support decides after that.
        </p>
      </FadeIn>
      <div className="flex gap-2" role="tablist" aria-label="Dispute lists">
        {[
          { key: 'open', label: 'Open' },
          { key: 'resolved', label: 'Decided' },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={tab.key === status}
            onClick={() => setStatus(tab.key)}
            className={cn(
              'inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold',
              tab.key === status
                ? 'bg-primary/10 text-primary-text'
                : 'bg-bg-band text-muted hover:text-ink',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {query.isPending ? (
        <div className="h-40 animate-pulse rounded-card bg-bg-band" aria-busy="true" />
      ) : query.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{query.error.message}</Alert>
          <Button variant="secondary" onClick={() => query.refetch()}>
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : query.data.disputes.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface p-10 text-center">
          <Scale className="size-8 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="text-muted">No disputes. Keep honouring your winning prices.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {query.data.disputes.map((dispute) => (
            <li key={dispute.id}>
              <Link
                href={`/seller/disputes/${dispute.id}`}
                className="flex items-center gap-3 rounded-card border border-line bg-surface p-4 shadow-card hover:shadow-pop"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-ink">{DISPUTE_TYPE_LABEL[dispute.type]}</p>
                    <DisputeStatusBadge status={dispute.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-muted">{dispute.description}</p>
                  {dispute.status === 'awaiting_seller' ? (
                    <p className="mt-1 text-xs font-semibold text-danger-text">
                      Answer by {formatDateTime(dispute.sellerDueAt)}
                    </p>
                  ) : null}
                </div>
                <ChevronRight
                  className="size-5 shrink-0 text-muted"
                  strokeWidth={2}
                  aria-hidden="true"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Answer form with private file uploads. */
function AnswerForm({ dispute }) {
  const respond = useRespondToDispute();
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  const submit = async () => {
    setUploadError(null);
    let evidence = [];
    if (files.length) {
      setIsUploading(true);
      try {
        evidence = await Promise.all(files.map((file) => uploadSellerEvidence(file)));
      } catch (err) {
        setUploadError(err.message);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }
    respond.mutate({ disputeId: dispute.id, text: text.trim(), evidence });
  };

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-bold text-ink">Your answer</h2>
      {dispute.status === 'seller_missed' ? (
        <Alert tone="warning" className="mt-2">
          The 48-hour window has passed. You can still answer; Support will see it was late.
        </Alert>
      ) : (
        <p className="mt-0.5 text-sm text-muted">Due by {formatDateTime(dispute.sellerDueAt)}.</p>
      )}
      <div className="mt-4 flex flex-col gap-3">
        <Textarea
          label="Explain what happened"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          maxLength={2000}
        />
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink">
          <Paperclip className="size-5 text-muted" strokeWidth={2} aria-hidden="true" />
          {files.length
            ? `${files.length} file(s) attached`
            : 'Attach the bill or photos (optional)'}
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,application/pdf"
            className="sr-only"
            onChange={(event) => setFiles([...(event.target.files || [])].slice(0, MAX_FILES))}
          />
        </label>
        {uploadError ? <Alert>{uploadError}</Alert> : null}
        {respond.isError ? <Alert>{respond.error.message}</Alert> : null}
        <Button
          className="self-start"
          disabled={text.trim().length < 10 || respond.isPending || isUploading}
          onClick={submit}
        >
          {respond.isPending || isUploading ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Send className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
          Send answer
        </Button>
      </div>
    </section>
  );
}

/**
 * @param {{ disputeId: string }} props
 * @returns {JSX.Element} One dispute for the dealer
 */
export function SellerDisputeDetail({ disputeId }) {
  const query = useSellerDispute(disputeId);
  if (query.isPending)
    return <div className="h-96 animate-pulse rounded-card bg-bg-band" aria-busy="true" />;
  if (query.isError) return <Alert>{query.error.message}</Alert>;
  const dispute = query.data;
  const canAnswer = ['awaiting_seller', 'seller_missed'].includes(dispute.status);

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/seller/disputes"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
        Back
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {DISPUTE_TYPE_LABEL[dispute.type]}
          </h1>
          <DisputeStatusBadge status={dispute.status} />
        </div>
        <p className="mt-1 text-muted">
          {dispute.productName} · {dispute.buyerFirstName || 'Buyer'} · opened{' '}
          {formatDateTime(dispute.createdAt)}
        </p>
      </div>
      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <h2 className="text-lg font-bold text-ink">The buyer says</h2>
        <p className="mt-2 whitespace-pre-line text-ink">{dispute.description}</p>
        {dispute.quotedPricePaise ? (
          <p className="mt-2 text-sm text-muted">
            Price the buyer says was asked: {formatINR(dispute.quotedPricePaise)}
          </p>
        ) : null}
        <div className="mt-4">
          <EvidenceList evidence={dispute.evidence} />
        </div>
      </section>
      {canAnswer ? (
        <AnswerForm dispute={dispute} />
      ) : dispute.sellerResponse ? (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <h2 className="text-lg font-bold text-ink">Your answer</h2>
          <p className="mt-2 whitespace-pre-line text-ink">{dispute.sellerResponse.text}</p>
        </section>
      ) : null}
      {dispute.decision ? (
        <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
          <h2 className="text-lg font-bold text-ink">Support&apos;s decision</h2>
          <p className="mt-2 text-ink">{dispute.decision.note}</p>
          {dispute.decision.penalties?.length ? (
            <p className="mt-1 text-sm text-danger-text">
              Penalties: {dispute.decision.penalties.join(', ')}
            </p>
          ) : null}
        </section>
      ) : null}
      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <h2 className="mb-3 text-lg font-bold text-ink">Timeline</h2>
        <DisputeTimeline timeline={dispute.timeline} />
      </section>
    </div>
  );
}
