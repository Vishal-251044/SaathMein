'use client';

/**
 * SellerProfileForm — /seller/profile (PRD §10.10 Profile): contact details, coverage
 * (cities + categories decide which auctions a dealer can join, AUC-1) and the shop
 * location used for "distance from you" on buyer cards. Staff see it read-only.
 */
import { useState } from 'react';
import { Check, Loader2, LocateFixed, MapPin, RefreshCw, Save } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import FadeIn from '@/components/animations/FadeIn';
import {
  usePublicCategories,
  usePublicCities,
  useSellerMe,
  useUpdateSellerProfile,
} from '@/hooks/useSeller';
import { cn } from '@/utils/genericFunctions';

/**
 * Selectable chip (toggle button).
 * @param {{ selected: boolean, onToggle: () => void, disabled?: boolean, children: React.ReactNode }} props
 * @returns {JSX.Element}
 */
function Chip({ selected, onToggle, disabled, children }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        'inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed',
        selected
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-line bg-surface text-ink hover:bg-bg-band',
      )}
    >
      {selected ? <Check className="size-4" strokeWidth={2.5} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

/**
 * Toggle an id in a list.
 * @param {string[]} list - Current ids
 * @param {string} id - Id to toggle
 * @returns {string[]}
 */
const toggle = (list, id) =>
  list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

/** Section card. */
function Section({ title, text, children }) {
  return (
    <FadeIn
      as="section"
      className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-6"
    >
      <h2 className="text-lg font-bold text-ink">{title}</h2>
      {text ? <p className="mt-0.5 text-sm text-muted">{text}</p> : null}
      <div className="mt-4">{children}</div>
    </FadeIn>
  );
}

/**
 * @returns {JSX.Element}
 */
export default function SellerProfileForm() {
  const { data: seller } = useSellerMe();
  const cities = usePublicCities();
  const categories = usePublicCategories();
  const update = useUpdateSellerProfile();
  const isOwner = seller.role === 'owner';
  const isNameLocked = ['pending', 'approved'].includes(seller.kyc.status);

  const [values, setValues] = useState({
    businessName: seller.businessName || '',
    contactName: seller.contactName || '',
    contactPhone: (seller.contactPhone || '').replace(/^\+91/, ''),
    cities: seller.cities,
    categories: seller.categories,
    location: seller.location,
  });
  const [locationError, setLocationError] = useState(null);
  const [isLocating, setIsLocating] = useState(false);
  const [saved, setSaved] = useState(false);

  const set = (key) => (event) => {
    setSaved(false);
    setValues((prev) => ({ ...prev, [key]: event.target.value }));
  };

  /** Use the browser's location for the shop (asks permission). */
  const locateShop = () => {
    if (!navigator.geolocation) {
      setLocationError('This browser cannot share a location.');
      return;
    }
    setIsLocating(true);
    setLocationError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setValues((prev) => ({ ...prev, location: [coords.longitude, coords.latitude] }));
        setSaved(false);
        setIsLocating(false);
      },
      () => {
        setLocationError('Location permission was denied. Allow it in your browser and try again.');
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  /** Save the profile. */
  const handleSubmit = (event) => {
    event.preventDefault();
    setSaved(false);
    update.mutate(
      {
        ...(isNameLocked ? {} : { businessName: values.businessName.trim() }),
        contactName: values.contactName.trim(),
        contactPhone: values.contactPhone.replace(/[\s-]/g, ''),
        cities: values.cities,
        categories: values.categories,
        ...(values.location ? { location: values.location } : {}),
      },
      { onSuccess: () => setSaved(true) },
    );
  };

  const isLoadingLists = cities.isPending || categories.isPending;
  const listError = cities.error || categories.error;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" noValidate>
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Business profile</h1>
        <p className="mt-1 text-muted">
          {isOwner
            ? 'Buyers see your business name, area and rating.'
            : 'Only the account owner can change these details.'}
        </p>
      </div>

      <Section title="Business and contact">
        <div className="flex flex-col gap-4">
          <Input
            label="Business name"
            value={values.businessName}
            onChange={set('businessName')}
            disabled={!isOwner || isNameLocked}
            hint={
              isNameLocked ? 'Verified with your KYC. Contact support to change it.' : undefined
            }
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              label="Contact person"
              value={values.contactName}
              onChange={set('contactName')}
              disabled={!isOwner}
            />
            <Input
              label="Business mobile"
              type="tel"
              inputMode="tel"
              maxLength={10}
              value={values.contactPhone}
              onChange={set('contactPhone')}
              disabled={!isOwner}
            />
          </div>
        </div>
      </Section>

      {listError ? (
        <Alert>
          {listError.message}{' '}
          <button
            type="button"
            className="inline-flex items-center gap-1 font-semibold underline"
            onClick={() => {
              cities.refetch();
              categories.refetch();
            }}
          >
            <RefreshCw className="size-3.5" strokeWidth={2} aria-hidden="true" />
            Retry
          </button>
        </Alert>
      ) : null}

      <Section title="Cities you serve" text="You can join auctions for groups in these cities.">
        {isLoadingLists ? (
          <div className="h-11 w-2/3 animate-pulse rounded-full bg-bg-band" />
        ) : (
          <div className="flex flex-wrap gap-2">
            {(cities.data || []).map((city) => (
              <Chip
                key={city.id}
                selected={values.cities.includes(city.id)}
                disabled={!isOwner}
                onToggle={() => {
                  setSaved(false);
                  setValues((prev) => ({ ...prev, cities: toggle(prev.cities, city.id) }));
                }}
              >
                {city.name}
              </Chip>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="What you sell"
        text="Pick every category you can supply. Vehicle dealers need an authorised dealer certificate."
      >
        {isLoadingLists ? (
          <div className="h-24 animate-pulse rounded-button bg-bg-band" />
        ) : (
          <div className="flex flex-col gap-5">
            {(categories.data || []).map((parent) => (
              <div key={parent.id}>
                <p className="mb-2 text-xs font-bold uppercase tracking-wider text-muted">
                  {parent.name}
                </p>
                <div className="flex flex-wrap gap-2">
                  {parent.children.map((category) => (
                    <Chip
                      key={category.id}
                      selected={values.categories.includes(category.id)}
                      disabled={!isOwner}
                      onToggle={() => {
                        setSaved(false);
                        setValues((prev) => ({
                          ...prev,
                          categories: toggle(prev.categories, category.id),
                        }));
                      }}
                    >
                      {category.name}
                    </Chip>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Shop location"
        text="Used to show buyers how far your shop is. Stand inside your shop when you set it."
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <p className="flex min-w-0 flex-1 items-center gap-2 text-sm text-ink">
            <MapPin className="size-4 shrink-0 text-muted" strokeWidth={2} aria-hidden="true" />
            {values.location
              ? `Set (${values.location[1].toFixed(5)}, ${values.location[0].toFixed(5)})`
              : 'Not set yet'}
          </p>
          {isOwner ? (
            <Button variant="secondary" onClick={locateShop} disabled={isLocating}>
              {isLocating ? (
                <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
              ) : (
                <LocateFixed className="size-4" strokeWidth={2} aria-hidden="true" />
              )}
              Use my current location
            </Button>
          ) : null}
        </div>
        {locationError ? <Alert className="mt-3">{locationError}</Alert> : null}
      </Section>

      {isOwner ? (
        <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-line bg-bg-band/95 px-4 py-4 backdrop-blur-md sm:mx-0 sm:flex-row sm:items-center sm:rounded-card sm:border sm:px-5">
          <div className="min-w-0 flex-1 text-sm">
            {update.isError ? (
              <p className="font-medium text-danger">{update.error.message}</p>
            ) : null}
            {saved ? <p className="font-semibold text-primary">Profile saved</p> : null}
            {!values.cities.length || !values.categories.length ? (
              <p className="text-muted">Choose at least one city and one category.</p>
            ) : null}
          </div>
          <Button
            type="submit"
            disabled={update.isPending || !values.cities.length || !values.categories.length}
          >
            {update.isPending ? (
              <Loader2 className="size-4 animate-spin" strokeWidth={2} aria-hidden="true" />
            ) : (
              <Save className="size-4" strokeWidth={2} aria-hidden="true" />
            )}
            Save profile
          </Button>
        </div>
      ) : null}
    </form>
  );
}
