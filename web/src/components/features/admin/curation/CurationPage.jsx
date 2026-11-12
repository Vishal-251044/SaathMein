'use client';

/**
 * CurationPage — Admin → Curation (F34): home banners (title + Hindi / Marathi, image,
 * in-app link, city, dates, order), featured group deals, and the category order used on
 * the home screen. Owner and Admin.
 */
import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ImagePlus,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Star,
  Trash2,
} from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import Toggle from '@/components/ui/Toggle';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { useAdminCategories } from '@/hooks/useAdminCatalog';
import { useAdminCities } from '@/hooks/useAdminCities';
import { useAdminGroups } from '@/hooks/useAdminGroups';
import {
  useCreateCuration,
  useCuration,
  useDeleteCuration,
  useSaveCategoryOrder,
  useUpdateCuration,
} from '@/hooks/useAdminDiscovery';
import { uploadBannerImage } from '@/services/adminDiscovery.service';
import { formatDateTime } from '@/utils/genericFunctions';

const EMPTY_BANNER = {
  title: '',
  titleHi: '',
  titleMr: '',
  subtitle: '',
  linkPath: '',
  cityId: '',
  startsAt: '',
  endsAt: '',
};

/** Date input value → ISO, or null. */
const toIso = (value) => (value ? new Date(value).toISOString() : null);

