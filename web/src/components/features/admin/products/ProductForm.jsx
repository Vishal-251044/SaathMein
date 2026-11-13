'use client';

/**
 * ProductForm — create or edit a product (CAT-2): details, variants, specs, city prices,
 * images and visibility. Turning a product live confirms its prices were checked.
 */
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Save, TriangleAlert } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Toggle from '@/components/ui/Toggle';
import RowListEditor from '@/components/features/admin/products/RowListEditor';
import PricesEditor, { createPriceRow } from '@/components/features/admin/products/PricesEditor';
import ProductImages from '@/components/features/admin/products/ProductImages';
import { useSaveProduct } from '@/hooks/useAdminCatalog';
import { paiseToRupeesInput, rupeesInputToPaise } from '@/utils/money';
import { slugify } from '@/utils/genericFunctions';

let nextRowId = 0;
const rowId = () => `row-${(nextRowId += 1)}`;

/** "trim=DLX; colour=Red" ↔ { trim: 'DLX', colour: 'Red' } */
const attrsToText = (attrs = {}) =>
  Object.entries(attrs)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
const textToAttrs = (text) =>
  Object.fromEntries(
    text
      .split(';')
      .map((pair) => pair.split('=').map((part) => part.trim()))
      .filter(([key, value]) => key && value),
  );

/**
 * Initial form state from a product (or empty for a new one).
 * @param {Object|null} product - Admin product
 * @returns {Object} Form state
 */
const initialState = (product) => ({
  categoryId: product?.categoryId || '',
  brand: product?.brand || '',
  model: product?.model || '',
  description: product?.description || '',
  tags: (product?.tags || []).join(', '),
  active: product?.active ?? false,
  variants: (product?.variants || []).map((v) => ({
    id: rowId(),
    key: v.key,
    name: v.name,
    attrs: attrsToText(v.attrs),
  })),
  specs: Object.entries(product?.specs || {}).map(([key, value]) => ({
    id: rowId(),
    key,
    value: String(value),
  })),
  prices: (product?.prices || []).map((price) =>
    createPriceRow({
      cityId: price.cityId,
      variantKey: price.variantKey || '',
      mrp: paiseToRupeesInput(price.mrpPaise),
      exShowroom: paiseToRupeesInput(price.exShowroomPaise),
      onRoad: paiseToRupeesInput(price.onRoadPaise),
    }),
  ),
});

/**
 * Validate the form and build the API payload.
 * @param {Object} state - Form state
 * @returns {{ values?: Object, error?: string }}
 */
const toPayload = (state) => {
  if (!state.categoryId) return { error: 'Choose a category' };
  if (!state.brand.trim() || !state.model.trim()) return { error: 'Brand and model are required' };

  const variants = state.variants
    .filter((v) => v.name.trim())
    .map((v) => ({
      key: v.key || slugify(v.name),
      name: v.name.trim(),
      attrs: textToAttrs(v.attrs),
    }));
  const variantKeys = new Set(variants.map((v) => v.key));

  const prices = [];
  for (const [index, row] of state.prices.entries()) {
    const amounts = {
      mrpPaise: rupeesInputToPaise(row.mrp),
      exShowroomPaise: rupeesInputToPaise(row.exShowroom),
      onRoadPaise: rupeesInputToPaise(row.onRoad),
    };
    if (Object.values(amounts).some((value) => value === undefined)) {
      return { error: `Price row ${index + 1}: prices must be numbers with up to 2 decimals` };
    }
    if (!row.cityId) return { error: `Price row ${index + 1}: choose a city` };
    if (Object.values(amounts).every((value) => value === null)) {
      return { error: `Price row ${index + 1}: enter MRP, ex-showroom or on-road` };
    }
    if (row.variantKey && !variantKeys.has(row.variantKey)) {
      return { error: `Price row ${index + 1}: its variant was removed` };
    }
    prices.push({ cityId: row.cityId, variantKey: row.variantKey || null, ...amounts });
  }

  return {
    values: {
      categoryId: state.categoryId,
      brand: state.brand.trim(),
      model: state.model.trim(),
      description: state.description.trim(),
      tags: state.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
      variants,
      specs: Object.fromEntries(
        state.specs.filter((s) => s.key.trim()).map((s) => [s.key.trim(), s.value.trim()]),
      ),
      prices,
      active: state.active,
    },
  };
};

/**
 * @param {Object} props
 * @param {Object|null} props.product - Product to edit (null = new)
 * @param {Object[]} props.categories - All categories
 * @param {Object[]} props.cities - All cities
 * @returns {JSX.Element}
 */
