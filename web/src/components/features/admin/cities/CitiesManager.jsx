'use client';

/**
 * CitiesManager — Admin → Cities (CAT-4): launch cities and their areas, with loading
 * skeletons, error retry and an empty state.
 */
import { useState } from 'react';
import { MapPinned, Plus, RefreshCw } from 'lucide-react';
import Button from '@/components/ui/Button';
import Alert from '@/components/ui/Alert';
import FadeIn from '@/components/animations/FadeIn';
import CityCard from '@/components/features/admin/cities/CityCard';
import NewCityForm from '@/components/features/admin/cities/NewCityForm';
import { useAdminCities } from '@/hooks/useAdminCities';

/** Placeholder cards while cities load. */
function CitiesSkeleton() {
  return (
    <div className="flex flex-col gap-4" aria-busy="true">
      {[0, 1].map((key) => (
        <div key={key} className="h-24 animate-pulse rounded-card border border-line bg-surface" />
      ))}
      <span className="sr-only">Loading cities</span>
    </div>
  );
}

/**
 * @returns {JSX.Element}
 */
export default function CitiesManager() {
  const { data: cities, isPending, isError, error, refetch, isFetching } = useAdminCities();
  const [isCreating, setIsCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <FadeIn className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold tracking-tight text-ink">
            Cities
          </h1>
          <p className="mt-1 text-muted">
            Launch cities and areas. Buyers see only cities and areas that are switched on.
          </p>
        </div>
        <Button onClick={() => setIsCreating(true)} disabled={isCreating}>
          <Plus className="size-4" strokeWidth={2} aria-hidden="true" />
          Add city
        </Button>
      </FadeIn>

      {isCreating ? <NewCityForm onDone={() => setIsCreating(false)} /> : null}

      {isPending ? <CitiesSkeleton /> : null}

      {isError ? (
        <div className="flex flex-col gap-3">
          <Alert>{error.message}</Alert>
          <Button
            variant="secondary"
            onClick={() => refetch()}
            disabled={isFetching}
            className="self-start"
          >
            <RefreshCw className="size-4" strokeWidth={2} aria-hidden="true" />
            Try again
          </Button>
        </div>
      ) : null}

      {cities && cities.length === 0 ? (
        <div className="flex flex-col items-center rounded-card border border-line bg-surface px-6 py-12 text-center">
          <MapPinned className="size-8 text-muted" strokeWidth={1.75} aria-hidden="true" />
          <p className="mt-4 font-bold text-ink">No cities yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Run <code className="font-mono">npm run seed:cities</code> in the backend to add Pune,
            or add a city here.
          </p>
        </div>
      ) : null}

      {cities?.length ? (
        <div className="flex flex-col gap-4">
          {cities.map((city, index) => (
            <CityCard key={city.id} city={city} defaultOpen={index === 0} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
