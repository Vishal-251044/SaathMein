'use client';

/**
 * SettingsPage — Admin → Settings (F35): platform rules and feature flags, one card per
 * section, saved separately and audited. Money is typed in rupees and stored as paise;
 * percentages are stored as basis points. Per-category values (token, back-out fee,
 * auction duration, bid step, anti-sniping, minimum dealers, commission) are edited in
 * Admin → Categories.
 */
import { useState } from 'react';
import Link from 'next/link';
import { Loader2, RefreshCw, RotateCcw, Save } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Toggle from '@/components/ui/Toggle';
import { useAdminSettings, useUpdateSettings } from '@/hooks/useAdminDiscovery';
import {
  bpsToPercentInput,
  paiseToRupeesInput,
  percentInputToBps,
  rupeesInputToPaise,
} from '@/utils/money';

/** Field kinds: rupees (paise), percent (bps), number, text, flag (boolean). */
const SECTIONS = [
  {
    key: 'flags',
    title: 'Feature flags',
    description: 'Switch features on or off without a new app release.',
    fields: [
      { key: 'referrals', label: 'Referral and wallet credits', kind: 'flag' },
      { key: 'sellerDeals', label: 'Seller-led group deals', kind: 'flag' },
      { key: 'communityGroups', label: 'Community (society) groups', kind: 'flag' },
      {
        key: 'maintenanceMode',
        label: 'Maintenance mode (buyers and dealers can only browse)',
        kind: 'flag',
      },
    ],
  },
  {
    key: 'referrals',
    title: 'Referrals and leader bonus',
    description:
      "Paid once, when a referred friend's first purchase completes. Credits are not cash.",
    fields: [
      { key: 'referrerCreditPaise', label: 'Credit to the person who invited', kind: 'rupees' },
      { key: 'friendCreditPaise', label: 'Credit to the invited friend', kind: 'rupees' },
      { key: 'leaderBonusPaise', label: 'Group-leader bonus', kind: 'rupees' },
      {
        key: 'leaderBonusMinOtherPurchases',
        label: 'Leader bonus: other members who must buy',
        kind: 'number',
      },
      {
        key: 'claimWithinDays',
        label: 'New accounts can add a code within (days)',
        kind: 'number',
      },
    ],
  },
  {
    key: 'alerts',
    title: 'Alerts',
    description:
      'Push alerts go to the buyer-app account with this phone number (install the app and sign in with it). The console bell and email work for all staff.',
    fields: [
      { key: 'ownerPushPhone', label: "Owner's phone for push alerts (10 digits)", kind: 'text' },
      {
        key: 'paymentSuccessMinBps',
        label: 'Alert when payment success falls below (%)',
        kind: 'percent',
      },
      {
        key: 'paymentSuccessMinSample',
        label: 'Only after this many payments in the hour',
        kind: 'number',
      },
      { key: 'refundStuckHours', label: 'Refund stuck after (hours)', kind: 'number' },
      {
        key: 'transferPendingHours',
        label: 'Dealer transfer pending after (hours)',
        kind: 'number',
      },
      { key: 'queueBacklogMax', label: 'Job backlog alert above (jobs)', kind: 'number' },
      { key: 'apiErrorsPerMinute', label: 'Server errors per minute alert', kind: 'number' },
    ],
  },
  {
    key: 'groups',
    title: 'Groups',
    fields: [
      { key: 'earlyStartThresholdBps', label: 'Leader can start early at (%)', kind: 'percent' },
      {
        key: 'leaderDecisionHours',
        label: 'Leader decision time after the deadline (hours)',
        kind: 'number',
      },
      { key: 'extensionDays', label: 'One-time extension (days)', kind: 'number' },
      { key: 'maxOpenGroupsPerLeader', label: 'Open groups one person can lead', kind: 'number' },
    ],
  },
  {
    key: 'auctions',
    title: 'Auctions (all categories)',
    fields: [
      { key: 'minRating', label: 'Minimum dealer rating to bid', kind: 'number', step: '0.1' },
      {
        key: 'minReviewsForRating',
        label: 'Reviews before the rating rule applies',
        kind: 'number',
      },
      {
        key: 'minDealerExtensionHours',
        label: 'Extension when too few dealers bid (hours)',
        kind: 'number',
      },
      {
        key: 'singleBidDecisionHours',
        label: 'Leader decision on a single bid (hours)',
        kind: 'number',
      },
      { key: 'exitWindowHours', label: 'Exit window after a win (hours)', kind: 'number' },
      { key: 'runnerUpOfferHours', label: 'Runner-up offer time (hours)', kind: 'number' },
      {
        key: 'priceAlertMinutes',
        label: 'Buyers get a new-price alert at most every (minutes)',
        kind: 'number',
      },
      {
        key: 'bidCooldownSeconds',
        label: 'Pause between bids of one dealer (seconds)',
        kind: 'number',
      },
      {
        key: 'backOutSuspensionDays',
        label: 'Auction ban after backing out (days)',
        kind: 'number',
      },
    ],
  },
  {
    key: 'payments',
    title: 'Payments',
    fields: [
      { key: 'seatReservationMinutes', label: 'Seat held while paying (minutes)', kind: 'number' },
      {
        key: 'waitlistOfferHours',
        label: 'Freed seat offered to the waitlist for (hours)',
        kind: 'number',
      },
    ],
  },
  {
    key: 'purchases',
    title: 'Purchases',
    fields: [
      {
        key: 'invoiceObjectionHours',
        label: 'Dealer can object to an invoice within (hours)',
        kind: 'number',
      },
      {
        key: 'expiryReminderHours',
        label: 'Remind buyers before the price ends (hours)',
        kind: 'number',
      },
      {
        key: 'sellerDealValidityDays',
        label: 'Seller-led deal price valid for (days)',
        kind: 'number',
      },
    ],
  },
  {
    key: 'billing',
    title: 'Commission invoices (GST)',
    description: 'Printed on every dealer invoice. Confirm with your CA.',
    fields: [
      { key: 'legalName', label: 'Legal name', kind: 'text' },
      { key: 'gstin', label: 'GSTIN', kind: 'text' },
      { key: 'address', label: 'Registered address', kind: 'text' },
      { key: 'stateCode', label: 'State code (first 2 digits of GSTIN)', kind: 'text' },
      { key: 'sacCode', label: 'SAC code', kind: 'text' },
      { key: 'gstRateBps', label: 'GST on commission (%)', kind: 'percent' },
      { key: 'invoicePrefix', label: 'Invoice number prefix', kind: 'text' },
    ],
  },
];

