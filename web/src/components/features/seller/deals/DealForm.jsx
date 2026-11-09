'use client';

/**
 * DealForm — publish a seller-led group deal (AUC-9): product, city, base price and 2–4
 * tiers (more buyers → bigger discount). Buyers join with a refundable token; the price
 * drops for everyone as tiers unlock. If the first tier is not reached by the deadline,
 * every token is refunded (decided 8 Nov 2026).
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Search, Tags, Trash2 } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Textarea from '@/components/ui/Textarea';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { usePublicCities, useSellerMe } from '@/hooks/useSeller';
import { useCreateDeal, useDealProduct, useProductSearch } from '@/hooks/useSellerAuctions';
import { percentInputToBps, rupeesInputToPaise } from '@/utils/money';
import { ROUTES } from '@/utils/constants';
import { cn, formatINR } from '@/utils/genericFunctions';

const START_TIERS = [
  { size: '5', percent: '3' },
  { size: '10', percent: '6' },
];

/**
 * @returns {JSX.Element}
 */
export default function DealForm() {
  const router = useRouter();
  const me = useSellerMe();
  const cities = usePublicCities();
  const create = useCreateDeal();

  const [cityId, setCityId] = useState('');
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search, 300);
  const [product, setProduct] = useState(null);
  const [variantKey, setVariantKey] = useState('');
  const [base, setBase] = useState('');
  const [tiers, setTiers] = useState(START_TIERS);
  const [deadlineDays, setDeadlineDays] = useState('14');
  const [note, setNote] = useState('');

  const myCities = (cities.data || []).filter((city) => me.data?.cities?.includes(city.id));
  const results = useProductSearch(product ? '' : debounced, cityId || undefined);
  const details = useDealProduct(product?.id || null, cityId || undefined);

  const basePaise = rupeesInputToPaise(base);
  const parsedTiers = useMemo(
    () =>
      tiers.map((tier) => ({
        size: /^\d+$/.test(tier.size) ? Number(tier.size) : NaN,
        discountBps: percentInputToBps(tier.percent),
      })),
    [tiers],
  );
  const tiersValid = parsedTiers.every(
    (tier) => Number.isInteger(tier.size) && tier.size >= 2 && tier.discountBps > 0,
  );
  const canSubmit =
    cityId &&
    product &&
    basePaise > 0 &&
    tiersValid &&
    Number(deadlineDays) >= 1 &&
    !create.isPending;

  const updateTier = (index, changes) =>
    setTiers((prev) => prev.map((tier, i) => (i === index ? { ...tier, ...changes } : tier)));

  const onSubmit = (event) => {
    event.preventDefault();
    if (!canSubmit) return;
    create.mutate(
      {
        productId: product.id,
        variantKey: variantKey || null,
        cityId,
        basePricePaise: basePaise,
        tiers: parsedTiers,
        deadlineDays: Number(deadlineDays),
        ...(note.trim() ? { note: note.trim() } : {}),
      },
      { onSuccess: () => router.push(ROUTES.SELLER_DEALS) },
    );
  };

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">New group deal</h1>
        <p className="mt-1 text-muted">
          Set a price that drops as more buyers join. No auction: buyers see your tiers and join.
        </p>
      </div>

      <section className="grid gap-4 rounded-card border border-line bg-surface p-5 shadow-card sm:grid-cols-2 sm:p-6">
        <Select
          label="City"
          value={cityId}
          onChange={(event) => setCityId(event.target.value)}
          required
        >
          <option value="">Choose a city</option>
          {myCities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </Select>

        {product ? (
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Product</span>
            <div className="flex min-h-11 items-center justify-between gap-2 rounded-button border border-line px-4">
              <span className="truncate font-semibold text-ink">{product.name}</span>
              <Button
                variant="ghost"
                className="h-9 min-h-9 px-3"
                onClick={() => {
                  setProduct(null);
                  setVariantKey('');
                }}
              >
                Change
              </Button>
            </div>
          </div>
        ) : (
          <div className="relative flex flex-col gap-1.5">
            <Input
              label="Product"
              placeholder="Search brand or model"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              autoComplete="off"
            />
            <Search
              className="pointer-events-none absolute right-3 top-10 size-5 text-muted"
              strokeWidth={2}
              aria-hidden="true"
            />
            {results.data?.length ? (
              <ul className="absolute top-full z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-button border border-line bg-surface shadow-pop">
                {results.data.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      className="flex min-h-11 w-full items-center px-4 text-left text-sm font-semibold text-ink hover:bg-bg-band"
                      onClick={() => {
                        setProduct(item);
                        setSearch('');
                        if (!base && item.fromPricePaise)
                          setBase(String(item.fromPricePaise / 100));
                      }}
                    >
                      {item.name}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )}

        <Select
          label="Variant"
          value={variantKey}
          onChange={(event) => setVariantKey(event.target.value)}
          disabled={!product}
        >
          <option value="">Any variant</option>
          {(details.data?.variants || []).map((variant) => (
            <option key={variant.key} value={variant.key}>
              {variant.name}
            </option>
          ))}
        </Select>
        <Input
          label="Base price per unit (all-inclusive)"
          inputMode="decimal"
          placeholder="₹0"
          value={base}
          onChange={(event) => setBase(event.target.value)}
          error={base && basePaise === undefined ? 'Enter an amount in rupees' : undefined}
          required
        />
      </section>

      <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
        <h2 className="text-lg font-bold text-ink">Tiers</h2>
        <p className="mt-0.5 text-sm text-muted">
          2 to 4 tiers. Each needs more buyers and a bigger discount.
        </p>
        <ul className="mt-4 flex flex-col gap-3">
          {tiers.map((tier, index) => {
            const parsed = parsedTiers[index];
            const price =
              basePaise > 0 && parsed.discountBps > 0
                ? basePaise - Math.round((basePaise * parsed.discountBps) / 10_000)
                : null;
            return (
              <li
                key={index}
                className="grid grid-cols-[1fr_1fr_auto] items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <Input
                  label={`Tier ${index + 1}: buyers`}
                  inputMode="numeric"
                  value={tier.size}
                  onChange={(event) => updateTier(index, { size: event.target.value })}
                />
                <Input
                  label="Discount %"
                  inputMode="decimal"
                  value={tier.percent}
                  onChange={(event) => updateTier(index, { percent: event.target.value })}
                />
                <div className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto">
                  <span className="text-sm text-muted">Price</span>
                  <p
                    className={cn(
                      'flex min-h-11 items-center font-mono font-bold',
                      price ? 'text-ink' : 'text-muted',
                    )}
                  >
                    {price ? formatINR(price) : '—'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove tier ${index + 1}`}
                  disabled={tiers.length <= 2}
                  onClick={() => setTiers((prev) => prev.filter((_, i) => i !== index))}
                  className="grid size-11 place-items-center rounded-button text-muted hover:bg-bg-band hover:text-danger disabled:opacity-40"
                >
                  <Trash2 className="size-5" strokeWidth={2} aria-hidden="true" />
                </button>
              </li>
            );
          })}
        </ul>
        {tiers.length < 4 ? (
          <Button
            variant="secondary"
            className="mt-3"
            onClick={() => setTiers((prev) => [...prev, { size: '', percent: '' }])}
          >
            <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
            Add tier
          </Button>
        ) : null}
        <p className="mt-4 text-sm text-muted">
          If the first tier is not reached by the deadline, every buyer is refunded and no sale
          happens.
        </p>
      </section>

      <section className="grid gap-4 rounded-card border border-line bg-surface p-5 shadow-card sm:grid-cols-2 sm:p-6">
        <Input
          label="Deadline (days from today)"
          inputMode="numeric"
          value={deadlineDays}
          onChange={(event) => setDeadlineDays(event.target.value.replace(/\D/g, ''))}
          required
        />
        <Textarea
          label="Note for buyers (optional)"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={500}
          rows={2}
        />
      </section>

      {create.isError ? <Alert>{create.error.message}</Alert> : null}
      <Button
        type="submit"
        size="lg"
        className="w-full sm:w-auto sm:self-start"
        disabled={!canSubmit}
      >
        {create.isPending ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Tags className="size-4" strokeWidth={2} aria-hidden="true" />
        )}
        Publish deal
      </Button>
    </form>
  );
}
