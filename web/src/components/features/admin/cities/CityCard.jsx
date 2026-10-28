'use client';

/**
 * CityCard — one city in Admin → Cities: status switch, area list with search, and
 * add / edit / enable-disable for each area.
 */
import { useMemo, useState } from 'react';
import { ChevronDown, MapPin, Pencil, Plus, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import Toggle from '@/components/ui/Toggle';
import AreaForm from '@/components/features/admin/cities/AreaForm';
import { useAddArea, useUpdateArea, useUpdateCity } from '@/hooks/useAdminCities';
import { cn } from '@/utils/genericFunctions';

/**
 * @param {Object} props
 * @param {Object} props.city - City from the admin API
 * @param {boolean} [props.defaultOpen] - Start expanded
 * @returns {JSX.Element}
 */
export default function CityCard({ city, defaultOpen = false }) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const [editingAreaId, setEditingAreaId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const updateCity = useUpdateCity();
  const addArea = useAddArea();
  const updateArea = useUpdateArea();

  const activeAreas = city.areas.filter((area) => area.active).length;
  const visibleAreas = useMemo(() => {
    const term = query.trim().toLowerCase();
    return [...city.areas]
      .sort((a, b) => a.name.localeCompare(b.name))
      .filter(
        (area) =>
          !term ||
          area.name.toLowerCase().includes(term) ||
          area.pincodes.some((pin) => pin.startsWith(term)),
      );
  }, [city.areas, query]);

  return (
    <article className="rounded-card border border-line bg-surface shadow-card">
      <header className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="grid size-11 shrink-0 place-items-center rounded-button bg-bg-band text-primary">
            <MapPin className="size-5" strokeWidth={2} aria-hidden="true" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-lg font-bold text-ink">
              {city.name}
              <span className="ml-2 text-sm font-medium text-muted">
                {[city.nameTranslations?.hi, city.nameTranslations?.mr].filter(Boolean).join(' · ')}
              </span>
            </span>
            <span className="block text-sm text-muted">
              {city.state} · {activeAreas} of {city.areas.length} areas live
            </span>
          </span>
          <ChevronDown
            className={cn(
              'ml-auto size-5 shrink-0 text-muted transition-transform',
              isOpen && 'rotate-180',
            )}
            aria-hidden="true"
          />
        </button>
        <div className="flex items-center gap-2">
          <span
            className={cn('text-sm font-semibold', city.active ? 'text-savings' : 'text-muted')}
          >
            {city.active ? 'Live' : 'Off'}
          </span>
          <Toggle
            checked={city.active}
            label={`${city.name} visible to buyers`}
            disabled={updateCity.isPending}
            onChange={(active) => updateCity.mutate({ cityId: city.id, changes: { active } })}
          />
        </div>
      </header>

      {isOpen ? (
        <div className="flex flex-col gap-4 border-t border-line p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="relative flex-1">
              <span className="sr-only">Search areas</span>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted"
                aria-hidden="true"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by area or pincode"
                className="min-h-11 w-full rounded-button border border-line bg-surface pl-9 pr-3 text-sm text-ink focus:border-primary focus:outline-none"
              />
            </label>
            <Button
              variant="secondary"
              onClick={() => {
                setIsAdding(true);
                setEditingAreaId(null);
              }}
            >
              <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
              Add area
            </Button>
          </div>

          {isAdding ? (
            <AreaForm
              submitLabel="Add area"
              onCancel={() => setIsAdding(false)}
              onSubmit={async (area) => {
                await addArea.mutateAsync({ cityId: city.id, area });
                setIsAdding(false);
              }}
            />
          ) : null}

          {/* Table on wide screens, stacked rows on phones; scrolls inside its own box */}
          <ul className="divide-y divide-line overflow-hidden rounded-button border border-line">
            {visibleAreas.map((area) =>
              editingAreaId === area.id ? (
                <li key={area.id} className="p-3">
                  <AreaForm
                    initial={area}
                    submitLabel="Save area"
                    onCancel={() => setEditingAreaId(null)}
                    onSubmit={async (changes) => {
                      await updateArea.mutateAsync({ cityId: city.id, areaId: area.id, changes });
                      setEditingAreaId(null);
                    }}
                  />
                </li>
              ) : (
                <li key={area.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2">
                  <div className="min-w-0 flex-1 basis-48">
                    <p
                      className={cn(
                        'font-semibold',
                        area.active ? 'text-ink' : 'text-muted line-through',
                      )}
                    >
                      {area.name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {[area.nameTranslations?.hi, area.nameTranslations?.mr]
                        .filter(Boolean)
                        .join(' · ') || 'No translations yet'}
                    </p>
                  </div>
                  <p className="basis-40 font-mono text-xs text-muted">
                    {area.pincodes.length ? area.pincodes.join(', ') : 'No pincode'}
                  </p>
                  <div className="ml-auto flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAreaId(area.id);
                        setIsAdding(false);
                      }}
                      aria-label={`Edit ${area.name}`}
                      className="grid size-11 place-items-center rounded-button text-muted hover:bg-bg-band hover:text-ink"
                    >
                      <Pencil className="size-4" strokeWidth={2} aria-hidden="true" />
                    </button>
                    <Toggle
                      checked={area.active}
                      label={`${area.name} visible to buyers`}
                      onChange={(active) =>
                        updateArea.mutate({ cityId: city.id, areaId: area.id, changes: { active } })
                      }
                    />
                  </div>
                </li>
              ),
            )}
            {visibleAreas.length === 0 ? (
              <li className="px-3 py-6 text-center text-sm text-muted">
                No areas match “{query}”.
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}
    </article>
  );
}
