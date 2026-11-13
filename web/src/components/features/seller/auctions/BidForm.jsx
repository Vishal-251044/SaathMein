'use client';

/**
 * BidForm — the dealer enters the all-inclusive breakdown (AUC-3); the total is the bid.
 * The form shows the highest allowed price (lowest − minimum step, or below the market
 * price for the first bid). The server re-checks everything; bids are final (AUC-7).
 */
import { useMemo, useState } from 'react';
import { Gavel, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import { usePlaceBid } from '@/hooks/useSellerAuctions';
import { rupeesInputToPaise } from '@/utils/money';
import { formatINR } from '@/utils/genericFunctions';

// Order matches the receipt a buyer sees; discount is subtracted
const FIELDS = [
  { key: 'basePaise', label: 'Ex-showroom / base price', required: true },
  { key: 'taxPaise', label: 'Taxes (if not in base)' },
  { key: 'rtoPaise', label: 'RTO / registration' },
  { key: 'insurancePaise', label: 'Insurance' },
  { key: 'accessoriesPaise', label: 'Accessories' },
  { key: 'handlingPaise', label: 'Handling / logistics' },
  { key: 'warrantyPaise', label: 'Extended warranty' },
  { key: 'deliveryPaise', label: 'Delivery' },
  { key: 'discountPaise', label: 'Discount (subtracted)' },
];

/**
 * Highest price the next bid may have (mirrors the server rule).
 * @param {Object} auction - Dealer auction view
 * @returns {number|null} Paise
 */
const maxAllowed = (auction) => {
  if (auction.lowestPricePaise) {
    const step = Math.max(
      auction.minStepPaise || 0,
      Math.round((auction.lowestPricePaise * (auction.minStepBps || 0)) / 10_000),
    );
    return auction.lowestPricePaise - step;
  }
  return auction.ceilingPaise ? auction.ceilingPaise - 1 : null;
};

/**
 * @param {{ auction: Object }} props - Dealer auction view
 * @returns {JSX.Element}
 */
export default function BidForm({ auction }) {
  const bid = usePlaceBid();
  const [values, setValues] = useState({});
  const [inclusions, setInclusions] = useState('');
  const [confirming, setConfirming] = useState(false);

  const parsed = useMemo(() => {
    const breakdown = {};
    let invalid = false;
    FIELDS.forEach(({ key }) => {
      const paise = rupeesInputToPaise(values[key]);
      if (paise === undefined) invalid = true;
      else if (paise) breakdown[key] = paise;
    });
    const total =
      FIELDS.filter(({ key }) => key !== 'discountPaise').reduce(
        (sum, { key }) => sum + (breakdown[key] || 0),
        0,
      ) - (breakdown.discountPaise || 0);
    return { breakdown, total, invalid };
  }, [values]);

  const limit = maxAllowed(auction);
  const tooHigh = limit != null && parsed.total > limit;
  const canSubmit = !parsed.invalid && parsed.breakdown.basePaise && parsed.total > 0 && !tooHigh;

  const submit = () => {
    bid.mutate(
      {
        groupId: auction.groupId,
        pricePerUnitPaise: parsed.total,
        breakdown: parsed.breakdown,
        inclusions: inclusions
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      },
      {
        onSuccess: () => {
          setConfirming(false);
          setValues({});
        },
        onError: () => setConfirming(false),
      },
    );
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (canSubmit) setConfirming(true);
      }}
      className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
    >
      <h2 className="text-lg font-bold text-ink">Place your price</h2>
      <p className="mt-0.5 text-sm text-muted">
        Per unit, all-inclusive.{' '}
        {limit != null ? (
          <>
            Your price must be at most{' '}
            <strong className="font-mono text-ink">{formatINR(limit)}</strong>.
          </>
        ) : null}
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {FIELDS.map(({ key, label, required }) => (
          <Input
            key={key}
            label={label}
            inputMode="decimal"
            placeholder="₹0"
            value={values[key] || ''}
            required={required}
            onChange={(event) => setValues((prev) => ({ ...prev, [key]: event.target.value }))}
            error={
              values[key] && rupeesInputToPaise(values[key]) === undefined
                ? 'Enter an amount in rupees'
                : undefined
            }
          />
        ))}
        <Input
          label="Free inclusions (optional)"
          placeholder="Helmet, first service, number plate"
          value={inclusions}
          onChange={(event) => setInclusions(event.target.value)}
          hint="Separate with commas"
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-button bg-bg-band p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-muted">All-inclusive price per unit</p>
          <p className="font-mono text-2xl font-extrabold text-ink">
            {formatINR(Math.max(0, parsed.total))}
          </p>
          {tooHigh ? (
            <p className="text-sm font-medium text-danger-text">
              Too high: beat the lowest price by the minimum step.
            </p>
          ) : null}
        </div>
        {confirming ? (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              onClick={() => setConfirming(false)}
              disabled={bid.isPending}
            >
              Change
            </Button>
            <Button onClick={submit} disabled={bid.isPending}>
              {bid.isPending ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : (
                <Gavel className="size-4" strokeWidth={2} aria-hidden="true" />
              )}
              Confirm {formatINR(parsed.total)}
            </Button>
          </div>
        ) : (
          <Button type="submit" disabled={!canSubmit}>
            <Gavel className="size-4" strokeWidth={2} aria-hidden="true" />
            Review bid
          </Button>
        )}
      </div>
      {confirming ? (
        <p className="mt-2 text-sm text-muted">
          Bids are final: you cannot edit, raise or withdraw them.
        </p>
      ) : null}
      {bid.isError ? <Alert className="mt-3">{bid.error.message}</Alert> : null}
      {bid.isSuccess ? (
        <Alert tone="info" className="mt-3">
          Bid placed. You have the lowest price
          {bid.data?.extended ? ' and the timer was extended by 5 minutes' : ''}.
        </Alert>
      ) : null}
    </form>
  );
}