export default function ProductForm({ product, categories, cities }) {
  const router = useRouter();
  const saveProduct = useSaveProduct();
  const [state, setState] = useState(() => initialState(product));
  const [error, setError] = useState(null);
  const [savedAt, setSavedAt] = useState(null);

  const set = (key) => (event) =>
    setState((current) => ({ ...current, [key]: event.target.value }));
  const setList = (key) => (rows) => setState((current) => ({ ...current, [key]: rows }));

  const leafCategories = useMemo(() => {
    const parentIds = new Set(categories.map((category) => category.parentId).filter(Boolean));
    const parentNames = new Map(categories.map((category) => [category.id, category.name]));
    return categories
      .filter((category) => !parentIds.has(category.id) && category.parentId)
      .map((category) => ({
        ...category,
        label: `${parentNames.get(category.parentId)} → ${category.name}`,
      }));
  }, [categories]);

  const currentVariants = state.variants
    .filter((v) => v.name.trim())
    .map((v) => ({ key: v.key || slugify(v.name), name: v.name.trim() }));

  /** Validate and save, then go to the product's page when it is new. */
  const handleSubmit = async (event) => {
    event.preventDefault();
    const { values, error: validationError } = toPayload(state);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    try {
      const saved = await saveProduct.mutateAsync({ productId: product?.id, values });
      setSavedAt(new Date());
      if (!product) router.replace(`/admin/products/${saved.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      {product?.needsPriceReview ? (
        <div className="flex items-start gap-3 rounded-card border border-warning/40 bg-warning/10 p-4">
          <TriangleAlert className="mt-0.5 size-5 shrink-0 text-warning-text" aria-hidden="true" />
          <p className="text-sm text-ink">
            These prices came from an import and have not been checked. Verify every city price,
            then switch the product <strong>Live</strong> and save.
          </p>
        </div>
      ) : null}
      {error ? <Alert>{error}</Alert> : null}

      <section className="grid grid-cols-1 gap-4 rounded-card border border-line bg-surface p-4 shadow-card sm:p-6 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-semibold text-ink">Category</span>
          <select
            value={state.categoryId}
            onChange={set('categoryId')}
            className="min-h-11 rounded-button border border-line bg-surface px-3 text-ink"
            required
          >
            <option value="">Choose a category</option>
            {leafCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <Input label="Brand" value={state.brand} onChange={set('brand')} required />
        <Input label="Model" value={state.model} onChange={set('model')} required />
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-sm font-semibold text-ink">Description</span>
          <textarea
            value={state.description}
            onChange={set('description')}
            rows={3}
            maxLength={2000}
            className="rounded-button border border-line bg-surface px-4 py-3 text-ink focus:border-primary focus:outline-none"
          />
        </label>
        <div className="md:col-span-2">
          <Input
            label="Search tags"
            hint="Comma separated, e.g. scooter, automatic, petrol"
            value={state.tags}
            onChange={set('tags')}
          />
        </div>
        <div className="flex items-center justify-between gap-3 rounded-button bg-bg-band px-4 py-2 md:col-span-2">
          <div>
            <p className="font-semibold text-ink">
              {state.active ? 'Live — buyers can see it' : 'Hidden from buyers'}
            </p>
            <p className="text-sm text-muted">Switch on only after the prices are verified.</p>
          </div>
          <Toggle
            checked={state.active}
            label="Visible to buyers"
            onChange={(active) => setState((current) => ({ ...current, active }))}
          />
        </div>
      </section>

      <section className="flex flex-col gap-8 rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
        <RowListEditor
          title="Variants"
          hint="Trims, colours or storage options. Leave empty if the product has one version."
          rows={state.variants}
          onChange={setList('variants')}
          createRow={() => ({ id: rowId(), key: '', name: '', attrs: '' })}
          addLabel="Add variant"
          renderRow={(row, update) => (
            <>
              <Input
                label="Variant name"
                value={row.name}
                onChange={(e) => update({ name: e.target.value })}
              />
              <Input
                label="Details"
                hint="e.g. trim=DLX; colour=Red"
                value={row.attrs}
                onChange={(e) => update({ attrs: e.target.value })}
              />
            </>
          )}
        />
        <RowListEditor
          title="Key specs"
          rows={state.specs}
          onChange={setList('specs')}
          createRow={() => ({ id: rowId(), key: '', value: '' })}
          addLabel="Add spec"
          renderRow={(row, update) => (
            <>
              <Input
                label="Name"
                value={row.key}
                onChange={(e) => update({ key: e.target.value })}
              />
              <Input
                label="Value"
                value={row.value}
                onChange={(e) => update({ value: e.target.value })}
              />
            </>
          )}
        />
        <PricesEditor
          rows={state.prices}
          onChange={setList('prices')}
          cities={cities}
          variants={currentVariants}
        />
      </section>

      {product ? (
        <section className="rounded-card border border-line bg-surface p-4 shadow-card sm:p-6">
          <ProductImages product={product} />
        </section>
      ) : (
        <p className="text-sm text-muted">Save the product first to add images.</p>
      )}

      <div className="sticky bottom-0 -mx-4 flex flex-col-reverse items-stretch gap-3 border-t border-line bg-bg-band/95 px-4 py-3 backdrop-blur sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:rounded-card sm:border">
        {savedAt ? <p className="text-sm font-medium text-savings-text">Saved</p> : null}
        <Button variant="ghost" href="/admin/products">
          Back to products
        </Button>
        <Button type="submit" disabled={saveProduct.isPending}>
          {saveProduct.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
          {product ? 'Save changes' : 'Create product'}
        </Button>
      </div>
    </form>
  );
}
