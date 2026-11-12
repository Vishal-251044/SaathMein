'use client';

/**
 * DisputeCase — one dispute for Support (TRU-4): buyer's complaint and evidence, chat
 * messages, the dealer's answer, the money state of the buyer's token and the decision
 * form. Refund is offered while the token is with SaathMein or on hold; wallet credits
 * once it was released to the dealer (decided 12 Nov 2026). A reason is required.
 */
import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Gavel, Loader2, RefreshCw } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import {
  DISPUTE_TYPE_LABEL,
  DisputeStatusBadge,
  DisputeTimeline,
  EvidenceList,
} from '@/components/features/trust/DisputeParts';
import { useAdminDispute, useDecideDispute } from '@/hooks/useTrust';
import { rupeesInputToPaise } from '@/utils/money';
import { formatDateTime, formatINR } from '@/utils/genericFunctions';

const TOKEN_STATE = {
  with_saathmein: 'With SaathMein (not yet sent to the dealer)',
  on_hold: 'On hold at the dealer (can be taken back)',
  released: 'Released to the dealer',
  refunded: 'Already refunded',
  none: 'No token',
};

const PENALTIES = [
  { key: 'warning', label: 'Warning' },
  { key: 'rating_penalty', label: 'Rating penalty (counts as a 1-star)' },
  { key: 'auction_suspension', label: 'Suspend from auctions' },
];

/** Card wrapper. */
function Card({ title, children }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Decision form. */
function DecisionForm({ dispute }) {
  const decide = useDecideDispute();
  const refundable = ['with_saathmein', 'on_hold'].includes(dispute.tokenState);
  const released = dispute.tokenState === 'released';
  const [outcome, setOutcome] = useState(refundable ? 'refund' : 'no_refund');
  const [credit, setCredit] = useState(
    dispute.purchase ? String(dispute.purchase.tokenPaise / 100) : '',
  );
  const [penalties, setPenalties] = useState([]);
  const [days, setDays] = useState('30');
  const [note, setNote] = useState('');
  const creditPaise = rupeesInputToPaise(credit);

  const togglePenalty = (key) =>
    setPenalties((prev) =>
      prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key],
    );

  const submit = () =>
    decide.mutate({
      disputeId: dispute.id,
      outcome,
      ...(outcome === 'credit' ? { creditPaise } : {}),
      penalties,
      ...(penalties.includes('auction_suspension') ? { suspensionDays: Number(days) } : {}),
      note: note.trim(),
    });

  const options = [
    ...(refundable
      ? [
          {
            key: 'refund',
            label: `Refund the full token (${formatINR(dispute.purchase?.tokenPaise)}) to the buyer's bank`,
          },
        ]
      : []),
    ...(released
      ? [{ key: 'credit', label: 'Give SaathMein credits (billed to the dealer)' }]
      : []),
    { key: 'no_refund', label: 'No refund (decide for the dealer)' },
  ];

  return (
    <Card title="Decision">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ink">Outcome</legend>
        {options.map((option) => (
          <label
            key={option.key}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-button bg-bg-band px-3 text-sm text-ink"
          >
            <input
              type="radio"
              name="outcome"
              checked={outcome === option.key}
              onChange={() => setOutcome(option.key)}
              className="size-5 accent-[#FF5A3C]"
            />
            {option.label}
          </label>
        ))}
      </fieldset>
      {outcome === 'credit' ? (
        <div className="mt-3 max-w-xs">
          <Input
            label="Credits (₹)"
            inputMode="decimal"
            value={credit}
            onChange={(event) => setCredit(event.target.value)}
            hint={`At most ${formatINR(dispute.purchase?.tokenPaise)}`}
          />
        </div>
      ) : null}
      <fieldset className="mt-4 flex flex-col gap-2">
        <legend className="mb-1 text-sm font-semibold text-ink">Dealer penalties (optional)</legend>
        {PENALTIES.map((penalty) => (
          <label
            key={penalty.key}
            className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink"
          >
            <input
              type="checkbox"
              checked={penalties.includes(penalty.key)}
              onChange={() => togglePenalty(penalty.key)}
              className="size-5 accent-[#FF5A3C]"
            />
            {penalty.label}
          </label>
        ))}
      </fieldset>
      {penalties.includes('auction_suspension') ? (
        <div className="mt-2 max-w-xs">
          <Input
            label="Suspension (days)"
            inputMode="numeric"
            value={days}
            onChange={(event) => setDays(event.target.value.replace(/\D/g, ''))}
          />
        </div>
      ) : null}
      <div className="mt-4">
        <Textarea
          label="Reason (shown to the buyer and dealer, kept in the audit log)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          maxLength={2000}
        />
      </div>
      {decide.isError ? <Alert className="mt-3">{decide.error.message}</Alert> : null}
      <Button
        className="mt-4"
        disabled={
          note.trim().length < 10 ||
          decide.isPending ||
          (outcome === 'credit' && !(creditPaise > 0))
        }
        onClick={submit}
      >
        {decide.isPending ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Gavel className="size-4" strokeWidth={2} aria-hidden="true" />
        )}
        Decide
      </Button>
    </Card>
  );
}

