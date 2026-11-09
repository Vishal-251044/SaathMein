'use client';

/**
 * JoinCommitmentForm — a dealer joins an auction by accepting the commitment (AUC-2):
 * honour the winning price for every member, deliver by a date, keep the price valid
 * 7–15 days. Backing out after winning carries penalties.
 */
import { useState } from 'react';
import { Handshake, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Alert from '@/components/ui/Alert';
import { useJoinAuction } from '@/hooks/useSellerAuctions';

const VALIDITY_OPTIONS = [7, 10, 15];

/** Tomorrow as yyyy-mm-dd (the earliest delivery date). */
const tomorrow = () => {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
};

/**
 * @param {{ groupId: string }} props
 * @returns {JSX.Element}
 */
export default function JoinCommitmentForm({ groupId }) {
  const join = useJoinAuction();
  const [deliveryBy, setDeliveryBy] = useState('');
  const [validity, setValidity] = useState('7');
  const [accepted, setAccepted] = useState(false);

  const onSubmit = (event) => {
    event.preventDefault();
    if (!accepted || !deliveryBy) return;
    join.mutate({ groupId, deliveryBy, priceValidityDays: Number(validity) });
  };

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
    >
      <h2 className="text-lg font-bold text-ink">Join this auction</h2>
      <p className="mt-0.5 text-sm text-muted">
        Accept the commitment to see the live price and place bids.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Input
          label="Delivery by"
          type="date"
          min={tomorrow()}
          value={deliveryBy}
          onChange={(event) => setDeliveryBy(event.target.value)}
          hint="When every member can take delivery"
          required
        />
        <Select
          label="Price valid for"
          value={validity}
          onChange={(event) => setValidity(event.target.value)}
          hint="Members can buy at your price for this long"
        >
          {VALIDITY_OPTIONS.map((days) => (
            <option key={days} value={days}>
              {days} days
            </option>
          ))}
        </Select>
      </div>
      <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-button bg-bg-band p-3 text-sm text-ink">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(event) => setAccepted(event.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[#FF5A3C]"
        />
        <span>
          If my price wins, I will sell to every member at that all-inclusive price with no hidden
          charges. Backing out after winning lowers my rating and suspends me from auctions for 30
          days.
        </span>
      </label>
      {join.isError ? <Alert className="mt-3">{join.error.message}</Alert> : null}
      <Button
        type="submit"
        className="mt-4 w-full sm:w-auto"
        disabled={!accepted || !deliveryBy || join.isPending}
      >
        {join.isPending ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Handshake className="size-4" strokeWidth={2} aria-hidden="true" />
        )}
        Accept and join
      </Button>
    </form>
  );
}
