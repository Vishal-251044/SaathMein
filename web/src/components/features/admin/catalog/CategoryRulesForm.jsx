'use client';

/**
 * CategoryRulesForm — edit one category's business rules (CAT-1): group sizes, token,
 * deadlines, auction rules (PRD §10.5), commission and back-out fee (PRD §5).
 * Staff type rupees, percentages, hours and days; the API stores paise and basis points.
 */
import { useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Alert from '@/components/ui/Alert';
import {
  bpsToPercentInput,
  paiseToRupeesInput,
  percentInputToBps,
  rupeesInputToPaise,
} from '@/utils/money';

/** Field definitions: [form key, label, unit, how to read it back]. */
const NUMBER_FIELDS = [
  { key: 'minSize', label: 'Min group size', group: 'Group' },
  { key: 'maxSize', label: 'Max group size', group: 'Group' },
  { key: 'deadlineMin', label: 'Shortest deadline (days)', group: 'Group' },
  { key: 'deadlineMax', label: 'Longest deadline (days)', group: 'Group' },
  { key: 'durationHours', label: 'Default length (hours)', group: 'Auction' },
  { key: 'minDurationHours', label: 'Shortest (hours)', group: 'Auction' },
  { key: 'maxDurationHours', label: 'Longest (hours)', group: 'Auction' },
  { key: 'antiSnipeMinutes', label: 'Anti-sniping window (minutes)', group: 'Auction' },
  { key: 'maxExtensions', label: 'Max timer extensions', group: 'Auction' },
  { key: 'minDealers', label: 'Minimum dealers', group: 'Auction' },
  { key: 'priceValidityDays', label: 'Price valid for (days)', group: 'Auction' },
];

/**
 * Turn a category's rules into form text values.
 * @param {Object} rules - Rules from the API
 * @returns {Record<string, string>} Form values
 */
const toFormValues = (rules = {}) => ({
  minSize: String(rules.minSize ?? ''),
  maxSize: String(rules.maxSize ?? ''),
  deadlineMin: String(rules.deadlineDays?.min ?? ''),
  deadlineMax: String(rules.deadlineDays?.max ?? ''),
  token: paiseToRupeesInput(rules.tokenAmountPaise),
  backoutFee: paiseToRupeesInput(rules.backoutFeePaise),
  durationHours: String(rules.auction?.durationHours ?? ''),
  minDurationHours: String(rules.auction?.minDurationHours ?? ''),
  maxDurationHours: String(rules.auction?.maxDurationHours ?? ''),
  minStepRupees: paiseToRupeesInput(rules.auction?.minStepPaise),
  minStepPercent: bpsToPercentInput(rules.auction?.minStepBps),
  antiSnipeMinutes: String(rules.auction?.antiSnipeMinutes ?? ''),
  maxExtensions: String(rules.auction?.maxExtensions ?? ''),
  minDealers: String(rules.auction?.minDealers ?? ''),
  priceValidityDays: String(rules.auction?.priceValidityDays ?? ''),
  commissionType: rules.commission?.type || 'percent',
  commissionValue:
    rules.commission?.type === 'flat'
      ? paiseToRupeesInput(rules.commission?.value)
      : bpsToPercentInput(rules.commission?.value),
});

/**
 * Convert form text back to API rules.
 * @param {Record<string, string>} values - Form values
 * @returns {{ rules?: Object, error?: string }}
 */
const toRules = (values) => {
  const whole = (key) => (/^\d+$/.test(values[key]) ? Number(values[key]) : undefined);
  const numbers = Object.fromEntries(NUMBER_FIELDS.map(({ key }) => [key, whole(key)]));
  const missing = NUMBER_FIELDS.find(({ key }) => numbers[key] === undefined);
  if (missing) return { error: `${missing.label} must be a whole number` };

  const token = rupeesInputToPaise(values.token);
  const backoutFee = rupeesInputToPaise(values.backoutFee);
  const minStep = rupeesInputToPaise(values.minStepRupees);
  const minStepBps = percentInputToBps(values.minStepPercent);
  const commission =
    values.commissionType === 'flat'
      ? rupeesInputToPaise(values.commissionValue)
      : percentInputToBps(values.commissionValue);

  if (
    [token, backoutFee, minStep, minStepBps, commission].some((v) => v === undefined || v === null)
  ) {
    return { error: 'Money and percentage fields need a number (up to 2 decimals)' };
  }
  if (numbers.minSize > numbers.maxSize) return { error: 'Min group size is more than the max' };
  if (numbers.deadlineMin > numbers.deadlineMax)
    return { error: 'Shortest deadline is longer than the longest' };

  return {
    rules: {
      minSize: numbers.minSize,
      maxSize: numbers.maxSize,
      tokenAmountPaise: token,
      backoutFeePaise: backoutFee,
      deadlineDays: { min: numbers.deadlineMin, max: numbers.deadlineMax },
      auction: {
        durationHours: numbers.durationHours,
        minDurationHours: numbers.minDurationHours,
        maxDurationHours: numbers.maxDurationHours,
        minStepPaise: minStep,
        minStepBps,
        antiSnipeMinutes: numbers.antiSnipeMinutes,
        maxExtensions: numbers.maxExtensions,
        minDealers: numbers.minDealers,
        priceValidityDays: numbers.priceValidityDays,
      },
      commission: { type: values.commissionType, value: commission },
    },
  };
};

/**
 * @param {Object} props
 * @param {Object} props.category - Category from the admin API
 * @param {(rules: Object) => Promise<void>} props.onSave - Save handler
 * @returns {JSX.Element}
 */
export default function CategoryRulesForm({ category, onSave }) {
  const [values, setValues] = useState(() => toFormValues(category.rules));
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const set = (key) => (event) =>
    setValues((current) => ({ ...current, [key]: event.target.value }));

  /** Validate and save. */
  const handleSubmit = async (event) => {
    event.preventDefault();
    const { rules, error: validationError } = toRules(values);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setIsSaving(true);
    try {
      await onSave(rules);
      setSavedAt(new Date());
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSaving(false);
    }
  };

  const groupFields = (group) =>
    NUMBER_FIELDS.filter((field) => field.group === group).map(({ key, label }) => (
      <Input key={key} label={label} value={values[key]} onChange={set(key)} inputMode="numeric" />
    ));

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {error ? <Alert>{error}</Alert> : null}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-bold text-ink">Groups and token</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupFields('Group')}
          <Input
            label="Token (₹)"
            value={values.token}
            onChange={set('token')}
            inputMode="decimal"
          />
          <Input
            label="Back-out fee after lock (₹)"
            value={values.backoutFee}
            onChange={set('backoutFee')}
            inputMode="decimal"
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-bold text-ink">Dealer auction</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {groupFields('Auction')}
          <Input
            label="Min bid step (₹)"
            hint="Bigger of ₹ step and % step applies"
            value={values.minStepRupees}
            onChange={set('minStepRupees')}
            inputMode="decimal"
          />
          <Input
            label="Min bid step (%)"
            value={values.minStepPercent}
            onChange={set('minStepPercent')}
            inputMode="decimal"
          />
        </div>
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1 text-sm font-bold text-ink">SaathMein commission</legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Type</span>
            <select
              value={values.commissionType}
              onChange={set('commissionType')}
              className="min-h-11 rounded-button border border-line bg-surface px-3 text-ink"
            >
              <option value="flat">Flat amount per unit (₹)</option>
              <option value="percent">Percentage of price (%)</option>
            </select>
          </label>
          <Input
            label={values.commissionType === 'flat' ? 'Amount per unit (₹)' : 'Percentage (%)'}
            value={values.commissionValue}
            onChange={set('commissionValue')}
            inputMode="decimal"
          />
        </div>
      </fieldset>

      <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
        {savedAt ? <p className="text-sm font-medium text-savings-text">Saved</p> : null}
        <Button type="submit" disabled={isSaving}>
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
          Save rules
        </Button>
      </div>
    </form>
  );
}