/**
 * @param {{ disputeId: string }} props
 * @returns {JSX.Element}
 */
export default function DisputeCase({ disputeId }) {
  const query = useAdminDispute(disputeId);
  if (query.isPending)
    return <div className="h-96 animate-pulse rounded-card bg-surface" aria-busy="true" />;
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
  const dispute = query.data;
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/disputes"
        className="inline-flex min-h-11 w-fit items-center gap-2 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" strokeWidth={2} aria-hidden="true" />
        Back to the queue
      </Link>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">
            {DISPUTE_TYPE_LABEL[dispute.type]}
          </h1>
          <DisputeStatusBadge status={dispute.status} />
        </div>
        <p className="mt-1 text-muted">
          {dispute.productName} · {dispute.buyerFirstName || 'Buyer'} vs {dispute.sellerName} ·
          opened {formatDateTime(dispute.createdAt)}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col gap-6">
          <Card title="Buyer's complaint">
            <p className="whitespace-pre-line text-ink">{dispute.description}</p>
            {dispute.quotedPricePaise ? (
              <p className="mt-2 text-sm text-muted">
                Dealer asked {formatINR(dispute.quotedPricePaise)} · winning price{' '}
                {formatINR(dispute.purchase?.pricePaise)}
              </p>
            ) : null}
            <div className="mt-4">
              <EvidenceList evidence={dispute.evidence} />
            </div>
          </Card>
          {dispute.chatMessages?.length ? (
            <Card title="Chat messages the buyer pointed to">
              <ul className="flex flex-col gap-2">
                {dispute.chatMessages.map((message, index) => (
                  <li
                    key={`${message.at}-${index}`}
                    className="rounded-button bg-bg-band px-3 py-2 text-sm"
                  >
                    <span className="font-semibold text-ink">{message.from}: </span>
                    <span className="text-ink">{message.text || '(photo)'}</span>
                    <span className="ml-2 text-xs text-muted">{formatDateTime(message.at)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ) : null}
          <Card title="Dealer's answer">
            {dispute.sellerResponse ? (
              <p className="whitespace-pre-line text-ink">{dispute.sellerResponse.text}</p>
            ) : (
              <p className="text-muted">
                {dispute.status === 'seller_missed'
                  ? 'The dealer did not answer within 48 hours.'
                  : `Due by ${formatDateTime(dispute.sellerDueAt)}.`}
              </p>
            )}
          </Card>
          {dispute.status === 'resolved' ? (
            <Card title="Decision">
              <p className="text-ink">
                {dispute.decision.outcome === 'refund'
                  ? `Refunded ${formatINR(dispute.decision.refundPaise)} to the buyer.`
                  : dispute.decision.outcome === 'credit'
                    ? `Gave ${formatINR(dispute.decision.creditPaise)} in credits (billed to the dealer).`
                    : 'No refund.'}
                {dispute.decision.penalties?.length
                  ? ` Penalties: ${dispute.decision.penalties.join(', ')}.`
                  : ''}
              </p>
              <p className="mt-1 text-sm text-muted">{dispute.decision.note}</p>
            </Card>
          ) : (
            <DecisionForm dispute={dispute} />
          )}
        </div>
        <div className="flex flex-col gap-6">
          <Card title="Money">
            <dl className="flex flex-col gap-2 text-sm">
              <div>
                <dt className="text-muted">Buyer&apos;s token</dt>
                <dd className="font-semibold text-ink">
                  {TOKEN_STATE[dispute.tokenState] || dispute.tokenState}
                </dd>
              </div>
              {dispute.purchase ? (
                <>
                  <div>
                    <dt className="text-muted">Purchase</dt>
                    <dd className="text-ink">
                      {dispute.purchase.status} ·{' '}
                      <span className="font-mono">{dispute.purchase.dealCode}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted">Winning price / token</dt>
                    <dd className="font-mono text-ink">
                      {formatINR(dispute.purchase.pricePaise)} /{' '}
                      {formatINR(dispute.purchase.tokenPaise)}
                    </dd>
                  </div>
                </>
              ) : null}
            </dl>
          </Card>
          <Card title="Timeline">
            <DisputeTimeline timeline={dispute.timeline} />
          </Card>
        </div>
      </div>
    </div>
  );
}