/** Card wrapper. */
function Section({ title, description, children }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Active toggle + order arrows + delete for one item. */
function ItemControls({ item, items }) {
  const update = useUpdateCuration();
  const remove = useDeleteCuration();
  const siblings = items.filter((other) => other.type === item.type);
  const index = siblings.findIndex((other) => other.id === item.id);
  const move = (delta) => {
    const other = siblings[index + delta];
    if (!other) return;
    update.mutate({ itemId: item.id, changes: { order: other.order } });
    update.mutate({ itemId: other.id, changes: { order: item.order } });
  };
  return (
    <div className="flex items-center gap-1">
      <Toggle
        checked={item.active}
        onChange={(active) => update.mutate({ itemId: item.id, changes: { active } })}
        label={item.active ? 'Shown on home' : 'Hidden'}
      />
      <button
        type="button"
        aria-label="Move up"
        disabled={index === 0}
        onClick={() => move(-1)}
        className="grid size-11 place-items-center rounded-button text-muted hover:bg-bg-band disabled:opacity-40"
      >
        <ArrowUp className="size-4" strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Move down"
        disabled={index === siblings.length - 1}
        onClick={() => move(1)}
        className="grid size-11 place-items-center rounded-button text-muted hover:bg-bg-band disabled:opacity-40"
      >
        <ArrowDown className="size-4" strokeWidth={2} aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Remove"
        onClick={() => remove.mutate(item.id)}
        className="grid size-11 place-items-center rounded-button text-muted hover:bg-bg-band hover:text-danger"
      >
        <Trash2 className="size-4" strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

/** Banners list + form. */
function Banners({ items, cities }) {
  const create = useCreateCuration();
  const [form, setForm] = useState(EMPTY_BANNER);
  const [file, setFile] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const banners = items.filter((item) => item.type === 'banner');
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const submit = async (event) => {
    event.preventDefault();
    setUploadError(null);
    let image = null;
    if (file) {
      setIsUploading(true);
      try {
        image = await uploadBannerImage(file);
      } catch (err) {
        setUploadError(err.message);
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }
    create.mutate(
      {
        type: 'banner',
        title: form.title.trim(),
        titleTranslations: {
          ...(form.titleHi ? { hi: form.titleHi } : {}),
          ...(form.titleMr ? { mr: form.titleMr } : {}),
        },
        subtitle: form.subtitle.trim() || undefined,
        linkPath: form.linkPath.trim() || null,
        cityId: form.cityId || null,
        startsAt: toIso(form.startsAt),
        endsAt: toIso(form.endsAt),
        order: banners.length,
        ...(image ? { image } : {}),
      },
      {
        onSuccess: () => {
          setForm(EMPTY_BANNER);
          setFile(null);
        },
      },
    );
  };

  return (
    <Section
      title="Home banners"
      description="Shown at the top of the buyer home screen. Links open screens inside the app only."
    >
      {banners.length ? (
        <ul className="mb-5 divide-y divide-line rounded-button border border-line">
          {banners.map((banner) => (
            <li key={banner.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              {banner.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.imageUrl}
                  alt=""
                  className="h-12 w-20 rounded-button object-cover"
                />
              ) : (
                <div className="h-12 w-20 rounded-button bg-sunrise" aria-hidden="true" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{banner.title}</p>
                <p className="truncate text-xs text-muted">
                  {banner.linkPath || 'No link'} ·{' '}
                  {banner.cityId
                    ? cities.find((city) => city.id === banner.cityId)?.name
                    : 'All cities'}
                  {banner.endsAt ? ` · until ${formatDateTime(banner.endsAt)}` : ''}
                </p>
              </div>
              <ItemControls item={banner} items={items} />
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Title (English)"
          value={form.title}
          onChange={set('title')}
          maxLength={80}
          required
        />
        <Input
          label="Subtitle (optional)"
          value={form.subtitle}
          onChange={set('subtitle')}
          maxLength={160}
        />
        <Input
          label="Title in Hindi (optional)"
          value={form.titleHi}
          onChange={set('titleHi')}
          maxLength={80}
        />
        <Input
          label="Title in Marathi (optional)"
          value={form.titleMr}
          onChange={set('titleMr')}
          maxLength={80}
        />
        <Input
          label="Link inside the app (optional)"
          value={form.linkPath}
          onChange={set('linkPath')}
          placeholder="/category/<id> or /groups/browse?type=seller_led"
        />
        <Select label="City" value={form.cityId} onChange={set('cityId')}>
          <option value="">All cities</option>
          {cities.map((city) => (
            <option key={city.id} value={city.id}>
              {city.name}
            </option>
          ))}
        </Select>
        <Input
          label="Starts (optional)"
          type="datetime-local"
          value={form.startsAt}
          onChange={set('startsAt')}
        />
        <Input
          label="Ends (optional)"
          type="datetime-local"
          value={form.endsAt}
          onChange={set('endsAt')}
        />
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm font-semibold text-ink sm:col-span-2">
          <ImagePlus className="size-5 text-muted" strokeWidth={2} aria-hidden="true" />
          {file ? file.name : 'Add an image (optional, 16:9)'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] || null)}
          />
        </label>
        {uploadError ? <Alert className="sm:col-span-2">{uploadError}</Alert> : null}
        {create.isError ? <Alert className="sm:col-span-2">{create.error.message}</Alert> : null}
        <Button
          type="submit"
          className="sm:col-span-2 sm:justify-self-start"
          disabled={!form.title.trim() || create.isPending || isUploading}
        >
          {create.isPending || isUploading ? (
            <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
          ) : (
            <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          )}
          Add banner
        </Button>
      </form>
    </Section>
  );
}

/** Featured groups: search live public groups and feature them. */
function FeaturedGroups({ items }) {
  const create = useCreateCuration();
  const [search, setSearch] = useState('');
  const q = useDebouncedValue(search.trim(), 300);
  const results = useAdminGroups({
    q: q || undefined,
    status: 'open',
    visibility: 'public',
    limit: 8,
    page: 1,
  });
  const featured = items.filter((item) => item.type === 'featured_group');
  const featuredIds = new Set(featured.map((item) => item.groupId));

  return (
    <Section title="Featured deals" description="Pinned first on the home screen in their city.">
      {featured.length ? (
        <ul className="mb-5 divide-y divide-line rounded-button border border-line">
          {featured.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <Star className="size-5 text-muted" strokeWidth={2} aria-hidden="true" />
              <p className="min-w-0 flex-1 truncate font-mono text-sm text-ink">{item.groupId}</p>
              <ItemControls item={item} items={items} />
            </li>
          ))}
        </ul>
      ) : null}
      <label className="relative block">
        <span className="sr-only">Search open groups</span>
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
          strokeWidth={2}
          aria-hidden="true"
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search open groups by product or invite code"
          className="min-h-11 w-full rounded-button border border-line bg-surface pl-9 pr-3 text-ink focus:border-primary focus:outline-none"
        />
      </label>
      {create.isError ? <Alert className="mt-3">{create.error.message}</Alert> : null}
      <ul className="mt-3 flex flex-col gap-2">
        {(results.data?.groups || []).map((group) => (
          <li
            key={group.id}
            className="flex items-center justify-between gap-3 rounded-button bg-bg-band px-4 py-2"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink">{group.productName}</span>
              <span className="text-xs text-muted">
                {group.cityName} · {group.memberCount} of {group.targetSize}
              </span>
            </span>
            {featuredIds.has(group.id) ? (
              <Badge tone="brand">Featured</Badge>
            ) : (
              <Button
                variant="secondary"
                disabled={create.isPending}
                onClick={() =>
                  create.mutate({
                    type: 'featured_group',
                    groupId: group.id,
                    cityId: group.cityId,
                    order: featured.length,
                  })
                }
              >
                <Star className="size-4" strokeWidth={2} aria-hidden="true" />
                Feature
              </Button>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Top-level category order. */
function CategoryOrder() {
  const categories = useAdminCategories();
  const save = useSaveCategoryOrder();
  const parents = useMemo(
    () =>
      (categories.data || [])
        .filter((category) => !category.parentId)
        .sort((a, b) => a.order - b.order),
    [categories.data],
  );
  const [order, setOrder] = useState(null);
  const list = order || parents;

  const move = (index, delta) => {
    const next = [...list];
    const [item] = next.splice(index, 1);
    next.splice(index + delta, 0, item);
    setOrder(next);
  };

  return (
    <Section
      title="Category order"
      description="Order of categories on the home screen and in browse."
    >
      {categories.isPending ? (
        <div className="h-32 animate-pulse rounded-button bg-bg-band" aria-busy="true" />
      ) : (
        <ol className="flex flex-col gap-2">
          {list.map((category, index) => (
            <li
              key={category.id}
              className="flex items-center gap-2 rounded-button bg-bg-band px-4 py-2"
            >
              <span className="w-6 text-sm text-muted">{index + 1}</span>
              <span className="flex-1 font-semibold text-ink">{category.name}</span>
              <button
                type="button"
                aria-label={`Move ${category.name} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
                className="grid size-11 place-items-center rounded-button text-muted hover:bg-surface disabled:opacity-40"
              >
                <ArrowUp className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Move ${category.name} down`}
                disabled={index === list.length - 1}
                onClick={() => move(index, 1)}
                className="grid size-11 place-items-center rounded-button text-muted hover:bg-surface disabled:opacity-40"
              >
                <ArrowDown className="size-4" strokeWidth={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}
      {save.isError ? <Alert className="mt-3">{save.error.message}</Alert> : null}
      {save.isSuccess && !order ? (
        <Alert tone="info" className="mt-3">
          Category order saved.
        </Alert>
      ) : null}
      <Button
        className="mt-4"
        disabled={!order || save.isPending}
        onClick={() =>
          save.mutate(
            list.map((category, index) => ({ id: category.id, order: index })),
            { onSuccess: () => setOrder(null) },
          )
        }
      >
        {save.isPending ? (
          <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
        ) : (
          <Save className="size-4" strokeWidth={2} aria-hidden="true" />
        )}
        Save order
      </Button>
    </Section>
  );
}

/** @returns {JSX.Element} */
export default function CurationPage() {
  const curation = useCuration();
  const cities = useAdminCities();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Curation</h1>
        <p className="mt-1 text-muted">What buyers see first on the home screen.</p>
      </div>
      {curation.isError ? (
        <div className="flex flex-col items-start gap-3">
          <Alert>{curation.error.message}</Alert>
          <Button variant="secondary" onClick={() => curation.refetch()}>
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : curation.isPending ? (
        <div className="h-64 animate-pulse rounded-card bg-surface" aria-busy="true" />
      ) : (
        <>
          <Banners items={curation.data} cities={cities.data || []} />
          <FeaturedGroups items={curation.data} />
        </>
      )}
      <CategoryOrder />
    </div>
  );
}
