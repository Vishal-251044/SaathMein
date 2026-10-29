'use client';

/**
 * PricesEditor — city prices for a product (CAT-2): one row per city + variant, with
 * MRP, ex-showroom and on-road prices in rupees. Every change is kept in price history.
 */
import Input from '@/components/ui/Input';
import RowListEditor from '@/components/features/admin/products/RowListEditor';

let nextRowId = 0;
/** @returns {Object} Empty price row */
export const createPriceRow = (overrides = {}) => ({
  id: `price-${(nextRowId += 1)}`,
  cityId: '',
  variantKey: '',
  mrp: '',
  exShowroom: '',
  onRoad: '',
  ...overrides,
});

/**
 * @param {Object} props
 * @param {Object[]} props.rows - Price rows (rupee text)
 * @param {(rows: Object[]) => void} props.onChange - New rows
 * @param {Object[]} props.cities - Cities from the admin API
 * @param {{ key: string, name: string }[]} props.variants - Current variants
 * @returns {JSX.Element}
 */
export default function PricesEditor({ rows, onChange, cities, variants }) {
  const selectClass =
    'min-h-11 w-full rounded-button border border-line bg-surface px-3 text-sm text-ink';

  return (
    <RowListEditor
      title="City prices"
      hint="Prices in rupees. For vehicles fill ex-showroom (and on-road if known); for electronics fill MRP."
      rows={rows}
      onChange={onChange}
      createRow={() => createPriceRow({ cityId: cities[0]?.id || '' })}
      addLabel="Add price"
      renderRow={(row, update) => (
        <>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">City</span>
            <select
              value={row.cityId}
              onChange={(e) => update({ cityId: e.target.value })}
              className={selectClass}
            >
              <option value="">Choose a city</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-ink">Variant</span>
            <select
              value={row.variantKey}
              onChange={(e) => update({ variantKey: e.target.value })}
              className={selectClass}
            >
              <option value="">Whole product</option>
              {variants.map((variant) => (
                <option key={variant.key} value={variant.key}>
                  {variant.name}
                </option>
              ))}
            </select>
          </label>
          <Input
            label="MRP (₹)"
            value={row.mrp}
            onChange={(e) => update({ mrp: e.target.value })}
            inputMode="decimal"
          />
          <Input
            label="Ex-showroom (₹)"
            value={row.exShowroom}
            onChange={(e) => update({ exShowroom: e.target.value })}
            inputMode="decimal"
          />
          <Input
            label="On-road (₹)"
            value={row.onRoad}
            onChange={(e) => update({ onRoad: e.target.value })}
            inputMode="decimal"
          />
        </>
      )}
    />
  );
}