/** Stored value → form text. */
const toInput = (kind, value) => {
  if (kind === 'flag') return Boolean(value);
  if (kind === 'rupees') return paiseToRupeesInput(value);
  if (kind === 'percent') return bpsToPercentInput(value);
  return value == null ? '' : String(value);
};

/** Form text → value to send; undefined when invalid. */
const fromInput = (kind, text) => {
  if (kind === 'flag') return Boolean(text);
  if (kind === 'rupees') return rupeesInputToPaise(text) ?? undefined;
  if (kind === 'percent') return percentInputToBps(text) ?? undefined;
  if (kind === 'number')
    return text !== '' && Number.isFinite(Number(text)) ? Number(text) : undefined;
  return String(text).trim();
};

/** One section card. */
function SectionCard({ section, data }) {
  const update = useUpdateSettings();
  const initial = Object.fromEntries(
    section.fields.map((field) => [field.key, toInput(field.kind, data.values[field.key])]),
  );
  const [form, setForm] = useState(initial);
  const changes = {};
  let invalid = false;
  section.fields.forEach((field) => {
    if (form[field.key] === initial[field.key]) return;
    const value = fromInput(field.kind, form[field.key]);
    if (value === undefined) invalid = true;
    else changes[field.key] = value;
  });
  const dirty = Object.keys(changes).length > 0;

  const save = () =>
    update.mutate(
      { key: section.key, changes },
      {
        onSuccess: (values) =>
          setForm(
            Object.fromEntries(
              section.fields.map((field) => [field.key, toInput(field.kind, values[field.key])]),
            ),
          ),
      },
    );

  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-bold text-ink">{section.title}</h2>
      {section.description ? (
        <p className="mt-0.5 text-sm text-muted">{section.description}</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {section.fields.map((field) =>
          field.kind === 'flag' ? (
            <div
              key={field.key}
              className="flex min-h-11 items-center justify-between gap-3 sm:col-span-2"
            >
              <span className="text-sm font-semibold text-ink">{field.label}</span>
              <Toggle
                checked={form[field.key]}
                onChange={(checked) => setForm((prev) => ({ ...prev, [field.key]: checked }))}
                label={field.label}
              />
            </div>
          ) : (
            <Input
              key={field.key}
              label={field.label}
              value={form[field.key]}
              inputMode={field.kind === 'text' ? undefined : 'decimal'}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, [field.key]: event.target.value }))
              }
              hint={`Default: ${toInput(field.kind, data.defaults[field.key]) || 'not set'}`}
            />
          ),
        )}
      </div>
      {invalid ? (
        <Alert className="mt-3">Check the highlighted values: some are not numbers.</Alert>
      ) : null}
      {update.isError ? <Alert className="mt-3">{update.error.message}</Alert> : null}
      {update.isSuccess && !dirty ? (
        <Alert tone="info" className="mt-3">
          Saved. Changes apply within a minute.
        </Alert>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button disabled={!dirty || invalid || update.isPending} onClick={save}>
          {update.isPending ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Save className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
          Save {section.title.toLowerCase()}
        </Button>
        {dirty ? (
          <Button variant="ghost" onClick={() => setForm(initial)}>
            <RotateCcw className="size-4" strokeWidth={2} aria-hidden="true" />
            Undo changes
          </Button>
        ) : null}
      </div>
    </section>
  );
}

/** @returns {JSX.Element} */
export default function SettingsPage() {
  const settings = useAdminSettings();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-muted">
          Platform rules. Token, back-out fee, auction duration, bid step and commission are set per
          category in{' '}
          <Link href="/admin/catalog" className="font-semibold text-primary hover:underline">
            Categories
          </Link>
          . Every change is recorded in the audit log.
        </p>
      </div>
      {settings.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{settings.error.message}</Alert>
          <Button variant="secondary" onClick={() => settings.refetch()}>
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : settings.isPending ? (
        <div className="h-96 animate-pulse rounded-card bg-surface" aria-busy="true" />
      ) : (
        SECTIONS.map((section) => (
          <SectionCard key={section.key} section={section} data={settings.data[section.key]} />
        ))
      )}
    </div>
  );
}
